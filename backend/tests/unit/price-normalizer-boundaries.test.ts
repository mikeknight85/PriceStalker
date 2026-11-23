import { describe, it, expect } from 'vitest';
import { normalizePrice } from '../../src/utils/scraping/price/normalizer';

describe('normalizePrice Locale Awareness & Format Mismatch Recovery', () => {
  it('returns null on null, undefined, or empty string inputs', () => {
    expect(normalizePrice('')).toBeNull();
    expect(normalizePrice(null as any)).toBeNull();
    expect(normalizePrice(undefined as any)).toBeNull();
    expect(normalizePrice('   ')).toBeNull();
  });

  describe('valid locale parsing', () => {
    it('parses US format (1,234.56) under en-US and converts en_US underscore notation', () => {
      expect(normalizePrice('1,234.56', 'en-US')).toBe(1234.56);
      expect(normalizePrice('1,234.56', 'en_US')).toBe(1234.56);
      expect(normalizePrice('99.99', 'en-US')).toBe(99.99);
    });

    it('parses German/European format (1.234,56) under de-DE and fr-FR', () => {
      expect(normalizePrice('1.234,56', 'de-DE')).toBe(1234.56);
      expect(normalizePrice('1.234,56', 'de_DE')).toBe(1234.56);
      expect(normalizePrice('49,95', 'de-DE')).toBe(49.95);
    });

    it('handles Swiss apostrophe grouping separator (1\'234.50)', () => {
      expect(normalizePrice("1'234.50", 'de-CH')).toBe(1234.5);
      expect(normalizePrice("2'500.00", 'en-US')).toBe(2500);
      expect(normalizePrice("12'500.75", 'de-CH')).toBe(12500.75);
    });
  });

  describe('format mismatch detection & smart fallback', () => {
    it('recovers when given European separators (1.234,56) with an en-US locale hint', () => {
      // en-US expects '.' as decimal and ',' as group. The input has lastComma > lastPeriod,
      // which triggers a format mismatch error and falls back to smart parsing.
      expect(normalizePrice('1.234,56', 'en-US')).toBe(1234.56);
    });

    it('recovers when given US separators (1,234.56) with a de-DE locale hint', () => {
      // de-DE expects ',' as decimal and '.' as group. The input has lastPeriod > lastComma,
      // which triggers a format mismatch error and falls back to smart parsing.
      expect(normalizePrice('1,234.56', 'de-DE')).toBe(1234.56);
    });

    it('disambiguates single comma with 2 digits as decimal under en-US (123,45 -> 123.45)', () => {
      // Input has only comma, but en-US expects comma to be grouping.
      // Since it is followed by 2 digits, it detects that comma is likely decimal.
      expect(normalizePrice('123,45', 'en-US')).toBe(123.45);
    });

    it('disambiguates single comma with 3 digits as grouping under en-US (1,234 -> 1234)', () => {
      expect(normalizePrice('1,234', 'en-US')).toBe(1234);
    });

    it('disambiguates single period with 2 digits as decimal under de-DE (123.45 -> 123.45)', () => {
      // Input has only period, but de-DE expects period to be grouping.
      // Since it is followed by 2 digits, it detects that period is likely decimal.
      expect(normalizePrice('123.45', 'de-DE')).toBe(123.45);
    });

    it('disambiguates single period with 3 digits as grouping under de-DE (1.234 -> 1234)', () => {
      expect(normalizePrice('1.234', 'de-DE')).toBe(1234);
    });

    it('falls back seamlessly when locale is completely unsupported or invalid', () => {
      expect(normalizePrice('1,234.56', 'not-a-locale-xyz')).toBe(1234.56);
      expect(normalizePrice('1.234,56', 'fake_LOCALE')).toBe(1234.56);
      expect(normalizePrice('123,45', 'invalid')).toBe(123.45);
      expect(normalizePrice('1,000', 'invalid')).toBe(1000);
    });
  });

  describe('rounding & invalid contents', () => {
    it('rounds numbers to two decimal places', () => {
      expect(normalizePrice('19.999', 'en-US')).toBe(20);
      expect(normalizePrice('4.555', 'en-US')).toBe(4.56);
      expect(normalizePrice('10.1234', 'en-US')).toBe(10.12);
    });

    it('returns null when text contains no parseable numeric digits', () => {
      expect(normalizePrice('N/A')).toBeNull();
      expect(normalizePrice('Contact for price')).toBeNull();
      expect(normalizePrice('Free')).toBeNull();
    });
  });
});
