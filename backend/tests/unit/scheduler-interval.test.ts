import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateNextCheckSeconds, getSmartJitter, isQuietHours } from '../../src/utils/system/scheduler-helpers';

/**
 * The scheduler applies three independent randomisers to every interval:
 * ±15% jitter, ×1.5 during quiet hours, and a 10% chance to double. Each is
 * defensible alone; stacked they produced a delay several times the interval a
 * user had chosen, and the dashboard renders a live countdown straight from
 * next_check_at -- so it reads as "this product is not being checked".
 */

const SIX_HOURS = 21600;

afterEach(() => vi.restoreAllMocks());

describe('calculateNextCheckSeconds', () => {
  it('never exceeds 1.5x the configured interval, however the dice fall', () => {
    // Force the worst case: maximum jitter, quiet hours, and the oversleep.
    vi.spyOn(Math, 'random').mockReturnValue(0.0001);
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(3);

    // Unbounded this was 6h x 1.15 x 1.5 x 2 = 20.7 hours on a 6-hour setting.
    expect(calculateNextCheckSeconds(SIX_HOURS)).toBeLessThanOrEqual(SIX_HOURS * 1.5);
  });

  it('holds the bound across the whole random range', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(3);
    for (let i = 0; i < 500; i++) {
      const next = calculateNextCheckSeconds(SIX_HOURS);
      expect(next).toBeLessThanOrEqual(SIX_HOURS * 1.5);
      expect(next).toBeGreaterThanOrEqual(60);
    }
  });

  it('holds the bound for every interval the UI offers', () => {
    // 1h, 6h, 12h, 24h, 48h
    for (const interval of [3600, 21600, 43200, 86400, 172800]) {
      for (let i = 0; i < 100; i++) {
        expect(calculateNextCheckSeconds(interval)).toBeLessThanOrEqual(interval * 1.5);
      }
    }
  });

  it('still varies, so the bound has not flattened the jitter', () => {
    // Bounding must not turn every product into the same fixed cadence, which
    // is the rhythm the randomisers exist to break.
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
    const seen = new Set(Array.from({ length: 200 }, () => calculateNextCheckSeconds(SIX_HOURS)));
    expect(seen.size).toBeGreaterThan(20);
  });

  it('never schedules sooner than a minute', () => {
    expect(calculateNextCheckSeconds(1)).toBeGreaterThanOrEqual(60);
    expect(calculateNextCheckSeconds(0)).toBeGreaterThanOrEqual(60);
  });

  it('stays close to the interval in the ordinary case', () => {
    // No oversleep, not quiet hours: the result should be recognisably the
    // interval the user picked.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
    const next = calculateNextCheckSeconds(SIX_HOURS);
    expect(next).toBeGreaterThan(SIX_HOURS * 0.8);
    expect(next).toBeLessThan(SIX_HOURS * 1.2);
  });
});

describe('the pieces it is built from', () => {
  it('keeps jitter within ±15%', () => {
    for (let i = 0; i < 200; i++) {
      expect(Math.abs(getSmartJitter(SIX_HOURS))).toBeLessThanOrEqual(SIX_HOURS * 0.15);
    }
  });

  it('treats 1am to 6am as quiet', () => {
    for (const [hour, quiet] of [[0, false], [1, true], [3, true], [6, true], [7, false], [23, false]] as const) {
      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(hour);
      expect(isQuietHours()).toBe(quiet);
      vi.restoreAllMocks();
    }
  });
});
