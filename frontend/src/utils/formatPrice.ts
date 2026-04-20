// Prefix symbols go directly before the number: $49.99, €49.99, R$49.99
const PREFIX_SYMBOL: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  KRW: '₩',
  RUB: '₽',
  BRL: 'R$',
  CAD: 'CA$',
  AUD: 'A$',
  NZD: 'NZ$',
  HKD: 'HK$',
  SGD: 'S$',
  MXN: 'Mex$',
};

// Code-with-space style: CHF 49.99, PLN 49.99
const CODE_WITH_SPACE = new Set([
  'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'ZAR', 'TRY',
]);

export function currencySymbol(currency: string | null | undefined): string {
  const ccy = (currency || 'USD').toUpperCase();
  if (PREFIX_SYMBOL[ccy]) return PREFIX_SYMBOL[ccy];
  if (CODE_WITH_SPACE.has(ccy)) return `${ccy} `;
  return `${ccy} `;
}

export function formatPrice(
  price: number | string | null | undefined,
  currency: string | null | undefined,
  opts: { showFraction?: boolean } = { showFraction: true },
): string {
  if (price === null || price === undefined) return '—';
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return '—';
  const formatted = opts.showFraction === false
    ? Math.round(num).toString()
    : num.toFixed(2);
  return `${currencySymbol(currency)}${formatted}`;
}

// Format a delta (price change) with sign: "+$5.00", "-€12.50"
export function formatPriceDelta(
  delta: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (delta === null || delta === undefined || isNaN(delta)) return '—';
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : '';
  return `${sign}${currencySymbol(currency)}${Math.abs(delta).toFixed(2)}`;
}
