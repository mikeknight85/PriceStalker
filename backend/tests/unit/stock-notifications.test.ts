import { describe, it, expect } from 'vitest';
import { interpolateTemplate } from '../../src/services/notifications/utils';
import type { NotificationPayload } from '../../src/services/notifications/types';

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
