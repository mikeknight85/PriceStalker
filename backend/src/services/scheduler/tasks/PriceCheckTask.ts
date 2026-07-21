import { productRepository } from '../../../models';
import { logger } from '../../../utils/system/logger';
import { systemService } from '../../domain/system';
import { productRefreshService } from '../../domain/product/ProductRefreshService';
import pLimit from 'p-limit';

let isRunning = false;

export async function checkPrices(): Promise<void> {
  if (isRunning) {
    logger.debug('Scheduler | Price Check | Scan already in progress, skipping...', 'Scheduler');
    return;
  }

  isRunning = true;

  // Check if scheduler is disabled globally
  try {
    const settings = await systemService.getSettings();
    const schedulerDisabled = settings.scheduler_disabled;
    if (schedulerDisabled === 'true') {
      logger.debug('Scheduler | Price Check | Scheduler is globally disabled in system settings', 'Scheduler');
      isRunning = false;
      return;
    }
  } catch (err) {
    logger.error('Scheduler | Price Check | Failed to check scheduler_disabled status', 'Scheduler', err);
  }

  // Heartbeat log to DEBUG level
  logger.debug('Scheduler | Heartbeat | Starting scheduled scan', 'Scheduler');

  try {
    // Find all products that are due for a refresh
    const products = await productRepository.findDueForRefresh();
    
    if (products.length > 0) {
      logger.info(`Scheduler | Price Check | Found ${products.length} products to check`, 'Scheduler');

      // Run refreshes with a concurrency limit
      const limit = pLimit(3);
      const tasks = products.map(product => limit(async () => {
        try {
          await productRefreshService.refreshProduct(product);
          
          // Jitter to avoid bot detection patterns
          const delay = 1000 + Math.floor(Math.random() * 2000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } catch (error) {
          logger.error(`Product ${product.id} | Scan | Failed: ${error}`, 'Scheduler', { product_id: product.id, error });
        }
      }));

      await Promise.all(tasks);
    }
  } catch (error) {
    logger.error('Scheduler | Price Check | Error in scheduled scan', 'Scheduler', error);
  } finally {
    if (isRunning) {
      isRunning = false;
      logger.debug('Scheduler | Heartbeat | Scheduled scan complete', 'Scheduler');
    }
  }
}
