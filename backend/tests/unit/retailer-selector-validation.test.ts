import { describe, it, expect } from 'vitest';
import { validateSelector } from '../../src/services/ai/strategies/retailer-config';

describe('Retailer Config Selector Validation', () => {
  it('rejects modal and dialog selectors for product titles', () => {
    expect(validateSelector('h2.explore-modal-title', 'https://example.com', 'name')).toBe(false);
    expect(validateSelector('.modal-header h3', 'https://example.com', 'name_selectors')).toBe(false);
    expect(validateSelector('[role="dialog"] h2', 'https://example.com', 'name')).toBe(false);
    expect(validateSelector('h1.product-title', 'https://example.com', 'name')).toBe(true);
  });

  it('rejects modal and dialog selectors for price fields', () => {
    expect(validateSelector('.modal-body span.price', 'https://example.com', 'price_selectors')).toBe(false);
    expect(validateSelector('[role="dialog"] .sale-price', 'https://example.com', 'deal_price_selectors')).toBe(false);
  });

  it('does not reject legitimate alert class selectors like price-alert', () => {
    expect(validateSelector('.price-alert span', 'https://example.com', 'price_selectors')).toBe(true);
  });
});
