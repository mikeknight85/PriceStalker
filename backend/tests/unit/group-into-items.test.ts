import { describe, it, expect } from 'vitest';
import { groupIntoItems } from '../../src/services/domain/product/utils/group-into-items';

/**
 * The grouped dashboard: one card per item, showing the best price across the
 * stores that sell it (issue #143).
 *
 * The decision this encodes is what "best price" refuses to mean. A listing
 * priced in a currency we could not convert is excluded, not compared raw --
 * ranking 49.99 EUR against 49.99 CHF and declaring a winner is worse than
 * declining to, because the user acts on that number.
 */

const listing = (over: Record<string, any> = {}): any => ({
  id: 1,
  user_id: 1,
  item_id: 100,
  is_primary: true,
  url: 'https://shop.example/p/1',
  name: 'Sony WH-1000XM5',
  item_name: 'Sony WH-1000XM5',
  item_image_url: null,
  image_url: null,
  category: 'audio',
  stock_status: 'in_stock',
  current_price: 299,
  currency: 'CHF',
  converted_price: 299,
  target_price: null,
  price_drop_threshold: null,
  notify_back_in_stock: false,
  created_at: new Date('2026-01-01'),
  sparkline: [],
  price_change_7d: null,
  min_price: null,
  ...over,
});

describe('grouping', () => {
  it('puts every store for one item on a single card', () => {
    const items = groupIntoItems([
      listing({ id: 1, item_id: 100 }),
      listing({ id: 2, item_id: 100, is_primary: false }),
      listing({ id: 3, item_id: 200 }),
    ], 'CHF');
    expect(items).toHaveLength(2);
    expect(items.find(i => i.id === 100)!.store_count).toBe(2);
    expect(items.find(i => i.id === 200)!.store_count).toBe(1);
  });

  it('skips a listing with no item rather than inventing one', () => {
    // Every product has an item. A null here means something is wrong, and a
    // phantom item on the dashboard would hide it.
    expect(groupIntoItems([listing({ item_id: null })], 'CHF')).toHaveLength(0);
  });

  it('takes the display name from the primary listing', () => {
    const items = groupIntoItems([
      listing({ id: 2, is_primary: false, item_name: 'Ignored', name: 'Ignored' }),
      listing({ id: 1, is_primary: true, item_name: 'Sony WH-1000XM5' }),
    ], 'CHF');
    expect(items[0].name).toBe('Sony WH-1000XM5');
  });

  it('falls back to the URL when an item and its listing are both unnamed', () => {
    const items = groupIntoItems([listing({ item_name: null, name: null, url: 'https://shop.example/p/9' })], 'CHF');
    expect(items[0].name).toBe('https://shop.example/p/9');
  });
});

describe('best price', () => {
  it('is the cheapest comparable store, and names it', () => {
    const items = groupIntoItems([
      listing({ id: 1, converted_price: 299 }),
      listing({ id: 2, is_primary: false, converted_price: 249.5 }),
      listing({ id: 3, is_primary: false, converted_price: 310 }),
    ], 'CHF');
    expect(items[0].best_price).toBe(249.5);
    expect(items[0].best_price_listing_ids).toEqual([2]);
    expect(items[0].best_price_currency).toBe('CHF');
  });

  it('excludes a store whose currency could not be converted', () => {
    // converted_price is null when no exchange rate resolved. Comparing the
    // raw number instead would rank across currencies.
    const items = groupIntoItems([
      listing({ id: 1, converted_price: 299 }),
      listing({ id: 2, is_primary: false, current_price: 10, currency: 'XYZ', converted_price: null }),
    ], 'CHF');
    expect(items[0].best_price).toBe(299);
    expect(items[0].comparable_count).toBe(1);
    expect(items[0].excluded_count).toBe(1);
  });

  it('excludes a store with no price scraped yet', () => {
    const items = groupIntoItems([
      listing({ id: 1, converted_price: 299 }),
      listing({ id: 2, is_primary: false, current_price: null, converted_price: null }),
    ], 'CHF');
    expect(items[0].comparable_count).toBe(1);
    expect(items[0].excluded_count).toBe(1);
  });

  it('reports no best price at all when nothing is comparable', () => {
    // Rather than picking one arbitrarily so the card has a number on it.
    const items = groupIntoItems([
      listing({ id: 1, converted_price: null }),
      listing({ id: 2, is_primary: false, converted_price: null }),
    ], 'CHF');
    expect(items[0].best_price).toBeNull();
    expect(items[0].best_price_listing_ids).toEqual([]);
    expect(items[0].best_price_currency).toBeNull();
    expect(items[0].excluded_count).toBe(2);
  });

  it('names no currency when there is no price to attach one to', () => {
    // An amount rendered beside a currency we never used would be a lie.
    const items = groupIntoItems([listing({ converted_price: null })], 'CHF');
    expect(items[0].best_price_currency).toBeNull();
  });

  it('treats zero as a real price', () => {
    const items = groupIntoItems([
      listing({ id: 1, converted_price: 0 }),
      listing({ id: 2, is_primary: false, converted_price: 50 }),
    ], 'CHF');
    expect(items[0].best_price).toBe(0);
    expect(items[0].comparable_count).toBe(2);
  });

  it('handles numeric columns arriving as strings, as pg returns them', () => {
    const items = groupIntoItems([
      listing({ id: 1, converted_price: '299.00' }),
      listing({ id: 2, is_primary: false, converted_price: '249.50' }),
    ], 'CHF');
    expect(items[0].best_price).toBe(249.5);
    expect(items[0].best_price_listing_ids).toEqual([2]);
  });
});

