import { exchangeRateRepository } from '../../../models';
import { logger } from '../../../utils/system/logger';
import { currencyConversionService } from '../../currency-conversion';

export async function updateExchangeRates(): Promise<void> {
  try {
    await currencyConversionService.updateRates();
  } catch (error) {
    logger.error('Scheduler | Exchange Rates | Failed to update rates', 'Scheduler', error);
  }
}

export async function checkInitialExchangeRates(): Promise<void> {
  try {
    const rates = await exchangeRateRepository.getAll();
    if (rates.length === 0) {
      logger.info('System | Scheduler | Initial exchange rate fetch triggered', 'Scheduler');
      // An empty table means every conversion is unavailable until the next
      // scheduled run, so retry the boot fetch instead of giving up on one failure.
      for (let attempt = 1; attempt <= 3; attempt++) {
        await currencyConversionService.updateRates().catch(() => null);
        if ((await exchangeRateRepository.getAll()).length > 0) return;
        logger.warn(`Currency | Initial rate fetch attempt ${attempt}/3 left the table empty${attempt < 3 ? ', retrying in 30s' : ''}.`, 'Currency');
        if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 30_000));
      }
    } else {
      // Check for staleness (older than 36 hours)
      const oldestRate = rates.reduce((oldest, current) => {
        return new Date(current.updated_at) < new Date(oldest.updated_at) ? current : oldest;
      }, rates[0]);
      
      const oldestTime = new Date(oldestRate.updated_at).getTime();
      const ageHours = (Date.now() - oldestTime) / (1000 * 60 * 60);
      if (ageHours > 36) {
        logger.warn(`Currency | Exchange rates are stale. Oldest rate (${oldestRate.from_currency} -> ${oldestRate.to_currency}) updated ${ageHours.toFixed(1)} hours ago (threshold: 36h).`, 'Currency');
      } else {
        logger.info(`System | Scheduler | Exchange rates check completed. Oldest rate age: ${ageHours.toFixed(1)} hours.`, 'Scheduler');
      }
    }
  } catch (error) {
    logger.error('Scheduler | Initial Exchange Rates | Check failed', 'Scheduler', error);
  }
}
