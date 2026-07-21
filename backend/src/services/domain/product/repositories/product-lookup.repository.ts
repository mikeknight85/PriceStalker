import pool from '../../../../config/database';
import { Product } from '../../../../models/types';

export const productLookupRepository = {
  findDueForRefresh: async (): Promise<Product[]> => {
    const result = await pool.query(
      `SELECT * FROM products
       WHERE (next_check_at IS NULL OR next_check_at < CURRENT_TIMESTAMP)
       AND (checking_paused IS NULL OR checking_paused = false)`
    );
    return result.rows;
  },

  findDuplicateUrl: async (url: string, userId: number): Promise<number | null> => {
    const fuzzyUrl = url.replace(/^https?:\/\/(www\.)?/i, '');
    const result = await pool.query(
      `SELECT id FROM products 
       WHERE user_id = $1 
       AND rtrim(REGEXP_REPLACE(url, '^https?:\/\/(www\\.)?', '', 'i'), '/') = rtrim($2, '/')
       LIMIT 1`,
      [userId, fuzzyUrl]
    );
    return result.rows[0]?.id || null;
  },
};
