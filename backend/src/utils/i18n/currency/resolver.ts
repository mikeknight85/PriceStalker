import { currencyCache } from './cache';
import { logger } from '../../system/logger';

export class CurrencyResolver {
  async getCurrencyFromLocale(locale: string): Promise<string | null> {
    const globalCurrencies = await currencyCache.getGlobalCurrencies();
    const cleanLocale = locale.replace('-', '_');
    const match = globalCurrencies.find(c => c.locale === cleanLocale || c.locale === locale);
    return match ? match.iso : null;
  }

  async getLocaleFromCurrency(iso: string): Promise<string | null> {
    const globalCurrencies = await currencyCache.getGlobalCurrencies();
    const match = globalCurrencies.find(c => c.iso === iso.toUpperCase());
    return match ? match.locale : null;
  }

  private resolveAmbiguousSymbol(matches: any[], symbol: string, localeHint?: string): { iso: string; matchedByHint: boolean } {
    if (!localeHint) {
      return { iso: matches[0].iso, matchedByHint: false };
    }

    const cleanHint = localeHint.replace('-', '_').toLowerCase();
    const hintParts = cleanHint.split('_');
    const hintLang = hintParts[0];
    const hintCountry = hintParts[hintParts.length - 1];

    // 1. Exact match (e.g. 'en_us' === 'en_us')
    let matched = matches.find(c => c.locale.replace('-', '_').toLowerCase() === cleanHint);
    if (matched) return { iso: matched.iso, matchedByHint: true };

    // 2. Language + Country match (if both exist)
    if (hintLang && hintCountry && hintLang !== hintCountry) {
      matched = matches.find(c => {
        const cLocale = c.locale.replace('-', '_').toLowerCase();
        const cParts = cLocale.split('_');
        const cLang = cParts[0];
        const cCountry = cParts[cParts.length - 1];
        return cLang === hintLang && cCountry === hintCountry;
      });
      if (matched) return { iso: matched.iso, matchedByHint: true };
    }

    // 3. Language only match (useful for zh vs ja, etc.)
    if (hintLang) {
      const langMatches = matches.filter(c => {
        const cLocale = c.locale.replace('-', '_').toLowerCase();
        const cLang = cLocale.split('_')[0];
        return cLang === hintLang;
      });
      if (langMatches.length > 0) {
        // Try to match country suffix among language matches
        if (hintCountry) {
          const countryMatch = langMatches.find(c => {
            const cLocale = c.locale.replace('-', '_').toLowerCase();
            const cParts = cLocale.split('_');
            const cCountry = cParts[cParts.length - 1];
            return cCountry === hintCountry;
          });
          if (countryMatch) return { iso: countryMatch.iso, matchedByHint: true };
        }
        // Special case: if we match 'zh', and we have CNY in the matches, prefer CNY
        if (hintLang === 'zh') {
          const cnyMatch = langMatches.find(c => c.iso === 'CNY');
          if (cnyMatch) return { iso: cnyMatch.iso, matchedByHint: true };
        }
        return { iso: langMatches[0].iso, matchedByHint: true };
      }
    }

    // 4. Country suffix only match (e.g. match by country if language differs)
    if (hintCountry) {
      matched = matches.find(c => {
        const cLocale = c.locale.replace('-', '_').toLowerCase();
        const cParts = cLocale.split('_');
        const cCountry = cParts[cParts.length - 1];
        return cCountry === hintCountry;
      });
      if (matched) return { iso: matched.iso, matchedByHint: true };
    }

    // Fallback to first one
    return { iso: matches[0].iso, matchedByHint: false };
  }

  async getCurrencyFromSymbol(symbol: string, localeHint?: string): Promise<string | null> {
    const globalCurrencies = await currencyCache.getGlobalCurrencies();
    
    // Filter by symbol
    const matches = globalCurrencies.filter(c => c.symbol === symbol);
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0].iso;

