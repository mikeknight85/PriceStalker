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
