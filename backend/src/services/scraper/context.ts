import { currencyHelper } from '../../utils/currencyHelper';

export interface ResolvedContext {
  locale: string;
  currency: string;
}

/**
 * Resolves the initial locale and currency based on user preferences and site defaults.
 */
export async function resolveScrapeContext(
  url: string, 
  userId?: number, 
  html?: string,
  currencyHint?: string
): Promise<ResolvedContext> {
  void userId;
  const { locale, currency } = await currencyHelper.resolveLocaleAndCurrency(url, html, undefined, undefined, currencyHint);
  return { locale, currency };
}
