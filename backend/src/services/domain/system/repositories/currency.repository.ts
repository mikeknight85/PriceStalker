import pool from '../../../../config/database';
import { RegionalCurrencyMapping, GlobalCurrency, ExchangeRate } from '../../../../models/types';

export const regionalCurrencyRepository = {
  getAll: async (): Promise<RegionalCurrencyMapping[]> => {
    const result = await pool.query(
      'SELECT * FROM regional_currency_mappings WHERE active = true ORDER BY match_type DESC, length(pattern) DESC'
    );
    return result.rows;
  },

  upsert: async (mapping: Partial<RegionalCurrencyMapping>): Promise<RegionalCurrencyMapping> => {
    const result = await pool.query(
      `INSERT INTO regional_currency_mappings (pattern, currency, match_type, active)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (pattern) DO UPDATE SET
         currency = EXCLUDED.currency,
         match_type = EXCLUDED.match_type,
         active = EXCLUDED.active
       RETURNING *`,
      [mapping.pattern, mapping.currency, mapping.match_type, mapping.active ?? true]
    );
    return result.rows[0];
  }
};


export const globalCurrencyRepository = {
  getAll: async (): Promise<GlobalCurrency[]> => {
    const result = await pool.query('SELECT * FROM global_currencies');
    return result.rows;
  },

  findByLocale: async (locale: string): Promise<GlobalCurrency | null> => {
    const result = await pool.query('SELECT * FROM global_currencies WHERE locale = $1 LIMIT 1', [locale]);
    return result.rows[0] || null;
  },

  findByIso: async (iso: string): Promise<GlobalCurrency | null> => {
    const result = await pool.query('SELECT * FROM global_currencies WHERE iso = $1 LIMIT 1', [iso]);
    return result.rows[0] || null;
  }
};


export const exchangeRateRepository = {
  upsert: async (from: string, to: string, rate: number): Promise<void> => {
    await pool.query(
      `INSERT INTO exchange_rates (from_currency, to_currency, rate, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (from_currency, to_currency) DO UPDATE SET
         rate = EXCLUDED.rate,
         updated_at = NOW()`,
      [from.toUpperCase(), to.toUpperCase(), rate]
    );
  },

  getRate: async (from: string, to: string): Promise<number | null> => {
    if (from.toUpperCase() === to.toUpperCase()) return 1.0;
    const result = await pool.query(
      'SELECT rate FROM exchange_rates WHERE from_currency = $1 AND to_currency = $2',
      [from.toUpperCase(), to.toUpperCase()]
    );
    return result.rows[0]?.rate ? parseFloat(result.rows[0].rate) : null;
  },

  getAll: async (): Promise<ExchangeRate[]> => {
    const result = await pool.query('SELECT * FROM exchange_rates');
    return result.rows;
  }
};
