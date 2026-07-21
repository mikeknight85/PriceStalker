import axios from 'axios';
import { exchangeRateRepository } from '../../../models';
import { logger } from '../../../utils/system/logger';

class CurrencyConversionService {
  private readonly API_URL = 'https://api.frankfurter.app/latest';
  private readonly DEFAULT_BASE = 'AUD';

  /**
   * Fetches latest exchange rates and updates the database.
   * By default, fetches rates relative to AUD.
   */
  async updateRates(base: string = this.DEFAULT_BASE): Promise<void> {
    try {
      logger.info(`Currency | Updating rates relative to ${base}...`, 'Currency');
      
      const response = await axios.get(this.API_URL, {
        params: { from: base }
      });

      if (response.data && response.data.rates) {
        const rates = response.data.rates;
        const promises = Object.keys(rates).map(currency => 
          exchangeRateRepository.upsert(base, currency, rates[currency])
        );
        
        // Also add the inverse rates for easier lookups
        const inversePromises = Object.keys(rates).map(currency => 
          exchangeRateRepository.upsert(currency, base, 1 / rates[currency])
        );

        await Promise.all([...promises, ...inversePromises]);
        logger.info(`Currency | Successfully updated ${Object.keys(rates).length * 2} exchange rates.`, 'Currency');
      }
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
