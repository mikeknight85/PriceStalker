import { AIStatus, StockStatus } from './base';

export interface Product {
  id: number;
  user_id: number;
  url: string;
  name: string | null;
  image_url: string | null;
  refresh_interval: number;
  last_checked: Date | null;
  next_check_at: Date | null;
  stock_status: StockStatus;
  page_gone_streak?: number;
  /** Why the product is unavailable, when it is. See types/availability. */
  unavailable_reason?: string | null;
  /** True when the system paused monitoring, false when a user did. */
  auto_paused?: boolean;
  /** Consecutive transport failures; distinct from page_gone_streak. */
  failure_streak?: number;
  last_failure_at?: Date | null;
  price_drop_threshold: number | null;
  target_price: number | null;
  notify_back_in_stock: boolean;
  ai_status: AIStatus;
  ai_verification_disabled: boolean;
  ai_extraction_disabled: boolean;
  category: string | null;
  checking_paused: boolean;
  created_at: Date;
}

export interface ProductWithLatestPrice extends Product {
  current_price: number | null;
  member_price: number | null;
  original_price: number | null;
  currency: string | null;
  converted_price: number | null;
  converted_currency: string | null;
  conversion_rate_date?: string | null;
  conversion_source?: string | null;
  retailer_name?: string | null;
}

export interface ProductWithSparkline extends ProductWithLatestPrice {
  sparkline: SparklinePoint[];
  price_change_7d: number | null;
  min_price: number | null;
}

export interface SparklinePoint {
  price: number;
  recorded_at: Date;
}

export interface PriceHistory {
  id: number;
  product_id: number;
  price: number;
  currency: string;
  ai_status: AIStatus;
  details?: any;
  recorded_at: Date;
}
