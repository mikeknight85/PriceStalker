import { productRepository } from '../../../models';
import { logger } from '../../../utils/system/logger';
import { systemService } from '../../domain/system';
import { productRefreshService } from '../../domain/product/ProductRefreshService';
import { refreshQueueDomain } from '../../domain/product/repositories/product-lookup.repository';
import pLimit from 'p-limit';

let isRunning = false;

/**
 * Minimum gap between two requests to the same retailer, and the extra random
 * spread on top of it.
 *
 * Global pacing was the only pacing there was: `pLimit(3)` plus a 1-3s sleep,
 * both indifferent to who is being asked. A user tracking eight products at one
 * shop therefore made three simultaneous requests to it, then three more a
 * second or two later. Measured against Akamai on target.com.au (issue #67),
 * three requests 800ms apart were served the full product page and the fourth
 * was denied; a client that had been quiet was served. The denial is a score
 * that degrades with volume and recovers with silence, so spacing per retailer
 * is the lever, not total throughput.
 *
 * 30s is deliberately short of the "one request per minute, or slower" the
 * investigation suggests starting from, because the sweep is serialised per
 * retailer: at a minute apart, fifty listings at one shop would hold a sweep
 * open for most of an hour, and the next sweep does not start until this one
 * ends. 30s puts that at 25 minutes for a product on a 6-hour schedule, which
 * is late by nothing anybody can see. Tune it here from the logs.
 */
const DOMAIN_GAP_MS = 30_000;
const DOMAIN_GAP_JITTER_MS = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => { setTimeout(resolve, ms); });
}

/**
 * Serialises work per retailer and spaces it out, while leaving work for
 * different retailers to run in parallel.
 *
 * The wait happens *outside* the concurrency limiter on purpose. Waiting inside
 * it would hold one of the three slots doing nothing, so one busy retailer
 * could starve every other shop in the sweep. Here the limiter is only entered
 * once the retailer's turn has come round.
 *
 * Chaining cannot deadlock against the limiter: each task's predecessor for a
 * retailer is created before it and therefore enters the limiter's FIFO queue
 * no later, so nothing ever waits on a task queued behind it.
 *
 * Exported so the pacing can be tested with a short gap instead of a 30s one.
 */
export function createDomainPacer(gapMs: number, jitterMs: number) {
  const chains = new Map<string, Promise<void>>();

  return function pace(domain: string, task: () => Promise<void>): Promise<void> {
    const previous = chains.get(domain);
    const next = (previous ?? Promise.resolve())
      .then(async () => {
        // The first request to a retailer in a sweep goes straight out; only the
        // ones behind it wait.
        if (previous) await sleep(gapMs + Math.floor(Math.random() * jitterMs));
        await task();
      })
      .catch(error => {
        // One product must not stall the rest of that retailer's queue, and must
        // not reject the whole sweep. The task logs its own failures; this is
        // only the backstop for anything that escapes it.
        logger.error(`Scheduler | Price Check | Paced task failed for ${domain}: ${error}`, 'Scheduler', { error });
      });
    chains.set(domain, next);
    return next;
  };
}

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
    // Find all products that are due for a refresh. The repository returns them
    // interleaved by retailer, so the concurrency slots below hold three
    // different shops rather than three listings from one (issue #67).
    const products = await productRepository.findDueForRefresh();

    if (products.length > 0) {
      logger.info(`Scheduler | Price Check | Found ${products.length} products to check`, 'Scheduler');

      // Run refreshes with a concurrency limit
      const limit = pLimit(3);
      const pace = createDomainPacer(DOMAIN_GAP_MS, DOMAIN_GAP_JITTER_MS);

      const tasks = products.map(product => pace(refreshQueueDomain(product.url), () => limit(async () => {
        try {
          await productRefreshService.refreshProduct(product);

          // Jitter to avoid bot detection patterns
          const delay = 1000 + Math.floor(Math.random() * 2000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } catch (error) {
          logger.error(`Product ${product.id} | Scan | Failed: ${error}`, 'Scheduler', { product_id: product.id, error });
        }
      })));

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
