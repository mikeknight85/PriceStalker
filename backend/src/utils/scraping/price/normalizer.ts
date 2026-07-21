/**
 * Normalizes a price string using locale-aware separation logic.
 */
export function normalizePrice(priceStr: string, locale: string): number | null {
  if (!priceStr) return null;

  // Normalize locale: database often uses underscores (en_AU), JS requires hyphens (en-AU)
  const cleanLocale = locale.replace('_', '-');

  // Detect separators for the given locale
  try {
    const parts = new Intl.NumberFormat(cleanLocale).formatToParts(1234.5);
    const decimalSep = parts.find(p => p.type === 'decimal')?.value || '.';
    const groupSep = parts.find(p => p.type === 'group')?.value || ',';

    // Verify format mismatch between the resolved locale separators and the actual price string
    const lastComma = priceStr.lastIndexOf(',');
    const lastPeriod = priceStr.lastIndexOf('.');
    if (lastComma !== -1 && lastPeriod !== -1) {
      if (groupSep === ',' && decimalSep === '.' && lastComma > lastPeriod) {
        throw new Error('Format mismatch: comma found after decimal point');
      }
      if (groupSep === '.' && decimalSep === ',' && lastPeriod > lastComma) {
        throw new Error('Format mismatch: period found after decimal comma');
      }
    } else if (lastComma !== -1 && groupSep === ',' && decimalSep === '.') {
      // Only comma exists, but resolved locale expects it to be grouping separator (,).
      // If it's followed by 2 digits (e.g. 123,45) or anything other than 3, it's a decimal separator!
      const cleanStr = priceStr.replace(/[^\d,]/g, '');
      const splitParts = cleanStr.split(',');
      const lastPart = splitParts[splitParts.length - 1];
      if (lastPart.length !== 3) {
        throw new Error('Format mismatch: comma is likely a decimal separator');
      }
    } else if (lastPeriod !== -1 && groupSep === '.' && decimalSep === ',') {
      // Only period exists, but resolved locale expects it to be grouping separator (.).
      // If it's followed by 2 digits (e.g. 123.45) or anything other than 3, it's a decimal separator!
      const cleanStr = priceStr.replace(/[^\d.]/g, '');
      const splitParts = cleanStr.split('.');
      const lastPart = splitParts[splitParts.length - 1];
      if (lastPart.length !== 3) {
        throw new Error('Format mismatch: period is likely a decimal separator');
      }
    }

    // Clean up: remove spaces and grouping separators
    let normalized = priceStr.replace(/[\s']/g, '');
    
    // Escaping separator for regex
    const escapedGroupSep = groupSep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedDecimalSep = decimalSep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (escapedGroupSep === escapedDecimalSep) {
      const occurrences = (normalized.match(new RegExp(escapedDecimalSep, 'g')) || []).length;
      if (occurrences === 1) {
        normalized = normalized.replace(escapedDecimalSep, '.');
      } else {
        const lastIndex = normalized.lastIndexOf(decimalSep);
        normalized = normalized.substring(0, lastIndex).replace(new RegExp(escapedGroupSep, 'g'), '') + 
                     '.' + 
                     normalized.substring(lastIndex + 1);
      }
    } else {
      normalized = normalized.replace(new RegExp(escapedGroupSep, 'g'), '');
      normalized = normalized.replace(new RegExp(escapedDecimalSep, 'g'), '.');
    }

    const price = parseFloat(normalized);
    return isNaN(price) ? null : Math.round(price * 100) / 100;
  } catch (e) {
    // Smart fallback for invalid locales
    let clean = priceStr.replace(/[^\d.,]/g, '');
    const lastComma = clean.lastIndexOf(',');
    const lastPeriod = clean.lastIndexOf('.');
    
    if (lastComma !== -1 && lastPeriod !== -1) {
      if (lastComma > lastPeriod) {
        // Format: 1.234,56 -> Decimal is comma, thousand separator is period
        clean = clean.replace(/\./g, '').replace(/,/g, '.');
      } else {
        // Format: 1,234.56 -> Decimal is period, thousand separator is comma
        clean = clean.replace(/,/g, '');
      }
    } else if (lastComma !== -1) {
      // Only commas exist (e.g. 123,45 vs 1,000) - check fractional digits
      const parts = clean.split(',');
      if (parts[parts.length - 1].length === 2) {
        clean = clean.replace(/,/g, '.'); // likely decimal
      } else {
        clean = clean.replace(/,/g, ''); // likely grouping
      }
    }
    
    const price = parseFloat(clean);
    return isNaN(price) ? null : Math.round(price * 100) / 100;
  }
}
