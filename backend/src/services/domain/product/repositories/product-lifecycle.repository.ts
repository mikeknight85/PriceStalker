import pool from '../../../../config/database';
import { 
  Product, 
  StockStatus,
  AIStatus
} from '../../../../models/types';
import { getSmartJitter } from '../../../../utils/system/scheduler-helpers';

export const productLifecycleRepository = {
  create: async (
    userId: number,
    url: string,
    name: string | null,
    imageUrl: string | null,
    refreshInterval: number = 43200,
    stockStatus: StockStatus = 'unknown',
    aiStatus: AIStatus = null,
    category: string | null = null
  ): Promise<Product> => {
    const jitter = getSmartJitter(refreshInterval);
    const initialDelaySeconds = Math.max(60, Math.floor(refreshInterval / 2) + jitter);
    const result = await pool.query(
      `INSERT INTO products (user_id, url, name, image_url, refresh_interval, stock_status, ai_status, next_check_at, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP + ($8 || ' seconds')::interval, $9)
       RETURNING *`,
      [userId, url, name, imageUrl, refreshInterval, stockStatus, aiStatus, initialDelaySeconds, category]
    );
    return result.rows[0];
  },

  update: async (
    id: number,
    userId: number,
    updates: {
      name?: string;
      image_url?: string | null;
      refresh_interval?: number;
      price_drop_threshold?: number | null;
      target_price?: number | null;
      notify_back_in_stock?: boolean;
      ai_verification_disabled?: boolean;
      ai_extraction_disabled?: boolean;
      needs_price_review?: boolean;
      ai_status?: string;
    },
    client?: any,
    options?: { asAdmin?: boolean }
  ): Promise<Product | null> => {
    const executor = client || pool;
    const fields: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    // Build fields dynamically
    const updateableFields = [
      'name', 'image_url', 'refresh_interval', 'price_drop_threshold', 'target_price',
      'notify_back_in_stock', 'ai_verification_disabled', 'ai_extraction_disabled',
      'checking_paused', 'category', 'stock_status', 'needs_price_review', 'ai_status'
    ];

    for (const field of updateableFields) {
      if ((updates as any)[field] !== undefined) {
        fields.push(`${field} = $${paramIndex++}`);
        values.push((updates as any)[field]);
      }
    }

    // Changing the frequency has to move the next check with it (issue #138).
    // refresh_interval is written here, but next_check_at is only ever set by
    // updateLastChecked after a scrape -- so a user shortening 24h to 6h waited
    // up to a further 24 hours, watching a countdown to the old target.
    //
    // Anchored on last_checked rather than now, so time already elapsed counts
    // toward the new interval and an already-overdue product is picked up on the
    // next tick. GREATEST clamps a resulting past timestamp to now.
    //
    // Deliberately not calculateNextCheckSeconds(): its randomisers are for
    // spreading scheduled load, and applying them here would show a user a
    // countdown that disagrees with the interval they just picked.
    if ((updates as any).refresh_interval !== undefined) {
      fields.push(`next_check_at = GREATEST(CURRENT_TIMESTAMP, COALESCE(last_checked, CURRENT_TIMESTAMP) + ($${paramIndex++} || ' seconds')::interval)`);
      values.push(String((updates as any).refresh_interval));
    }

    // checking_paused and auto_paused are a pair: a pause set through this
    // update is a user's decision, so the automatic flag must clear with it.
    // Leaving it set would produce auto_paused = true with checking_paused =
    // false, which describes nothing, and would let a later automatic resume
    // undo a pause the user had chosen.
    if (fields.some(f => f.startsWith('checking_paused'))) {
      fields.push('auto_paused = false');
    }

    if (fields.length === 0) return null;

    // Order matters: the WHERE clause numbers these as id, userId, admin flag.
    values.push(id, userId, options?.asAdmin === true);
    const result = await executor.query(
      `UPDATE products SET ${fields.join(', ')}
       WHERE id = $${paramIndex++} AND ($${paramIndex + 1}::boolean = true OR user_id = $${paramIndex})
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  delete: async (id: number, userId: number, options?: { asAdmin?: boolean }): Promise<boolean> => {
    const result = await pool.query(
      'DELETE FROM products WHERE id = $1 AND ($3::boolean = true OR user_id = $2)',
      [id, userId, options?.asAdmin === true]
    );
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * The user-facing pause. Always recorded as a user pause (auto_paused = false),
   * which is what stops a later automatic resume from overriding a deliberate
   * decision -- the system only resumes what the system paused.
   */
  bulkSetCheckingPaused: async (ids: number[], userId: number, paused: boolean): Promise<number> => {
    if (ids.length === 0) return 0;
    const result = await pool.query(
      `UPDATE products SET checking_paused = $1, auto_paused = false WHERE id = ANY($2) AND user_id = $3`,
      [paused, ids, userId]
    );
    return result.rowCount || 0;
  },
};
