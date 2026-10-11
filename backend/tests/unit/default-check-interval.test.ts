import { describe, it, expect } from 'vitest';
import {
  DEFAULT_REFRESH_INTERVAL_SETTING_KEY,
  FALLBACK_REFRESH_INTERVAL_SECONDS,
  MAX_DEFAULT_REFRESH_INTERVAL_SECONDS,
  MIN_DEFAULT_REFRESH_INTERVAL_SECONDS,
  normaliseDefaultRefreshInterval,
  parseRefreshInterval,
  resolveRefreshInterval,
} from '../../src/utils/system/check-interval';

/**
 * The default check interval for a new product (issue #239).
 *
 * The Add Product form opened on 12 hours and both add paths fell back to the
 * same number, so changing it meant changing the field on every product. The
 * value now comes from a ranking, and the two things that matter most about
 * that ranking are that each step can be absent, and that an instance which has
 * configured nothing behaves exactly as it did before.
 */

const ONE_HOUR = 3600;
const SIX_HOURS = 21600;
const TWELVE_HOURS = 43200;
const TWENTY_FOUR_HOURS = 86400;

describe('resolveRefreshInterval', () => {
  it('prefers the interval sent with the product over every default', () => {
    expect(
      resolveRefreshInterval({
        explicit: SIX_HOURS,
        userPreference: TWENTY_FOUR_HOURS,
        instanceDefault: ONE_HOUR,
      })
    ).toBe(SIX_HOURS);
  });

  it("prefers the user's own default over the instance default", () => {
    expect(
      resolveRefreshInterval({
        userPreference: TWENTY_FOUR_HOURS,
        instanceDefault: ONE_HOUR,
      })
    ).toBe(TWENTY_FOUR_HOURS);
  });

  it('falls back to the instance default when the user has no preference', () => {
    expect(resolveRefreshInterval({ userPreference: null, instanceDefault: SIX_HOURS })).toBe(SIX_HOURS);
  });

  it('degrades to the old hardcoded 12 hours when nothing is configured', () => {
    // The upgrade case: migration 022 seeds the instance default, but an
    // instance restored from a backup, or a settings row deleted by hand, must
    // still behave exactly as it did before the setting existed.
    expect(resolveRefreshInterval()).toBe(TWELVE_HOURS);
    expect(resolveRefreshInterval({})).toBe(TWELVE_HOURS);
    expect(resolveRefreshInterval({ userPreference: null, instanceDefault: null })).toBe(TWELVE_HOURS);
    expect(FALLBACK_REFRESH_INTERVAL_SECONDS).toBe(TWELVE_HOURS);
  });

  it('reads the instance default out of a text column', () => {
    // system_settings.value is text, so every instance default arrives as a
    // string however it was written.
    expect(resolveRefreshInterval({ instanceDefault: '21600' })).toBe(SIX_HOURS);
    expect(resolveRefreshInterval({ instanceDefault: ' 21600 ' })).toBe(SIX_HOURS);
  });

  it('steps past an unusable value instead of failing on it', () => {
    // Each of these means "not set", so the next source in the ranking answers.
    for (const junk of [null, undefined, '', '   ', 'auto', 'NaN', 0, -1, Number.NaN]) {
      expect(resolveRefreshInterval({ explicit: junk, userPreference: SIX_HOURS })).toBe(SIX_HOURS);
      expect(resolveRefreshInterval({ userPreference: junk, instanceDefault: SIX_HOURS })).toBe(SIX_HOURS);
      expect(resolveRefreshInterval({ instanceDefault: junk })).toBe(TWELVE_HOURS);
    }
  });

  it('holds a stored default to the one-hour floor', () => {
    // A default applies to every product a person adds, so this is the one
    // interval here that multiplies. One hour is the shortest the UI has ever
    // offered, so nothing a person could previously choose is refused.
    expect(resolveRefreshInterval({ userPreference: 60 })).toBe(MIN_DEFAULT_REFRESH_INTERVAL_SECONDS);
    expect(resolveRefreshInterval({ instanceDefault: '300' })).toBe(MIN_DEFAULT_REFRESH_INTERVAL_SECONDS);
    expect(MIN_DEFAULT_REFRESH_INTERVAL_SECONDS).toBe(ONE_HOUR);
  });

  it('holds a stored default to the one-week ceiling', () => {
    expect(resolveRefreshInterval({ userPreference: 99_999_999 })).toBe(MAX_DEFAULT_REFRESH_INTERVAL_SECONDS);
  });

  it('honours an explicit per-product interval verbatim, floor included', () => {
    // The floor guards the *defaults* this issue introduces. Clamping a value
    // the request actually carried would change the behaviour of an API call
    // that works today, and of the per-product override the issue promises to
    // leave alone.
    expect(resolveRefreshInterval({ explicit: 60 })).toBe(60);
    expect(resolveRefreshInterval({ explicit: 99_999_999 })).toBe(99_999_999);
  });

  it('truncates a fractional interval rather than storing one', () => {
    expect(resolveRefreshInterval({ explicit: 3600.9 })).toBe(ONE_HOUR);
  });
});

describe('parseRefreshInterval', () => {
  it('accepts a positive number however it is spelled', () => {
    expect(parseRefreshInterval(ONE_HOUR)).toBe(ONE_HOUR);
    expect(parseRefreshInterval('3600')).toBe(ONE_HOUR);
  });

  it('treats anything unusable as absent', () => {
    expect(parseRefreshInterval(null)).toBeNull();
    expect(parseRefreshInterval(undefined)).toBeNull();
    expect(parseRefreshInterval('')).toBeNull();
    expect(parseRefreshInterval('twelve hours')).toBeNull();
    expect(parseRefreshInterval(0)).toBeNull();
    expect(parseRefreshInterval(-3600)).toBeNull();
  });
});

describe('normaliseDefaultRefreshInterval', () => {
  it('returns null for "no preference", which clears the column', () => {
    // A user choosing "Follow the instance default" sends an empty value, and
    // null is what makes the next add fall through to the instance default.
    expect(normaliseDefaultRefreshInterval('')).toBeNull();
    expect(normaliseDefaultRefreshInterval(null)).toBeNull();
    expect(normaliseDefaultRefreshInterval(undefined)).toBeNull();
    expect(normaliseDefaultRefreshInterval('not a number')).toBeNull();
  });

  it('clamps a stored value into the allowed band', () => {
    expect(normaliseDefaultRefreshInterval(1)).toBe(MIN_DEFAULT_REFRESH_INTERVAL_SECONDS);
    expect(normaliseDefaultRefreshInterval(SIX_HOURS)).toBe(SIX_HOURS);
    expect(normaliseDefaultRefreshInterval(99_999_999)).toBe(MAX_DEFAULT_REFRESH_INTERVAL_SECONDS);
  });

  it('names the settings key the migration seeds', () => {
    // Migration 022 and Admin -> System have to agree on this string.
    expect(DEFAULT_REFRESH_INTERVAL_SETTING_KEY).toBe('default_refresh_interval');
  });
});
