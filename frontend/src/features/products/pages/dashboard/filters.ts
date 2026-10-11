import { ItemWithListings, Product, StockStatus } from '../../../../types/api';
import { STOCK_STATUS_BY_AVAILABILITY, StockFilter, TrackingFilter } from './utils';

/**
 * The dashboard's two filters, for both views (issues #246 and #248).
 *
 * The flat "All stores" view filters listings, so each filter reads a field off
 * a `products` row. The grouped "By product" view filters items, which have no
 * such row: an item is the thing you want to buy and its stores each have their
 * own schedule and their own shelf. So every filter needs a meaning at the item
 * level too, and both views are driven from the predicates here rather than
 * each view re-deciding -- the previous arrangement had the pause filter wired
 * only to the flat list, so in the grouped view the dropdown moved and nothing
 * happened, which is the complaint in #248 (and, for sorting, in #241).
 *
 * The rule in both cases is **the best answer among the stores wins**, which is
 * what the item card already does with price. Concretely:
 *
 * - An item is **Active** if any store is still being checked. "Am I still
 *   tracking this thing" is answered yes by one live store, and an item whose
 *   stores are a mix is not meaningfully paused.
 * - An item is **In Stock** if any store has it. An item with three stores
 *   where one has it is in stock, not out of stock -- and that is exactly what
 *   its card says, so filtering on "Out of Stock" can never hand back a card
 *   reading "In stock".
 *
 * Both filters are therefore mutually exclusive at the item level: an item
 * appears under exactly one tracking value and exactly one stock value, never
 * under two and never under none.
 */

/**
 * Whether monitoring is paused for one listing.
 *
 * `checking_paused` is typed `boolean`, but the value arriving from an API that
 * answers `{}` for an unmocked endpoint, or from a driver handing back `0`/`1`
 * for a Postgres boolean, is not guaranteed to be one. Narrowed through
 * `unknown` rather than cast, so nothing here needs `as any`.
 */
export function isListingPaused(listing: Pick<Product, 'checking_paused'>): boolean {
  const raw: unknown = listing.checking_paused;
  return raw === true || raw === 1 || raw === '1' || raw === 't' || raw === 'true';
}

/**
 * One listing's stock status, with anything unrecognised read as `unknown`.
 *
 * A listing is never dropped from every bucket: a null, a missing field or a
 * status this build has not heard of is an honest "we do not know", which is a
 * filter value of its own.
 */
export function listingStockStatus(listing: Pick<Product, 'stock_status'>): StockStatus {
  const raw: unknown = listing.stock_status;
  return STOCK_STATUS_BY_AVAILABILITY.find(status => status === raw) ?? 'unknown';
}

export function matchesTrackingFilter(
  listing: Pick<Product, 'checking_paused'>,
  filter: TrackingFilter,
): boolean {
  if (filter === 'all') return true;
  return isListingPaused(listing) ? filter === 'paused' : filter === 'active';
}

export function matchesStockFilter(
  listing: Pick<Product, 'stock_status'>,
  filter: StockFilter,
): boolean {
  if (filter === 'all') return true;
  return listingStockStatus(listing) === filter;
}

function listingsOf(item: Pick<ItemWithListings, 'listings'>): Product[] {
  // Array.isArray rather than a null check: an unexpected response shape must
  // filter to "nothing to show" rather than throwing out of the dashboard.
  return Array.isArray(item.listings) ? item.listings : [];
}

/**
 * Whether the item is still being tracked anywhere.
 *
 * An item with no stores at all counts as paused: nothing is being checked, so
 * claiming it is active would be the same silent lie this file exists to stop.
 */
export function itemTrackingState(
  item: Pick<ItemWithListings, 'listings'>,
): Exclude<TrackingFilter, 'all'> {
  return listingsOf(item).some(listing => !isListingPaused(listing)) ? 'active' : 'paused';
}

/**
 * The one stock status an item is filed under: the most available of its stores.
 *
 * For a single-store item this is simply that store's status, so the two views
 * agree on every item a user actually has today. Derived from the listings
 * rather than from the server's `any_in_stock` so that one rule covers all six
 * statuses, not just the in-stock/not-in-stock split; where the two overlap
 * they agree, and `itemStockStatus(item) === 'in_stock'` exactly when
 * `any_in_stock` is true.
 */
export function itemStockStatus(item: Pick<ItemWithListings, 'listings'>): StockStatus {
  const statuses = listingsOf(item).map(listingStockStatus);
  // An item with no stores knows nothing about its own availability.
  return STOCK_STATUS_BY_AVAILABILITY.find(status => statuses.includes(status)) ?? 'unknown';
}

export function itemMatchesTrackingFilter(
  item: Pick<ItemWithListings, 'listings'>,
  filter: TrackingFilter,
): boolean {
  if (filter === 'all') return true;
  return itemTrackingState(item) === filter;
}

export function itemMatchesStockFilter(
  item: Pick<ItemWithListings, 'listings'>,
  filter: StockFilter,
): boolean {
  if (filter === 'all') return true;
  return itemStockStatus(item) === filter;
}
