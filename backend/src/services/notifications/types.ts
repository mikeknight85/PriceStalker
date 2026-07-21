export interface NotificationPayload {
  productName: string;
  productUrl: string;
  type: 'price_drop' | 'back_in_stock' | 'target_price' | 'not_available' | 'price_announced';
  productId?: number;
  oldPrice?: number;
  newPrice?: number;
  currency?: string;
  threshold?: number;
  targetPrice?: number;
}

export interface NotificationResult {
  channelsNotified: string[];
  channelsFailed: string[];
}

export interface NotificationProvider {
  send(payload: NotificationPayload): Promise<boolean>;
}
