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
      const product = await productRepository.findById(productId, userId);
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
      await productRepository.updateLastChecked(productId, product.refresh_interval);

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
    _client: PoolClient, // Reserved for future transactional needs
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
      await productRepository.update(productId, userId, metadataUpdates);
      logger.debug(`Product ${productId} | Metadata Updated | ${source}`, 'Products');
    }
  }

  /**
   * Handles stock status transitions and history recording.
   */
  private async updateStockState(
    _client: PoolClient,
    productId: number,
    product: Product,
    scrapedData: ScrapedProductWithVoting
  ) {
    if (scrapedData.stockStatus !== product.stock_status) {
      await productRepository.updateStockStatus(productId, scrapedData.stockStatus, scrapedData.aiStatus);
      await stockHistoryRepository.recordChange(productId, scrapedData.stockStatus);
      logger.info(`Product ${productId} | Stock | Changed: ${product.stock_status} -> ${scrapedData.stockStatus}`, 'Products', { product_id: productId });
    }
  }

  /**
   * Records Standard, Member, and Original prices.
   */
  private async recordPrices(
    _client: PoolClient,
    productId: number,
    scrapedData: ScrapedProductWithVoting,
    source: string
  ) {
    if (!scrapedData.price) return;

    // A. Standard Price
    const latestStandardPrice = await priceHistoryRepository.getLatest(productId, 'standard');
    if (!latestStandardPrice || latestStandardPrice.price !== scrapedData.price.price) {
      await priceHistoryRepository.create(
        productId,
        scrapedData.price.price,
        scrapedData.price.currency || 'AUD',
        scrapedData.aiStatus,
        null,
        'standard'
      );

      logger.info(`Product ${productId} | Price | Recorded: ${scrapedData.price.currency || 'AUD'} ${scrapedData.price.price} (${source})`, 'Products', { product_id: productId });

      // Update anchor price for drift tracking
      await productRepository.updateAnchorPrice(productId, scrapedData.price.price);

      // Record extraction method if we're moving to a stable one
      if (scrapedData.selectedMethod) {
        await productRepository.updateExtractionMethod(productId, scrapedData.selectedMethod);
      }
    }

    // B. Member Price
    if (scrapedData.memberPrice) {
      const latestMemberPrice = await priceHistoryRepository.getLatest(productId, 'member-price');
      if (!latestMemberPrice || latestMemberPrice.price !== scrapedData.memberPrice.price) {
        await priceHistoryRepository.create(
          productId,
          scrapedData.memberPrice.price,
          scrapedData.memberPrice.currency || 'AUD',
          scrapedData.aiStatus,
          null,
          'member-price'
        );
      }
    }

    // C. Original Price
    if (scrapedData.originalPrice) {
      const latestOriginalPrice = await priceHistoryRepository.getLatest(productId, 'original-price');
      if (!latestOriginalPrice || latestOriginalPrice.price !== scrapedData.originalPrice.price) {
        await priceHistoryRepository.create(
          productId,
          scrapedData.originalPrice.price,
          scrapedData.originalPrice.currency || 'AUD',
          scrapedData.aiStatus,
          null,
          'original-price'
        );
      }
    }
  }
}

export const productPersistenceService = new ProductPersistenceService();
