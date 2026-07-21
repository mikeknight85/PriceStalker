import * as cheerio from 'cheerio';
import * as fs from 'fs';
import { denoiseDomForExtraction } from '../services/scraper/extractors/dom-denoiser';

async function main() {
  const htmlPath = process.argv[2];
  if (!htmlPath) {
    console.error('Usage: tsx debug-denoiser.ts <html-file>');
    process.exit(1);
  }

  const html = fs.readFileSync(htmlPath, 'utf8');
  const $ = cheerio.load(html);

  const globalSelectors = [
    '[data-automation-test-id*="price" i]',
    '[data-testid*="price" i]',
    '[class*="price" i]'
  ];

  console.log('Initial nodes:', $('*').length);
  denoiseDomForExtraction($, undefined, globalSelectors);
  console.log('Nodes after denoise:', $('*').length);

  const scripts = $('script');
  console.log('Scripts remaining:', scripts.length);
  scripts.each((i, el) => {
    console.log(`Script ${i}: type=${$(el).attr('type')}`);
    if (i < 3) {
        const h = $(el).html();
        if (h) console.log(h.substring(0, 100));
    }
  });

  const oosMatch = $('body').text().toLowerCase().includes('out of stock');
  console.log('Includes "out of stock":', oosMatch);
}

main().catch(console.error);