    const result = this.resolveAmbiguousSymbol(matches, symbol, localeHint);
    return result.iso;
  }

  getCurrencyFromSymbolSync(symbol: string, localeHint?: string): string | null {
    const globalCurrencies = currencyCache.getGlobalCurrenciesSync();
    
    // Filter by symbol
    const matches = globalCurrencies.filter(c => c.symbol === symbol);
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0].iso;

    const result = this.resolveAmbiguousSymbol(matches, symbol, localeHint);
    
    if (!result.matchedByHint) {
      logger.warn(`CurrencyHelper | Ambiguous currency symbol "${symbol}" resolved to fallback "${result.iso}" due to missing/unmatched locale hint "${localeHint || 'none'}".`, 'Currency');
    }

    return result.iso;
  }

  async resolveLocaleAndCurrency(url: string, html?: string, userLocale?: string, userCurrency?: string, currencyHint?: string): Promise<{ locale: string; currency: string }> {
    const regionalMappings = await currencyCache.getRegionalMappings();
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch (err) {
      logger.warn(`CurrencyResolver | Malformed URL provided: "${url}". Falling back to default locale and currency.`, 'Currency');
      const fallbackLocale = (userLocale || 'en-AU').replace(/_/g, '-');
      return { locale: fallbackLocale, currency: userCurrency || 'AUD' };
    }
    const hostname = urlObj.hostname.toLowerCase();
    const path = urlObj.pathname.toLowerCase();

    // 0. Prioritize retailer config currency hint if provided
    if (currencyHint) {
      const locale = await this.getLocaleFromCurrency(currencyHint) || userLocale || 'en-AU';
      return { locale: locale.replace(/_/g, '-'), currency: currencyHint };
    }

    // 1. Check URL Mappings (TLD/Path)
    const tldMatch = regionalMappings.find(m => {
      if (m.match_type !== 'tld') return false;
      const code = m.pattern.replace(/^\./, '').toLowerCase();
      const regex = new RegExp('(^|\\.)' + code + '(\\.|$)');
      return regex.test(hostname);
    });
    if (tldMatch) {
      const locale = await this.getLocaleFromCurrency(tldMatch.currency) || userLocale || 'en-AU';
      return { locale: locale.replace(/_/g, '-'), currency: tldMatch.currency };
    }

    const pathMatch = regionalMappings.find(m => m.match_type === 'path' && path.includes(m.pattern.toLowerCase()));
    if (pathMatch) {
      const locale = await this.getLocaleFromCurrency(pathMatch.currency) || userLocale || 'en-AU';
      return { locale: locale.replace(/_/g, '-'), currency: pathMatch.currency };
    }

    // 2. Scan HTML for lang attribute
    if (html) {
      const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
      if (langMatch) {
        let detectedLocale = langMatch[1].replace('-', '_');
        
        // Handle base language codes (e.g. 'de' -> 'de_DE', 'en' -> 'en_US')
        if (!detectedLocale.includes('_')) {
          const defaults: Record<string, string> = {
            'de': 'de_DE',
            'en': 'en_US',
            'fr': 'fr_FR',
            'it': 'it_IT',
            'es': 'es_ES',
            'ja': 'ja_JP',
            'ko': 'ko_KR',
            'zh': 'zh_CN',
            'pt': 'pt_BR',
            'nl': 'nl_NL'
          };
          if (defaults[detectedLocale.toLowerCase()]) {
            detectedLocale = defaults[detectedLocale.toLowerCase()];
          }
        }

        const detectedCurrency = await this.getCurrencyFromLocale(detectedLocale);
        if (detectedCurrency) return { locale: langMatch[1].replace(/_/g, '-'), currency: detectedCurrency };
      }
    }

    // 3. Fallback to User Preferences
    const finalLocale = (userLocale || 'en-AU').replace(/_/g, '-');
    return {
      locale: finalLocale,
      currency: userCurrency || 'AUD'
    };
  }
}

export const currencyResolver = new CurrencyResolver();