describe('price spread', () => {
  it('is the gap between cheapest and dearest', () => {
    const items = groupIntoItems([
      listing({ id: 1, converted_price: 299 }),
      listing({ id: 2, is_primary: false, converted_price: 249.5 }),
    ], 'CHF');
    expect(items[0].price_spread).toBe(49.5);
  });

  it('is null for a single store, because one price is not a comparison', () => {
    expect(groupIntoItems([listing()], 'CHF')[0].price_spread).toBeNull();
  });

  it('is null when only one store could be compared', () => {
    const items = groupIntoItems([
      listing({ id: 1, converted_price: 299 }),
      listing({ id: 2, is_primary: false, converted_price: null }),
    ], 'CHF');
    expect(items[0].price_spread).toBeNull();
  });

  it('rounds to money rather than exposing float noise', () => {
    const items = groupIntoItems([
      listing({ id: 1, converted_price: 10.1 }),
      listing({ id: 2, is_primary: false, converted_price: 20.2 }),
    ], 'CHF');
    expect(items[0].price_spread).toBe(10.1);
  });
});

describe('listing order', () => {
  it('puts the cheapest comparable store first', () => {
    const items = groupIntoItems([
      listing({ id: 1, converted_price: 299 }),
      listing({ id: 2, is_primary: false, converted_price: 249.5 }),
      listing({ id: 3, is_primary: false, converted_price: 260 }),
    ], 'CHF');
    expect(items[0].listings.map(l => l.id)).toEqual([2, 3, 1]);
  });

  it('keeps uncomparable stores, at the end', () => {
    // Left out of the comparison is not the same as no longer tracked.
    const items = groupIntoItems([
      listing({ id: 1, converted_price: null }),
      listing({ id: 2, is_primary: false, converted_price: 249.5 }),
    ], 'CHF');
    expect(items[0].listings.map(l => l.id)).toEqual([2, 1]);
    expect(items[0].store_count).toBe(2);
  });
});

describe('stock', () => {
  it('is in stock when any store has it', () => {
    const items = groupIntoItems([
      listing({ id: 1, stock_status: 'out_of_stock' }),
      listing({ id: 2, is_primary: false, stock_status: 'in_stock' }),
    ], 'CHF');
    expect(items[0].any_in_stock).toBe(true);
  });

  it('is out of stock only when no store has it', () => {
    const items = groupIntoItems([
      listing({ id: 1, stock_status: 'out_of_stock' }),
      listing({ id: 2, is_primary: false, stock_status: 'not_available' }),
    ], 'CHF');
    expect(items[0].any_in_stock).toBe(false);
  });
});

describe('alert settings come from the item', () => {
  it('are carried onto the card', () => {
    const items = groupIntoItems([listing({ target_price: 249.99, notify_back_in_stock: true })], 'CHF');
    expect(items[0].target_price).toBe(249.99);
    expect(items[0].notify_back_in_stock).toBe(true);
  });
});

