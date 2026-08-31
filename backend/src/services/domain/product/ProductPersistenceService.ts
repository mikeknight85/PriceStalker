import { 
  productRepository, 
  priceHistoryRepository, 
  stockHistoryRepository, 
} from '../../../models';
import { ScrapedProductWithVoting } from '../../../types/scraper';
import { logger } from '../../../utils/system/logger';
import { syncUserCategories, runAutoRetailerConfig, sanitizeProductName, sanitizeProductImage } from './utils';
import pool from '../../../config/database';
import { PoolClient } from 'pg';
import { configCache, regionalMappingCache } from '../../../utils/cache';
import { Product } from '../../../models/types';

export class ProductPersistenceService {
  /**
   * Saves metadata, price history, and stock history for a product.
   * Handles Standard, Member, and Original prices.
   */
  async saveScrapeResult(
    productId: number, 
    userId: number, 
    scrapedData: ScrapedProductWithVoting,
    source: 'manual-add' | 'refresh' | 'manual-confirm' | 'auto-track',
    manualSelector?: string
  ) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Acquire a session-level advisory lock for this product ID
      // This prevents concurrent updates for the same product
      await client.query('SELECT pg_advisory_xact_lock($1)', [productId]);

      // 1. Fetch current state
      const product = await productRepository.findById(productId, userId, { executor: client });
      if (!product) {
        await client.query('ROLLBACK');
        return;
      }

      // Resolve domain early — needed for cache invalidation post-commit
      const configDomain = await regionalMappingCache.getLookupDomain(product.url);

      // 2. Update metadata (Name/Image)
      await this.updateMetadata(client, productId, userId, product, scrapedData, source);

      // 3. Update stock status and history
      await this.updateStockState(client, productId, product, scrapedData);

      // 4. Record Prices
      await this.recordPrices(client, productId, scrapedData, source);

      // 5. Sync Categories
      if (product.category) {
        await syncUserCategories(userId, product.category);
      }

      // 6. Auto-Retailer Config discovery (participates in THIS transaction)
      await runAutoRetailerConfig({
        url: product.url,
        productId,
        html: scrapedData.html,
        manualSelector,
        scrapedData,
        source,
        client // join outer transaction
      });

      // 7. Reschedule check
      await productRepository.updateLastChecked(productId, product.refresh_interval, client);

      // 7.5 Write needs_price_review = true to DB on refresh if needsReview is true
      if (source === 'refresh' && scrapedData.needsReview) {
        await productRepository.update(productId, userId, { needs_price_review: true }, client);
      }

      await client.query('COMMIT');

