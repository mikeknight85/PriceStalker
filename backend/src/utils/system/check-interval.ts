/**
 * How often a *new* product is checked, when nobody said (issue #239).
 *
 * Three things can answer "check this how often?", and they are deliberately
 * ranked rather than merged:
 *
 *   1. the value sent with the product        -- the person chose it, per product
 *   2. `users.default_refresh_interval`       -- this person's own default
 *   3. `system_settings.default_refresh_interval` -- the instance default (Admin)
 *   4. FALLBACK_REFRESH_INTERVAL_SECONDS      -- 12 hours, what the form hardcoded
 *
 * Every step is optional, so an instance that has never been configured and a
 * user who has never expressed a preference both land on exactly the 12 hours
 * the Add Product form used to hardcode. Nothing about an *existing* product is
 * read or written here: a default only ever decides the interval of a listing
 * being created.
 *
 * The functions are pure so the ranking can be tested without a database.
 */

/** The key the instance default is stored under in `system_settings`. */
export const DEFAULT_REFRESH_INTERVAL_SETTING_KEY = 'default_refresh_interval';

/**
 * The interval used when neither the user nor the administrator has chosen one.
 *
 * 12 hours, because that is what `ProductForm` and both product-add paths
 * hardcoded before this setting existed, and an upgrade must not silently
 * re-schedule anything.
 */
export const FALLBACK_REFRESH_INTERVAL_SECONDS = 43200;

/**
 * The floor applied to a stored *default*.
 *
 * A default is applied to every product a person adds, so an aggressive one is
 * the only setting here that multiplies: set it to five minutes and a bulk-add
 * of thirty listings becomes thirty retailers' worth of traffic every five
 * minutes, forever. `PriceCheckTask` spaces requests to one retailer 30s apart
 * (issue #67/#226) and serialises them, so a sweep that cannot finish inside
 * the interval simply never catches up -- the pacing protects the retailer, not
 * the user from their own setting.
 *
 * One hour matches the shortest interval the UI has ever offered, so this
 * refuses nothing a person could previously pick. It is applied to the stored
 * defaults only; an explicit per-product interval is still honoured exactly as
 * sent, because clamping that would change the behaviour of a request that
 * works today.
 */
export const MIN_DEFAULT_REFRESH_INTERVAL_SECONDS = 3600;

/** A week. Past this a "tracker" is not tracking, and the field is likely a typo. */
export const MAX_DEFAULT_REFRESH_INTERVAL_SECONDS = 604800;

/**
 * Reads a candidate interval off the wire or out of a text column.
 *
 * `system_settings.value` is `text` and a JSON body can carry a string, so both
 * have to parse. Anything that is not a positive whole number of seconds --
 * null, '', 'auto', 0, -1, NaN -- is "not set" rather than an error, which is
 * what lets each step of the ranking fall through to the next.
 */
export function parseRefreshInterval(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const seconds = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(seconds)) return null;
  const whole = Math.trunc(seconds);
  return whole > 0 ? whole : null;
}

/**
 * Parses a value destined to be *stored* as a default, and holds it to the
 * floor and ceiling.
 *
 * Returns null for "no preference", which for a user clears the column and
 * falls back to the instance default.
 */
export function normaliseDefaultRefreshInterval(value: unknown): number | null {
  const seconds = parseRefreshInterval(value);
  if (seconds === null) return null;
  return Math.min(
    MAX_DEFAULT_REFRESH_INTERVAL_SECONDS,
    Math.max(MIN_DEFAULT_REFRESH_INTERVAL_SECONDS, seconds)
  );
}

export interface RefreshIntervalSources {
  /** The interval sent with the request. Honoured verbatim when it is usable. */
  explicit?: unknown;
  /** `users.default_refresh_interval`. */
  userPreference?: unknown;
  /** `system_settings.default_refresh_interval`. */
  instanceDefault?: unknown;
}

/**
 * Picks the interval a new product should be created with.
 *
 * See the ranking at the top of the file. Always returns a usable number of
 * seconds, so no caller needs its own `|| 43200`.
 */
export function resolveRefreshInterval(sources: RefreshIntervalSources = {}): number {
  const explicit = parseRefreshInterval(sources.explicit);
  if (explicit !== null) return explicit;

  return (
    normaliseDefaultRefreshInterval(sources.userPreference) ??
    normaliseDefaultRefreshInterval(sources.instanceDefault) ??
    FALLBACK_REFRESH_INTERVAL_SECONDS
  );
}
