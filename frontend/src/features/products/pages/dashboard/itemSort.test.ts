import { describe, expect, it } from 'vitest';
import { ItemWithListings, Product } from '../../../../types/api';
import { bestPriceListing, compareItems, itemSortValue, sortItems } from './itemSort';

let nextId = 1;

function listing(overrides: Partial<Product> = {}): Product {
  const id = overrides.id ?? nextId++;
  return {
    id,
    user_id: 1,
    url: `https://store-${id}.test/product`,
    name: `Listing ${id}`,
    image_url: null,
    refresh_interval: 60,
    last_checked: null,
    next_check_at: null,
    stock_status: 'in_stock',
    price_drop_threshold: null,
    target_price: null,
    notify_back_in_stock: false,
    ai_verification_disabled: false,
    ai_extraction_disabled: false,
    checking_paused: false,
    category: null,
    created_at: '2025-01-01T00:00:00.000Z',
    current_price: 10,
    member_price: null,
    original_price: null,
    currency: 'USD',
    converted_price: 10,
    converted_currency: 'USD',
    ai_status: null,
    ...overrides,
  };
}

function item(overrides: Partial<ItemWithListings> = {}): ItemWithListings {
  const listings = overrides.listings ?? [listing()];
  const id = overrides.id ?? nextId++;
  return {
    id,
    name: `Item ${id}`,
    image_url: null,
    category: null,
    target_price: null,
    price_drop_threshold: null,
    notify_back_in_stock: false,
    listings,
    store_count: listings.length,
    best_price: listings[0]?.converted_price ?? null,
    best_price_listing_ids: listings[0] ? [listings[0].id] : [],
    all_tied: false,
    best_price_currency: 'USD',
    price_spread: null,
    comparable_count: listings.length,
    excluded_count: 0,
    any_in_stock: true,
    ...overrides,
  };
}

const names = (items: ItemWithListings[]) => items.map(i => i.name);

describe('itemSortValue', () => {
  it('ranks price on the item best price, not on any one listing', () => {
    const subject = item({
      best_price: 42,
      listings: [listing({ converted_price: 99 }), listing({ converted_price: 42 })],
    });
    expect(itemSortValue(subject, 'price')).toBe(42);
  });

  it('treats an item with no comparable price as unanswerable', () => {
    expect(itemSortValue(item({ best_price: null }), 'price')).toBeNull();
  });

  it('dates an item from its earliest listing, not its newest store', () => {
    const subject = item({
      listings: [
        listing({ created_at: '2025-06-01T00:00:00.000Z' }),
        listing({ created_at: '2024-02-01T00:00:00.000Z' }),
      ],
    });
    expect(itemSortValue(subject, 'date_added')).toBe(new Date('2024-02-01T00:00:00.000Z').getTime());
  });

  it('takes last checked from the freshest listing', () => {
    const subject = item({
      listings: [
        listing({ last_checked: '2025-03-01T00:00:00.000Z' }),
        listing({ last_checked: '2025-09-09T00:00:00.000Z' }),
        listing({ last_checked: null }),
      ],
    });
    expect(itemSortValue(subject, 'last_checked')).toBe(new Date('2025-09-09T00:00:00.000Z').getTime());
  });

  it('has nothing to say about last checked when no store has been checked', () => {
    expect(itemSortValue(item({ listings: [listing({ last_checked: null })] }), 'last_checked')).toBeNull();
  });

  it('reads stock as a yes or no across the whole item', () => {
    expect(itemSortValue(item({ any_in_stock: true }), 'status')).toBe(0);
    expect(itemSortValue(item({ any_in_stock: false }), 'status')).toBe(1);
  });

  it('counts untagged as an answer rather than a gap', () => {
    expect(itemSortValue(item({ category: null }), 'tag')).toBe('');
  });

  it('takes the website of the store setting the best price', () => {
    const cheap = listing({ url: 'https://www.aaa-shop.test/p', converted_price: 5 });
    const dear = listing({ url: 'https://zzz-shop.test/p', converted_price: 50 });
    const subject = item({
      listings: [dear, cheap],
      best_price: 5,
      best_price_listing_ids: [cheap.id],
    });
    expect(itemSortValue(subject, 'website')).toBe('aaa-shop.test');
  });

  it('still names a website when no price could be compared', () => {
    const only = listing({ url: 'https://solo.test/p', converted_price: null });
    const subject = item({ listings: [only], best_price: null, best_price_listing_ids: [] });
    expect(itemSortValue(subject, 'website')).toBe('solo.test');
  });

  it('reads price change off the best-price listing', () => {
    const cheap = listing({ converted_price: 80, price_change_7d: -20 });
    const dear = listing({ converted_price: 120, price_change_7d: 50 });
    const subject = item({
      listings: [dear, cheap],
      best_price: 80,
      best_price_listing_ids: [cheap.id],
    });
    expect(itemSortValue(subject, 'price_change_percent')).toBe(-20);
    // 80 is 20% below last week's 100, so the move is -20 in the user's currency.
    expect(itemSortValue(subject, 'price_change')).toBeCloseTo(-20, 10);
  });

  it('has no absolute change to report for a price that fell the whole way', () => {
    const only = listing({ converted_price: 0, price_change_7d: -100 });
    const subject = item({ listings: [only], best_price: 0, best_price_listing_ids: [only.id] });
    expect(itemSortValue(subject, 'price_change_percent')).toBe(-100);
    expect(itemSortValue(subject, 'price_change')).toBeNull();
  });

  it('survives a response whose listing arrays are not arrays', () => {
    const malformed = {
      ...item(),
      // The e2e suite answers unmocked endpoints with `{}`, and a misconfigured
      // proxy does the same in production.
      listings: undefined as unknown as Product[],
      best_price_listing_ids: undefined as unknown as number[],
    };
    expect(bestPriceListing(malformed)).toBeNull();
    expect(itemSortValue(malformed, 'website')).toBeNull();
    expect(itemSortValue(malformed, 'date_added')).toBeNull();
  });
});

