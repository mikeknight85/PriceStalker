import { type CheerioAPI } from 'cheerio';

/**
 * Detects common bot challenges in HTML.
 *
 * Getting this wrong is expensive in a specific way (issue #149). A challenge
 * page arrives with HTTP 200 and looks, to everything downstream, like a
 * product page that simply has no price on it. So a miss here means:
 * extraction finds nothing, AI auto-mapping generates a config from challenge
 * HTML and rejects it, the add fails with a flat 400 explaining nothing, and
 * the browser-scraper fallback never fires because it is gated on the
 * challengeReason this function returns.
 *
 * Matching was case-sensitive, which missed four things outright -- including
 * `PerimeterX`, the vendor's own casing of its own name, and Amazon's
 * `/errors_page/validateCaptcha`. Everything is matched case-insensitively now.
 *
 * ## Why regexes rather than html.toLowerCase()
 *
 * This runs on every scrape, and a real product page is routinely several
 * megabytes. Lowercasing it would allocate a second copy of the whole document
 * every time, on the path where we expect to find nothing. These patterns are
 * compiled once at module load and scan in place.
 */

/** Body markers, compiled once. Order is irrelevant; each is tried in turn. */
const AKAMAI_BODY = /Reference\s*#18\.|errors\.edgesuite\.net/i;
const CLOUDFLARE_BODY = /cloudflare-static|cf-browser-verification|\/cdn-cgi\/challenge-platform/i;
const DATADOME_BODY = /geo\.captcha|dd-captcha|datadome\.co/i;
const INCAPSULA_BODY = /Incapsula incident ID|_Incapsula_Resource/i;
const PERIMETERX_BODY = /perimeterx|px-captcha|block\.perimeterx\.net/i;

/**
 * Generic last-resort markers, only ever applied to a small body.
 *
 * The size guard is what keeps the word "captcha" appearing somewhere in a
 * genuine 3MB product page from taking that product offline. A challenge page
 * is small by nature -- the ones measured on this project are 2.8KB and 8.3KB.
 */
const GENERIC_BODY = /captcha|prove you are human|are you a robot|unusual traffic|automated access/i;
const GENERIC_BODY_MAX_BYTES = 15000;

/** Titles are cheap to test and far more specific, so they are never size-gated. */
const AKAMAI_TITLE = /access denied/i;
const ROBOT_TITLE = /are you a robot|robot check|verify you are human|bot verification|verify you are a human/i;
const CLOUDFLARE_TITLE = /just a moment|cloudflare|attention required/i;
const PERIMETERX_TITLE = /access to this page has been denied/i;
/** Amazon serves its CAPTCHA under this title, which matched nothing before. */
const AMAZON_TITLE = /server busy|robot check/i;
const GENERIC_TITLE = /captcha|are you human|security check/i;

export function detectBotChallenge(html: string, $: CheerioAPI): string | null {
  const title = $('title').text();

  // Akamai / Edgesuite (Kmart, Target). The title test was an exact equality
  // against 'access denied', so anything with a suffix -- "Access Denied -
  // Target Australia" -- fell straight through.
  if (AKAMAI_TITLE.test(title) || AKAMAI_BODY.test(html)) {
    return 'Akamai Access Denied';
  }

  // Retailer-specific robot interstitials (e.g. digitec/galaxus "Are you a
  // robot?"). These pages carry robots-noindex and no product data, so
  // without this check they are misread as soft-404 dead pages.
  if (ROBOT_TITLE.test(title)) {
    return 'Robot Check Interstitial';
  }

  if (CLOUDFLARE_TITLE.test(title) || CLOUDFLARE_BODY.test(html)) {
    return 'Cloudflare Challenge';
  }

  if (DATADOME_BODY.test(html)) {
    return 'DataDome Challenge';
  }

  if (INCAPSULA_BODY.test(html)) {
    return 'Imperva/Incapsula Challenge';
  }

  if (PERIMETERX_TITLE.test(title) || PERIMETERX_BODY.test(html)) {
    return 'PerimeterX Challenge';
  }

  // Amazon's CAPTCHA page: title "Server Busy", body linking
  // /errors_page/validateCaptcha. Named separately from the generic branch
  // because "no price found" on Amazon is a common enough report that the log
  // line saying which of the two happened is worth having.
  if (AMAZON_TITLE.test(title)) {
    return 'Amazon Bot Challenge';
  }

  // Generic signals. The title is checked whatever the page size; the body only
  // when the page is too small to be a real product page.
  if (GENERIC_TITLE.test(title) || (html.length < GENERIC_BODY_MAX_BYTES && GENERIC_BODY.test(html))) {
    return 'Generic Bot Challenge';
  }

  return null;
}
