/**
 * Standardized price formatting using Intl.NumberFormat
 * Handles user locale and currency preferences
 */
export function formatPrice(
  price: number | string | null | undefined,
  currency: string | null = 'USD',
  locale?: string | null,
  fallback: string = 'N/A'
): string {
  if (price === null || price === undefined) return fallback;
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) return fallback;

  // An unknown currency ('' from the scraper's review flow, or null) must not
  // masquerade as USD — show a plain localized number instead.
  if (!currency) {
    try {
      return new Intl.NumberFormat(locale ?? undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numPrice);
    } catch {
      return numPrice.toFixed(2);
    }
  }

  try {
    // Intl throws on an explicit null; undefined means "use the runtime default".
    const formatter = new Intl.NumberFormat(locale ?? undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return formatter.format(numPrice);
  } catch (err) {
    console.error('Price formatting error:', err);
    // Fallback to basic symbol formatting if Intl fails
    const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'AUD' || currency === 'USD' ? '$' : currency + ' ';
    return `${symbol}${numPrice.toFixed(2)}`;
  }
}

/**
 * Truncate long URLs to just the domain
 */
export function truncateUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Format relative date/time
 */
export function formatRelativeDate(dateString: string | null, locale?: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  // Anything older falls back to an absolute date, which must respect the
  // user's locale like every other date in the app.
  return formatDate(dateString, locale);
}

/**
 * Localized date and time down to the second, for log and audit timestamps
 * where the exact moment matters. Normalises a null locale so Intl never throws.
 */
export function formatDateTime(
  dateString: string | null | undefined,
  locale?: string | null
): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  };

  try {
    return date.toLocaleString(locale ?? undefined, options);
  } catch {
    return date.toLocaleString(undefined, options);
  }
}

/**
 * Localized date formatting with caller-supplied Intl options (e.g. compact
 * chart axis labels). Normalises a null locale so Intl never throws on it.
 */
export function formatDateWithOptions(
  value: string | number | Date,
  locale: string | null | undefined,
  options: Intl.DateTimeFormatOptions
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return 'N/A';
  try {
    return date.toLocaleDateString(locale ?? undefined, options);
  } catch {
    return date.toLocaleDateString(undefined, options);
  }
}

/**
 * Format a date string into a localized, human-readable format
 */
export function formatDate(
  dateString: string | null | undefined,
  locale?: string | null,
  includeTime: boolean = false
): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };

  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }

  try {
    // Intl throws on an explicit null, and unlike formatPrice this had no
    // guard -- an unset user locale took the whole page down.
    return date.toLocaleDateString(locale ?? undefined, options);
  } catch {
    return date.toLocaleDateString(undefined, options);
  }
}
