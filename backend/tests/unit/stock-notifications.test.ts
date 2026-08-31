import { describe, it, expect } from 'vitest';
import { interpolateTemplate } from '../../src/services/notifications/utils';
import type { NotificationPayload } from '../../src/services/notifications/types';
import { isBackInStockFrom } from '../../src/services/domain/product/ProductRefreshService';

const base: NotificationPayload = {
  productName: 'WaveShare POE USB-C Splitter',
  productUrl: 'https://shop.example.com/p/1',
  type: 'back_in_stock',
  productId: 409,
};

describe('Notification templates', () => {
  describe('missing values read as missing', () => {
    it('says a price is unavailable rather than N/A', () => {
      // A product can come back in stock before a price is extracted.
      expect(interpolateTemplate('Price: {{current_price}}', base)).toBe('Price: unavailable');
    });

    it('renders a zero price rather than treating it as absent', () => {
      // `payload.newPrice ? ...` treated 0 as missing.
      expect(interpolateTemplate('{{current_price}}', { ...base, newPrice: 0 })).toBe('0.00');
    });

    it('does not invent USD for an unknown currency', () => {
      // The rest of the app stopped guessing when unresolved currencies moved
      // to manual confirmation; this path was still defaulting.
      expect(interpolateTemplate('[{{currency}}]', base)).toBe('[]');
      expect(interpolateTemplate('[{{currency}}]', { ...base, currency: 'AUD' })).toBe('[AUD]');
    });
  });

  describe('stock event variables', () => {
    it('exposes the transition so a template can describe the event', () => {
      const payload: NotificationPayload = {
        ...base,
        oldStockStatus: 'out_of_stock',
        newStockStatus: 'in_stock',
      };

      expect(
        interpolateTemplate('{{product_name}}: {{old_stock_status}} -> {{new_stock_status}}', payload)
      ).toBe('WaveShare POE USB-C Splitter: Out of stock -> In stock');
    });

    it('reads unknown when there was no transition', () => {
      expect(interpolateTemplate('{{new_stock_status}}', base)).toBe('unknown');
    });
  });

  it('still renders an ordinary price drop', () => {
    const payload: NotificationPayload = {
      ...base,
      type: 'price_drop',
      oldPrice: 49.99,
      newPrice: 39.99,
      currency: 'AUD',
    };
    expect(
      interpolateTemplate('{{product_name}} fell from {{old_price}} to {{current_price}} {{currency}}', payload)
    ).toBe('WaveShare POE USB-C Splitter fell from 49.99 to 39.99 AUD');
  });
});

describe('what counts as coming back in stock', () => {
  it('includes every status where the item existed but could not be bought', () => {
    // member_only was missing (issue #92). From the user's side it is the same
    // event as the rest of this list: the item was there, they could not buy
    // it, and now they can.
    expect(isBackInStockFrom('out_of_stock')).toBe(true);
    expect(isBackInStockFrom('pre_order')).toBe(true);
    expect(isBackInStockFrom('not_available')).toBe(true);
    expect(isBackInStockFrom('member_only')).toBe(true);
  });

  it('excludes unknown, which is an absence of information rather than a state', () => {
    // Otherwise the first successful scrape after any parse failure announces
    // "back in stock" for a product that was in stock the whole time.
    expect(isBackInStockFrom('unknown')).toBe(false);
  });

  it('excludes a product that has never had a status', () => {
    expect(isBackInStockFrom(null)).toBe(false);
  });

  it('does not fire on a product that was already in stock', () => {
    expect(isBackInStockFrom('in_stock')).toBe(false);
  });
});
