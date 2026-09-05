import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * `new Date().toISOString()` is UTC by definition, whatever `TZ` says, so a
 * Perth-configured install logged in UTC while two docs pages promised
 * otherwise (issue #146). The scraper had the mirror-image bug: it hardcoded
 * `Australia/Perth`, so every install in the world read its scraper logs in
 * Perth time.
 *
 * The module reads `process.env.TZ` once at import and caches the formatter --
 * building an Intl.DateTimeFormat per log line would be a real cost on the
 * hottest path in the process. So each case here re-imports with a fresh
 * module registry.
 */

const FIXED = new Date('2026-09-04T17:18:02.834Z');
const originalTz = process.env.TZ;

async function loadWith(tz: string | undefined) {
  vi.resetModules();
  if (tz === undefined) delete process.env.TZ;
  else process.env.TZ = tz;
  return import('../../src/utils/system/logging/timestamp');
}

beforeEach(() => vi.resetModules());
afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe('the bug', () => {
  it('renders a TZ-configured install in that timezone, not UTC', async () => {
    const { formatLogTimestamp } = await loadWith('Australia/Perth');
    // 17:18 UTC is 01:18 the next day in Perth (UTC+8).
    expect(formatLogTimestamp(FIXED)).toBe('2026-09-05T01:18:02.834+08:00');
  });

  it('handles a negative offset', async () => {
    const { formatLogTimestamp } = await loadWith('America/New_York');
    expect(formatLogTimestamp(FIXED)).toBe('2026-09-04T13:18:02.834-04:00');
  });

  it('handles a half-hour offset', async () => {
    const { formatLogTimestamp } = await loadWith('Asia/Kolkata');
    expect(formatLogTimestamp(FIXED)).toBe('2026-09-04T22:48:02.834+05:30');
  });

  it('keeps sub-second precision, which the scraper used to drop', async () => {
    // The old scraper format was `01/09/2026, 3:11:40 am` -- no milliseconds,
    // and day/month ambiguous to half its readers.
    const { formatLogTimestamp } = await loadWith('Europe/Zurich');
    expect(formatLogTimestamp(FIXED)).toMatch(/\.\d{3}\+02:00$/);
  });
});

describe('the UTC case stays byte-identical', () => {
  // Anything already grepping or parsing these logs must keep working unless
  // the operator opts in by setting TZ.
  it.each([undefined, 'UTC', 'Etc/UTC', 'GMT'])('TZ=%s renders exactly as before', async (tz) => {
    const { formatLogTimestamp } = await loadWith(tz);
    expect(formatLogTimestamp(FIXED)).toBe(FIXED.toISOString());
    expect(formatLogTimestamp(FIXED)).toBe('2026-09-04T17:18:02.834Z');
  });

  it('treats an empty or whitespace TZ as unset', async () => {
    for (const tz of ['', '   ']) {
      const { formatLogTimestamp } = await loadWith(tz);
      expect(formatLogTimestamp(FIXED)).toBe(FIXED.toISOString());
    }
  });
});

describe('a bad TZ must not take the logger down', () => {
  // A process that cannot log is far worse than one logging in the wrong
  // timezone. Intl.DateTimeFormat throws RangeError on an unknown zone.
  it.each(['Australia/Perht', 'Not/A/Zone', 'garbage', '../../etc/passwd'])(
    'falls back to UTC for TZ=%s instead of throwing',
    async (tz) => {
      const { formatLogTimestamp } = await loadWith(tz);
      expect(() => formatLogTimestamp(FIXED)).not.toThrow();
      expect(formatLogTimestamp(FIXED)).toBe(FIXED.toISOString());
    }
  );

  it('reports the bad value so it can be surfaced once at startup', async () => {
    const { invalidTimezone, isTimezoneApplied } = await loadWith('Australia/Perht');
    expect(invalidTimezone()).toBe('Australia/Perht');
    expect(isTimezoneApplied()).toBe(false);
  });

  it('reports nothing when the zone is good, or when none was asked for', async () => {
    const good = await loadWith('Australia/Perth');
    expect(good.invalidTimezone()).toBeNull();
    expect(good.isTimezoneApplied()).toBe(true);

    const none = await loadWith(undefined);
    expect(none.invalidTimezone()).toBeNull();
    expect(none.isTimezoneApplied()).toBe(false);
  });
});

describe('the output is still a valid, parseable timestamp', () => {
  it('round-trips back to the instant it was given', async () => {
    // The whole point of keeping ISO 8601 with an offset: shifting the display
    // timezone must not change which moment the line refers to.
    for (const tz of ['Australia/Perth', 'America/New_York', 'Asia/Kolkata', 'Europe/Zurich']) {
      const { formatLogTimestamp } = await loadWith(tz);
      expect(new Date(formatLogTimestamp(FIXED)).getTime()).toBe(FIXED.getTime());
    }
  });

  it('sorts in the same order as the instants, within one stream', async () => {
    const { formatLogTimestamp } = await loadWith('Australia/Perth');
    const stamps = [0, 1000, 60_000, 3_600_000].map(ms => formatLogTimestamp(new Date(FIXED.getTime() + ms)));
    expect([...stamps].sort()).toEqual(stamps);
  });

  it('renders midnight as 00:00, not 24:00', async () => {
    // Intl may legitimately render midnight as hour 24; ISO 8601 wants 00.
    const { formatLogTimestamp } = await loadWith('Australia/Perth');
    // 16:00 UTC is exactly midnight in Perth.
    expect(formatLogTimestamp(new Date('2026-09-04T16:00:00.000Z'))).toBe('2026-09-05T00:00:00.000+08:00');
  });

  it('follows daylight saving rather than pinning one offset', async () => {
    const { formatLogTimestamp } = await loadWith('Europe/Zurich');
    expect(formatLogTimestamp(new Date('2026-01-15T12:00:00.000Z'))).toContain('+01:00');
    expect(formatLogTimestamp(new Date('2026-07-15T12:00:00.000Z'))).toContain('+02:00');
  });
});
