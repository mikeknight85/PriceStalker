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
  'CHF': 'CHF',
  'CAD': 'CAD',
  'AUD': 'AUD',
  'USD': 'USD',
  'EUR': 'EUR',
  'GBP': 'GBP',
};

export const PRICE_PATTERNS = [
  // AUD $29.99 or USD 29.99 (Prefix currency codes)
  /(AUD|USD|GBP|EUR|CAD|JPY|INR|NZD|SGD|HKD|CHF)\s*([$€£¥₹])?\s*(\d{1,3}(?:[,.\s']?\d{3})*(?:[.,]\d{1,2})?)/i,
  // $29.99 or $29,99 or $ 29.99 or $1'234.56
  /([$€£¥₹])\s*(\d{1,3}(?:[,.\s']?\d{3})*(?:[.,]\d{1,2})?)/,
  // CHF 29.99 or Fr. 29.99 (Swiss franc prefix)
  /(CHF|Fr\.)\s*(\d{1,3}(?:[,.\s']?\d{3})*(?:[.,]\d{1,2})?)/i,
  // 29.99 USD or 29,99 EUR or 29.99 CHF
  /(\d{1,3}(?:[,.\s']?\d{3})*(?:[.,]\d{1,2})?)\s*(USD|EUR|GBP|CAD|AUD|JPY|INR|CHF)/i,
  // Plain number with optional decimal (fallback)
  /(\b\d{1,3}(?:[,.\s']?\d{3})*(?:[.,]\d{1,2})\b|\b\d+\b)/,
];

export const PAYMENT_DENY_LIST = [
  '/mo', 'per month', 'monthly payment', 'a month', 
  'payments starting', 'payment of', 'payments of'
];
