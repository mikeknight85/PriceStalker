import { describe, it, expect } from 'vitest';
import { withItemAlertSettings, ITEM_ALERT_COLUMNS, ITEM_ALERT_JOIN } from '../../src/services/domain/product/repositories/item-alert-settings';

/**
 * Alert settings moved from the listing to the item (issue #143), because
 * "tell me when anyone has this under 50" describes what the user wants, not
 * one shop's page.
 *
 * The risk this guards is quiet: if a query returns the product's own stale
 * column instead of the item's, alerts fire against a threshold the user
 * changed days ago, and nothing looks broken.
 */

const row = (over: Record<string, any> = {}) => ({
  id: 7,
  item_id: 3,
  url: 'https://shop.example/p/1',
  // What the products table still carries. These columns are retained until a
  // later migration drops them, so they are exactly the stale values that must
  // not win.
  target_price: 999.99,
  price_drop_threshold: 99,
  notify_back_in_stock: false,
  // What the join supplies.
  item_target_price: 249.99,
  item_price_drop_threshold: 10,
  item_notify_back_in_stock: true,
  ...over,
});

describe('withItemAlertSettings', () => {
  it('lets the item win over the listing column', () => {
    const p = withItemAlertSettings(row());
    expect(p.target_price).toBe(249.99);
    expect(p.price_drop_threshold).toBe(10);
    expect(p.notify_back_in_stock).toBe(true);
  });

  it('strips the aliased columns, so nothing downstream sees two spellings', () => {
    const p = withItemAlertSettings(row());
    expect(p).not.toHaveProperty('item_target_price');
    expect(p).not.toHaveProperty('item_price_drop_threshold');
    expect(p).not.toHaveProperty('item_notify_back_in_stock');
  });

  it('leaves every other column alone', () => {
    const p = withItemAlertSettings(row());
    expect(p.id).toBe(7);
    expect(p.url).toBe('https://shop.example/p/1');
    expect(p.item_id).toBe(3);
  });

  it('reads a cleared item setting as cleared, not as the stale listing value', () => {
    // A user who removes their target price must not have the old one revived
    // from the column we stopped writing to.
    const p = withItemAlertSettings(row({ item_target_price: null, item_price_drop_threshold: null }));
    expect(p.target_price).toBeNull();
    expect(p.price_drop_threshold).toBeNull();
  });

  it('treats a missing back-in-stock flag as off rather than undefined', () => {
    expect(withItemAlertSettings(row({ item_notify_back_in_stock: null })).notify_back_in_stock).toBe(false);
  });

  it('keeps a zero target price, which is a real value', () => {
    expect(withItemAlertSettings(row({ item_target_price: 0 })).target_price).toBe(0);
  });

  describe('a product with no item', () => {
    it('keeps whatever the row held rather than silently clearing alerts', () => {
      // Should not arise -- every product gets an item -- but a scrape is the
      // wrong place to discover a broken invariant by turning alerts off.
      const p = withItemAlertSettings(row({ item_id: null, item_target_price: null, item_notify_back_in_stock: null }));
      expect(p.target_price).toBe(999.99);
      expect(p.notify_back_in_stock).toBe(false);
    });

    it('still strips the aliased columns', () => {
      const p = withItemAlertSettings(row({ item_id: null }));
      expect(p).not.toHaveProperty('item_target_price');
    });
  });
});

describe('the SQL fragments', () => {
  it('alias every column, so none collides with p.*', () => {
    // Selecting bare i.target_price alongside p.* yields two columns of the
    // same name, and which one the driver keeps is undocumented.
    for (const col of ['target_price', 'price_drop_threshold', 'notify_back_in_stock']) {
      expect(ITEM_ALERT_COLUMNS).toContain(`AS item_${col}`);
    }
  });

  it('join on the item, and do so as a LEFT join', () => {
    // An inner join would silently drop any product whose item is missing --
    // taking it out of the scheduler entirely rather than surfacing the fault.
    expect(ITEM_ALERT_JOIN).toContain('LEFT JOIN items i');
    expect(ITEM_ALERT_JOIN).toContain('i.id = p.item_id');
  });
});
