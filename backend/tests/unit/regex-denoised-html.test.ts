import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { denoiseDomForExtraction } from '../../src/services/scraper/extractors/dom-denoiser';
import { evaluateSelector } from '../../src/services/scraper/core/engine';

/**
 * Regex selectors used to run against the raw response while every other
 * extraction path ran against the denoised document. A rule written for the
 * product area therefore also saw sidebars, carousels, footers and tracking
 * payloads that the denoiser had already removed.
 */

const PAGE = `
<html><body>
  <main>
    <div class="product"><span class="price">$49.99</span></div>
  </main>
  <aside class="recommendations">
    <div class="product"><span class="price">$9.99</span></div>
  </aside>
  <footer><span class="price">$1.00</span></footer>
  <script>window.__INITIAL_STATE__ = {"product":{"price":"49.99","sku":"ABC"}};</script>
  <script>(function(){var _gaq=[['_setAccount','UA-1']];})();</script>
</body></html>
`;

function denoised(html: string) {
  const $ = cheerio.load(html);
  denoiseDomForExtraction($);
  return $;
}

describe('Regex selectors run against the denoised document', () => {
  it('does not match prices from noise containers the denoiser removed', () => {
    const $ = denoised(PAGE);

    const results = evaluateSelector($, PAGE, 'regex:/\\$([0-9]+\\.[0-9]{2})/');
    const values = results.map((r) => r.value);

    expect(values).toContain('49.99');
    // The aside and footer prices are gone from the denoised document, so a
    // regex aimed at the product area no longer collects them.
    expect(values).not.toContain('9.99');
    expect(values).not.toContain('1.00');
  });

  it('can still reach a price held in a state script', () => {
    const $ = denoised(PAGE);

    // Many sites render the price from a state blob rather than into the DOM,
    // and a custom regex rule is the only way to reach it. Stripping every
    // script left those rules matching nothing.
    const results = evaluateSelector($, PAGE, 'regex:/"price":"([0-9.]+)"/');

    expect(results.map((r) => r.value)).toContain('49.99');
  });

  it('drops marketing and tracking scripts', () => {
    const html = denoised(PAGE).html();

    expect(html).toContain('__INITIAL_STATE__');
    expect(html).not.toContain('_setAccount');
  });

  it('falls back to the supplied html rather than losing the selector', () => {
    // A document that cannot be serialised must degrade, not throw.
    const broken = Object.assign(() => ({ each: () => undefined }), {
      html: () => {
        throw new Error('unserialisable');
      },
    }) as never;
    const results = evaluateSelector(broken, '<span>$5.00</span>', 'regex:/\\$([0-9]+\\.[0-9]{2})/');
    expect(results.map((r) => r.value)).toContain('5.00');
  });
});
