import { ItemWithListings, Product } from '../../../../types/api';
import { SortOption, SortOrder, getWebsite } from './utils';

/**
 * Sorting for the grouped "By product" dashboard (issue #241).
 *
 * The flat view sorts listings, so every sort option there reads a field off a
 * `products` row. An item has no such row: it is the thing the user wants to
 * buy, and the stores selling it each have their own price, currency, schedule
 * and check history. Every option therefore has to be given a meaning at the
 * item level, and the meaning that matters is the one the card already shows --
 * the best price across the item's stores, in the user's own currency, chosen
 * from the stores whose currency could be converted.
 *
 * Two rules hold throughout:
 *
 * 1. **Anything the card cannot state sorts last, in both directions.** An item
 *    with no comparable price shows "No price yet"; leading the cheapest-first
 *    list with a column of those would be worse than useless. The flat view
 *    coerces a missing price to 0 instead, which puts unpriced listings in
 *    front of a genuinely cheap one -- not a behaviour worth copying.
 * 2. **Ties break on name, then id, always ascending.** Ties are common here
 *    (an untagged pair, two items both in stock, two stores at the same price)
 *    and a grouped view that reshuffles equal rows on every poll looks broken.
 *    The secondary key is deliberately not reversed with the sort order, so a
 *    block of tied items reads alphabetically whichever way the arrow points.
 */

/**
 * The store whose price the card is showing.
 *
 * `best_price_listing_ids` can name several stores -- ties are common, and the
 * card marks all of them -- so this takes the first in the order the card
 * renders rather than inventing a second ranking the user cannot see.
 */
export function bestPriceListing(item: ItemWithListings): Product | null {
  const listings = Array.isArray(item.listings) ? item.listings : [];
  const bestIds = Array.isArray(item.best_price_listing_ids) ? item.best_price_listing_ids : [];
  if (bestIds.length === 0) return null;
  return listings.find(listing => bestIds.includes(listing.id)) ?? null;
}

/** The store a listing-shaped question falls back to when no price is comparable. */
function representativeListing(item: ItemWithListings): Product | null {
  const listings = Array.isArray(item.listings) ? item.listings : [];
  return bestPriceListing(item) ?? listings[0] ?? null;
}

function listingTimes(item: ItemWithListings, field: 'created_at' | 'last_checked'): number[] {
  const listings = Array.isArray(item.listings) ? item.listings : [];
  return listings
    .map(listing => {
      const raw = listing[field];
      if (!raw) return NaN;
      return new Date(raw).getTime();
    })
    .filter(time => Number.isFinite(time));
}

/**
 * When the user started tracking the item: the earliest of its stores.
 *
 * Adding a second store to something tracked for a year does not make it new.
 */
function dateAdded(item: ItemWithListings): number | null {
  const times = listingTimes(item, 'created_at');
  return times.length > 0 ? Math.min(...times) : null;
}

/**
 * When the item was last looked at: the most recent of its stores.
 *
 * The freshest store is what the item currently knows about itself, so a
 * newly checked store makes the item recently checked even if a paused store
 * beside it has not been read in weeks.
 */
function lastChecked(item: ItemWithListings): number | null {
  const times = listingTimes(item, 'last_checked');
  return times.length > 0 ? Math.max(...times) : null;
}

/** The 7-day move on the price the card is showing, as a percentage. */
function priceChangePercent(item: ItemWithListings): number | null {
  const best = bestPriceListing(item);
  const change = best?.price_change_7d;
  return typeof change === 'number' && Number.isFinite(change) ? change : null;
}

/**
 * The 7-day move on the price the card is showing, in the user's currency.
 *
 * Derived from the percentage the way the flat view derives it, but against
 * `best_price` rather than a listing's own `current_price`: `best_price` is
 * already converted, so items priced in different currencies stay comparable.
 * Summing or comparing raw `current_price` deltas across currencies would rank
 * a 100 JPY move above a 5 GBP one.
 */
function priceChangeAbsolute(item: ItemWithListings): number | null {
  const percent = priceChangePercent(item);
  if (percent === null) return null;
  const price = item.best_price;
  if (typeof price !== 'number' || !Number.isFinite(price)) return null;
  const ratio = 1 + percent / 100;
  // A price that fell the whole way to zero has no finite "before", so there is
  // no absolute change to sort on.
  if (ratio === 0) return null;
  return price - price / ratio;
}

/** The website of the store the card is pointing the user at. */
function website(item: ItemWithListings): string | null {
  const listing = representativeListing(item);
  return listing ? getWebsite(listing.url) : null;
}

type SortValue = number | string | null;

/**
 * The value an item is ranked by. `null` means the item cannot answer this
 * question and sorts last whichever way the arrow points.
 */
export function itemSortValue(item: ItemWithListings, sortBy: SortOption): SortValue {
  switch (sortBy) {
    case 'date_added':
      return dateAdded(item);
    case 'name':
      return item.name ?? '';
    case 'tag':
      // Untagged is a real answer, not a missing one: it sorts with the empty
      // string, the way it does in the flat view.
      return item.category ?? '';
    case 'price':
      return typeof item.best_price === 'number' && Number.isFinite(item.best_price)
        ? item.best_price
        : null;
    case 'price_change':
      return priceChangeAbsolute(item);
    case 'price_change_percent':
      return priceChangePercent(item);
    case 'status':
      // Binary at the item level: somewhere has it, or nowhere does. Ascending
      // puts in-stock first, matching the flat view, where 'in_stock' sorts
      // before 'out_of_stock' alphabetically.
      return item.any_in_stock ? 0 : 1;
    case 'last_checked':
      return lastChecked(item);
    case 'website':
      // An item can be sold by several stores, so "website" has to pick one.
      // It picks the store setting the best price -- the one the card
      // highlights -- which for a single-store item is simply its website, the
      // same answer the flat view gives.
      return website(item);
  }
}

function compareValues(a: SortValue, b: SortValue): number {
  if (typeof a === 'string' || typeof b === 'string') {
    return String(a ?? '').localeCompare(String(b ?? ''));
  }
  return (a ?? 0) - (b ?? 0);
}

/** Name then id, so equal rows hold still between polls. */
function compareTieBreak(a: ItemWithListings, b: ItemWithListings): number {
  const byName = (a.name ?? '').localeCompare(b.name ?? '');
  if (byName !== 0) return byName;
  return a.id - b.id;
}

/** Ranks an item against another on `sortBy` alone, ascending, nulls last. */
export function compareItems(
  a: ItemWithListings,
  b: ItemWithListings,
  sortBy: SortOption,
): number {
  const valueA = itemSortValue(a, sortBy);
  const valueB = itemSortValue(b, sortBy);

  if (valueA === null && valueB === null) return 0;
  if (valueA === null) return 1;
  if (valueB === null) return -1;

  return compareValues(valueA, valueB);
}

/** A sorted copy. The input is never mutated: it is react-query's cached data. */
export function sortItems(
  items: ItemWithListings[],
  sortBy: SortOption,
  sortOrder: SortOrder,
): ItemWithListings[] {
  const direction = sortOrder === 'asc' ? 1 : -1;

  return [...items].sort((a, b) => {
    const valueA = itemSortValue(a, sortBy);
    const valueB = itemSortValue(b, sortBy);

    // Unanswerable last in both directions, so reversing the order never
    // promotes a card that has nothing to show to the top of the list.
    if (valueA === null && valueB !== null) return 1;
    if (valueB === null && valueA !== null) return -1;

    const comparison = compareValues(valueA, valueB);
    if (comparison !== 0) return direction * comparison;

    return compareTieBreak(a, b);
  });
}
