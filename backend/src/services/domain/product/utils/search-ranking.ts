/**
 * Ranks search results by how likely each is to be a trackable product page
 * (issue #94).
 *
 * Deliberately **reorders rather than filters**. Two reasons:
 *
 * 1. The issue warns against assuming every retailer uses the same URL pattern,
 *    and it is right -- any rule confident enough to exclude on would also
 *    exclude working results from retailers that do not follow it.
 * 2. Filtering can return nothing. A search that finds no results reads as "we
 *    could not find that product" when it may mean "our heuristic was wrong",
 *    and the user has no way to tell which.
 *
 * Switching SearXNG to `categories=shopping` was the other option considered. It
 * is rejected here because which engines back that category depends entirely on
 * the operator's own SearXNG configuration -- on an instance with none enabled
 * it returns nothing at all, which is a worse failure than poor ordering.
 */

/** Hosts that are never a product page worth tracking. */
const NON_PRODUCT_HOSTS = [
  'youtube.com', 'youtu.be', 'vimeo.com',
  'reddit.com', 'quora.com', 'stackexchange.com', 'stackoverflow.com',
  'wikipedia.org', 'fandom.com',
  'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com',
  'pinterest.com', 'linkedin.com',
];

/** Path segments that indicate a listing or article rather than one product. */
const NON_PRODUCT_SEGMENTS = [
  '/blog/', '/news/', '/article/', '/articles/', '/review/', '/reviews/',
  '/forum/', '/community/', '/support/', '/help/', '/guide/', '/guides/',
  '/compare/', '/vs/', '/best-', '/how-to',
];

/** A price-looking string in the snippet is decent evidence of a product page. */
const PRICE_PATTERN = /(?:[$£€¥]\s?\d|(?:\d[\d.,]*)\s?(?:USD|EUR|GBP|AUD|CHF|CAD|NZD)\b)/i;

export interface RankableResult {
  title: string;
  url: string;
  content: string;
  domain: string;
  isSupported: boolean;
}

/**
 * Higher is more likely to be a product page. Scores are relative, not absolute
 * -- only the ordering they produce is meaningful.
 */
export function scoreResult(result: RankableResult): number {
  let score = 0;

  // The strongest signal available, and the one that does not assume a URL
  // shape: this domain already has a retailer configuration, so the scraper is
  // known to work on it.
  if (result.isSupported) score += 10;

  let path = '';
  try {
    path = new URL(result.url).pathname.toLowerCase();
  } catch {
    return score - 5;
  }

  const host = result.domain.toLowerCase();
  if (NON_PRODUCT_HOSTS.some(h => host === h || host.endsWith(`.${h}`))) score -= 8;
  if (NON_PRODUCT_SEGMENTS.some(seg => path.includes(seg))) score -= 4;

  // A price in the snippet suggests the page is selling something.
  if (PRICE_PATTERN.test(result.content) || PRICE_PATTERN.test(result.title)) score += 3;

  // A product page usually sits deeper than a category page. Weak on purpose,
  // and capped, because plenty of retailers put products at the root.
  const depth = path.split('/').filter(Boolean).length;
  score += Math.min(depth, 3) * 0.5;

  // A bare domain is a home page, not a product.
  if (depth === 0) score -= 3;

  return score;
}

/**
 * Sorts by score, preserving the engine's own order within equal scores.
 *
 * The stability matters: where the heuristic has nothing to say, the search
 * engine's relevance ranking is better than anything invented here.
 */
export function rankSearchResults<T extends RankableResult>(results: T[]): T[] {
  return results
    .map((result, index) => ({ result, index, score: scoreResult(result) }))
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .map(entry => entry.result);
}
