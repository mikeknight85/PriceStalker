import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { denoiseDomForExtraction } from '../../src/services/scraper/extractors/dom-denoiser';
import { cleanHtml } from '../../src/services/ai/html/cleaner';
import type { RetailerConfig } from '../../src/models/types';

describe('Modal & Hidden Container Stripping', () => {
  const sampleHtml = `
    <html>
      <body>
        <h1 class="product-title">Real Product Title</h1>
        <div class="d-none explore-modal-container" id="cartLimitModal">
          <div class="explore-modal-header">
            <h2 class="explore-modal-title">Cart limit reached</h2>
          </div>
        </div>
        <div role="dialog" class="auth-modal">
          <h3>Sign In to Continue</h3>
        </div>
      </body>
    </html>
  `;

  it('prunes modals and d-none containers in runtime denoiser', () => {
    const $ = cheerio.load(sampleHtml);
    denoiseDomForExtraction($, {});
    expect($('.explore-modal-title').length).toBe(0);
    expect($('[role="dialog"]').length).toBe(0);
    expect($('.product-title').length).toBe(1);
  });

  it('prunes modals in AI auto-mapping HTML cleaner', () => {
    const $ = cheerio.load(sampleHtml);
    cleanHtml($);
    expect($('.explore-modal-title').length).toBe(0);
    expect($('.product-title').length).toBe(1);
  });

  it('never removes document body even when modal-open class is present', () => {
    const modalBodyHtml = `<html><body class="modal-open"><h1>Title</h1><span class="price">$5</span></body></html>`;
    const $runtime = cheerio.load(modalBodyHtml);
    denoiseDomForExtraction($runtime, {});
    expect($runtime('body').length).toBe(1);
    expect($runtime('h1').text()).toBe('Title');
    expect($runtime('.price').text()).toBe('$5');

    const $ai = cheerio.load(modalBodyHtml);
    cleanHtml($ai);
    expect($ai('body').length).toBe(1);
    expect($ai('h1').text()).toBe('Title');
  });

  it('preserves responsive bootstrap d-none d-md-block containers', () => {
    const responsiveHtml = `<html><body><div class="d-none d-md-block"><span class="price">$5</span></div></body></html>`;
    const $runtime = cheerio.load(responsiveHtml);
    denoiseDomForExtraction($runtime, {});
    expect($runtime('.price').length).toBe(1);
    expect($runtime('.price').text()).toBe('$5');

    const $ai = cheerio.load(responsiveHtml);
    cleanHtml($ai);
    expect($ai('.price').length).toBe(1);
    expect($ai('.price').text()).toBe('$5');
  });

  it('does not preserve modal containers even if previously configured in name_selectors', () => {
    const rogueConfigHtml = `<html><body><div class="d-none explore-modal-container"><h2 class="explore-modal-title">Account limit reached</h2></div><h1 class="real-title">Pixel 9</h1></body></html>`;
    const domainConfig: Partial<RetailerConfig> = {
      name_selectors: ['h2.explore-modal-title'],
    };
    const $ = cheerio.load(rogueConfigHtml);
    denoiseDomForExtraction($, domainConfig);
    expect($('.explore-modal-title').length).toBe(0);
    expect($('.real-title').length).toBe(1);
  });
});
