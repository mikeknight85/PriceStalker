import { describe, it, expect, vi } from 'vitest';
import {
  formatPrice,
  truncateUrl,
  formatRelativeDate,
  formatDateTime,
  formatDateWithOptions,
  formatDate,
} from './format';

describe('formatPrice', () => {
  it('returns fallback for null or undefined price', () => {
    expect(formatPrice(null)).toBe('N/A');
    expect(formatPrice(undefined)).toBe('N/A');
    expect(formatPrice(null, 'USD', null, 'Free')).toBe('Free');
    expect(formatPrice(undefined, 'USD', null, '-')).toBe('-');
  });

  it('returns fallback for non-numeric or NaN price', () => {
    expect(formatPrice('abc')).toBe('N/A');
    expect(formatPrice(NaN)).toBe('N/A');
  });

  it('formats numeric values and numeric strings', () => {
    const formattedNum = formatPrice(49.99, 'USD', 'en-US');
    const formattedStr = formatPrice('49.99', 'USD', 'en-US');
    expect(formattedNum).toBe('$49.99');
    expect(formattedStr).toBe('$49.99');
  });

  it('survives null or undefined locale without throwing or triggering fallback errors', () => {
    // Repository Rule 2: Locale formatting must survive null.
    // Intl.NumberFormat throws TypeError on null. formatPrice must normalise null
    // to undefined BEFORE calling Intl, and must NOT trigger the catch fallback.
    const consoleSpy = vi.spyOn(console, 'error');

    try {
      expect(() => formatPrice(19.99, 'USD', null)).not.toThrow();
      expect(formatPrice(19.99, 'USD', null)).toContain('19.99');
      // console.error must NOT have been called (no catch-block fallback triggered)
      expect(consoleSpy).not.toHaveBeenCalled();

      expect(() => formatPrice(19.99, 'USD', undefined)).not.toThrow();
      expect(consoleSpy).not.toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('formats correctly with explicit currency and locale', () => {
    expect(formatPrice(12.5, 'EUR', 'de-DE')).toMatch(/12,50\s*€/);
    expect(formatPrice(12.5, 'GBP', 'en-GB')).toBe('£12.50');
  });

  it('formats without currency symbol when currency is empty or null', () => {
    expect(formatPrice(25.5, null, 'en-US')).toBe('25.50');
    expect(formatPrice(25.5, '', 'en-US')).toBe('25.50');
    expect(() => formatPrice(25.5, null, null)).not.toThrow();
  });

  it('falls back to symbol or currency code when Intl throws on invalid currency', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(formatPrice(10, 'INVALID_CURRENCY', 'en-US')).toBe('INVALID_CURRENCY 10.00');
    expect(formatPrice(10, 'EUR', 'invalid-locale-causing-fallback')).toBe('€10.00');
    expect(formatPrice(10, 'GBP', 'invalid-locale-causing-fallback')).toBe('£10.00');
    expect(formatPrice(10, 'USD', 'invalid-locale-causing-fallback')).toBe('$10.00');
    expect(formatPrice(10, 'AUD', 'invalid-locale-causing-fallback')).toBe('$10.00');
    spy.mockRestore();
  });
});

describe('truncateUrl', () => {
  it('strips www. from standard URL hostnames', () => {
    expect(truncateUrl('https://www.amazon.com/dp/B000123')).toBe('amazon.com');
  });

  it('leaves non-www domains intact', () => {
    expect(truncateUrl('https://store.steampowered.com/app/10')).toBe('store.steampowered.com');
  });

  it('returns original input if not a valid URL', () => {
    expect(truncateUrl('not-a-valid-url')).toBe('not-a-valid-url');
  });
});

describe('formatRelativeDate', () => {
  it('returns Never for null or empty input', () => {
    expect(formatRelativeDate(null)).toBe('Never');
    expect(formatRelativeDate('')).toBe('Never');
  });

  it('formats intervals under a week as relative descriptions', () => {
    const now = Date.now();
    expect(formatRelativeDate(new Date(now - 30 * 1000).toISOString())).toBe('Just now');
    expect(formatRelativeDate(new Date(now - 5 * 60 * 1000).toISOString())).toBe('5m ago');
    expect(formatRelativeDate(new Date(now - 2 * 3600 * 1000).toISOString())).toBe('2h ago');
    expect(formatRelativeDate(new Date(now - 3 * 86400 * 1000).toISOString())).toBe('3d ago');
  });

  it('delegates to formatDate for dates older than 7 days and survives null locale', () => {
    const past = new Date(Date.now() - 10 * 86400 * 1000).toISOString();
    expect(() => formatRelativeDate(past, null)).not.toThrow();
    expect(formatRelativeDate(past, 'en-US')).not.toBe('Never');
  });
});

describe('formatDateTime', () => {
  it('returns N/A for null, undefined, or invalid dates', () => {
    expect(formatDateTime(null)).toBe('N/A');
    expect(formatDateTime(undefined)).toBe('N/A');
    expect(formatDateTime('invalid-date')).toBe('N/A');
  });

  it('formats valid date with seconds and survives null locale', () => {
    const dateStr = '2026-03-15T12:30:45.000Z';
    expect(() => formatDateTime(dateStr, null)).not.toThrow();
    const result = formatDateTime(dateStr, 'en-US');
    expect(result).toContain('2026');
    expect(result).toContain('15');
  });

  it('recovers gracefully from invalid locale', () => {
    const dateStr = '2026-03-15T12:30:45.000Z';
    expect(() => formatDateTime(dateStr, 'invalid-locale-xyz')).not.toThrow();
  });
});

describe('formatDateWithOptions', () => {
  it('formats Date instances, numbers, and strings', () => {
    const date = new Date('2026-06-01T00:00:00.000Z');
    const opts: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' };
    expect(formatDateWithOptions(date, 'en-US', opts)).toBe('Jun 2026');
    expect(formatDateWithOptions(date.getTime(), 'en-US', opts)).toBe('Jun 2026');
    expect(formatDateWithOptions(date.toISOString(), 'en-US', opts)).toBe('Jun 2026');
  });

  it('survives null locale and returns N/A on invalid dates', () => {
    const opts: Intl.DateTimeFormatOptions = { month: 'short' };
    expect(formatDateWithOptions('bad-date', null, opts)).toBe('N/A');

    const toLocaleSpy = vi.spyOn(Date.prototype, 'toLocaleDateString');
    try {
      expect(() => formatDateWithOptions('2026-01-01', null, opts)).not.toThrow();
      expect(toLocaleSpy).toHaveBeenCalledWith(undefined, opts);
    } finally {
      toLocaleSpy.mockRestore();
    }
  });
});

describe('formatDate', () => {
  it('returns N/A for null, undefined, or invalid dates', () => {
    expect(formatDate(null)).toBe('N/A');
    expect(formatDate(undefined)).toBe('N/A');
    expect(formatDate('invalid')).toBe('N/A');
  });

  it('survives null locale without passing raw null to toLocaleDateString', () => {
    // Repository Rule 2: toLocaleDateString(null) throws TypeError.
    // formatDate must normalise null to undefined so toLocaleDateString is never passed raw null.
    const toLocaleSpy = vi.spyOn(Date.prototype, 'toLocaleDateString');
    try {
      expect(() => formatDate('2026-05-10T08:00:00.000Z', null)).not.toThrow();
      expect(formatDate('2026-05-10T08:00:00.000Z', null)).toContain('2026');
      expect(toLocaleSpy).toHaveBeenCalledWith(undefined, expect.any(Object));
    } finally {
      toLocaleSpy.mockRestore();
    }
  });

  it('includes time when includeTime is true', () => {
    const withTime = formatDate('2026-05-10T08:30:00.000Z', 'en-US', true);
    const withoutTime = formatDate('2026-05-10T08:30:00.000Z', 'en-US', false);
    expect(withTime.length).toBeGreaterThan(withoutTime.length);
  });
});
