import { describe, it, expect } from 'vitest';
import {
  buildChallengePattern,
  looksLikeChallenge,
  DEFAULT_CHALLENGE_PHRASES,
  CHALLENGE_BODY_MAX_BYTES,
} from '../../../scraper/src/utils/challenge';

/**
 * These exercise the browser scraper's own interstitial recognition, imported
 * from the scraper workspace rather than reimplemented here.
 *
 * It used to be reimplemented: this file carried its own `buildChallengeRegex`
 * with its own copy of the phrase list, which is how the production list could
 * grow four entries that match working pages while the tests kept passing.
 */

const pattern = buildChallengePattern();

/** Body of a size no product page could plausibly be. */
const wallPage = (body: string) => `<html><body>${body}</body></html>`;

/** Body padded past the size gate, as a real product page is. */
const productPage = (body: string) =>
  `<html><body>${body}${'<div class="filler">x</div>'.repeat(1200)}</body></html>`;

describe('Challenge Pattern Interstitials', () => {
  it('matches common bot-wall and anti-bot challenge titles', () => {
    expect(looksLikeChallenge('Pardon Our Interruption', wallPage(''), pattern)).toBe(true);
    expect(looksLikeChallenge('Just a moment...', wallPage(''), pattern)).toBe(true);
    expect(looksLikeChallenge('Access Denied', wallPage(''), pattern)).toBe(true);
    expect(looksLikeChallenge('Attention Required! | Cloudflare', wallPage(''), pattern)).toBe(true);
  });

  it('matches challenge phrases in the body of a small wall page', () => {
    expect(looksLikeChallenge('', wallPage('<h1>Security Check</h1>'), pattern)).toBe(true);
    expect(looksLikeChallenge('', wallPage('<span>Are you a robot?</span>'), pattern)).toBe(true);
    expect(
      looksLikeChallenge('', wallPage('<div>Please verify you are human before continuing</div>'), pattern)
    ).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(looksLikeChallenge('pardon our interruption', '', pattern)).toBe(true);
    expect(looksLikeChallenge('PARDON OUR INTERRUPTION', '', pattern)).toBe(true);
    expect(looksLikeChallenge('SeCuRiTy ChEcK', '', pattern)).toBe(true);
  });

  it('does not match standard product pages without challenges', () => {
    const regularHtml = `
      <html>
        <head><title>Nintendo Switch OLED Console - EB Games Australia</title></head>
        <body>
          <h1>Nintendo Switch OLED</h1>
          <span class="price">$539.00</span>
          <p>This console features a vibrant 7-inch OLED screen.</p>
        </body>
      </html>
    `;
    expect(looksLikeChallenge('Nintendo Switch OLED Console - EB Games Australia', regularHtml, pattern)).toBe(false);
  });

  it('supports custom retailer-specific challenge phrases', () => {
    const customPattern = buildChallengePattern(['blocked by perimeterx', 'human verification needed']);
    expect(looksLikeChallenge('', wallPage('<div>blocked by perimeterx</div>'), customPattern)).toBe(true);
    expect(looksLikeChallenge('', wallPage('<div>human verification needed</div>'), customPattern)).toBe(true);
    expect(looksLikeChallenge('', wallPage('<div>pardon our interruption</div>'), customPattern)).toBe(false);
  });
});

/**
 * Blocker 3. A false positive here fails no scrape -- the scraper returns the
 * HTML either way -- but it costs a wait plus a round of synthetic input per
 * attempt, on every scrape of the affected retailer. The phrases that matched
 * working pages were the expensive part.
 */
