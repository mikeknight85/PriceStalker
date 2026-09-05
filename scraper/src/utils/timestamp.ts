/**
 * Log timestamps that respect the configured `TZ` (issue #146).
 *
 * Duplicated from backend/src/utils/system/logging/timestamp.ts rather than
 * shared, because the two workspaces have no common package -- the same reason
 * scraper/src/utils/userAgent.ts is duplicated. Keep them in step: the point is
 * that both services stamp their logs the same way, so a Docker log stream
 * interleaving the two reads as one timeline.
 *
 * This side had the mirror-image bug. It hardcoded `Australia/Perth`, so every
 * install in the world read its scraper logs in Perth time, and the format was
 * `01/09/2026, 3:11:40 am` -- day/month ambiguous to half its readers.
 */

/** Zones that mean "just use UTC", where the plain ISO string is already right. */
const UTC_ALIASES = new Set(['UTC', 'ETC/UTC', 'ETC/GMT', 'GMT', 'Z']);

interface Formatter {
  format(date: Date): string;
}

/**
 * Built once. `Intl.DateTimeFormat` is expensive to construct and this runs on
 * every log line, so building it per call would put a measurable cost on the
 * hottest path in the process.
 */
const formatter: Formatter | null = buildFormatter();

function buildFormatter(): Formatter | null {
  const tz = process.env.TZ?.trim();
  if (!tz || UTC_ALIASES.has(tz.toUpperCase())) return null;

  try {
    const intl = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      fractionalSecondDigits: 3,
      timeZoneName: 'longOffset',
    });
    // Prove it actually works before installing it. A zone can be accepted by
    // the constructor and still misbehave on a Node build without full ICU.
    const probe = renderWith(intl, new Date());
    if (!probe) return null;
    return { format: (date: Date) => renderWith(intl, date) ?? date.toISOString() };
  } catch {
    // An unrecognised zone -- a typo like `Australia/Perht` -- must not take the
    // logger down with it. A process that cannot log is far worse than one
    // logging in the wrong timezone, so fall back silently to UTC. The warning
    // is emitted by warnIfTimezoneInvalid() once, at startup, rather than from
    // here: this module is imported by the logger, and logging from inside it
    // during construction risks recursion.
    return null;
  }
}

/** Assembles `YYYY-MM-DDTHH:mm:ss.sss+HH:MM`, or null if the parts look wrong. */
function renderWith(intl: Intl.DateTimeFormat, date: Date): string | null {
  const parts: Record<string, string> = {};
  for (const part of intl.formatToParts(date)) parts[part.type] = part.value;

  const { year, month, day, hour, minute, second, fractionalSecond } = parts;
  if (!year || !month || !day || !hour || !minute || !second) return null;

  // `longOffset` renders as "GMT+08:00", and as a bare "GMT" at zero offset.
  const raw = parts.timeZoneName ?? '';
  const offset = raw === 'GMT' ? '+00:00' : raw.replace(/^GMT/, '');
  if (!/^[+-]\d{2}:\d{2}$/.test(offset)) return null;

  // 24:00 is a legal Intl rendering of midnight; ISO 8601 wants 00:00.
  const hh = hour === '24' ? '00' : hour;

  return `${year}-${month}-${day}T${hh}:${minute}:${second}.${fractionalSecond ?? '000'}${offset}`;
}

/**
 * The timestamp prefix for one log line.
 *
 * Never throws. The logger is the thing you reach for when everything else is
 * broken; it must not become the thing that breaks.
 */
export function formatLogTimestamp(date: Date = new Date()): string {
  if (!formatter) return date.toISOString();
  try {
    return formatter.format(date);
  } catch {
    return date.toISOString();
  }
}

/** True when `TZ` was set to something usable and is being applied. */
export function isTimezoneApplied(): boolean {
  return formatter !== null;
}

/**
 * Whether `TZ` was set but could not be used, so a caller can say so once at
 * startup. Silently ignoring a misspelled zone would leave an operator staring
 * at UTC timestamps with no idea why.
 */
export function invalidTimezone(): string | null {
  const tz = process.env.TZ?.trim();
  if (!tz || UTC_ALIASES.has(tz.toUpperCase())) return null;
  return formatter === null ? tz : null;
}
