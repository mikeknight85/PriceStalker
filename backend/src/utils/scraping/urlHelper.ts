export interface UrlCanonicalRule {
  domain_pattern: string;
  path_match: string;
  path_replacement: string;
  description?: string;
}

/**
 * Lists of parameters to explicitly strip or keep.
 */
const STRIP_LIST = [
  'utm_', 'affid', 'affiliate', 'ref', 'referrer', 'tag', 'fbclid', 'gclid', 'gbraid', 'wbraid',
  'spm', 'promo', 'promocode', 'coupon', 'discount', 'source', 'clickid', 'click_id', 'ncid',
  '_ga', '_gl', 'tracking', 'campaign', 'medium', 'session', 'igshid', 'zanpid', 'msclkid',
  'mc_cid', 'mc_eid', 'yclid', '_hsenc', '_hsmi', '__hssc', '__hstc', '__hsfp', 'rb_clickid',
  's_kwcid', 'bt_ee', 'bt_ts', 'irclickid', 'wickedid', 'twclid', 'ttclid', 'crid', 'sprefix',
  'qid', 'sr', 'dib', 'recently_viewed', 'reviews_redesign', 'queryid', 'objectid', 'indexname',
  'content-id', '_sid'
];

const KEEP_LIST = [
  // Regional / Store settings
  'store', 'location', 'region', 'postcode', 'state', 'suburb', 'city', 'country', 'site',
  // Language & Locale details
  'locale', 'lang', 'hl', 'currency',
  // Variant selection / product identifiers
  'sku', 'productid', 'variant', 'color', 'size', 'id', 'v', 'page', 'product', 'item',
  'model', 'ean', 'upc', 'dwvar_', 'pdp', 'option', 'pid', 'selectedcolor', 'style', 'th'
];

/**
 * Finds the first URL canonicalization rule matching the given URL hostname and pathname.
 */
export function findMatchingCanonicalRule(url: string, rules?: UrlCanonicalRule[]): UrlCanonicalRule | null {
  if (!rules || rules.length === 0) return null;
  try {
    const urlObj = new URL(url.trim());
    const hostname = urlObj.hostname.replace(/^www\./i, '').toLowerCase();

    for (const rule of rules) {
      if (!rule.domain_pattern || !rule.path_match || rule.path_replacement === undefined) continue;
      try {
        const domainRegex = new RegExp(rule.domain_pattern, 'i');
        if (domainRegex.test(hostname)) {
          const pathRegex = new RegExp(rule.path_match, 'i');
          if (pathRegex.test(urlObj.pathname)) {
            return rule;
          }
        }
      } catch {
        // Safe against malformed user-supplied regexes
      }
    }
  } catch {
    // Ignore URL parse error
  }
  return null;
}

/**
 * Cleans a URL by removing tracking parameters and unnecessary fragments,
 * applying data-driven path canonicalization rules if provided,
 * while preserving essential product identifiers (using a hybrid blacklist/whitelist approach).
 */
export function cleanUrl(url: string, rules?: UrlCanonicalRule[]): string {
  try {
    const urlObj = new URL(url.trim());

    // 0. Apply URL canonicalization rules to pathname if configured
    if (rules && rules.length > 0) {
      const hostname = urlObj.hostname.replace(/^www\./i, '').toLowerCase();
      for (const rule of rules) {
        if (!rule.domain_pattern || !rule.path_match || rule.path_replacement === undefined) continue;
        try {
          const domainRegex = new RegExp(rule.domain_pattern, 'i');
          if (domainRegex.test(hostname)) {
            const pathRegex = new RegExp(rule.path_match, 'i');
            if (pathRegex.test(urlObj.pathname)) {
              urlObj.pathname = urlObj.pathname.replace(pathRegex, rule.path_replacement);
              break;
            }
          }
        } catch {
          // Ignore invalid regex in user-configured rules
        }
      }
    }

    // 1. Trim trailing slash from pathname if it's not the root path
    if (urlObj.pathname.length > 1 && urlObj.pathname.endsWith('/')) {
      urlObj.pathname = urlObj.pathname.substring(0, urlObj.pathname.length - 1);
    }

    const paramsToDelete: string[] = [];
    urlObj.searchParams.forEach((_, key) => {
      const lowerKey = key.toLowerCase();

      // Check blacklist
      const shouldStrip = STRIP_LIST.some(p => lowerKey.includes(p));

      // Check whitelist
      const isEssential = KEEP_LIST.some(k => 
        lowerKey === k || 
        lowerKey.startsWith(k) || 
        lowerKey.includes('_' + k) ||
        lowerKey.includes(k + '_') || 
        lowerKey.endsWith('id') || 
        lowerKey.endsWith('pid')
      );

      if (shouldStrip || !isEssential) {
        paramsToDelete.push(key);
      }
    });

    paramsToDelete.forEach(p => urlObj.searchParams.delete(p));

    // Strip fragments/hashes unless they look like they contain identifiers
    if (urlObj.hash) {
      const hashLower = urlObj.hash.toLowerCase();
      const hasEssentialHash = KEEP_LIST.some(k => hashLower.includes(k)) || hashLower.includes('pid');
      if (!hasEssentialHash) {
        urlObj.hash = '';
      }
    }

    return urlObj.toString();
  } catch {
    // Return original if parsing fails (fallback)
    return url;
  }
}

/**
 * Convenience wrapper for cleanUrl with canonicalization rules.
 */
export function canonicalizeUrl(url: string, rules?: UrlCanonicalRule[]): string {
  return cleanUrl(url, rules);
}

/**
 * Standardizes the urlLookup string used to match configs in the database
 */
export function getUrlLookup(url: string): string {
  try {
    const urlObj = new URL(url);
    let pathname = urlObj.pathname;
    
    // Trim trailing slash for consistent lookup matching
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.substring(0, pathname.length - 1);
    }
    
    return (urlObj.hostname.replace('www.', '') + pathname).toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
