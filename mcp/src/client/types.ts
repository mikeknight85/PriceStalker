export interface PriceStalkerClientConfig {
  baseUrl: string;
  apiToken: string;
  timeout?: number;
}

export interface ProductListing {
  id: number;
  item_id?: number | null;
  url: string;
  domain?: string;
  retailer_id?: number | null;
  retailer_name?: string | null;
  name: string | null;
  current_price: number | null;
  currency: string | null;
  image_url: string | null;
  stock_status: string | null;
  paused: boolean;
  last_checked: string | null;
  created_at: string;
  updated_at: string;
  // Alert settings on joined items
  target_price?: number | null;
  price_drop_threshold?: number | null;
  notify_back_in_stock?: boolean;
}

export interface Item {
  id: number;
  name: string;
  image_url?: string | null;
  target_price: number | null;
  price_drop_threshold: number | null;
  notify_back_in_stock: boolean;
  created_at: string;
  updated_at: string;
  stores?: ProductListing[];
  best_price?: number | null;
  currency?: string | null;
  store_count?: number;
}

export interface PriceHistoryPoint {
  id: number;
  product_id: number;
  price: number | null;
  currency: string | null;
  stock_status: string | null;
  created_at: string;
}

export interface PriceHistoryResult {
  history: PriceHistoryPoint[];
  stats?: {
    lowestPrice: number | null;
    highestPrice: number | null;
    currentPrice: number | null;
    averagePrice: number | null;
  };
}

export interface StockHistoryPoint {
  id: number;
  product_id: number;
  stock_status: string;
  created_at: string;
}

export interface StockHistoryResult {
  history: StockHistoryPoint[];
}

export interface RetailerConfig {
  id?: number;
  domain: string;
  name: string | null;
  status?: string | null;
  use_proxy?: boolean;
  use_browser_scraper?: boolean;
  currency_hint?: string | null;
  name_selectors?: string[];
  retailer_name_selectors?: string[];
  price_selectors?: string[];
  deal_price_selectors?: string[];
  original_price_selectors?: string[];
  member_price_selectors?: string[];
  image_selectors?: string[];
  stock_selectors?: string[];
  in_stock_phrases?: string[];
  out_of_stock_phrases?: string[];
  pre_order_phrases?: string[];
  member_only_phrases?: string[];
  exclusion_selectors?: string[];
  jsonld_image_key?: string | null;
  jsonld_price_key?: string | null;
  jsonld_name_key?: string | null;
  user_agent?: string | null;
  referrer?: string | null;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExtractionResult {
  success: boolean;
  name?: string | null;
  price?: number | { price?: number; currency?: string } | null;
  currency?: string | null;
  imageUrl?: string | null;
  stockStatus?: string | null;
  priceCandidates?: any[];
  html?: string;
  error?: string;
  needsReview?: boolean;
  debugFileUrl?: string | null;
  ai_extraction_result?: any;
}

export interface SystemLog {
  id: number;
  level: string;
  context: string;
  message: string;
  meta?: any;
  created_at: string;
}

export interface SystemLogsResponse {
  logs: SystemLog[];
  total: number;
  page: number;
  limit: number;
}

export interface SearXNGSearchResult {
  title: string;
  url: string;
  content: string;
  engine: string;
  parsed_url: string[];
  img_src?: string;
  price?: string | number;
}
