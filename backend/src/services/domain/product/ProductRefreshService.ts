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

    // 2. Persist results (DB State Sync)
    await productPersistenceService.saveScrapeResult(productId, userId, scrapedData, 'refresh');

    // Unpause if the product was previously paused but is now available again
    if (product.checking_paused && scrapedData.stockStatus !== 'not_available') {
      logger.info(`Product ${productId} | Status | Page is available again. Resuming checks.`, 'Products', { product_id: productId });
      await productRepository.bulkSetCheckingPaused([productId], userId, false);
      product.checking_paused = false;
    }

    // 3. Handle Notifications (Side-effects of change)
    if (scrapedData.stockStatus !== product.stock_status) {
      if (scrapedData.stockStatus === 'not_available') {
        logger.warn(`Product ${productId} | Status | Page is unavailable (404/410). Pausing further checks.`, 'Products', { product_id: productId });
        await productRepository.bulkSetCheckingPaused([productId], userId, true);
        await productNotificationService.notifyNotAvailable(product);
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
