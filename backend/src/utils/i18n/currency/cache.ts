import { globalCurrencyRepository, GlobalCurrency, regionalCurrencyRepository, RegionalCurrencyMapping } from '../../../models';
import { logger } from '../../system/logger';

export class CurrencyCache {
  private globalCurrencies: GlobalCurrency[] | null = null;
  private regionalMappings: RegionalCurrencyMapping[] | null = null;
  private expiry = 0;
  private readonly TTL = 60 * 60 * 1000; // 1 hour

  async refresh(): Promise<{ global: GlobalCurrency[], regional: RegionalCurrencyMapping[] }> {
    const now = Date.now();
    if (this.globalCurrencies && this.expiry > now) {
      return { global: this.globalCurrencies, regional: this.regionalMappings! };
    }

    try {
      const [global, regional] = await Promise.all([
        globalCurrencyRepository.getAll(),
        regionalCurrencyRepository.getAll()
      ]);
      this.globalCurrencies = global;
      this.regionalMappings = regional;
      this.expiry = now + this.TTL;
      logger.debug(`CurrencyHelper | Loaded ${global.length} global currencies and ${regional.length} regional mappings.`, 'Currency');
      return { global, regional };
    } catch (error) {
      logger.error('CurrencyHelper | Refresh Failed', 'Currency', error);
      this.globalCurrencies = this.globalCurrencies || [];
      this.regionalMappings = this.regionalMappings || [];
      return { global: this.globalCurrencies, regional: this.regionalMappings };
    }
  }

  async getGlobalCurrencies() {
    const { global } = await this.refresh();
    return global;
  }

  getGlobalCurrenciesSync() {
    return this.globalCurrencies || [];
  }

  async getRegionalMappings() {
    const { regional } = await this.refresh();
    return regional;
  }
}

export const currencyCache = new CurrencyCache();
