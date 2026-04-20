export interface ParsedPrice {
  price: number;
  currency: string;
}

// Currency symbols and their ISO codes
const currencyMap: Record<string, string> = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₹': 'INR',
  '₩': 'KRW',
  '₽': 'RUB',
  '¢': 'USD',
  'Fr.': 'CHF',
  'CHF': 'CHF',
  'R$': 'BRL',
  'zł': 'PLN',
  'CAD': 'CAD',
  'AUD': 'AUD',
  'USD': 'USD',
  'EUR': 'EUR',
  'GBP': 'GBP',
  'BRL': 'BRL',
  'PLN': 'PLN',
  'SEK': 'SEK',
  'NOK': 'NOK',
  'DKK': 'DKK',
  'KRW': 'KRW',
  'RUB': 'RUB',
  'CNY': 'CNY',
};

// Currencies that typically use comma as decimal separator
const COMMA_DECIMAL_CURRENCIES = new Set([
  'EUR', 'BRL', 'PLN', 'SEK', 'NOK', 'DKK', 'RUB',
]);

// Patterns to match prices in text. Order matters: more specific first.
const pricePatterns = [
  // R$ (Brazilian Real) — check before bare $ because R$ contains $
  /(?<currency>R\$)\s*(?<price>[\d.,']+)/,
  // Single-char prefix symbols: $ € £ ¥ ₹ ₩ ₽
  /(?<currency>[$€£¥₹₩₽])\s*(?<price>[\d.,']+)/,
  // CHF / Fr. prefix (Swiss franc) with optional apostrophe thousands
  /(?<currency>CHF|Fr\.)\s*(?<price>[\d.,']+)/i,
  // zł prefix (Polish złoty) — sometimes appears before
  /(?<currency>zł)\s*(?<price>[\d.,']+)/i,
  // Suffix ISO code: 29.99 USD, 29,99 EUR, 1'234.56 CHF, R$ 5,00 BRL
  /(?<price>[\d.,']+)\s*(?<currency>USD|EUR|GBP|CAD|AUD|JPY|INR|CHF|BRL|PLN|SEK|NOK|DKK|KRW|RUB|CNY)/i,
  // Suffix zł — Polish numbers typically come before the symbol
  /(?<price>[\d.,']+)\s*(?<currency>zł)/i,
  // Plain number with optional decimal (fallback, assumed USD)
  /(?<price>\d{1,3}(?:[,.\s]?\d{3})*(?:[.,]\d{1,2})?)/,
];

export function parsePrice(text: string): ParsedPrice | null {
  if (!text) return null;

  // Clean up the text
  const cleanText = text.trim().replace(/\s+/g, ' ');

  // Reject monthly payment/financing prices
  const lowerText = cleanText.toLowerCase();
  if (lowerText.includes('/mo') ||
      lowerText.includes('per month') ||
      lowerText.includes('monthly payment') ||
      lowerText.includes('a month') ||
      lowerText.includes('payments starting') ||
      lowerText.includes('payment of') ||
      lowerText.includes('payments of') ||
      /\d+\s*payments?\b/.test(lowerText) ||
      /\d+\s*mo\b/.test(lowerText)) {
    return null;
  }

  for (const pattern of pricePatterns) {
    const match = cleanText.match(pattern);
    if (match && match.groups) {
      const priceStr = match.groups.price || match[1];
      const currencySymbol = match.groups.currency || '$';

      if (priceStr) {
        const currency = currencyMap[currencySymbol] || 'USD';
        const price = normalizePrice(priceStr, currency);
        if (price !== null && price > 0) {
          return { price, currency };
        }
      }
    }
  }

  // Try to extract just a number as fallback
  const numberMatch = cleanText.match(/[\d.,']+/);
  if (numberMatch) {
    const price = normalizePrice(numberMatch[0], 'USD');
    if (price !== null && price > 0) {
      return { price, currency: 'USD' };
    }
  }

  return null;
}

/**
 * Normalize a price string to a JS number, handling US/European/Swiss formats.
 *
 * Separator conventions this must handle:
 *   US:       1,234.56   comma=thousands, period=decimal
 *   European: 1.234,56   period=thousands, comma=decimal
 *   Swiss:    1'234.56   apostrophe=thousands, period=decimal
 *   Ambiguous without decimals: "2.720" — could be 2720 (EUR/BRL thousands)
 *                               or 2.720 (literal three-decimal). We use the
 *                               currency hint: comma-decimal currencies treat
 *                               "2.720" as 2720; everyone else keeps 2.720.
 */
function normalizePrice(priceStr: string, currency?: string): number | null {
  if (!priceStr) return null;

  // Strip whitespace and Swiss apostrophe thousands separator
  let normalized = priceStr.replace(/\s/g, '').replace(/'/g, '');

  const lastDot = normalized.lastIndexOf('.');
  const lastComma = normalized.lastIndexOf(',');
  const isCommaDecimalCurrency = currency ? COMMA_DECIMAL_CURRENCIES.has(currency) : false;

  if (lastDot > -1 && lastComma > -1) {
    // Both separators present — the LAST one is the decimal.
    if (lastComma > lastDot) {
      // European: 1.234,56 -> 1234.56
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      // US: 1,234.56 -> 1234.56
      normalized = normalized.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    // Only comma
    const afterComma = normalized.substring(lastComma + 1);
    if (afterComma.length === 3 && /^\d{1,3}(,\d{3})+$/.test(normalized)) {
      // US thousands without decimals: 1,234 -> 1234
      normalized = normalized.replace(/,/g, '');
    } else if (afterComma.length === 1 || afterComma.length === 2) {
      // Decimal: 29,99 or 29,9 -> 29.99 / 29.9
      normalized = normalized.replace(',', '.');
    } else if (isCommaDecimalCurrency) {
      // Ambiguous but currency suggests comma is decimal
      normalized = normalized.replace(',', '.');
    } else {
      // Default: treat as US thousands
      normalized = normalized.replace(/,/g, '');
    }
  } else if (lastDot > -1) {
    // Only dot
    const afterDot = normalized.substring(lastDot + 1);
    if (afterDot.length === 3 && /^\d{1,3}(\.\d{3})+$/.test(normalized)) {
      // Could be European thousands (2.720 -> 2720) or literal three-decimal.
      // Prefer thousands interpretation for comma-decimal currencies.
      if (isCommaDecimalCurrency) {
        normalized = normalized.replace(/\./g, '');
      }
      // Else keep as-is: US would not commonly write a thousands separator
      // without a decimal, so "2.720" most likely means 2.72 rounded.
    }
    // afterDot length 1 or 2 is just a regular decimal — leave alone.
  }

  const price = parseFloat(normalized);
  return isNaN(price) ? null : Math.round(price * 100) / 100;
}

export function extractPricesFromText(html: string): ParsedPrice[] {
  const prices: ParsedPrice[] = [];
  const seen = new Set<number>();

  // Match all price-like patterns in the HTML. Order/alternatives mirror pricePatterns.
  const allMatches = html.matchAll(
    /R\$\s*[\d.,']+|[$€£¥₹₩₽]\s*[\d.,']+|(?:CHF|Fr\.)\s*[\d.,']+|zł\s*[\d.,']+|[\d.,']+\s*(?:USD|EUR|GBP|CAD|AUD|JPY|INR|CHF|BRL|PLN|SEK|NOK|DKK|KRW|RUB|CNY|zł)/gi
  );

  for (const match of allMatches) {
    const parsed = parsePrice(match[0]);
    if (parsed && !seen.has(parsed.price)) {
      seen.add(parsed.price);
      prices.push(parsed);
    }
  }

  return prices;
}

export function findMostLikelyPrice(prices: ParsedPrice[]): ParsedPrice | null {
  if (prices.length === 0) return null;
  if (prices.length === 1) return prices[0];

  // Filter out very small prices (likely coupons, savings amounts, not actual product prices).
  // Most real products cost at least $2-3; coupon amounts are often $1-5.
  const validPrices = prices.filter((p) => p.price >= 5);

  // If no prices above 5, try with a lower threshold but above typical coupon amounts
  if (validPrices.length === 0) {
    const lowThresholdPrices = prices.filter((p) => p.price >= 2);
    if (lowThresholdPrices.length > 0) {
      lowThresholdPrices.sort((a, b) => a.price - b.price);
      return lowThresholdPrices[0];
    }
    // Fall back to original list if nothing matches
    return prices[0];
  }

  // Sort by price — the lowest valid price is often the sale/current price
  validPrices.sort((a, b) => a.price - b.price);

  return validPrices[0];
}
