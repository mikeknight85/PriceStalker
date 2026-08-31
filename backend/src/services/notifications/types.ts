export interface NotificationPayload {
  productName: string;
  productUrl: string;
  type: 'price_drop' | 'back_in_stock' | 'target_price' | 'not_available' | 'product_restored' | 'price_announced';
  productId?: number;
  oldPrice?: number;
  newPrice?: number;
  currency?: string;
  threshold?: number;
  targetPrice?: number;
  /**
   * Stock transition that triggered the notification, when there was one.
   * Without these a custom template cannot tell "back in stock" from a price
   * drop, and every event renders through the same price-shaped wording.
   */
  oldStockStatus?: string;
  newStockStatus?: string;
}

export interface NotificationResult {
  channelsNotified: string[];
  channelsFailed: string[];
}

export interface NotificationProvider {
  send(payload: NotificationPayload): Promise<boolean>;
}
