import pool from '../../../../config/database';
import { RetailerConfig } from '../../../../models/types';

export const retailerQueryRepository = {
  getAll: async (activeOnly: boolean = true): Promise<RetailerConfig[]> => {
    let query = 'SELECT * FROM retailer_configs';
    if (activeOnly) {
      query += ' WHERE active = true';
    }
    query += ' ORDER BY COALESCE(name, domain) ASC';
    const result = await pool.query(query);
    return result.rows;
  },

  getByDomain: async (domain: string, client?: any): Promise<RetailerConfig | null> => {
    const executor = client || pool;
    const result = await executor.query(
      'SELECT * FROM retailer_configs WHERE domain = $1 AND active = true',
      [domain]
    );
    return result.rows[0] || null;
  },

  getByDomainForUpdate: async (domain: string, client?: any): Promise<RetailerConfig | null> => {
    const executor = client || pool;
    const result = await executor.query(
      'SELECT * FROM retailer_configs WHERE domain = $1 AND active = true FOR UPDATE',
      [domain]
    );
    return result.rows[0] || null;
  },

  getConfigForUrl: async (urlLookup: string): Promise<RetailerConfig | null> => {
    // Find the configuration where domain is a prefix of the lookup string,
    // ensuring we respect path/subdomain boundaries (e.g. matching 'apple.com/au' but not 'amazon.com' for 'amazon.com.au')
    const result = await pool.query(
      'SELECT * FROM retailer_configs WHERE (domain = $1 OR $1 ILIKE domain || \'/%\') AND active = true ORDER BY length(domain) DESC LIMIT 1',
      [urlLookup.toLowerCase()]
    );
    return result.rows[0] || null;
  },
};
