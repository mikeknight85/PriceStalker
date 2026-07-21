import * as cheerio from 'cheerio';
import * as fs from 'fs';
import { denoiseDomForExtraction } from '../services/scraper/extractors/dom-denoiser';

async function main() {
  const htmlPath = process.argv[2];
  if (!htmlPath) {
    console.error('Usage: tsx debug-denoiser-full.ts <html-file>');
    process.exit(1);
  }

  const html = fs.readFileSync(htmlPath, 'utf8');
  const $ = cheerio.load(html);

  const globalSelectors = [
    "[itemprop=\"availability\"]", ".stock-status", ".availability", "[data-automation-test-id*=\"stock\" i]", "[data-automation-test-id*=\"availability\" i]", "[data-automation-test-id*=\"buy-box\" i]", "[data-testid*=\"stock\" i]", "[data-testid*=\"availability\" i]", "[data-test-id*=\"stock\" i]", "[data-test-id*=\"availability\" i]", "[class*=\"stock-status\" i]", "[class*=\"availability\" i]"
  ];

  console.log('Initial nodes:', $('*').length);
  denoiseDomForExtraction($, undefined, globalSelectors);
  console.log('Nodes after denoise:', $('*').length);

  const scripts = $('script');
  console.log('Scripts remaining:', scripts.length);
  
  const bodyText = $('body').text().toLowerCase();
  const oosMatch = bodyText.includes('out of stock');
  console.log('Includes "out of stock":', oosMatch);
  
  if (oosMatch) {
      const idx = bodyText.indexOf('out of stock');
      console.log('Found "out of stock" at index:', idx);
      console.log('Context:', bodyText.substring(Math.max(0, idx - 50), Math.min(bodyText.length, idx + 50)));
  }
}

main().catch(console.error);
