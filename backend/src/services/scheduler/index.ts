import cron from 'node-cron';
import { logger } from '../../utils/system/logger';
import { checkPrices } from './tasks/PriceCheckTask';
import { runCleanup } from './tasks/CleanupTask';
import { updateExchangeRates, checkInitialExchangeRates } from './tasks/ExchangeRateTask';
import { refreshAIModels } from './tasks/AIModelRefreshTask';
import { runTelemetryPing } from './tasks/TelemetryTask';

export * from './tasks/PriceCheckTask';
export * from './tasks/CleanupTask';
export * from './tasks/ExchangeRateTask';
export * from './tasks/AIModelRefreshTask';
export * from './tasks/TelemetryTask';

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

  // 4. Model list refresh for every configured AI provider, daily at 5 AM
  cron.schedule('0 5 * * *', () => {
    refreshAIModels().catch((err) => logger.error('Scheduler | AI Models | Unhandled error', 'Scheduler', err));
  });

  // 5. Daily anonymous telemetry heartbeat (with random jitter to prevent load spikes)
  const telemetryJitterMinute = Math.floor(Math.random() * 60);
  cron.schedule(`${telemetryJitterMinute} 6 * * *`, () => {
    runTelemetryPing().catch((err) => logger.debug('Scheduler | Telemetry | Unhandled error', 'Scheduler', err));
  });

  // 6. Initial startup checks
  checkInitialExchangeRates();
  setTimeout(() => {
    runTelemetryPing().catch((err) => logger.debug('Scheduler | Telemetry | Initial ping unhandled error', 'Scheduler', err));
  }, 120_000);

  logger.info('System | Scheduler | Started | Price check (1m)', 'Scheduler');
  logger.info('System | Scheduler | Started | Log cleanup (3am)', 'Scheduler');
  logger.info('System | Scheduler | Started | Exchange rates (4am)', 'Scheduler');
  logger.info('System | Scheduler | Started | AI model refresh (5am)', 'Scheduler');
  logger.info(`System | Scheduler | Started | Telemetry ping (6:${telemetryJitterMinute.toString().padStart(2, '0')}am)`, 'Scheduler');
}
