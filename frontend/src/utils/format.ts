/**
 * Standardized price formatting using Intl.NumberFormat
 * Handles user locale and currency preferences
 */
export function formatPrice(
  price: number | string | null | undefined,
  currency: string | null = 'USD',
  locale: string = 'en-AU',
  fallback: string = 'N/A'
): string {
  if (price === null || price === undefined) return fallback;
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) return fallback;

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'USD',
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
export function formatRelativeDate(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return date.toLocaleDateString();
}

/**
 * Format a date string into a localized, human-readable format
 */
export function formatDate(
  dateString: string | null | undefined,
  locale: string = 'en-AU',
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

  return date.toLocaleDateString(locale, options);
}
