export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  data: any;
  created_at: Date;
}

export interface CreateNotification {
  user_id: number;
  type: string;
  title: string;
  message: string;
  data?: any;
}

/**
 * Event types as stored. Each is the event itself, not a category -- the three
 * catch-all types they replace made distinct events indistinguishable once
 * persisted (issue #93).
 */
export const NOTIFICATION_EVENT_TYPES = [
  'price_drop',
  'target_price',
  'price_announced',
  'back_in_stock',
  'not_available',
  'product_restored',
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

/**
 * Filter groups offered in the UI.
 *
 * Grouped rather than one filter per type: a user looking for availability
 * problems wants unavailable and restored together, and should not have to know
 * which internal code produced which row.
 */
export const NOTIFICATION_CATEGORIES: Record<string, readonly NotificationEventType[]> = {
  price: ['price_drop', 'target_price', 'price_announced'],
  availability: ['back_in_stock', 'not_available', 'product_restored'],
};

export function eventTypesForCategory(category?: string | null): readonly string[] | null {
  if (!category || category === 'all') return null;
  if (NOTIFICATION_CATEGORIES[category]) return NOTIFICATION_CATEGORIES[category];
  // A bare event type is also a valid filter, so a deep link to one still works.
  return NOTIFICATION_EVENT_TYPES.includes(category as NotificationEventType) ? [category] : null;
}
