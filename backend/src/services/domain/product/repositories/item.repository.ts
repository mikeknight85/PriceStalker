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
   * Moves a listing onto another item -- "these two are the same thing"
   * (issue #143).
   *
   * The listing keeps its own URL, schedule, scrape history and prices. What
   * changes is which item it belongs to, and therefore which alert settings
   * apply to it: the target item's, not the ones it carried before. That is the
   * point of the move, but it is a real loss if the old settings were the ones
   * the user wanted, so the caller is told what was discarded.
   *
   * The moved listing is never primary. The target item already has one, and
   * two primaries is the state the unique index exists to prevent.
   */
  attachListing: async (
    productId: number,
    itemId: number,
    userId: number
  ): Promise<{ movedFromItemId: number; discardedAlertSettings: Partial<Item> | null }> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Both sides must belong to the caller. Checked in one place rather than
      // trusting the route, because an id from a request body is not a claim
      // about ownership.
      const target = await client.query(`SELECT id FROM items WHERE id = $1 AND user_id = $2`, [itemId, userId]);
      if (target.rowCount === 0) {
        const err = new Error('Item not found');
        (err as any).statusCode = 404;
        throw err;
      }

      const product = await client.query(
        `SELECT p.id, p.item_id, i.target_price, i.price_drop_threshold, i.notify_back_in_stock
         FROM products p LEFT JOIN items i ON i.id = p.item_id
         WHERE p.id = $1 AND p.user_id = $2`,
        [productId, userId]
      );
      if (product.rowCount === 0) {
        const err = new Error('Product not found');
        (err as any).statusCode = 404;
        throw err;
      }

      const previousItemId: number | null = product.rows[0].item_id;
      if (previousItemId === itemId) {
        const err = new Error('This store is already part of that product');
        (err as any).statusCode = 409;
        throw err;
      }

      await client.query(
        `UPDATE products SET item_id = $1, is_primary = false WHERE id = $2 AND user_id = $3`,
        [itemId, productId, userId]
      );

      // The item it came from may now be empty. deleteIfEmpty re-checks rather
      // than assuming this was its only listing.
      let discarded: Partial<Item> | null = null;
      if (previousItemId !== null) {
        const old = product.rows[0];
        const hadSettings = old.target_price !== null || old.price_drop_threshold !== null || old.notify_back_in_stock;
        const removed = await client.query(
          `DELETE FROM items WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM products WHERE item_id = $1)`,
          [previousItemId]
        );
        // Only report a loss if the settings actually went with the deleted
        // item. If other listings still hold it, nothing was discarded.
        if (hadSettings && (removed.rowCount ?? 0) > 0) {
          discarded = {
            target_price: old.target_price,
            price_drop_threshold: old.price_drop_threshold,
            notify_back_in_stock: old.notify_back_in_stock,
          };
        }
      }

      await client.query('COMMIT');
      return { movedFromItemId: previousItemId as number, discardedAlertSettings: discarded };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Gives a listing its own item again, undoing an attach.
   *
   * The new item takes the listing's own name, image and category, so a
   * detached store reads as the thing it actually is rather than inheriting a
   * label chosen for a different grouping. Alert settings start empty: the ones
   * on the item it is leaving belong to the remaining listings.
   */
  detachListing: async (productId: number, userId: number): Promise<Item> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const product = await client.query(
        `SELECT id, item_id, name, url, image_url, category FROM products WHERE id = $1 AND user_id = $2`,
        [productId, userId]
      );
      if (product.rowCount === 0) {
        const err = new Error('Product not found');
        (err as any).statusCode = 404;
        throw err;
      }

      const row = product.rows[0];
      const siblings = await client.query(
        `SELECT count(*)::int AS n FROM products WHERE item_id = $1 AND id <> $2`,
        [row.item_id, productId]
      );
      if (siblings.rows[0].n === 0) {
        // Already the only listing, so it is already its own item. Refusing is
        // clearer than silently churning the row for no visible effect.
        const err = new Error('This store is the only one for that product, so there is nothing to separate it from');
        (err as any).statusCode = 409;
        throw err;
      }

      const created = await client.query(
        `INSERT INTO items (user_id, name, image_url, category) VALUES ($1, $2, $3, $4) RETURNING *`,
        [userId, String(row.name || row.url).slice(0, 255), row.image_url, row.category]
      );
      await client.query(
        `UPDATE products SET item_id = $1, is_primary = true WHERE id = $2`,
        [created.rows[0].id, productId]
      );

      await client.query('COMMIT');
      return created.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
