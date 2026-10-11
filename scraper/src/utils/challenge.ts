/**
 * Challenge-interstitial recognition for the browser scraper.
 *
 * This exists for one purpose: deciding whether to pay for another
 * auto-resolve round (a wait plus a round of synthetic input) before returning
 * the page. It is *not* the project's bot-challenge classifier -- that is
 * `backend/src/services/scraper/transport/detection.ts`, which decides whether
 * a page is BLOCKED. The discipline here is deliberately copied from it,
 * because the failure mode is the same one in a cheaper costume.
 *
 * ## Why matching is scoped rather than "does the page contain this string"
 *
 * The first version of this tested a flat phrase list against the whole of
 * `page.content()` with no size guard. A false positive fails no scrape -- the
 * caller returns the HTML either way -- but it costs up to ~21s and two rounds
 * of synthetic input on *every* scrape of the affected retailer, and several of
 * the phrases appear on pages that work perfectly:
 *
 *   - `datadome` and `perimeterx` are the vendors' own sensor scripts. The edge
 *     injects those into ordinary protected pages, not only challenges, so the
 *     retailers taxed hardest would have been exactly the DataDome/PerimeterX
 *     ones the feature was meant to help. This is the `/akam/<n>/pixel_`
 *     mistake that `detection.ts` documents at length and #226 deliberately
 *     avoided; the bare vendor names are gone, replaced by the markers that
 *     only a challenge carries.
 *   - "press and hold" is ordinary product copy ("press and hold the start
 *     button for 3 seconds") on kettles and power tools.
 *   - "access denied", "just a moment" and "security check" ship inside the
 *     i18n dictionaries of SPA bundles -- a 1.6MB Next.js product page can
 *     contain all three and be entirely healthy.
 *
 * So the phrase list is tested against the document title (cheap, specific,
 * never size-gated) and against the body only when the body is small enough to
 * be a wall page rather than a product page. The handful of markers that no
 * working page has any reason to carry are matched at any size.
 */

/**
 * Markers that only appear on a challenge, matched whatever the page size.
 *
 * Each one is a challenge *widget* or challenge *endpoint*, never a sensor
 * script: `px-captcha` is PerimeterX's own press-and-hold container id,
 * `geo.captcha-delivery` and `dd-captcha` are DataDome's CAPTCHA host and
 * widget, and the Cloudflare and Incapsula entries are their interstitial
 * resources. All of these are already in `detection.ts`'s
 * `DATADOME_BODY` / `PERIMETERX_BODY` / `CLOUDFLARE_BODY` / `INCAPSULA_BODY`.
 *
 * Deliberately absent: `datadome`, `perimeterx`, `akamai` and `captcha` on
 * their own.
 */
const CHALLENGE_MARKERS =
  /px-captcha|geo\.captcha-delivery|dd-captcha|block\.perimeterx\.net|cf-browser-verification|\/cdn-cgi\/challenge-platform|_Incapsula_Resource/i;

/**
 * Largest body the phrase list is allowed to be tested against.
 *
 * Mirrors `GENERIC_BODY_MAX_BYTES` in the backend's `detection.ts`. The
 * challenge pages measured on this project are 2.7KB and 8.3KB; a product page
 * is hundreds of KB to several MB.
 */
export const CHALLENGE_BODY_MAX_BYTES = 15000;

/**
 * Built-in phrase list, used when the backend sends none.
 *
 * The authoritative copy is the `generic_challenge_phrases` system setting,
 * seeded by migration 021 and editable under Admin -> Extraction Rules. This
 * list is the fallback for a scraper container talking to an older backend, and
 * is kept in step with that migration deliberately.
 */
export const DEFAULT_CHALLENGE_PHRASES: readonly string[] = [
  'are you a robot',
  'just a moment',
  'access denied',
  'verify you are human',
  'pardon our interruption',
  'security check',
  'attention required',
  'access is temporarily restricted',
  'unusual activity',
  'access to this page has been denied',
  'press & hold',
  'press and hold'
];

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Compiles the phrase list, or returns `null` when there is nothing to match.
 *
 * The `filter(Boolean)` is load-bearing: a blank entry (an admin saving the
 * list with a stray empty row) would otherwise contribute an empty alternative
 * to the regex, and `/a||b/` matches every string there is -- which would put
 * every scrape on the planet into the auto-resolve loop.
 */
export function buildChallengePattern(phrases?: readonly string[] | null): RegExp | null {
  const source = phrases && phrases.length > 0 ? phrases : DEFAULT_CHALLENGE_PHRASES;
  const cleaned = source
    .filter((phrase): phrase is string => typeof phrase === 'string')
    .map(phrase => phrase.trim())
    .filter(Boolean);

  if (cleaned.length === 0) return null;
  return new RegExp(cleaned.map(escapeRegExp).join('|'), 'i');
}

/**
 * Whether this page looks like a challenge interstitial worth waiting out.
 *
 * @param title Document title, as `page.title()` reports it.
 * @param html  Full page content.
 * @param phrasePattern Compiled phrase list, from `buildChallengePattern`.
 */
export function looksLikeChallenge(
  title: string,
  html: string,
  phrasePattern: RegExp | null
): boolean {
  if (CHALLENGE_MARKERS.test(html)) return true;
  if (!phrasePattern) return false;
  if (title && phrasePattern.test(title)) return true;
  return html.length < CHALLENGE_BODY_MAX_BYTES && phrasePattern.test(html);
}
