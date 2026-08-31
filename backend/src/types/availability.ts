/**
 * Why a product could not be reached, recorded on the product itself.
 *
 * The distinction that matters is **definitive vs transient**, because the two
 * deserve opposite treatment: a page that is genuinely gone should stop being
 * checked and the user told, while a retailer having a bad afternoon should be
 * retried and nobody woken up.
 *
 * Before this existed, a scrape failure was either a `not_available` status with
 * a hardcoded "404/410" reason in the notification history regardless of the
 * actual cause, or -- for every network-shaped failure -- silence: the previous
 * status was kept, nothing was counted, and nothing was recorded.
 */
export type UnavailableReason =
  // --- Definitive: the page itself is gone. Pause and notify after a streak.
  | 'http_404'
  | 'http_410'
  | 'redirected_to_error_page'
  | 'soft_404_title'
  | 'soft_404_noindex'
  | 'soft_404_element'
  // --- Transient: the page may well be fine; we could not see it.
  | 'site_timeout'
  | 'dns_failure'
  | 'connection_failure'
  | 'remote_scraper_failure'
  | 'bot_or_challenge'
  | 'unknown_scrape_failure';

const DEFINITIVE: ReadonlySet<UnavailableReason> = new Set<UnavailableReason>([
  'http_404',
  'http_410',
  'redirected_to_error_page',
  'soft_404_title',
  'soft_404_noindex',
  'soft_404_element',
]);

/**
 * True when the evidence is about the product page rather than about our ability
 * to fetch it. Only these advance the page-gone streak toward pausing.
 */
export function isDefinitiveUnavailable(reason: UnavailableReason | null | undefined): boolean {
  return !!reason && DEFINITIVE.has(reason);
}

/** Wording for notifications and the UI. Written for a person, not a log. */
const DESCRIPTIONS: Record<UnavailableReason, string> = {
  http_404: 'The product page returned 404 Not Found',
  http_410: 'The product page returned 410 Gone',
  redirected_to_error_page: 'The product URL redirected to an error or home page',
  soft_404_title: 'The page title indicates the product no longer exists',
  soft_404_noindex: 'The page asks not to be indexed and has no product details',
  soft_404_element: 'The page shows a "not found" message',
  site_timeout: 'The retailer did not respond in time',
  dns_failure: 'The retailer’s domain could not be resolved',
  connection_failure: 'The connection to the retailer failed',
  remote_scraper_failure: 'The browser scraper could not fetch the page',
  bot_or_challenge: 'The retailer served a bot check instead of the product page',
  unknown_scrape_failure: 'The page could not be read',
};

export function describeUnavailableReason(reason: UnavailableReason | null | undefined): string {
  if (!reason) return 'Unknown';
  return DESCRIPTIONS[reason] ?? 'The page could not be read';
}

/**
 * Classifies a transport-layer error.
 *
 * Node and axios report these through a mix of `code`, `errno` and message text
 * depending on which layer failed, so this checks all three rather than trusting
 * any one of them.
 */
export function classifyTransportError(error: unknown): UnavailableReason {
  const err = error as { code?: string; errno?: string; message?: string };
  const code = String(err?.code || err?.errno || '').toUpperCase();
  const message = String(err?.message || '').toLowerCase();

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || message.includes('getaddrinfo')) {
    return 'dns_failure';
  }
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || message.includes('timeout')) {
    return 'site_timeout';
  }
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
    return 'connection_failure';
  }
  return 'unknown_scrape_failure';
}
