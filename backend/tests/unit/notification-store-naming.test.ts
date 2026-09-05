import { describe, it, expect } from 'vitest';
import { describeEvent } from '../../src/services/notifications/events';
import { interpolateTemplate } from '../../src/services/notifications/utils';
import type { NotificationPayload } from '../../src/services/notifications/types';

/**
 * When a product is tracked at several shops, an alert has to say which one --
 * "the price dropped" is not actionable if you do not know where to go
 * (issue #143 phase 4, asked for directly on the issue).
 *
 * The other half matters just as much: with a single store the alert can only
 * be about that one, so naming it is clutter, and every existing user's
 * notifications must read exactly as they did before.
 */

const base: NotificationPayload = {
  productName: 'Sony WH-1000XM5',
  productUrl: 'https://digitec.ch/p/1',
  type: 'price_drop',
  oldPrice: 299,
  newPrice: 249.5,
  currency: 'CHF',
};

describe('naming the store when there are several', () => {
  it('says which shop the price dropped at', () => {
    expect(describeEvent({ ...base, storeName: 'Digitec' }).headline)
      .toBe('Price dropped from CHF 299.00 to CHF 249.50 (-CHF 49.50) at Digitec');
  });

  it('says which shop hit the target', () => {
    const event = describeEvent({ ...base, type: 'target_price', targetPrice: 250, storeName: 'Amazon' });
    expect(event.headline).toContain('at Amazon');
    expect(event.headline).toContain('at or below your target');
  });

  it('says which shop has it back in stock, without two "at"s', () => {
    const event = describeEvent({ ...base, type: 'back_in_stock', storeName: 'Galaxus' });
    expect(event.headline).toBe('This item is now available at Galaxus for CHF 249.50');
    expect(event.headline).not.toMatch(/at .* at /);
  });

  it('says which shop announced a price', () => {
    expect(describeEvent({ ...base, type: 'price_announced', storeName: 'Digitec' }).headline)
      .toBe('A price has been announced at Digitec: CHF 249.50');
  });

  it('still names the shop when the price itself is missing', () => {
    const event = describeEvent({ ...base, type: 'back_in_stock', newPrice: undefined, storeName: 'Digitec' });
    expect(event.headline).toBe('This item is now available at Digitec');
  });
});

describe('a single-store product reads exactly as before', () => {
  // Every existing user has single-store products. Their notifications must
  // not grow a clause because a feature they do not use now exists.
  it.each(['price_drop', 'target_price', 'back_in_stock', 'price_announced'] as const)(
    '%s says nothing about a store',
    (type) => {
      const event = describeEvent({ ...base, type, targetPrice: 250 });
      expect(event.headline).not.toContain(' at Digitec');
      expect(event.headline).not.toMatch(/\bat undefined\b/);
      expect(event.headline).not.toMatch(/\bat null\b/);
      expect(event.headline).not.toMatch(/\s{2,}/);
    }
  );

  it('produces the same price-drop wording it always did', () => {
    expect(describeEvent(base).headline)
      .toBe('Price dropped from CHF 299.00 to CHF 249.50 (-CHF 49.50)');
  });

  it('produces the same back-in-stock wording it always did', () => {
    expect(describeEvent({ ...base, type: 'back_in_stock' }).headline)
      .toBe('This item is now available at CHF 249.50');
  });
});

describe('the {{store}} template variable', () => {
  it('resolves to the store name', () => {
    expect(interpolateTemplate('{{product_name}} @ {{store}}', { ...base, storeName: 'Digitec' }))
      .toBe('Sony WH-1000XM5 @ Digitec');
  });

  it('is empty rather than "undefined" for a single-store product', () => {
    // A template using it must read naturally either way rather than rendering
    // a stray label.
    expect(interpolateTemplate('[{{store}}]', base)).toBe('[]');
  });
});
