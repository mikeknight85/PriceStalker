import { describe, it, expect } from 'vitest';
import {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_CATEGORIES,
  eventTypesForCategory,
} from '../../src/models/types/notification';

/**
 * Notifications were stored under three catch-all types, so distinct events
 * became indistinguishable the moment they were persisted: a product going
 * missing, a retailer being unreachable and a product coming back were all
 * `system_alert`, labelled "Tracking Issue".
 */

describe('Notification event types', () => {
  it('covers every event the product lifecycle can produce', () => {
    // If an alert is added without a type here, it silently falls through to a
    // de-underscored code in the UI, which is how "Tracking Issue" happened.
    expect([...NOTIFICATION_EVENT_TYPES].sort()).toEqual([
      'back_in_stock',
      'not_available',
      'price_announced',
      'price_drop',
      'product_restored',
      'target_price',
    ]);
  });

  describe('categories group by what a user is looking for', () => {
    it('puts every availability event under one filter', () => {
      // Someone chasing an availability problem should not have to know which
      // internal code produced which row.
      expect([...NOTIFICATION_CATEGORIES.availability].sort()).toEqual([
        'back_in_stock',
        'not_available',
        'product_restored',
      ]);
    });

    it('puts every price event under one filter', () => {
      expect([...NOTIFICATION_CATEGORIES.price].sort()).toEqual([
        'price_announced',
        'price_drop',
        'target_price',
      ]);
    });

    it('assigns every event type to exactly one category', () => {
      const assigned = Object.values(NOTIFICATION_CATEGORIES).flat();
      expect([...assigned].sort()).toEqual([...NOTIFICATION_EVENT_TYPES].sort());
      expect(new Set(assigned).size).toBe(assigned.length);
    });
  });

  describe('resolving a filter', () => {
    it('returns null for no filter, so the query stays unfiltered', () => {
      expect(eventTypesForCategory(null)).toBeNull();
      expect(eventTypesForCategory(undefined)).toBeNull();
      expect(eventTypesForCategory('all')).toBeNull();
    });

    it('expands a category', () => {
      expect(eventTypesForCategory('availability')).toHaveLength(3);
    });

    it('accepts a bare event type, so a deep link to one still works', () => {
      expect(eventTypesForCategory('not_available')).toEqual(['not_available']);
    });

    it('ignores an unknown filter rather than returning nothing', () => {
      // Returning an empty array would match no rows and read as "you have no
      // notifications", which is worse than ignoring a bad parameter.
      expect(eventTypesForCategory('nonsense')).toBeNull();
      expect(eventTypesForCategory('stock_alert')).toBeNull();
    });
  });
});
