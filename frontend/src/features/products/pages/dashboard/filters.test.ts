import { describe, expect, it } from 'vitest';
import { ItemWithListings, Product, StockStatus } from '../../../../types/api';
import {
  isListingPaused,
  itemMatchesStockFilter,
  itemMatchesTrackingFilter,
  itemStockStatus,
  itemTrackingState,
  listingStockStatus,
  matchesStockFilter,
  matchesTrackingFilter,
} from './filters';
import {
  STOCK_FILTER_OPTIONS,
  STOCK_STATUS_BY_AVAILABILITY,
  StockFilter,
  TRACKING_FILTER_OPTIONS,
  TrackingFilter,
} from './utils';

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
    // The card's own badge: derived, so a fixture cannot claim one thing while
    // its listings say another.
    any_in_stock: listings.some(l => l.stock_status === 'in_stock'),
    ...overrides,
  };
}

const ALL_STATUSES = STOCK_STATUS_BY_AVAILABILITY;
const TRACKING_VALUES = TRACKING_FILTER_OPTIONS.map(option => option.value);
const STOCK_VALUES = STOCK_FILTER_OPTIONS.map(option => option.value);

/** An unknown-shaped value, the way an unmocked endpoint or a driver sends it. */
function wire(value: unknown): Partial<Product> {
  return value as Partial<Product>;
}

describe('the filter dropdowns', () => {
  it('offers one stock option per status, so none is unreachable', () => {
    expect(STOCK_VALUES).toEqual(['all', ...ALL_STATUSES]);
  });

  it('keeps tracking and stock as separate questions', () => {
    expect(TRACKING_VALUES).toEqual(['all', 'active', 'paused']);
    expect(STOCK_VALUES).not.toContain('active');
    expect(STOCK_VALUES).not.toContain('paused');
  });
});

describe('reading a listing', () => {
  it('reads a paused listing however the wire spelled it', () => {
    expect(isListingPaused(listing({ checking_paused: true }))).toBe(true);
    expect(isListingPaused(listing(wire({ checking_paused: 1 })))).toBe(true);
    expect(isListingPaused(listing(wire({ checking_paused: 't' })))).toBe(true);
  });

  it('reads anything else as still being checked', () => {
    expect(isListingPaused(listing({ checking_paused: false }))).toBe(false);
    expect(isListingPaused(listing(wire({ checking_paused: 0 })))).toBe(false);
    expect(isListingPaused(listing(wire({ checking_paused: null })))).toBe(false);
    expect(isListingPaused(listing(wire({ checking_paused: undefined })))).toBe(false);
  });

  it('files a missing or unrecognised stock status under unknown', () => {
    expect(listingStockStatus(listing(wire({ stock_status: null })))).toBe('unknown');
    expect(listingStockStatus(listing(wire({ stock_status: undefined })))).toBe('unknown');
    expect(listingStockStatus(listing(wire({ stock_status: 'on_the_moon' })))).toBe('unknown');
  });

  it('keeps every real status as itself', () => {
    ALL_STATUSES.forEach(status => {
      expect(listingStockStatus(listing({ stock_status: status }))).toBe(status);
    });
  });
});

describe('the flat "All stores" view', () => {
  it('filters tracking on the listing own pause flag', () => {
    const active = listing({ checking_paused: false });
    const paused = listing({ checking_paused: true });

    expect(matchesTrackingFilter(active, 'active')).toBe(true);
    expect(matchesTrackingFilter(active, 'paused')).toBe(false);
    expect(matchesTrackingFilter(paused, 'paused')).toBe(true);
    expect(matchesTrackingFilter(paused, 'active')).toBe(false);
  });

  it('filters stock on the listing own status', () => {
    const subject = listing({ stock_status: 'pre_order' });
    expect(matchesStockFilter(subject, 'pre_order')).toBe(true);
    expect(matchesStockFilter(subject, 'in_stock')).toBe(false);
    expect(matchesStockFilter(subject, 'out_of_stock')).toBe(false);
  });

  it('puts every listing in exactly one bucket of each filter', () => {
    const subjects = ALL_STATUSES.flatMap(status => [
      listing({ stock_status: status, checking_paused: false }),
      listing({ stock_status: status, checking_paused: true }),
    ]);

    subjects.forEach(subject => {
      const stockMatches = ALL_STATUSES.filter(status => matchesStockFilter(subject, status));
      const trackingMatches = (['active', 'paused'] as TrackingFilter[])
        .filter(value => matchesTrackingFilter(subject, value));
      expect(stockMatches).toHaveLength(1);
      expect(trackingMatches).toHaveLength(1);
    });
  });

  it('treats "all" as a true no-op for both filters', () => {
    const subjects = ALL_STATUSES.flatMap(status => [
      listing({ stock_status: status, checking_paused: false }),
      listing({ stock_status: status, checking_paused: true }),
      listing(wire({ stock_status: null, checking_paused: null })),
    ]);

    expect(subjects.every(subject => matchesTrackingFilter(subject, 'all'))).toBe(true);
    expect(subjects.every(subject => matchesStockFilter(subject, 'all'))).toBe(true);
  });

  it('combines the two filters, each still deciding on its own field', () => {
    const subjects = [
      listing({ name: 'active in stock', checking_paused: false, stock_status: 'in_stock' }),
      listing({ name: 'active out of stock', checking_paused: false, stock_status: 'out_of_stock' }),
      listing({ name: 'paused in stock', checking_paused: true, stock_status: 'in_stock' }),
      listing({ name: 'paused out of stock', checking_paused: true, stock_status: 'out_of_stock' }),
    ];

    const select = (tracking: TrackingFilter, stock: StockFilter) =>
      subjects
        .filter(s => matchesTrackingFilter(s, tracking) && matchesStockFilter(s, stock))
        .map(s => s.name);

    expect(select('active', 'out_of_stock')).toEqual(['active out of stock']);
    expect(select('paused', 'in_stock')).toEqual(['paused in stock']);
    expect(select('all', 'in_stock')).toEqual(['active in stock', 'paused in stock']);
    expect(select('paused', 'all')).toEqual(['paused in stock', 'paused out of stock']);
    expect(select('all', 'all')).toHaveLength(4);
  });
});

