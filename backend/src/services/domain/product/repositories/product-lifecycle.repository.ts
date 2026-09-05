import pool from '../../../../config/database';
import { 
  Product, 
  StockStatus,
  AIStatus
} from '../../../../models/types';
import { getSmartJitter } from '../../../../utils/system/scheduler-helpers';
import { itemRepository } from './item.repository';

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

    // Every product belongs to an item, including one tracked at a single
    // retailer -- that is an item with one listing (issue #143). Creating them
    // together in a transaction matters: a product with no item would have
    // nowhere to keep its alert settings, and would be invisible to the
    // grouped view without anything indicating why.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const item = await itemRepository.create(
        userId,
        (name && name.trim()) || url,
        imageUrl,
        category,
        client
      );

      const result = await client.query(
        `INSERT INTO products (user_id, url, name, image_url, refresh_interval, stock_status, ai_status, next_check_at, category, item_id, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP + ($8 || ' seconds')::interval, $9, $10, true)
         RETURNING *`,
        [userId, url, name, imageUrl, refreshInterval, stockStatus, aiStatus, initialDelaySeconds, category, item.id]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
    // price_drop_threshold, target_price and notify_back_in_stock are absent on
    // purpose: they moved to the item, because they describe what the user
    // wants rather than anything about one shop's page (issue #143). They are
    // routed below. The columns still exist on `products` and are no longer
    // read -- a later migration drops them, once this has run in beta.
    const updateableFields = [
      'name', 'image_url', 'refresh_interval',
      'ai_verification_disabled', 'ai_extraction_disabled',
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

    // Alert settings belong to the item, so they are written there rather than
    // here (issue #143). Done before the product update so that a request
    // carrying only alert settings still resolves to the item's owner, and a
    // request carrying both is not left half-applied.
    const alertUpdates = {
      target_price: (updates as any).target_price,
      price_drop_threshold: (updates as any).price_drop_threshold,
      notify_back_in_stock: (updates as any).notify_back_in_stock,
    };
    const hasAlertUpdate = Object.values(alertUpdates).some(v => v !== undefined);

    if (hasAlertUpdate) {
      const owner = await executor.query(
        `SELECT p.item_id, p.user_id FROM products p
         WHERE p.id = $1 AND ($3::boolean = true OR p.user_id = $2)`,
        [id, userId, options?.asAdmin === true]
      );
      const itemId = owner.rows[0]?.item_id;
      if (itemId) {
        // The item's own user_id, not the caller's -- an admin acting on
        // another user's product must still write to that user's item.
        await itemRepository.updateAlertSettings(itemId, owner.rows[0].user_id, alertUpdates, executor);
      }
    }

    // Nothing left for the product itself. Returning the row rather than null
    // matters: a request that only changed a target price did succeed, and a
    // null here would read to the caller as "product not found".
    if (fields.length === 0) {
      if (!hasAlertUpdate) return null;
      const current = await executor.query(
        `SELECT * FROM products WHERE id = $1 AND ($3::boolean = true OR user_id = $2)`,
        [id, userId, options?.asAdmin === true]
      );
      return current.rows[0] || null;
    }

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
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Remember the item before the listing goes, so the orphan can be swept.
      const owner = await client.query(
        'SELECT item_id FROM products WHERE id = $1 AND ($3::boolean = true OR user_id = $2)',
        [id, userId, options?.asAdmin === true]
      );

      const result = await client.query(
        'DELETE FROM products WHERE id = $1 AND ($3::boolean = true OR user_id = $2)',
        [id, userId, options?.asAdmin === true]
      );

      // An item with no listings has nothing to check and nothing to show, so
      // leaving it would accumulate invisible rows. deleteIfEmpty re-checks
      // rather than trusting that this was the last one -- an item with a
      // second store attached must survive.
      const itemId = owner.rows[0]?.item_id;
      if (itemId && (result.rowCount ?? 0) > 0) {
        await itemRepository.deleteIfEmpty(itemId, client);
      }

      await client.query('COMMIT');
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
