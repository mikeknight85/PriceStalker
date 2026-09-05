import { Product } from '../../../../models/types';

/**
 * Alert settings live on the item, not the listing (issue #143).
 *
 * Every query that returns a product for anything that reads `target_price`,
 * `price_drop_threshold` or `notify_back_in_stock` has to join the item and
 * pass its rows through here.
 *
 * They are aliased in SQL rather than selected as bare `i.target_price`
 * alongside `p.*`. That would produce two result columns of the same name, and
 * which one the driver keeps is an undocumented implementation detail --
 * currently the later one, but relying on that would mean alerts silently
 * firing against a stale threshold if it ever changed. Explicit aliases cost a
 * line and cannot drift.
 */
export const ITEM_ALERT_COLUMNS = `
              i.target_price         AS item_target_price,
              i.price_drop_threshold AS item_price_drop_threshold,
              i.notify_back_in_stock AS item_notify_back_in_stock`;

/** The join those columns require. */
export const ITEM_ALERT_JOIN = `LEFT JOIN items i ON i.id = p.item_id`;

/**
 * Overlays a row's item alert settings onto the product shape the rest of the
 * code reads.
 *
 * A product with no item keeps whatever the row already held rather than
 * silently becoming "no target price". That should not arise -- every product
 * gets an item -- but a scrape is the wrong place to discover a broken
 * invariant by turning someone's alerts off.
 */
export function withItemAlertSettings<T extends Record<string, any>>(row: T): T {
  const { item_target_price, item_price_drop_threshold, item_notify_back_in_stock, ...rest } = row;
  if (row.item_id == null) return rest as T;
  return {
    ...rest,
    target_price: item_target_price ?? null,
    price_drop_threshold: item_price_drop_threshold ?? null,
    notify_back_in_stock: item_notify_back_in_stock ?? false,
  } as unknown as T;
}

/** Convenience for a query returning many rows. */
export function withItemAlertSettingsAll<T extends Record<string, any>>(rows: T[]): T[] {
  return rows.map(withItemAlertSettings);
}

/** Narrower alias, for call sites that specifically produce Products. */
export const asProductWithItemAlerts = (row: Record<string, any>): Product =>
  withItemAlertSettings(row) as unknown as Product;
