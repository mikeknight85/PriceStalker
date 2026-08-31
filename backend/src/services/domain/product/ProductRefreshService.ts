import { 
  productRepository, 
  priceHistoryRepository, 
  Product,
} from '../../../models';
import { scrapeProductWithVoting } from '../../scraper';
import { ExtractionMethod } from '../../../types/scraper';
import { logger } from '../../../utils/system/logger';
import { productNotificationService } from './notifications/index';
import { productPersistenceService } from './ProductPersistenceService';
import { isDefinitiveUnavailable, describeUnavailableReason } from '../../../types/availability';

// Consecutive page-gone scrapes required before a product is marked
// not_available, monitoring is paused, and the user is notified.
const PAGE_GONE_THRESHOLD = 3;

/**
 * Consecutive transport failures before the user is told the retailer looks
 * unreachable.
 *
 * Higher than the page-gone threshold, and deliberately does not pause: a
 * timeout is evidence about the network, not about the product, so the right
 * response is to keep trying and say so once it stops looking like a blip.
 */
const SITE_FAILURE_NOTIFY_THRESHOLD = 6;

export class ProductRefreshService {
  /**
   * Refreshes a product by scraping its URL and updating its state.
   * Orchestrates notifications for price drops and stock changes.
   */
  async refreshProduct(product: Product): Promise<any> {
    const productId = product.id;
    const userId = product.user_id;

    const preferredMethod = await productRepository.getPreferredExtractionMethod(productId);
    const anchorPrice = await productRepository.getAnchorPrice(productId);
    const skipAiVerification = await productRepository.isAiVerificationDisabled(productId);
    const skipAiExtraction = await productRepository.isAiExtractionDisabled(productId);

    // 0. Capture state before refresh
    const preScrapePrice = await priceHistoryRepository.getLatest(productId, 'standard');

    // 1. Scrape
    const scrapedData = await scrapeProductWithVoting(
      product.url,
      userId,
      preferredMethod as ExtractionMethod | undefined,
      anchorPrice || undefined,
      skipAiVerification,
      skipAiExtraction,
      undefined,
      productId
    );

    // 1.5 Separate two things that used to be conflated.
    //
    // A *definitive* result -- 404, 410, a redirect to the home page, a soft 404
    // -- is evidence about the product, and after a streak it pauses monitoring
    // and tells the user. Bot walls serve 404 for a while, hence the streak.
    //
    // A *transient* failure -- timeout, DNS, refused connection, a bot challenge
    // -- is evidence about the network or the retailer. It previously produced
    // `unknown`, which preserved the status, counted nothing and recorded
    // nothing, so a retailer could be down for a week leaving no trace. It now
    // counts separately, never pauses, and never marks a product gone.
    const reason = scrapedData.unavailableReason;
    const isDefinitive = isDefinitiveUnavailable(reason);
    const isTransient = !!reason && !isDefinitive;

    if (isTransient) {
      const failures = await productRepository.recordFailure(productId, reason!);
      logger.warn(
        `Product ${productId} | Availability | ${describeUnavailableReason(reason)} (failure ${failures}). Status unchanged.`,
        'Products',
        { product_id: productId }
      );
      if (failures === SITE_FAILURE_NOTIFY_THRESHOLD) {
        // Once, on crossing the threshold -- not every scrape thereafter.
        await productNotificationService.notifyNotAvailable(product, reason!, false);
      }
    } else if (isDefinitive && product.stock_status !== 'not_available') {
      const streak = (product.page_gone_streak || 0) + 1;
      await productRepository.setPageGoneStreak(productId, streak);
      await productRepository.setUnavailableReason(productId, reason!);
      if (streak < PAGE_GONE_THRESHOLD) {
        logger.warn(`Product ${productId} | Status | ${describeUnavailableReason(reason)} (${streak}/${PAGE_GONE_THRESHOLD} consecutive). Keeping status '${product.stock_status}' until the streak completes.`, 'Products', { product_id: productId });
        scrapedData.stockStatus = product.stock_status;
      }
    } else if (!reason) {
      // The page was actually read, so any previous failure state is stale.
      if (product.page_gone_streak) await productRepository.setPageGoneStreak(productId, 0);
      await productRepository.clearFailureState(productId);
    }

    // 2. Persist results (DB State Sync)
    await productPersistenceService.saveScrapeResult(productId, userId, scrapedData, 'refresh');

    // Resume only a pause the system applied. A user who deliberately paused a
    // product does not want it silently resumed because the page came back --
    // that decision is theirs, and previously it was overridden.
    if (product.checking_paused && product.auto_paused && scrapedData.stockStatus !== 'not_available') {
      logger.info(`Product ${productId} | Status | Page is available again. Resuming checks.`, 'Products', { product_id: productId });
      await productRepository.setPaused(productId, false, false);
      await productRepository.setUnavailableReason(productId, null);
      product.checking_paused = false;
      // Close the loop. Without this the lifecycle only ever reports bad news:
      // the user was told monitoring stopped and never told it started again.
      await productNotificationService.notifyProductRestored(product);
    }

    // 3. Handle Notifications (Side-effects of change)
    if (scrapedData.stockStatus !== product.stock_status) {
      if (scrapedData.stockStatus === 'not_available') {
        logger.warn(`Product ${productId} | Status | ${describeUnavailableReason(reason)}. Pausing further checks.`, 'Products', { product_id: productId });
        await productRepository.setPaused(productId, true, false);
        await productNotificationService.notifyNotAvailable(product, reason);
      } else if (
        (product.stock_status === 'out_of_stock' || product.stock_status === 'pre_order' || product.stock_status === 'not_available') && 
        scrapedData.stockStatus === 'in_stock' && 
        product.notify_back_in_stock
      ) {
        await productNotificationService.notifyBackInStock(product, scrapedData);
      }
    }

    if (scrapedData.price) {
      // Check if this was a pre-order product with no prior recorded price
      const isPreOrderNoPrice = product.stock_status === 'pre_order' && (!preScrapePrice || !preScrapePrice.price);
      if (isPreOrderNoPrice) {
        await productNotificationService.notifyPriceAnnounced(product, scrapedData.price);
      }

      if (!preScrapePrice || preScrapePrice.price !== scrapedData.price.price) {
        if (preScrapePrice && product.price_drop_threshold) {
          await productNotificationService.notifyPriceDrop(product, preScrapePrice.price, scrapedData.price);
        }
        if (product.target_price) {
          await productNotificationService.notifyTargetHit(product, preScrapePrice?.price || null, scrapedData.price);
        }
        
        let statusLabel = scrapedData.aiStatus === 'confirmed' ? ' (System confirmed)' : (scrapedData.aiStatus ? ` (AI: ${scrapedData.aiStatus})` : '');
        logger.info(`Product ${productId} | Price | Updated to ${scrapedData.price.currency} ${scrapedData.price.price}${statusLabel}`, 'Products', { product_id: productId });
      }
    }

    return {
      stockStatus: scrapedData.stockStatus,
      aiStatus: scrapedData.aiStatus,
    };
  }
}

export const productRefreshService = new ProductRefreshService();
