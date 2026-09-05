import pool from '../../../../config/database';
import { Product } from '../../../../models/types';
import { ITEM_ALERT_COLUMNS, ITEM_ALERT_JOIN, asProductWithItemAlerts } from './item-alert-settings';

export const productLookupRepository = {
  /**
   * Products due a check, carrying their item's alert settings.
   *
   * The alert settings come from the item, not the listing (issue #143). They
   * are aliased rather than selected as bare `i.target_price` alongside `p.*`:
   * that produces two columns of the same name, and which one the driver keeps
   * is an undocumented detail. Getting it wrong would mean alerts firing
   * against a stale threshold -- a silent, hard-to-trace bug -- so the mapping
   * is explicit here instead.
   */
  findDueForRefresh: async (): Promise<Product[]> => {
    const result = await pool.query(
      `SELECT p.*,${ITEM_ALERT_COLUMNS}
       FROM products p
       ${ITEM_ALERT_JOIN}
       WHERE (p.next_check_at IS NULL OR p.next_check_at < CURRENT_TIMESTAMP)
       AND (p.checking_paused IS NULL OR p.checking_paused = false)`
    );
    return result.rows.map(asProductWithItemAlerts);
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
