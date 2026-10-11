import { Product, PriceReviewResponse, StockStatus } from '../../../../types/api';

export type SortOption = 'date_added' | 'name' | 'tag' | 'price' | 'price_change' | 'price_change_percent' | 'status' | 'last_checked' | 'website';
export type SortOrder = 'asc' | 'desc';

/**
 * The two dashboard filters, kept apart on purpose (issue #246).
 *
 * They used to be one control labelled "All Status", which filtered on
 * `checking_paused` -- whether PriceStalker is still checking the page. Users
 * read it as stock and got nothing of the sort, and there was no way to ask the
 * dashboard the question they actually had ("what is out of stock?").
 *
 * `TrackingFilter` is about us: are we still looking at this page.
 * `StockFilter` is about the retailer: can you buy the thing.
 * Neither implies the other -- an actively checked listing is routinely out of
 * stock, and a paused one can be sitting in stock -- so they are separate
 * dropdowns with separate wording, and they compose.
 */
export type TrackingFilter = 'all' | 'active' | 'paused';

/** 'all' plus every `StockStatus`, so no status is unreachable from the UI. */
export type StockFilter = 'all' | StockStatus;

export const TRACKING_FILTER_OPTIONS: { value: TrackingFilter; label: string }[] = [
  { value: 'all', label: 'All Tracking' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
];

/**
 * How the UI names each stock status. One table, read by the filter dropdown,
 * so the filter and the summary card cannot drift apart.
 */
export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  in_stock: 'In Stock',
  out_of_stock: 'Out of Stock',
  pre_order: 'Pre-Order',
  not_available: 'Not Available',
  member_only: 'Member Only',
  unknown: 'Unknown',
};

/**
 * Most available first. Also the order the dropdown lists them in, and the
 * precedence used to give a grouped item one status out of several stores --
 * see `filters.ts`.
 */
export const STOCK_STATUS_BY_AVAILABILITY: StockStatus[] = [
  'in_stock',
  'member_only',
  'pre_order',
  'unknown',
  'out_of_stock',
  'not_available',
];

export const STOCK_FILTER_OPTIONS: { value: StockFilter; label: string }[] = [
  { value: 'all', label: 'All Stock' },
  ...STOCK_STATUS_BY_AVAILABILITY.map(status => ({
    value: status as StockFilter,
    label: STOCK_STATUS_LABELS[status],
  })),
];

/**
 * A remembered dropdown choice, or the default when nothing valid is stored.
 *
 * Validated against the option list rather than cast: a value left behind by an
 * older build (or by hand) would otherwise leave the select showing nothing,
 * which is how the `sortBy` guard below came to exist. Reads are wrapped
 * because a private window throws on access instead of returning null, and a
 * dashboard that will not render is worse than one that forgets a preference.
 */
export function readStoredChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(key);
  } catch {
    return fallback;
  }
  return allowed.some(value => value === saved) ? (saved as T) : fallback;
}

/** Stores a dropdown choice, treating the preference as optional. */
export function writeStoredChoice(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* preference is optional */
  }
}

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date_added', label: 'Date Added' },
  { value: 'name', label: 'Product Name' },
  { value: 'tag', label: 'Tags' },
  { value: 'price', label: 'Price' },
  { value: 'price_change', label: 'Price Change ($)' },
  { value: 'price_change_percent', label: 'Price Change (%)' },
  { value: 'status', label: 'Stock Status' },
  { value: 'last_checked', label: 'Last Checked' },
  { value: 'website', label: 'Website' },
];

// Type guard to check if response needs review
export function isPriceReviewResponse(response: Product | PriceReviewResponse): response is PriceReviewResponse {
  return 'needsReview' in response && response.needsReview === true;
}

export const getWebsite = (url: string) => {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
};

export interface DashboardSummaryData {
  totalProducts: number;
  biggestDrops: Product[];
  atTargetPrice: Product[];
  atHistoricalLow: Product[];
  pausedProducts: number;
  activeProducts: number;
  onSaleCount: number;
  retailerCounts: { name: string; count: number }[];
  tagCounts: { name: string; count: number }[];
  stockCounts: { name: string; count: number }[];
}

export function calculateDashboardSummary(products: Product[]): DashboardSummaryData | null {
  if (products.length === 0) return null;

  const totalProducts = products.length;
  const biggestDrops = [...products]
    .filter(p => p.price_change_7d && p.price_change_7d < 0)
    .sort((a, b) => (a.price_change_7d || 0) - (b.price_change_7d || 0))
    .slice(0, 3);

  const atTargetPrice = products.filter(p =>
    p.target_price && p.current_price &&
    parseFloat(String(p.current_price)) <= parseFloat(String(p.target_price))
  );

  const atHistoricalLow = products.filter(p =>
    p.current_price && p.min_price &&
    parseFloat(String(p.current_price)) <= parseFloat(String(p.min_price))
  );

  const pausedProducts = products.filter(p => p.checking_paused).length;
  const activeProducts = totalProducts - pausedProducts;
  const onSaleCount = products.filter(p => 
    p.original_price && p.current_price && p.current_price < p.original_price
  ).length;

  const retailerMap = products.reduce((acc, p) => {
    const name = p.retailer_name || 'Unknown';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const retailerCounts = Object.entries(retailerMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // `p.category` is the wire field for what the UI calls tags (issue #147).
  const tagMap = products.reduce((acc, p) => {
    const name = p.category || 'Untagged';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const tagCounts = Object.entries(tagMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const stockMap = products.reduce((acc, p) => {
    const status = p.stock_status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const stockCounts = Object.entries(stockMap).map(([status, count]) => ({
    // The same table the filter dropdown reads, so the two cannot drift.
    name: STOCK_STATUS_LABELS[status as StockStatus] || status,
    count
  }));

  return {
    totalProducts,
    biggestDrops,
    atTargetPrice,
    atHistoricalLow,
    pausedProducts,
    activeProducts,
    onSaleCount,
    retailerCounts,
    tagCounts,
    stockCounts
  };
}

