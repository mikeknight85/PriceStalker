import { describe, it, expect } from 'vitest';
import { load } from 'cheerio';
import { detectBotChallenge } from '../../src/services/scraper/transport/detection';

/**
 * A challenge page arrives with HTTP 200 and looks, to everything downstream,
 * like a product page that simply has no price on it. A miss here means
 * extraction finds nothing, auto-mapping generates a config from challenge HTML
 * and rejects it, the add fails with a flat 400, and the browser fallback never
 * fires -- because it is gated on what this function returns (issue #149).
 *
 * This function had no tests at all despite gating that whole path.
 */

const detect = (html: string) => detectBotChallenge(html, load(html));
const page = (title: string, body = '') => `<html><head><title>${title}</title></head><body>${body}</body></html>`;

/** Padding, to build a page too large for the size-gated generic body check. */
const bulk = (bytes: number) => '<div>product detail</div>'.repeat(Math.ceil(bytes / 25));

describe('the four case-sensitivity misses', () => {
  it('catches PerimeterX in the vendor own casing', () => {
    // html.includes('perimeterx') returned false against 'PerimeterX'.
    expect(detect(page('Loading', '<script src="/_px/PerimeterX/init.js"></script>')))
      .toBe('PerimeterX Challenge');
  });

  it('catches Amazon /errors_page/validateCaptcha', () => {
    // html.includes('captcha') returned false against the capital C.
    expect(detect(page('Amazon.com', '<form action="/errors_page/validateCaptcha"></form>')))
      .not.toBeNull();
  });

  it('catches Amazon "Server Busy", which matched nothing at all', () => {
    expect(detect(page('Server Busy'))).toBe('Amazon Bot Challenge');
  });

  it('catches an Access Denied title that carries a suffix', () => {
    // The check was an exact equality against 'access denied'.
    expect(detect(page('Access Denied - Target Australia'))).toBe('Akamai Access Denied');
    expect(detect(page('Access Denied'))).toBe('Akamai Access Denied');
  });
});

describe('each vendor, however it cases its markers', () => {
  it.each([
    ['Akamai reference', page('Error', 'Reference #18.abc123'), 'Akamai Access Denied'],
    ['Akamai edgesuite', page('Error', 'errors.EDGESUITE.net'), 'Akamai Access Denied'],
    ['Cloudflare title', page('Just a moment...'), 'Cloudflare Challenge'],
    ['Cloudflare body', page('x', '<script src="/cdn-cgi/challenge-platform/h/b/x"></script>'), 'Cloudflare Challenge'],
    ['DataDome', page('x', '<script src="https://geo.captcha-delivery.com/c.js"></script>'), 'DataDome Challenge'],
    ['Incapsula', page('x', 'Incapsula incident ID: 1234'), 'Imperva/Incapsula Challenge'],
    ['PerimeterX denied title', page('Access to this page has been denied'), 'PerimeterX Challenge'],
    ['robot interstitial', page('Are you a robot?'), 'Robot Check Interstitial'],
  ])('%s', (_label, html, expected) => {
    expect(detect(html)).toBe(expected);
  });

  it('matches regardless of how the marker is cased', () => {
    for (const variant of ['DataDome.co', 'datadome.co', 'DATADOME.CO']) {
      expect(detect(page('x', `<script src="//${variant}/x.js"></script>`))).toBe('DataDome Challenge');
    }
  });
});

describe('the size guard, which is what stops false positives', () => {
  it('does not flag a large genuine page that happens to say captcha', () => {
    // A 3MB product page mentioning the word must not take that product
    // offline. This is the guard's whole purpose.
    const real = page('Sony WH-1000XM5 | Retailer', `${bulk(40000)}<p>Our login uses a captcha.</p>`);
    expect(real.length).toBeGreaterThan(15000);
    expect(detect(real)).toBeNull();
  });

  it('does flag a small page that says captcha', () => {
    expect(detect(page('Verification', '<p>Please complete the captcha.</p>')))
      .toBe('Generic Bot Challenge');
  });

  it('still reads the title on a large page, which the guard used to cover', () => {
    // The size gate wrapped the title checks too, so a big challenge page whose
    // title said captcha was missed.
    const big = page('Captcha Required', bulk(40000));
    expect(big.length).toBeGreaterThan(15000);
    expect(detect(big)).toBe('Generic Bot Challenge');
  });
});

describe('genuine product pages are left alone', () => {
  it.each([
    ['a plain product page', page('Sony WH-1000XM5 | Retailer', '<span class="price">$49.99</span>')],
    ['one mentioning security', page('Security Camera 1080p | Retailer', '<span class="price">$89.00</span>')],
    ['one with an empty title', page('', '<span class="price">$10.00</span>')],
    ['one with no title element', '<html><body><span class="price">$10.00</span></body></html>'],
    ['an empty document', ''],
  ])('%s is not a challenge', (_label, html) => {
    expect(detect(html)).toBeNull();
  });

  it('does not fire on a product whose name contains "robot"', () => {
    // "Robot Vacuum" must not read as a robot check.
    expect(detect(page('Roborock S8 Robot Vacuum | Retailer', '<span class="price">$899</span>')))
      .toBeNull();
  });
});