      // Flush the in-memory retailer config cache AFTER commit so the next scrape
      // immediately picks up any selector changes confirmed by this save operation.
      configCache.invalidate(configDomain);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Product ${productId} | Persistence | Failed: ${error}`, 'Products', { product_id: productId, error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Updates product metadata if missing or generic.
   */
  private async updateMetadata(
    client: PoolClient,
    productId: number,
    userId: number,
    product: Product,
    scrapedData: ScrapedProductWithVoting,
    source: string
  ) {
    const metadataUpdates: any = {};

    const sanitizedName = sanitizeProductName(scrapedData.name);
    const currentNameIsGeneric = !product.name || sanitizeProductName(product.name) === null;

    if (sanitizedName && currentNameIsGeneric) {
      metadataUpdates.name = sanitizedName;
    }

    const sanitizedImage = sanitizeProductImage(scrapedData.imageUrl, product.image_url);
    if (sanitizedImage) {
      metadataUpdates.image_url = sanitizedImage;
    }

    if (Object.keys(metadataUpdates).length > 0) {
      await productRepository.update(productId, userId, metadataUpdates, client);
      logger.debug(`Product ${productId} | Metadata Updated | ${source}`, 'Products');
    }
  }

  /**
   * Handles stock status transitions and history recording.
   */
  private async updateStockState(
    client: PoolClient,
    productId: number,
    product: Product,
    scrapedData: ScrapedProductWithVoting
  ) {
    // 'unknown' means the scrape could not determine anything (blocked page,
    // failed extraction) — it is not an observation, so never let it
    // overwrite a real previously-known status.
    if (scrapedData.stockStatus === 'unknown' && product.stock_status && product.stock_status !== 'unknown') {
      logger.debug(`Product ${productId} | Stock | Scrape returned unknown; keeping '${product.stock_status}'`, 'Products', { product_id: productId });
      return;
    }

    if (scrapedData.stockStatus !== product.stock_status) {
      await productRepository.updateStockStatus(productId, scrapedData.stockStatus, scrapedData.aiStatus, client);
      await stockHistoryRepository.recordChange(productId, scrapedData.stockStatus, client);
      logger.info(`Product ${productId} | Stock | Changed: ${product.stock_status} -> ${scrapedData.stockStatus}`, 'Products', { product_id: productId });
    }
  }

  /**
   * Records Standard, Member, and Original prices.
   *
   * Every statement runs on the caller's transaction client. These used to run
   * on the shared pool, so a price-history row could commit on its own and
   * survive a rollback of the product write it belonged to -- leaving history
   * that describes a state the product never reached.
   */
  private async recordPrices(
    client: PoolClient,
    productId: number,
    scrapedData: ScrapedProductWithVoting,
    source: string
  ) {
    // A price that still needs a human decision is not authoritative yet.
    // Recording it makes it the current price and the anchor, so a wrong
    // extraction becomes the product's price before anyone has confirmed it.
    // A manual confirmation is the act of reviewing, so it always records.
    const awaitingReview = scrapedData.needsReview === true && source !== 'manual-confirm';

    // A. Standard Price
    if (scrapedData.price && !scrapedData.price.currency) {
      // A price without a resolved currency must never enter history, but the
      // skip has to be loud: arbitration flags it for review, and this log is
      // the trace for why the history did not advance.
      logger.warn(`Product ${productId} | Price | Skipped recording ${scrapedData.price.price}: no currency resolved (${source})`, 'Products', { product_id: productId });
    } else if (awaitingReview && scrapedData.price?.currency) {
      logger.info(`Product ${productId} | Price | Skipped recording ${scrapedData.price.currency} ${scrapedData.price.price}: awaiting review (${source})`, 'Products', { product_id: productId });
    } else if (scrapedData.price?.currency) {
      const latestStandardPrice = await priceHistoryRepository.getLatest(productId, 'standard', client);
      // A manual confirmation always records, even at an unchanged price: the
      // user explicitly verified it, and the fresh row is what repopulates a
      // stale product's history and anchor (issue #55).
      if (source === 'manual-confirm' || this.hasChanged(latestStandardPrice, scrapedData.price)) {
        await priceHistoryRepository.create(
          productId,
          scrapedData.price.price,
          scrapedData.price.currency,
          scrapedData.aiStatus,
          null,
          'standard',
          client
        );

        logger.info(`Product ${productId} | Price | Recorded: ${scrapedData.price.currency} ${scrapedData.price.price} (${source})`, 'Products', { product_id: productId });

        // Update anchor price for drift tracking
        await productRepository.updateAnchorPrice(productId, scrapedData.price.price, client);

        // Record extraction method if we're moving to a stable one
        if (scrapedData.selectedMethod) {
          await productRepository.updateExtractionMethod(productId, scrapedData.selectedMethod, client);
        }
      }
    }

    // B. Member Price
    await this.recordSecondaryPrice(client, productId, scrapedData, source, 'member-price', scrapedData.memberPrice, awaitingReview);

    // C. Original Price
    await this.recordSecondaryPrice(client, productId, scrapedData, source, 'original-price', scrapedData.originalPrice, awaitingReview);
  }

  /**
   * Member and original prices follow the same rules as the standard price,
   * including the missing-currency diagnostic that only the standard price used
   * to emit -- these were skipped silently, so a retailer whose member price
   * never had a resolvable currency looked identical to one that had no member
   * price at all.
   */
  private async recordSecondaryPrice(
    client: PoolClient,
    productId: number,
    scrapedData: ScrapedProductWithVoting,
    source: string,
    priceType: 'member-price' | 'original-price',
    candidate: { price: number; currency?: string | null } | null | undefined,
    awaitingReview: boolean
  ) {
    if (!candidate) return;

    if (!candidate.currency) {
      logger.warn(`Product ${productId} | Price | Skipped recording ${priceType} ${candidate.price}: no currency resolved (${source})`, 'Products', { product_id: productId });
      return;
    }

    if (awaitingReview) {
      logger.info(`Product ${productId} | Price | Skipped recording ${priceType}: awaiting review (${source})`, 'Products', { product_id: productId });
      return;
    }

    const latest = await priceHistoryRepository.getLatest(productId, priceType, client);
    if (this.hasChanged(latest, candidate)) {
      await priceHistoryRepository.create(
        productId,
        candidate.price,
        candidate.currency,
        scrapedData.aiStatus,
        null,
        priceType,
        client
      );
    }
  }

  /**
   * True when the scraped price differs from the last recorded one.
   *
   * Currency is part of the comparison. Comparing the number alone meant a
   * retailer switching 100 USD to 100 AUD wrote no row at all, so the product
   * kept reporting the old currency indefinitely.
   */
  private hasChanged(
    latest: { price: number | string; currency?: string | null } | null,
    candidate: { price: number; currency?: string | null }
  ): boolean {
    if (!latest) return true;
    const latestPrice = typeof latest.price === 'string' ? parseFloat(latest.price) : latest.price;
    return latestPrice !== candidate.price || (latest.currency ?? null) !== (candidate.currency ?? null);
  }

}

export const productPersistenceService = new ProductPersistenceService();
