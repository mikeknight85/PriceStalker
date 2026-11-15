export interface ParsedPrice {
  price: number;
  currency: string;
}

export const CURRENCY_MAP: Record<string, string> = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₹': 'INR',
  'Fr.': 'CHF',
  'FR.': 'CHF',
  'CHF': 'CHF',
  'CAD': 'CAD',
  'AUD': 'AUD',
  'USD': 'USD',
  'EUR': 'EUR',
  'GBP': 'GBP',
  'NZD': 'NZD',
  'SGD': 'SGD',
  'HKD': 'HKD',
  'JPY': 'JPY',
  'INR': 'INR',
  'CNY': 'CNY',
};

// The fractional group is deliberately `\d+` rather than `\d{1,2}`. Capping it
// at two digits makes the group unmatchable when a third decimal follows, so the
// engine backtracks it to empty and `(?!\d)` is then satisfied by the separator
// -- which floors the value ("$1.4599" -> 1, "$1,299.9900" -> 1299). How many
// fraction digits are meaningful is a locale question, and `normalizePrice`
// already owns it; the pattern's job is only to capture the whole number.
export const PRICE_PATTERNS = [
  // AUD $29.99 or USD 29.99 (Prefix currency codes)
  /(AUD|USD|GBP|EUR|CAD|JPY|INR|NZD|SGD|HKD|CHF)\s*([$€£¥₹])?\s*(\d{1,3}(?:[,.\s']?\d{3})*(?:[.,]\d+)?)(?!\d)/i,
  // $29.99 or $29,99 or $ 29.99 or $1'234.56
  /([$€£¥₹])\s*(\d{1,3}(?:[,.\s']?\d{3})*(?:[.,]\d+)?)(?!\d)/,
  // CHF 29.99 or Fr. 29.99 (Swiss franc prefix)
  /(CHF|Fr\.)\s*(\d{1,3}(?:[,.\s']?\d{3})*(?:[.,]\d+)?)(?!\d)/i,
  // 29.99 USD or 29,99 EUR or 29.99 CHF
  /(\d{1,3}(?:[,.\s']?\d{3})*(?:[.,]\d+)?)(?!\d)\s*(USD|EUR|GBP|CAD|AUD|JPY|INR|CHF)/i,
  // Plain number with optional decimal (fallback)
  /(\b\d{1,3}(?:[,.\s']?\d{3})*(?:[.,]\d+)?)(?!\d)/,
];

export const PAYMENT_DENY_LIST = [
  '/mo', 'per month', 'monthly payment', 'a month', 
  'payments starting', 'payment of', 'payments of'
];
