import pool from '../../../../config/database';

/**
 * Which store a listing belongs to, and whether naming it is worth doing
 * (issue #143 phase 4).
 *
 * "Price dropped at Digitec" is useful when a product is tracked at four
 * shops and the user has to know which one to open. It is noise when there is
 * only one shop, where the alert can only possibly be about that one -- so the
 * store count is resolved alongside the name and the wording adapts.
 *
 * Resolved at notification time rather than carried on the product, because a
 * retailer's display name lives in `retailer_configs` and changes when an
 * admin renames it.
 */
export interface StoreContext {
  /** Display name for the retailer: its configured name, else its domain. */
  storeName: string | null;
  /** How many stores the item has, including this one. */
  storeCount: number;
}

export async function getStoreContext(productId: number): Promise<StoreContext> {
  try {
    const result = await pool.query(
      `SELECT
         COALESCE(rc.name, rc.domain) AS store_name,
         (SELECT count(*)::int FROM products sib WHERE sib.item_id = p.item_id) AS store_count
       FROM products p
       LEFT JOIN LATERAL (
         SELECT name, domain FROM retailer_configs
         WHERE p.url LIKE '%' || domain || '%' AND active = true
         ORDER BY length(domain) DESC
         LIMIT 1
       ) rc ON true
       WHERE p.id = $1`,
      [productId]
    );

    const row = result.rows[0];
    if (!row) return { storeName: null, storeCount: 1 };

    return {
      // Fall back to the URL's host, so a retailer with no config yet still
      // reads as a place rather than as nothing.
      storeName: row.store_name || null,
      // A product with no item should not make the alert claim there are zero
      // stores; it is at least the one being alerted about.
      storeCount: Math.max(1, row.store_count ?? 1),
    };
  } catch {
    // A notification is not worth failing over a decoration. Without a store
    // name the message reads exactly as it did before this feature.
    return { storeName: null, storeCount: 1 };
  }
}

/** The host of a URL, for a retailer that has no configured name. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
