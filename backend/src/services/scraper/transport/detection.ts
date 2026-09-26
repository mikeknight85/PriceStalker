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

/**
 * Akamai Bot Manager's *second* block page: the behavioural-challenge
 * interstitial (issue #67).
 *
 * It is nothing like the Access Denied page. It arrives with **HTTP 200**, is
 * about 2.7KB, and has **no `<title>` element at all**, so every pattern above
 * -- and every Cloudflare, DataDome, Incapsula and PerimeterX pattern below --
 * returned zero matches against the captured sample. The measured consequence:
 * it is scraped as a product page that happens to have no price, so
 * `challengeReason` stays null, the browser fallback never fires, auto-mapping
 * runs on challenge HTML, and the user is advised to enable the Browser
 * Scraper for what was in fact a bot wall.
 *
 * These markers come from Akamai's own interstitial template -- the "cpt"
 * container, the behavioural tile widget, and the "protected by Akamai"
 * footer. They are names no product page has any reason to contain, which is
 * why they are matched on their own:
 *
 *   <div id="sec-if-cpt-container" role="main" style="display: none">
 *     <div class="behavioral-content">
 *       <div id="sec-bc-text-container"></div>
 *       <div id="sec-bc-tile-parent">…
 *       <div class="scf-akamai-logo-sec-abc">
 *
 * Deliberately *not* matched here: the word "akamai" on its own, and
 * `behavioral-content` on its own. A false positive stops a scrape that works,
 * and plenty of retailers mention their CDN in a script URL or a comment.
 */
const AKAMAI_BEHAVIORAL_BODY = /sec-if-cpt-container|scf-akamai-logo|sec-bc-tile-parent|sec-bc-text-container/i;

/**
 * The Bot Manager sensor pixel, which is only evidence when the page is tiny.
 *
 * `/akam/13/pixel_<hex>` is the `<noscript>` fallback for Akamai's sensor. The
 * edge injects that sensor into **ordinary protected pages too**, not only
 * challenges, so on its own it would flag every working page on a
 * Bot-Manager-protected retailer -- exactly the false positive that stops a
 * scrape that was succeeding. It is therefore only read together with the size
 * guard below: a 2.7KB document carrying the sensor and nothing else is a
 * challenge, a 387KB product page carrying the same sensor is a product page.
 */
const AKAMAI_SENSOR_PIXEL = /\/akam\/\d+\/pixel_/i;
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

  // Akamai's other block page. Named separately from Access Denied because the
  // two are different responses from different parts of Bot Manager, arrive
  // with different status codes, and the log line saying which one happened is
  // the difference between "we were refused" and "we were asked to prove
  // ourselves in a browser".
  if (
    AKAMAI_BEHAVIORAL_BODY.test(html) ||
    (html.length < GENERIC_BODY_MAX_BYTES && AKAMAI_SENSOR_PIXEL.test(html))
  ) {
    return 'Akamai Behavioural Challenge';
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
