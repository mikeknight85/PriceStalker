import pool from '../../../../config/database';
import { Item } from '../../../../models/types';

type Executor = { query: (text: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

/**
 * The canonical item a product listing belongs to (issue #143).
 *
 * Alert settings are written here rather than on `products`, because they
 * describe what the user wants ("tell me when anyone has this under 50") rather
 * than anything about a particular shop's page.
 */
export const itemRepository = {
  /**
   * Creates an item.
   *
   * `name` is truncated to the column width rather than being allowed to fail
   * the insert: a product title long enough to overflow is a scraping artefact,
   * and rejecting the whole add over it would be the wrong trade.
   */
  create: async (
    userId: number,
    name: string,
    imageUrl: string | null = null,
    category: string | null = null,
    client?: Executor
  ): Promise<Item> => {
    const executor = client || pool;
    const result = await executor.query(
      `INSERT INTO items (user_id, name, image_url, category)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, name.slice(0, 255), imageUrl, category]
    );
    return result.rows[0];
  },

  findById: async (id: number, userId: number, client?: Executor): Promise<Item | null> => {
    const executor = client || pool;
    const result = await executor.query(
      `SELECT * FROM items WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return result.rows[0] || null;
  },

  /** Every listing attached to an item, primary first. */
  listingsFor: async (itemId: number, userId: number, client?: Executor) => {
    const executor = client || pool;
    const result = await executor.query(
      `SELECT * FROM products WHERE item_id = $1 AND user_id = $2
       ORDER BY is_primary DESC, id ASC`,
      [itemId, userId]
    );
    return result.rows;
  },

  /**
   * Updates the alert settings that used to live on `products`.
   *
   * Returns null when nothing was passed, matching productLifecycleRepository
   * .update, so a caller can tell "no change requested" from "not found".
   */
  updateAlertSettings: async (
    id: number,
    userId: number,
    updates: {
      target_price?: number | null;
      price_drop_threshold?: number | null;
      notify_back_in_stock?: boolean;
      name?: string;
      image_url?: string | null;
      category?: string | null;
    },
    client?: Executor
  ): Promise<Item | null> => {
    const executor = client || pool;
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    for (const field of ['target_price', 'price_drop_threshold', 'notify_back_in_stock', 'name', 'image_url', 'category'] as const) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = $${i++}`);
        values.push(updates[field]);
      }
    }
    if (fields.length === 0) return null;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id, userId);
    const result = await executor.query(
      `UPDATE items SET ${fields.join(', ')} WHERE id = $${i++} AND user_id = $${i} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  /**
   * Deletes an item once its last listing has gone.
   *
   * An item with no listings has nothing to check and nothing to show, so
   * leaving it behind would accumulate invisible rows. Guarded on the item
   * genuinely being empty rather than assuming the caller checked.
   */
  deleteIfEmpty: async (id: number, client?: Executor): Promise<boolean> => {
    const executor = client || pool;
    const result = await executor.query(
      `DELETE FROM items WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM products WHERE item_id = $1)`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  },
};
