import axios from 'axios';
import { exchangeRateRepository } from '../../../models';
import { logger } from '../../../utils/system/logger';

class CurrencyConversionService {
  private readonly API_URL = 'https://api.frankfurter.dev/v2/rates';
  private readonly DEFAULT_BASE = 'EUR';
  private readonly SOURCE = 'frankfurter-v2-blended';

  /**
   * Fetches latest exchange rates and updates the database.
   * Fetches the provider's complete daily reference-rate set relative to EUR.
   */
  async updateRates(base: string = this.DEFAULT_BASE): Promise<void> {
    try {
      logger.info(`Currency | Updating rates relative to ${base}...`, 'Currency');
      
      const response = await axios.get<Array<{ date: string; base: string; quote: string; rate: number }>>(this.API_URL, {
        params: { base },
        timeout: 10000
      });

      if (!Array.isArray(response.data) || response.data.length === 0) {
        throw new Error(`Unexpected rates response (status ${response.status}): ${JSON.stringify(response.data).slice(0, 300)}`);
      }

      const promises = response.data.map(({ base: rateBase, quote, rate, date }) =>
        exchangeRateRepository.upsert(rateBase, quote, rate, date, this.SOURCE)
      );
      const inversePromises = response.data.map(({ base: rateBase, quote, rate, date }) =>
        exchangeRateRepository.upsert(quote, rateBase, 1 / rate, date, this.SOURCE)
      );

      await Promise.all([...promises, ...inversePromises]);
      logger.info(`Currency | Successfully updated ${response.data.length * 2} exchange rates.`, 'Currency');
    } catch (error: any) {
      logger.error(`Currency | Failed to update exchange rates: ${error.message}`, 'Currency', error);
      throw error;
    }
  }

  /**
   * Converts an amount from one currency to another.
   * If the rate is not in the DB, it tries to fetch it or returns null.
   */
  async convert(amount: number, from: string, to: string): Promise<number | null> {
    if (from.toUpperCase() === to.toUpperCase()) return amount;

    try {
      let rate = await exchangeRateRepository.getRate(from, to);

      if (rate === null) {
        // Try indirect conversion via base currency (AUD)
        const rateToBase = await exchangeRateRepository.getRate(from, this.DEFAULT_BASE);
        const rateFromBase = await exchangeRateRepository.getRate(this.DEFAULT_BASE, to);

        if (rateToBase !== null && rateFromBase !== null) {
          rate = rateToBase * rateFromBase;
        }
      }

      if (rate !== null) {
        return Math.round(amount * rate * 100) / 100;
      }

      logger.warn(`Currency | No exchange rate found for ${from} to ${to}`, 'Currency');
      return null;
    } catch (error: any) {
      logger.error(`Currency | Conversion error: ${error.message}`, 'Currency');
      return null;
    }
  }
}

export const currencyConversionService = new CurrencyConversionService();
