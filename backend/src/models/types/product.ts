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
