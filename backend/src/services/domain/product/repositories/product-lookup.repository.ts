import pool from '../../../../config/database';
import { Product } from '../../../../models/types';
import { ITEM_ALERT_COLUMNS, ITEM_ALERT_JOIN, asProductWithItemAlerts } from './item-alert-settings';

/**
 * The retailer a product URL belongs to, for pacing purposes only.
 *
 * Deliberately crude: lower-cased host with a leading `www.` removed, and no
 * public-suffix logic. It groups one shop's listings together, which is all the
 * caller needs -- it is not a canonical lookup domain and must not be used as
 * one (`urlHelper` owns that).
 */
export function refreshQueueDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    // An unparseable URL still has to land in some group, and a group of its own
    // is the honest answer: nothing is known about who hosts it.
    return url.toLowerCase();
  }
}

/**
 * Round-robins a due list across retailers, preserving each retailer's own
 * order.
 *
 * `findDueForRefresh` had no ordering at all, so Postgres handed back whatever
 * the heap gave it -- and that is worse than random would be. Products added in
 * one sitting share a retailer, sit adjacent in the heap and carry the same
 * default refresh interval, so they come due in the same sweep and arrive as a
 * block. `PriceCheckTask` then fires the first three of that block concurrently
 * through `pLimit(3)`: three simultaneous requests to one shop.
 *
 * Measured against Akamai on target.com.au (issue #67): three requests 800ms
 * apart were served the full product page and the fourth was denied. The denial
 * follows the client rather than the route, degrades with request volume and
 * recovers with silence, so the shape of the burst is what matters.
 *
 * The interleave is computed here rather than as a window function in the query
 * because the result is the same either way and this can be tested without a
 * live Postgres. The query carries a deterministic `ORDER BY`, so the input is
 * stable and the output reproducible.
 */
export function interleaveByRetailer<T extends { url: string }>(products: T[]): T[] {
  if (products.length < 2) return products;

  // Map insertion order is the order the retailers were first seen, which is
  // what keeps the whole thing deterministic for a deterministic input.
  const byDomain = new Map<string, T[]>();
  for (const product of products) {
    const domain = refreshQueueDomain(product.url);
    const bucket = byDomain.get(domain);
    if (bucket) bucket.push(product);
    else byDomain.set(domain, [product]);
  }

  const buckets = [...byDomain.values()];
  const interleaved: T[] = [];
  // Counted rather than spread into Math.max: a big instance's due list is not
  // a safe number of function arguments.
  let rounds = 0;
  for (const bucket of buckets) rounds = Math.max(rounds, bucket.length);
  for (let round = 0; round < rounds; round++) {
    for (const bucket of buckets) {
      if (round < bucket.length) interleaved.push(bucket[round]);
    }
  }
  return interleaved;
}

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
   *
   * Ordered longest-waiting first and then interleaved across retailers, so the
   * scheduler does not fire a whole retailer's block at once (issue #67). See
   * `interleaveByRetailer` above for why that matters.
   */
  findDueForRefresh: async (): Promise<Product[]> => {
    const result = await pool.query(
      `SELECT p.*,${ITEM_ALERT_COLUMNS}
       FROM products p
       ${ITEM_ALERT_JOIN}
       WHERE (p.next_check_at IS NULL OR p.next_check_at < CURRENT_TIMESTAMP)
       AND (p.checking_paused IS NULL OR p.checking_paused = false)
       ORDER BY p.next_check_at ASC NULLS FIRST, p.id ASC`
    );
    // Longest-waiting first from the query, then spread across retailers so the
    // scheduler's three concurrent slots hold three different shops rather than
    // three listings from one (issue #67).
    return interleaveByRetailer(result.rows.map(asProductWithItemAlerts));
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
