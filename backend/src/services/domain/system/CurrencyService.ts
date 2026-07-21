import { globalCurrencyRepository, GlobalCurrency } from '../../../models';

export class CurrencyService {
  /**
   * Get all supported currencies
   */
  async getCurrencies(): Promise<GlobalCurrency[]> {
    return await globalCurrencyRepository.getAll();
  }
}

export const currencyService = new CurrencyService();

