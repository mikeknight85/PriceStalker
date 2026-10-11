import { describe, it, expect } from 'vitest';
import {
  FALLBACK_REFRESH_INTERVAL,
  REFRESH_INTERVALS,
  describeRefreshInterval,
  snapToOfferedInterval,
} from './refreshInterval';

/**
 * The Add Product form now starts at a configured default instead of a
 * hardcoded 12 hours (issue #239), so it has to cope with a number that is not
 * one of the options it offers -- and with no number at all, which is what an
 * unmocked endpoint or a failed request gives it. A select whose value matches
 * no option renders blank, which looks like a broken form.
 */

describe('snapToOfferedInterval', () => {
  it('keeps an interval that is already offered', () => {
    for (const option of REFRESH_INTERVALS) {
      expect(snapToOfferedInterval(option.value)).toBe(option.value);
    }
  });

  it('snaps an interval that is not offered to the nearest one that is', () => {
    expect(snapToOfferedInterval(3500)).toBe(3600);
    expect(snapToOfferedInterval(40000)).toBe(43200);
    expect(snapToOfferedInterval(999999)).toBe(86400);
  });

  it('falls back to 12 hours when there is no usable number', () => {
    // The request is still in flight, or answered `{}` -- the pre-#239
    // behaviour is what should show, not an empty field.
    expect(snapToOfferedInterval(undefined)).toBe(FALLBACK_REFRESH_INTERVAL);
    expect(snapToOfferedInterval(null)).toBe(FALLBACK_REFRESH_INTERVAL);
    expect(snapToOfferedInterval('43200')).toBe(FALLBACK_REFRESH_INTERVAL);
    expect(snapToOfferedInterval(Number.NaN)).toBe(FALLBACK_REFRESH_INTERVAL);
    expect(snapToOfferedInterval(0)).toBe(FALLBACK_REFRESH_INTERVAL);
    expect(snapToOfferedInterval(-3600)).toBe(FALLBACK_REFRESH_INTERVAL);
    expect(FALLBACK_REFRESH_INTERVAL).toBe(43200);
  });
});

describe('describeRefreshInterval', () => {
  it('uses the label of an offered interval', () => {
    expect(describeRefreshInterval(3600)).toBe('1 hour');
    expect(describeRefreshInterval(43200)).toBe('12 hours');
  });

  it('names an interval that is not offered', () => {
    expect(describeRefreshInterval(10800)).toBe('3 hours');
    expect(describeRefreshInterval(5400)).toBe('90 minutes');
  });

  it('describes the fallback when there is no usable number', () => {
    expect(describeRefreshInterval(undefined)).toBe('12 hours');
    expect(describeRefreshInterval(null)).toBe('12 hours');
  });
});
