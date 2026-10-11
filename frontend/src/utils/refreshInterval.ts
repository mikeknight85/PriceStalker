/**
 * The check intervals the UI offers, and the helpers for turning a number of
 * seconds into one of them.
 *
 * Shared rather than feature-local because three screens now need the same
 * list: the Add Product form, the per-product override on product detail, and
 * the two places the *default* is configured -- Settings -> Tracking and
 * Admin -> System (issue #239).
 */

export interface RefreshIntervalOption {
  value: number;
  label: string;
}

export const REFRESH_INTERVALS: RefreshIntervalOption[] = [
  { value: 3600, label: '1 hour' },
  { value: 7200, label: '2 hours' },
  { value: 14400, label: '4 hours' },
  { value: 21600, label: '6 hours' },
  { value: 43200, label: '12 hours' },
  { value: 64800, label: '18 hours' },
  { value: 86400, label: '24 hours' },
];

/**
 * What a new product is checked every when nothing is configured anywhere.
 *
 * Must stay equal to FALLBACK_REFRESH_INTERVAL_SECONDS in the backend's
 * `utils/system/check-interval.ts`: it is what the form shows while the
 * defaults request is in flight, and what it shows if that request answers
 * with something unusable.
 */
export const FALLBACK_REFRESH_INTERVAL = 43200;

/**
 * Picks the offered option closest to `seconds`.
 *
 * A `<select>` whose value matches no `<option>` renders blank, and the stored
 * default does not have to be one of the seven: an administrator can set any
 * number through the API, and the list itself may change between releases. So
 * the form snaps to the nearest offered interval instead of showing an empty
 * field. Anything unusable -- undefined because the request is still in flight,
 * or `{}` from an unmocked endpoint -- lands on the 12-hour fallback.
 */
export function snapToOfferedInterval(seconds: unknown): number {
  const target = typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
    ? seconds
    : FALLBACK_REFRESH_INTERVAL;

  return REFRESH_INTERVALS.reduce((closest, option) => (
    Math.abs(option.value - target) < Math.abs(closest - target) ? option.value : closest
  ), REFRESH_INTERVALS[0].value);
}

/**
 * Names an interval in words, for a label that has to say what a default is.
 *
 * Deliberately no `Intl` and no `toLocale*`: `users.locale` can be null and
 * both throw on null, which blanks the page (CLAUDE.md rule 2). Hours are plain
 * enough not to need formatting.
 */
export function describeRefreshInterval(seconds: unknown): string {
  const snapped = typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
    ? seconds
    : FALLBACK_REFRESH_INTERVAL;

  const offered = REFRESH_INTERVALS.find(option => option.value === snapped);
  if (offered) return offered.label;

  if (snapped % 3600 === 0) {
    const hours = snapped / 3600;
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }

  const minutes = Math.round(snapped / 60);
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}
