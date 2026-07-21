import { Product, PriceReviewResponse } from '../../../../types/api';

export type SortOption = 'date_added' | 'name' | 'category' | 'price' | 'price_change' | 'price_change_percent' | 'status' | 'last_checked' | 'website';
export type SortOrder = 'asc' | 'desc';
export type PauseFilter = 'all' | 'active' | 'paused';

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date_added', label: 'Date Added' },
  { value: 'name', label: 'Product Name' },
  { value: 'category', label: 'Category' },
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
  categoryCounts: { name: string; count: number }[];
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

  const categoryMap = products.reduce((acc, p) => {
    const name = p.category || 'Uncategorized';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryCounts = Object.entries(categoryMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const stockMap = products.reduce((acc, p) => {
    const status = p.stock_status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const stockCounts = Object.entries(stockMap).map(([status, count]) => {
    const stockLabels: Record<string, string> = {
      in_stock: 'In Stock',
      out_of_stock: 'Out of Stock',
      pre_order: 'Pre-Order',
      not_available: 'Not Available',
      member_only: 'Member Only',
      unknown: 'Unknown'
    };
    return {
      name: stockLabels[status] || status,
      count
    };
  });

  return {
    totalProducts,
    biggestDrops,
    atTargetPrice,
    atHistoricalLow,
    pausedProducts,
    activeProducts,
    onSaleCount,
    retailerCounts,
    categoryCounts,
    stockCounts
  };
}