describe('sortItems', () => {
  it('sorts by item name in both directions', () => {
    const items = [item({ name: 'Monitor' }), item({ name: 'Anvil' }), item({ name: 'Zither' })];
    expect(names(sortItems(items, 'name', 'asc'))).toEqual(['Anvil', 'Monitor', 'Zither']);
    expect(names(sortItems(items, 'name', 'desc'))).toEqual(['Zither', 'Monitor', 'Anvil']);
  });

  it('sorts by the best price the card shows', () => {
    const items = [
      item({ name: 'Dear', best_price: 300 }),
      item({ name: 'Cheap', best_price: 10 }),
      item({ name: 'Middling', best_price: 55 }),
    ];
    expect(names(sortItems(items, 'price', 'asc'))).toEqual(['Cheap', 'Middling', 'Dear']);
    expect(names(sortItems(items, 'price', 'desc'))).toEqual(['Dear', 'Middling', 'Cheap']);
  });

  it('compares across currencies on the converted best price', () => {
    // A yen listing whose raw number dwarfs every other price, and a krona one
    // that could not be converted at all. Ranking on `current_price` would put
    // the yen item last and the unconvertible one mid-table; ranking on the
    // converted best price -- what the card prints -- is the only ordering the
    // user can make sense of.
    const yenStore = listing({ currency: 'JPY', current_price: 15_000, converted_price: 96 });
    const poundStore = listing({ currency: 'GBP', current_price: 110, converted_price: 140 });
    const multiCurrency = item({
      name: 'Imported Camera',
      listings: [poundStore, yenStore],
      best_price: 96,
      best_price_currency: 'USD',
      best_price_listing_ids: [yenStore.id],
      comparable_count: 2,
    });

    const kronaStore = listing({ currency: 'SEK', current_price: 900, converted_price: null });
    const unconvertible = item({
      name: 'Unpriceable Lamp',
      listings: [kronaStore],
      best_price: null,
      best_price_currency: null,
      best_price_listing_ids: [],
      comparable_count: 0,
      excluded_count: 1,
    });

    const domestic = item({ name: 'Local Kettle', best_price: 120, listings: [listing({ converted_price: 120 })] });

    const items = [unconvertible, multiCurrency, domestic];
    expect(names(sortItems(items, 'price', 'asc'))).toEqual([
      'Imported Camera',
      'Local Kettle',
      'Unpriceable Lamp',
    ]);
    // The item with nothing to compare stays at the bottom when the arrow
    // flips: leading "most expensive" with "No price yet" is the silence this
    // view was reported for.
    expect(names(sortItems(items, 'price', 'desc'))).toEqual([
      'Local Kettle',
      'Imported Camera',
      'Unpriceable Lamp',
    ]);
  });

  it('breaks ties alphabetically, the same way in both directions', () => {
    const items = [
      item({ name: 'Walnut Desk', best_price: 75 }),
      item({ name: 'Ash Desk', best_price: 75 }),
      item({ name: 'Maple Desk', best_price: 75 }),
    ];
    expect(names(sortItems(items, 'price', 'asc'))).toEqual(['Ash Desk', 'Maple Desk', 'Walnut Desk']);
    expect(names(sortItems(items, 'price', 'desc'))).toEqual(['Ash Desk', 'Maple Desk', 'Walnut Desk']);
  });

  it('breaks a tie on id when two items share a name', () => {
    const items = [
      item({ id: 9, name: 'Same Name', best_price: 5 }),
      item({ id: 2, name: 'Same Name', best_price: 5 }),
    ];
    expect(sortItems(items, 'price', 'desc').map(i => i.id)).toEqual([2, 9]);
  });

  it('puts in-stock items first when ascending', () => {
    const items = [
      item({ name: 'Sold Out', any_in_stock: false }),
      item({ name: 'Available', any_in_stock: true }),
    ];
    expect(names(sortItems(items, 'status', 'asc'))).toEqual(['Available', 'Sold Out']);
    expect(names(sortItems(items, 'status', 'desc'))).toEqual(['Sold Out', 'Available']);
  });

  it('sorts by the earliest store an item was tracked at', () => {
    const old = item({
      name: 'Tracked Last Year',
      listings: [
        listing({ created_at: '2024-01-01T00:00:00.000Z' }),
        // A store added yesterday must not make a year-old item look new.
        listing({ created_at: '2025-12-31T00:00:00.000Z' }),
      ],
    });
    const recent = item({
      name: 'Tracked This Week',
      listings: [listing({ created_at: '2025-07-01T00:00:00.000Z' })],
    });
    expect(names(sortItems([recent, old], 'date_added', 'asc'))).toEqual([
      'Tracked Last Year',
      'Tracked This Week',
    ]);
  });

  it('sorts by tag', () => {
    const items = [
      item({ name: 'C', category: 'Tools' }),
      item({ name: 'A', category: 'Games' }),
      item({ name: 'B', category: null }),
    ];
    expect(names(sortItems(items, 'tag', 'asc'))).toEqual(['B', 'A', 'C']);
  });

  it('sorts by the website of the cheapest store', () => {
    const makeItem = (name: string, host: string, price: number) => {
      const best = listing({ url: `https://${host}/p`, converted_price: price });
      return item({ name, listings: [best], best_price: price, best_price_listing_ids: [best.id] });
    };
    const items = [makeItem('Two', 'zed.test', 5), makeItem('One', 'alpha.test', 7)];
    expect(names(sortItems(items, 'website', 'asc'))).toEqual(['One', 'Two']);
  });

  it('sorts by price change, steepest drop first when ascending', () => {
    const makeItem = (name: string, price: number, change: number) => {
      const best = listing({ converted_price: price, price_change_7d: change });
      return item({ name, listings: [best], best_price: price, best_price_listing_ids: [best.id] });
    };
    // -50% off 100 is -100 absolute; -10% off 1000 is about -111 absolute. The
    // percentage and currency sorts therefore disagree on purpose.
    const halfOffCheap = makeItem('Half Off Cheap', 100, -50);
    const slightlyOffDear = makeItem('Slightly Off Dear', 1000, -10);
    const risen = makeItem('Gone Up', 100, 25);
    const items = [risen, slightlyOffDear, halfOffCheap];

    expect(names(sortItems(items, 'price_change_percent', 'asc'))).toEqual([
      'Half Off Cheap',
      'Slightly Off Dear',
      'Gone Up',
    ]);
    expect(names(sortItems(items, 'price_change', 'asc'))).toEqual([
      'Slightly Off Dear',
      'Half Off Cheap',
      'Gone Up',
    ]);
  });

  it('sends items with no known change to the end of both directions', () => {
    const known = (() => {
      const best = listing({ converted_price: 100, price_change_7d: -5 });
      return item({ name: 'Known', listings: [best], best_price: 100, best_price_listing_ids: [best.id] });
    })();
    const unknown = (() => {
      const best = listing({ converted_price: 100, price_change_7d: null });
      return item({ name: 'Unknown', listings: [best], best_price: 100, best_price_listing_ids: [best.id] });
    })();
    expect(names(sortItems([unknown, known], 'price_change_percent', 'asc'))).toEqual(['Known', 'Unknown']);
    expect(names(sortItems([unknown, known], 'price_change_percent', 'desc'))).toEqual(['Known', 'Unknown']);
  });

  it('does not mutate the query cache it was handed', () => {
    const items = [item({ name: 'Zed' }), item({ name: 'Abe' })];
    const original = [...items];
    sortItems(items, 'name', 'asc');
    expect(items).toEqual(original);
  });

  it('renders an empty list without complaint', () => {
    expect(sortItems([], 'price', 'asc')).toEqual([]);
  });
});

describe('compareItems', () => {
  it('ranks ascending and reports a tie as zero', () => {
    const cheap = item({ name: 'A', best_price: 1 });
    const dear = item({ name: 'B', best_price: 2 });
    expect(compareItems(cheap, dear, 'price')).toBeLessThan(0);
    expect(compareItems(dear, cheap, 'price')).toBeGreaterThan(0);
    expect(compareItems(cheap, item({ name: 'C', best_price: 1 }), 'price')).toBe(0);
  });

  it('ranks an unanswerable item after an answerable one', () => {
    const priced = item({ best_price: 10 });
    const unpriced = item({ best_price: null });
    expect(compareItems(unpriced, priced, 'price')).toBe(1);
    expect(compareItems(priced, unpriced, 'price')).toBe(-1);
    expect(compareItems(unpriced, item({ best_price: null }), 'price')).toBe(0);
  });
});
