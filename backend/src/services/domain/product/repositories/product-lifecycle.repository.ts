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
    client?: any
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

    if (fields.length === 0) return null;

    values.push(id, userId);
    const result = await executor.query(
      `UPDATE products SET ${fields.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  delete: async (id: number, userId: number): Promise<boolean> => {
    const result = await pool.query(
      'DELETE FROM products WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  },

  bulkSetCheckingPaused: async (ids: number[], userId: number, paused: boolean): Promise<number> => {
    if (ids.length === 0) return 0;
    const result = await pool.query(
      `UPDATE products SET checking_paused = $1 WHERE id = ANY($2) AND user_id = $3`,
      [paused, ids, userId]
    );
    return result.rowCount || 0;
  },
};
