import { describe, it, expect } from 'vitest';
import {
  parseRefreshInterval,
  normaliseDefaultRefreshInterval,
  resolveRefreshInterval,
  MIN_DEFAULT_REFRESH_INTERVAL_SECONDS,
  MAX_DEFAULT_REFRESH_INTERVAL_SECONDS,
  FALLBACK_REFRESH_INTERVAL_SECONDS,
} from '../../src/utils/system/check-interval';
import {
  FALLBACK_REFRESH_INTERVAL,
  snapToOfferedInterval,
} from '../../../frontend/src/utils/refreshInterval';

describe('Refresh Interval Bounds & Clamping (Issue #239)', () => {
  describe('Backend & Frontend Parity', () => {
    it('frontend FALLBACK_REFRESH_INTERVAL matches backend FALLBACK_REFRESH_INTERVAL_SECONDS (12h)', () => {
      expect(FALLBACK_REFRESH_INTERVAL).toBe(FALLBACK_REFRESH_INTERVAL_SECONDS);
      expect(FALLBACK_REFRESH_INTERVAL_SECONDS).toBe(43200);
    });
  });

  describe('parseRefreshInterval boundary and invalid inputs', () => {
    it('returns null for empty, null, and undefined values', () => {
      expect(parseRefreshInterval(null)).toBeNull();
      expect(parseRefreshInterval(undefined)).toBeNull();
      expect(parseRefreshInterval('')).toBeNull();
      expect(parseRefreshInterval('   ')).toBeNull();
    });

    it('returns null for non-numeric and invalid numbers (NaN, negative, zero, Infinity)', () => {
      expect(parseRefreshInterval('auto')).toBeNull();
      expect(parseRefreshInterval('none')).toBeNull();
      expect(parseRefreshInterval(0)).toBeNull();
      expect(parseRefreshInterval(-3600)).toBeNull();
      expect(parseRefreshInterval(NaN)).toBeNull();
      expect(parseRefreshInterval(Infinity)).toBeNull();
      expect(parseRefreshInterval(-Infinity)).toBeNull();
    });

    it('parses valid numeric values and truncates decimals', () => {
      expect(parseRefreshInterval(3600)).toBe(3600);
      expect(parseRefreshInterval(3600.9)).toBe(3600);
      expect(parseRefreshInterval('7200')).toBe(7200);
      expect(parseRefreshInterval('  14400  ')).toBe(14400);
    });
  });

  describe('normaliseDefaultRefreshInterval clamping', () => {
    it('clamps values below the 1-hour minimum (3600s) up to MIN_DEFAULT_REFRESH_INTERVAL_SECONDS', () => {
      // 5 minutes (300s) is below floor
      expect(normaliseDefaultRefreshInterval(300)).toBe(MIN_DEFAULT_REFRESH_INTERVAL_SECONDS);
      expect(normaliseDefaultRefreshInterval(1)).toBe(MIN_DEFAULT_REFRESH_INTERVAL_SECONDS);
      expect(normaliseDefaultRefreshInterval(3599)).toBe(MIN_DEFAULT_REFRESH_INTERVAL_SECONDS);
      expect(normaliseDefaultRefreshInterval(3600)).toBe(3600);
    });

    it('clamps values above the 7-day maximum (604800s) down to MAX_DEFAULT_REFRESH_INTERVAL_SECONDS', () => {
      // 30 days is above ceiling
      expect(normaliseDefaultRefreshInterval(2592000)).toBe(MAX_DEFAULT_REFRESH_INTERVAL_SECONDS);
      expect(normaliseDefaultRefreshInterval(604801)).toBe(MAX_DEFAULT_REFRESH_INTERVAL_SECONDS);
      expect(normaliseDefaultRefreshInterval(604800)).toBe(604800);
    });

    it('returns null when input is unparseable', () => {
      expect(normaliseDefaultRefreshInterval(null)).toBeNull();
      expect(normaliseDefaultRefreshInterval('bad')).toBeNull();
      expect(normaliseDefaultRefreshInterval(0)).toBeNull();
    });
  });

  describe('resolveRefreshInterval precedence ranking', () => {
    it('explicit interval wins over all defaults and is NOT clamped', () => {
      // Explicit can even be 1800 (30 mins), because explicit per-product intervals are honored verbatim
      const interval = resolveRefreshInterval({
        explicit: 1800,
        userPreference: 7200,
        instanceDefault: 14400,
      });
      expect(interval).toBe(1800);
    });

    it('userPreference wins over instanceDefault when explicit is absent', () => {
      const interval = resolveRefreshInterval({
        explicit: null,
        userPreference: 7200,
        instanceDefault: 14400,
      });
      expect(interval).toBe(7200);
    });

    it('instanceDefault wins over fallback when userPreference is absent', () => {
      const interval = resolveRefreshInterval({
        explicit: null,
        userPreference: null,
        instanceDefault: 21600,
      });
      expect(interval).toBe(21600);
    });

    it('falls back to FALLBACK_REFRESH_INTERVAL_SECONDS (43200) when all sources are missing or invalid', () => {
      expect(resolveRefreshInterval({})).toBe(FALLBACK_REFRESH_INTERVAL_SECONDS);
      expect(
        resolveRefreshInterval({
          explicit: 'invalid',
          userPreference: -10,
          instanceDefault: 0,
        })
      ).toBe(FALLBACK_REFRESH_INTERVAL_SECONDS);
    });
  });

  describe('Frontend snapToOfferedInterval boundaries', () => {
    it('snaps invalid inputs to FALLBACK_REFRESH_INTERVAL (43200)', () => {
      expect(snapToOfferedInterval(null)).toBe(43200);
      expect(snapToOfferedInterval(undefined)).toBe(43200);
      expect(snapToOfferedInterval(0)).toBe(43200);
      expect(snapToOfferedInterval(-500)).toBe(43200);
      expect(snapToOfferedInterval('not-a-number')).toBe(43200);
      expect(snapToOfferedInterval({})).toBe(43200);
    });

    it('snaps arbitrary numbers to the nearest offered interval', () => {
      // Near 3600 (1h)
      expect(snapToOfferedInterval(4000)).toBe(3600);
      // Near 7200 (2h)
      expect(snapToOfferedInterval(6000)).toBe(7200);
      // Near 86400 (24h)
      expect(snapToOfferedInterval(90000)).toBe(86400);
    });
  });
});