describe('Challenge recognition does not fire on working pages', () => {
  it('ignores a DataDome sensor script on a full-size product page', () => {
    // js.datadome.co ships on every *protected* page, not only challenges.
    // Matching the bare vendor name taxed exactly the retailers this feature
    // exists to help -- the `/akam/<n>/pixel_` mistake in a new costume.
    const html = productPage(
      '<script src="https://js.datadome.co/tags.js"></script>' +
      '<script>window.ddjskey="ABC123";window.ddoptions={endpoint:"https://api.datadome.co/js/"}</script>' +
      '<h1>Apple Watch Series 6</h1><span class="price">$399.00</span>'
    );
    expect(html.length).toBeGreaterThan(CHALLENGE_BODY_MAX_BYTES);
    expect(looksLikeChallenge('Apple Watch Series 6 | Dick Smith', html, pattern)).toBe(false);
  });

  it('ignores a PerimeterX sensor script on a full-size product page', () => {
    const html = productPage(
      '<script src="https://client.perimeterx.net/PXaBcDeF/main.min.js"></script>' +
      '<h1>Huda Beauty Easy Bake Loose Powder</h1><span class="price">$55.00</span>'
    );
    expect(looksLikeChallenge('Huda Beauty Easy Bake Loose Powder', html, pattern)).toBe(false);
  });

  it('ignores "press and hold" as ordinary product copy', () => {
    const html = productPage(
      '<h1>Smeg Variable Temperature Kettle</h1>' +
      '<div class="description">To begin boiling, press and hold the start button for 3 seconds.</div>' +
      '<span class="price">$249.00</span>'
    );
    expect(looksLikeChallenge('Smeg Variable Temperature Kettle', html, pattern)).toBe(false);
  });

  it('ignores challenge words buried in an SPA i18n dictionary', () => {
    // A 1.6MB Next.js product page can carry all three of these in its bundled
    // translations and be entirely healthy.
    const html = productPage(
      '<script id="__NEXT_DATA__" type="application/json">' +
      '{"i18n":{"errors":{"403":"Access denied","loading":"Just a moment","captcha":"Security check"}}}' +
      '</script><h1>Mirabella Pumpkin Inflatable</h1><span class="price">$25.00</span>'
    );
    expect(looksLikeChallenge('Mirabella Pumpkin Inflatable | Big W', html, pattern)).toBe(false);
  });

  it('still fires on the real challenge markers at any page size', () => {
    // These are challenge widgets and endpoints, not sensors, so they are not
    // size-gated: PerimeterX's press-and-hold container and DataDome's CAPTCHA
    // host only exist on a wall.
    expect(
      looksLikeChallenge('', productPage('<div id="px-captcha"></div>'), pattern)
    ).toBe(true);
    expect(
      looksLikeChallenge('', productPage('<iframe src="https://geo.captcha-delivery.com/captcha/?initialCid=x"></iframe>'), pattern)
    ).toBe(true);
    expect(
      looksLikeChallenge('', productPage('<div class="dd-captcha-container"></div>'), pattern)
    ).toBe(true);
  });

  it('still fires on a small DataDome wall page', () => {
    const html = wallPage(
      '<h1>Access is temporarily restricted</h1>' +
      '<p>You have been blocked due to unusual activity.</p>'
    );
    expect(html.length).toBeLessThan(CHALLENGE_BODY_MAX_BYTES);
    expect(looksLikeChallenge('', html, pattern)).toBe(true);
  });
});

describe('buildChallengePattern', () => {
  it('drops blank entries rather than letting them match every page', () => {
    // An empty alternative makes /a||b/, which matches any string at all --
    // putting every scrape into the auto-resolve loop.
    const withBlanks = buildChallengePattern(['press & hold', '', '   ', 'px-captcha']);
    expect(withBlanks).not.toBeNull();
    expect(looksLikeChallenge('Ordinary Product Page', productPage('<h1>Kettle</h1>'), withBlanks)).toBe(false);
    expect(looksLikeChallenge('', wallPage('<button>Press &amp; Hold</button>'), withBlanks)).toBe(false);
    expect(looksLikeChallenge('', wallPage('<button>Press & Hold</button>'), withBlanks)).toBe(true);
  });

  it('returns null when every configured phrase is blank', () => {
    expect(buildChallengePattern(['', '  '])).toBeNull();
  });

  it('matches nothing by phrase when the pattern is null, but still sees markers', () => {
    expect(looksLikeChallenge('Just a moment', wallPage('are you a robot'), null)).toBe(false);
    expect(looksLikeChallenge('', wallPage('<div id="px-captcha"></div>'), null)).toBe(true);
  });

  it('falls back to the built-in list when the backend sends none', () => {
    expect(buildChallengePattern([])?.source).toBe(buildChallengePattern()?.source);
  });

  it('escapes regex metacharacters in configured phrases', () => {
    const escaped = buildChallengePattern(['press & hold']);
    expect(escaped?.source).toContain('press & hold');
    expect(looksLikeChallenge('', wallPage('press & hold'), escaped)).toBe(true);
  });

  it('seeds no bare vendor names in the built-in list', () => {
    // The authoritative copy is migration 021; this list is the fallback for a
    // scraper container talking to an older backend, and must not drift back.
    expect(DEFAULT_CHALLENGE_PHRASES).not.toContain('datadome');
    expect(DEFAULT_CHALLENGE_PHRASES).not.toContain('perimeterx');
    expect(DEFAULT_CHALLENGE_PHRASES).not.toContain('captcha-delivery');
    expect(DEFAULT_CHALLENGE_PHRASES).not.toContain('px-captcha');
  });
});