/**
 * Akamai's second block page, measured in #67: HTTP 200, about 2.7KB, and no
 * `<title>` element at all. Every pattern in detection.ts was tested against the
 * captured file and none matched, so it was scraped as a product page that
 * happens to have no price -- which meant no challengeReason, no browser
 * fallback, auto-mapping run on challenge HTML, and the user advised to enable
 * the Browser Scraper for a bot wall.
 *
 * Reproduced from the capture quoted in docs/audit/akamai_bot_manager.md.
 */
const AKAMAI_INTERSTITIAL = `<!DOCTYPE html><html><body>
<script type="text/javascript" src="/GMhXa/m/x0/MOFy/9tCqmXA4JjZC/RoqPUw/dzZmVXNs/YEUwIA?v=8083001e-1234-abcd&t=330639649"></script>
<div id="sec-if-cpt-container" role="main" style="display: none">
  <div class="behavioral-content">
    <div id="sec-bc-text-container"></div>
    <div id="sec-bc-tile-parent"></div>
    <div class="behavioral-button progress-btn-disabled"></div>
    <div class="scf-akamai-logo-sec-abc">
      <p class="scf-akamai-protected-by">Powered and protected by Akamai</p>
    </div>
  </div>
</div>
<noscript><img src="https://www.target.com.au/akam/13/pixel_5f33a13e?a=dD1lNzQ="></noscript>
</body></html>`;

describe('the Akamai behavioural interstitial (issue #67)', () => {
  it('recognises the captured page, which nothing matched before', () => {
    expect(detect(AKAMAI_INTERSTITIAL)).toBe('Akamai Behavioural Challenge');
  });

  it('is the shape the old patterns could not see: 200, small, and untitled', () => {
    const $ = load(AKAMAI_INTERSTITIAL);
    expect($('title').length).toBe(0);
    expect(AKAMAI_INTERSTITIAL.length).toBeLessThan(15000);
    // The two Akamai markers that do exist are absent here, which is why the
    // Access Denied branch never fired.
    expect(AKAMAI_INTERSTITIAL).not.toMatch(/access denied/i);
    expect(AKAMAI_INTERSTITIAL).not.toMatch(/Reference\s*#18\.|errors\.edgesuite\.net/i);
  });

  it.each([
    ['the cpt container', '<div id="sec-if-cpt-container" role="main"></div>'],
    ['the logo block', '<div class="scf-akamai-logo-sec-abc"></div>'],
    ['the tile widget', '<div id="sec-bc-tile-parent"></div>'],
    ['the text container', '<div id="sec-bc-text-container"></div>'],
  ])('matches on %s alone', (_label, marker) => {
    expect(detect(`<html><body>${marker}</body></html>`)).toBe('Akamai Behavioural Challenge');
  });

  it('reads the sensor pixel only on a small page', () => {
    const pixel = '<noscript><img src="/akam/13/pixel_5f33a13e?a=dD0x"></noscript>';
    expect(detect(`<html><body>${pixel}</body></html>`)).toBe('Akamai Behavioural Challenge');
  });

  it('does not flag a real product page carrying the same sensor pixel', () => {
    // This is the false positive that matters most. Akamai injects the sensor
    // into ordinary protected pages too, so matching /akam/n/pixel_ on its own
    // would flag every working page on every Bot-Manager retailer -- taking a
    // scrape that succeeds and calling it a block.
    const real = page(
      'Star Wars Zero Company - PlayStation 5 | Target Australia',
      `<span class="price">$79.00</span>${bulk(40000)}<noscript><img src="/akam/13/pixel_5f33a13e?a=dD0x"></noscript>`
    );
    expect(real.length).toBeGreaterThan(15000);
    expect(detect(real)).toBeNull();
  });

  it('does not flag a product page that merely mentions akamai', () => {
    // A retailer naming its CDN in a script URL, a preconnect or a comment is
    // not a challenge, at any page size.
    const mentions = page('Sony WH-1000XM5 | Retailer', [
      '<link rel="preconnect" href="https://retailer.akamaized.net">',
      '<script src="https://cdn.akamai.com/libs/boomerang.js"></script>',
      '<!-- served via Akamai -->',
      '<span class="price">$399.00</span>',
    ].join(''));
    expect(mentions.length).toBeLessThan(15000);
    expect(detect(mentions)).toBeNull();
  });

  it('does not flag a page whose own classes look similar', () => {
    // Nothing here is Akamai's template: a shop with behavioural analytics of
    // its own, or a "secure checkout" container, must still scrape.
    const lookalike = page('Robot Vacuum | Retailer', [
      '<div class="behavioral-content">Recommended for you</div>',
      '<div id="sec-checkout-container"></div>',
      '<div class="akamai-logo"></div>',
      '<span class="price">$599.00</span>',
    ].join(''));
    expect(detect(lookalike)).toBeNull();
  });
});

describe('real captures from this project', () => {
  it('recognises the target.com.au block page', () => {
    // 8,315 bytes, title "Access Denied" -- measured in #67.
    expect(detect(page('Access Denied', 'Reference #18.4f7c2d17'))).toBe('Akamai Access Denied');
  });

  it('recognises the amazon.com.au challenge from the #68 log', () => {
    // 2,860 bytes, 32 DOM nodes, served as HTTP 200.
    const amazon = page('Server Busy', '<form action="/errors_page/validateCaptcha" method="get"></form>');
    expect(amazon.length).toBeLessThan(15000);
    expect(detect(amazon)).toBe('Amazon Bot Challenge');
  });
});