describe('the grouped "By product" view', () => {
  it('keeps an item active while any one store is still being checked', () => {
    const mixed = item({
      listings: [listing({ checking_paused: true }), listing({ checking_paused: false })],
    });

    expect(itemTrackingState(mixed)).toBe('active');
    expect(itemMatchesTrackingFilter(mixed, 'active')).toBe(true);
    expect(itemMatchesTrackingFilter(mixed, 'paused')).toBe(false);
  });

  it('calls an item paused only once every store is', () => {
    const allPaused = item({
      listings: [listing({ checking_paused: true }), listing({ checking_paused: true })],
    });

    expect(itemTrackingState(allPaused)).toBe('paused');
    expect(itemMatchesTrackingFilter(allPaused, 'paused')).toBe(true);
    expect(itemMatchesTrackingFilter(allPaused, 'active')).toBe(false);
  });

  it('counts an item with no stores as paused rather than silently active', () => {
    expect(itemTrackingState(item({ listings: [] }))).toBe('paused');
    expect(itemStockStatus(item({ listings: [] }))).toBe('unknown');
  });

  it('survives a listings field that is not an array', () => {
    // Not an array: an endpoint answering `{}` must filter to nothing rather
    // than throw the dashboard away.
    const broken: ItemWithListings = {
      ...item({ listings: [] }),
      listings: {} as unknown as Product[],
    };
    expect(itemTrackingState(broken)).toBe('paused');
    expect(itemStockStatus(broken)).toBe('unknown');
    expect(itemMatchesStockFilter(broken, 'all')).toBe(true);
  });

  it('is in stock when its stores disagree and one of them has it', () => {
    const disagreeing = item({
      listings: [
        listing({ stock_status: 'out_of_stock' }),
        listing({ stock_status: 'in_stock' }),
        listing({ stock_status: 'unknown' }),
      ],
    });

    expect(itemStockStatus(disagreeing)).toBe('in_stock');
    expect(itemMatchesStockFilter(disagreeing, 'in_stock')).toBe(true);
    // The point of the decision: a card reading "In stock" must never come back
    // from the Out of Stock filter.
    expect(itemMatchesStockFilter(disagreeing, 'out_of_stock')).toBe(false);
    expect(itemMatchesStockFilter(disagreeing, 'unknown')).toBe(false);
  });

  it('is out of stock only when nowhere has it', () => {
    const nowhere = item({
      listings: [listing({ stock_status: 'out_of_stock' }), listing({ stock_status: 'not_available' })],
    });

    expect(itemStockStatus(nowhere)).toBe('out_of_stock');
    expect(itemMatchesStockFilter(nowhere, 'out_of_stock')).toBe(true);
    expect(itemMatchesStockFilter(nowhere, 'in_stock')).toBe(false);
  });

  it('falls back to the next most available status its stores can offer', () => {
    const preOrder = item({
      listings: [listing({ stock_status: 'out_of_stock' }), listing({ stock_status: 'pre_order' })],
    });
    expect(itemStockStatus(preOrder)).toBe('pre_order');

    const memberOnly = item({
      listings: [listing({ stock_status: 'pre_order' }), listing({ stock_status: 'member_only' })],
    });
    expect(itemStockStatus(memberOnly)).toBe('member_only');

    const unsure = item({
      listings: [listing({ stock_status: 'not_available' }), listing({ stock_status: 'unknown' })],
    });
    expect(itemStockStatus(unsure)).toBe('unknown');
  });

  it('agrees with the badge the card already shows', () => {
    const combinations: StockStatus[][] = [
      ['in_stock'],
      ['out_of_stock'],
      ['in_stock', 'out_of_stock'],
      ['member_only', 'pre_order'],
      ['unknown', 'not_available'],
      ['out_of_stock', 'unknown', 'in_stock'],
    ];

    combinations.forEach(statuses => {
      const subject = item({ listings: statuses.map(status => listing({ stock_status: status })) });
      expect(itemStockStatus(subject) === 'in_stock').toBe(subject.any_in_stock);
    });
  });

  it('answers a one-store item exactly as the flat view answers its listing', () => {
    ALL_STATUSES.forEach(status => {
      [true, false].forEach(paused => {
        const only = listing({ stock_status: status, checking_paused: paused });
        const single = item({ listings: [only] });

        STOCK_VALUES.forEach(value => {
          expect(itemMatchesStockFilter(single, value)).toBe(matchesStockFilter(only, value));
        });
        TRACKING_VALUES.forEach(value => {
          expect(itemMatchesTrackingFilter(single, value)).toBe(matchesTrackingFilter(only, value));
        });
      });
    });
  });

  it('puts every item in exactly one bucket of each filter', () => {
    const subjects = [
      item({ listings: [listing({ stock_status: 'in_stock' })] }),
      item({ listings: [listing({ stock_status: 'in_stock' }), listing({ stock_status: 'out_of_stock' })] }),
      item({ listings: [listing({ stock_status: 'member_only' }), listing({ stock_status: 'unknown' })] }),
      item({ listings: [] }),
    ];

    subjects.forEach(subject => {
      const stockMatches = ALL_STATUSES.filter(status => itemMatchesStockFilter(subject, status));
      const trackingMatches = (['active', 'paused'] as TrackingFilter[])
        .filter(value => itemMatchesTrackingFilter(subject, value));
      expect(stockMatches).toHaveLength(1);
      expect(trackingMatches).toHaveLength(1);
    });
  });

  it('treats "all" as a true no-op for both filters', () => {
    const subjects = [
      item({ listings: [listing({ stock_status: 'out_of_stock', checking_paused: true })] }),
      item({ listings: [listing({ stock_status: 'in_stock' }), listing({ stock_status: 'not_available' })] }),
      item({ listings: [] }),
    ];

    expect(subjects.every(subject => itemMatchesTrackingFilter(subject, 'all'))).toBe(true);
    expect(subjects.every(subject => itemMatchesStockFilter(subject, 'all'))).toBe(true);
  });

  it('combines the two filters on an item whose stores disagree about both', () => {
    // One store paused with stock, one active without: the item is both active
    // and in stock, because each filter asks its own question of the best store.
    const subject = item({
      listings: [
        listing({ checking_paused: true, stock_status: 'in_stock' }),
        listing({ checking_paused: false, stock_status: 'out_of_stock' }),
      ],
    });

    expect(itemMatchesTrackingFilter(subject, 'active') && itemMatchesStockFilter(subject, 'in_stock')).toBe(true);
    expect(itemMatchesTrackingFilter(subject, 'paused') && itemMatchesStockFilter(subject, 'in_stock')).toBe(false);
    expect(itemMatchesTrackingFilter(subject, 'active') && itemMatchesStockFilter(subject, 'out_of_stock')).toBe(false);
  });

  it('selects the same items the dashboard would render for each pair of filters', () => {
    const live = item({
      name: 'Live and available',
      listings: [listing({ checking_paused: false, stock_status: 'in_stock' })],
    });
    const parked = item({
      name: 'Parked and gone',
      listings: [listing({ checking_paused: true, stock_status: 'out_of_stock' })],
    });
    const mixed = item({
      name: 'Three stores, one with stock',
      listings: [
        listing({ checking_paused: true, stock_status: 'out_of_stock' }),
        listing({ checking_paused: true, stock_status: 'in_stock' }),
        listing({ checking_paused: true, stock_status: 'not_available' }),
      ],
    });
    const items = [live, parked, mixed];

    const select = (tracking: TrackingFilter, stock: StockFilter) =>
      items
        .filter(i => itemMatchesTrackingFilter(i, tracking) && itemMatchesStockFilter(i, stock))
        .map(i => i.name);

    expect(select('all', 'all')).toEqual([live.name, parked.name, mixed.name]);
    expect(select('active', 'all')).toEqual([live.name]);
    expect(select('paused', 'in_stock')).toEqual([mixed.name]);
    expect(select('paused', 'out_of_stock')).toEqual([parked.name]);
    expect(select('active', 'out_of_stock')).toEqual([]);
  });
});
