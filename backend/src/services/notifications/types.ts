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
  /**
   * Why the product could not be read, already phrased for a person.
   *
   * Every channel hardcoded "Page no longer exists (404/410)", so a timeout, a
   * redirect and a soft 404 were all reported as a dead page -- while the
   * in-app history, which does receive the reason, said something different.
   */
  /**
   * Which store the alert is about, when naming it helps.
   *
   * Set only where a product is tracked at more than one shop: with a single
   * store the alert can only be about that one, and saying so is clutter. See
   * repositories/store-context.ts (issue #143).
   */
  storeName?: string;
  reason?: string;
  /**
   * Whether monitoring actually stopped. Defaults to true when absent, matching
   * the definitive-unavailable path. The transient-failure path passes false:
   * it keeps retrying, and saying otherwise is simply untrue.
   */
  paused?: boolean;
}

export interface NotificationResult {
  channelsNotified: string[];
  channelsFailed: string[];
}

export interface NotificationProvider {
  send(payload: NotificationPayload): Promise<boolean>;
}
