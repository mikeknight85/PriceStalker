import cron from 'node-cron';
import { logger } from '../../utils/system/logger';
import { checkPrices } from './tasks/PriceCheckTask';
import { runCleanup } from './tasks/CleanupTask';
import { updateExchangeRates, checkInitialExchangeRates } from './tasks/ExchangeRateTask';

export * from './tasks/PriceCheckTask';
export * from './tasks/CleanupTask';
export * from './tasks/ExchangeRateTask';

/**
 * Starts all scheduled background tasks.
 */
export function startScheduler(): void {
  // 1. Price checks every minute
  cron.schedule('* * * * *', () => {
    checkPrices().catch((err) => logger.error('Scheduler | Price Check | Unhandled error', 'Scheduler', err));
  });

  // 2. Log and notification cleanup every day at 3 AM
  cron.schedule('0 3 * * *', () => {
    runCleanup().catch((err) => logger.error('Scheduler | Cleanup | Unhandled error', 'Scheduler', err));
  });

  // 3. Exchange rate updates every day at 4 AM
  cron.schedule('0 4 * * *', () => {
    updateExchangeRates().catch((err) => logger.error('Scheduler | Exchange Rates | Unhandled error', 'Scheduler', err));
  });

  // 4. Initial startup checks
  checkInitialExchangeRates();

  logger.info('System | Scheduler | Started | Price check (1m)', 'Scheduler');
  logger.info('System | Scheduler | Started | Log cleanup (3am)', 'Scheduler');
  logger.info('System | Scheduler | Started | Exchange rates (4am)', 'Scheduler');
}
