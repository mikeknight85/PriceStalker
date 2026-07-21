import { userRepository } from '../../models';
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
  let userLocale: string | undefined;
  let userCurrency: string | undefined;

  if (userId) {
    const user = await userRepository.findById(userId);
    if (user) {
      userLocale = user.locale;
      userCurrency = user.preferred_currency || user.currency;
    }
  }

  const { locale, currency } = await currencyHelper.resolveLocaleAndCurrency(url, html, userLocale, userCurrency, currencyHint);
  return { locale, currency };
}
