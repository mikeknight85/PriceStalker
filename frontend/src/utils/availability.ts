/**
 * Human wording for the availability reason codes the backend stores on a
 * product. Mirrors backend/src/types/availability.ts.
 *
 * Duplicated rather than shared because the two workspaces have no common
 * package, and a reason the UI cannot name is worse than a slightly duplicated
 * table: an unrecognised code falls through to a readable default rather than
 * rendering a raw enum at the user.
 */
const DESCRIPTIONS: Record<string, string> = {
  http_404: 'The product page returned 404 Not Found',
  http_410: 'The product page returned 410 Gone',
  redirected_to_error_page: 'The product URL redirected to an error or home page',
  soft_404_title: 'The page title indicates the product no longer exists',
  soft_404_noindex: 'The page asks not to be indexed and has no product details',
  soft_404_element: 'The page shows a "not found" message',
  site_timeout: 'The retailer did not respond in time',
  dns_failure: "The retailer's domain could not be resolved",
  connection_failure: 'The connection to the retailer failed',
  remote_scraper_failure: 'The browser scraper could not fetch the page',
  bot_or_challenge: 'The retailer served a bot check instead of the product page',
  unknown_scrape_failure: 'The page could not be read',
};

const DEFINITIVE = new Set([
  'http_404',
  'http_410',
  'redirected_to_error_page',
  'soft_404_title',
  'soft_404_noindex',
  'soft_404_element',
]);

export function describeUnavailableReason(reason?: string | null): string | null {
  if (!reason) return null;
  return DESCRIPTIONS[reason] ?? 'The page could not be read';
}

/** True when the page itself is gone, rather than merely unreachable. */
export function isDefinitiveUnavailable(reason?: string | null): boolean {
  return !!reason && DEFINITIVE.has(reason);
}

/**
 * What is happening to monitoring, in one line.
 *
 * The point of the issue: a user seeing a stalled product could not tell whether
 * they had paused it, the system had given up, or a retailer was simply down.
 */
export function describeMonitoringState(product: {
  checking_paused?: boolean;
  auto_paused?: boolean;
  unavailable_reason?: string | null;
  failure_streak?: number;
}): string {
  if (product.checking_paused) {
    // A paused product is excluded from scheduled refreshes, so nothing is
    // watching for it to come back. The system resumes an auto-pause the moment
    // a scrape succeeds -- but only a manual refresh can produce that scrape,
    // so saying only "paused" leaves the user waiting for a recovery that will
    // never arrive on its own (issue #92).
    return product.auto_paused
      ? 'Paused automatically because the page could not be found. Refresh it manually to check whether it is back'
      : 'Paused by you';
  }
  if (product.failure_streak && product.failure_streak > 0) {
    return `Still checking; ${product.failure_streak} recent ${
      product.failure_streak === 1 ? 'attempt' : 'attempts'
    } failed`;
  }
  return 'Active';
}
