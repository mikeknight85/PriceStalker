import { ParsedPrice, CURRENCY_MAP, PRICE_PATTERNS, PAYMENT_DENY_LIST } from './constants';
import { normalizePrice } from './normalizer';
import { currencyHelper } from '../../currencyHelper';

/**
 * Parses a price string into a numeric value and currency code.
 */
export function parsePrice(text: string, currencyHint?: string, localeHint: string = 'en-AU'): ParsedPrice | null {
  if (!text) return null;

  const cleanText = text.trim().replace(/\s+/g, ' ');
  const lowerText = cleanText.toLowerCase();

  if (PAYMENT_DENY_LIST.some(p => lowerText.includes(p)) || 
      /\d+\s*payments?\b/.test(lowerText) || 
      /\d+\s*mo\b/.test(lowerText)) {
    return null;
  }

  for (const pattern of PRICE_PATTERNS) {
    const match = cleanText.match(pattern);
    if (match) {
      let priceStr = '';
      let currencySymbol = '';
      
      if (match[3]) {
        priceStr = match[3];
        currencySymbol = match[1];
      } else if (match[1] && match[2]) {
        if (/[$€£¥₹]|CHF|Fr\./i.test(match[1])) {
          currencySymbol = match[1];
          priceStr = match[2];
        } else {
          priceStr = match[1];
          currencySymbol = match[2];
        }
      } else if (match[1]) {
        priceStr = match[1];
      }

      if (priceStr) {
        const price = normalizePrice(priceStr, localeHint);
        if (price !== null && price > 0) {
          let currency = 'USD';
          if (currencySymbol) {
            const resolved = currencyHelper.getCurrencyFromSymbolSync(currencySymbol, localeHint);
            currency = resolved || CURRENCY_MAP[currencySymbol.toUpperCase()] || currencySymbol.toUpperCase() || 'USD';
          }
          if ((currencySymbol === '$' || !currencySymbol) && currencyHint) {
            currency = currencyHint;
          }
          return { price, currency };
        }
      }
    }
  }

  const numberMatch = cleanText.match(/[\d,.\s']+\d*/);
  if (numberMatch) {
    const price = normalizePrice(numberMatch[0], localeHint);
    if (price !== null && price > 0) {
      return { price, currency: currencyHint || 'USD' };
    }
  }

  return null;
}

export function extractPricesFromText(html: string, currencyHint?: string, localeHint?: string): ParsedPrice[] {
  const prices: ParsedPrice[] = [];
  const allMatches = html.matchAll(
    /(?:[$€£¥₹])\s*[\d,.\s']+\d*|(?:CHF|Fr\.)\s*[\d,.\s']+\d*|[\d,.\s']+\d*\s*(?:USD|EUR|GBP|CAD|AUD|CHF)/gi
  );

  for (const match of allMatches) {
    const parsed = parsePrice(match[0], currencyHint, localeHint);
    if (parsed) {
      prices.push(parsed);
    }
  }
  return prices;
}

export function findMostLikelyPrice(prices: ParsedPrice[]): ParsedPrice | null {
  if (prices.length === 0) return null;
  if (prices.length === 1) return prices[0];

  const validPrices = prices.filter((p) => p.price >= 5);

  if (validPrices.length === 0) {
    const lowThresholdPrices = prices.filter((p) => p.price >= 2);
    if (lowThresholdPrices.length > 0) {
      lowThresholdPrices.sort((a, b) => a.price - b.price);
      return lowThresholdPrices[0];
    }
    return prices[0];
  }

  validPrices.sort((a, b) => a.price - b.price);
  return validPrices[0];
}
