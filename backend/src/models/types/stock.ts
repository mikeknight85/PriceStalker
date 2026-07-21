import { StockStatus } from './base';

export interface StockStatusHistory {
  id: number;
  product_id: number;
  status: StockStatus;
  changed_at: Date;
}

export interface StockStatusStats {
  availability_percent: number;
  outage_count: number;
  avg_outage_days: number | null;
  longest_outage_days: number | null;
  current_status: StockStatus;
  days_in_current_status: number;
}