describe('edge cases', () => {
  it('returns nothing for no products', () => {
    expect(groupIntoItems([], 'CHF')).toEqual([]);
  });

  it('compares in the store\'s own currency when the user has no preference', () => {
    // This previously asserted best_price_currency was null, which encoded the
    // bug in #160: "Automatic" meant nothing could be compared at all. The
    // store's own currency is the right answer.
    const items = groupIntoItems([listing({ converted_price: null })], null);
    expect(items[0].best_price).toBe(299);
    expect(items[0].best_price_currency).toBe('CHF');
  });
});


describe('a user on the default "Automatic" currency (issue #160)', () => {
  // users.currency IS NULL is what every new account starts on. The SQL
  // compares each price against a null currency and the rate join never fires,
  // so converted_price is null for every listing. Treating that as "nothing is
  // comparable" told a new user with two shops in one currency that neither
  // could be compared -- the feature failing on first use.
  const noConversion = (over: Record<string, any> = {}) =>
    listing({ converted_price: null, ...over });

  it('compares stores that share a currency, using their own prices', () => {
    const items = groupIntoItems([
      noConversion({ id: 1, currency: 'AUD', current_price: 379 }),
      noConversion({ id: 2, is_primary: false, currency: 'AUD', current_price: 349 }),
    ], null);
    expect(items[0].comparable_count).toBe(2);
    expect(items[0].excluded_count).toBe(0);
    expect(items[0].best_price).toBe(349);
    expect(items[0].best_price_currency).toBe('AUD');
    expect(items[0].price_spread).toBe(30);
  });

  it('reports the stores own currency, not a guessed one', () => {
    const items = groupIntoItems([noConversion({ currency: 'AUD', current_price: 379 })], null);
    expect(items[0].best_price_currency).toBe('AUD');
  });

  it('still excludes a store in a different currency, since there is no rate', () => {
    const items = groupIntoItems([
      noConversion({ id: 1, currency: 'AUD', current_price: 379 }),
      noConversion({ id: 2, is_primary: false, currency: 'EUR', current_price: 200 }),
    ], null);
    expect(items[0].comparable_count).toBe(1);
    expect(items[0].excluded_count).toBe(1);
    expect(items[0].best_price).toBe(379);
  });

  it('takes the comparison currency from the primary listing, so it does not move with prices', () => {
    const items = groupIntoItems([
      noConversion({ id: 1, is_primary: true, currency: 'AUD', current_price: 379 }),
      noConversion({ id: 2, is_primary: false, currency: 'EUR', current_price: 1 }),
    ], null);
    expect(items[0].best_price_currency).toBe('AUD');
    expect(items[0].best_price).toBe(379);
  });

  it('does not fall back to raw prices when the user HAS a preferred currency', () => {
    // With a preference, an unconvertible listing must stay excluded rather
    // than sneaking in at its raw number.
    const items = groupIntoItems([
      listing({ id: 1, converted_price: 300 }),
      listing({ id: 2, is_primary: false, converted_price: null, currency: 'XYZ', current_price: 5 }),
    ], 'CHF');
    expect(items[0].comparable_count).toBe(1);
    expect(items[0].best_price).toBe(300);
  });
});

describe('tied prices (issue #161)', () => {
  it('marks every store at the best price, not just the first', () => {
    const items = groupIntoItems([
      listing({ id: 1, converted_price: 379 }),
      listing({ id: 2, is_primary: false, converted_price: 379 }),
      listing({ id: 3, is_primary: false, converted_price: 400 }),
    ], 'AUD');
    expect(items[0].best_price_listing_ids.sort()).toEqual([1, 2]);
  });

  it('flags an all-tied item, so the card does not claim a difference', () => {
    const items = groupIntoItems([
      listing({ id: 1, converted_price: 379 }),
      listing({ id: 2, is_primary: false, converted_price: 379 }),
    ], 'AUD');
    expect(items[0].all_tied).toBe(true);
    expect(items[0].price_spread).toBe(0);
  });

  it('is not all-tied when one store is cheaper', () => {
    const items = groupIntoItems([
      listing({ id: 1, converted_price: 379 }),
      listing({ id: 2, is_primary: false, converted_price: 349 }),
    ], 'AUD');
    expect(items[0].all_tied).toBe(false);
    expect(items[0].best_price_listing_ids).toEqual([2]);
  });

  it('is not all-tied with a single store, where there is nothing to tie with', () => {
    const items = groupIntoItems([listing({ converted_price: 379 })], 'AUD');
    expect(items[0].all_tied).toBe(false);
    expect(items[0].best_price_listing_ids).toEqual([1]);
  });
});
