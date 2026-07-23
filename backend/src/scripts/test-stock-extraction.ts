import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { extractStock } from '../services/scraper/extractors/stock/index';
import { settingsCache } from '../utils/cache';

async function main() {
  const htmlArg = process.argv[2];
  const htmlPath = htmlArg ? path.resolve(htmlArg) : path.resolve(__dirname, '../../../../tmp/amazon_test.html');

  console.log(`Reading HTML dump from: ${htmlPath}`);

  if (!fs.existsSync(htmlPath)) {
    console.error(`Error: File does not exist at ${htmlPath}`);
    console.error(`Usage: pnpm --filter pricestalker-backend exec tsx src/scripts/test-stock-extraction.ts [html-file-path]`);
    process.exit(1);
  }

  const html = fs.readFileSync(htmlPath, 'utf-8');
  const $ = cheerio.load(html);

  // Load generic phrases from cache
  const prePhrases = await settingsCache.getGenericPreOrderPhrases();
  const oosPhrases = await settingsCache.getGenericOutOfStockPhrases();
  const isPhrases = await settingsCache.getGenericInStockPhrases();

  const phrases = { pre: prePhrases, oos: oosPhrases, is: isPhrases };
  console.log('Generic Phrases Loaded:', phrases);

  // Test Case A: No custom retailer configuration (testing global selectors fallback)
  console.log('\n--- Test Case A: No Retailer Config (Using Generic Stock Selectors Fallback) ---');
  const stepsA: string[] = [];
  const { status: statusA, candidates: candidatesA } = await extractStock($, undefined, phrases, stepsA);
  console.log('Result Status:', statusA);
  console.log('Candidates:', candidatesA);
  console.log('Steps Taken:', stepsA);

  // Test Case B: With Custom stock selectors configured (e.g. #availability)
  console.log('\n--- Test Case B: Custom Selector (#availability) ---');
  const stepsB: string[] = [];
  const mockConfigB = {
    stock_selectors: ['#availability'],
  };
  const { status: statusB, candidates: candidatesB } = await extractStock($, mockConfigB, phrases, stepsB);
  console.log('Result Status:', statusB);
  console.log('Candidates:', candidatesB);
  console.log('Steps Taken:', stepsB);

  // Test Case C: With Custom stock selectors configured (#outOfStock)
  console.log('\n--- Test Case C: Custom Selector (#outOfStock) ---');
  const stepsC: string[] = [];
  const mockConfigC = {
    stock_selectors: ['#outOfStock'],
  };
  const { status: statusC, candidates: candidatesC } = await extractStock($, mockConfigC, phrases, stepsC);
  console.log('Result Status:', statusC);
  console.log('Candidates:', candidatesC);
  console.log('Steps Taken:', stepsC);

  // Test Case D: Modifier ::equals selector (matches)
  console.log('\n--- Test Case D: Custom Selector with ::equals modifier (matching) ---');
  const stepsD: string[] = [];
  const availabilityText = $('#availability').text().trim();
  console.log(`Raw text of #availability: "${availabilityText}"`);
  
  const mockConfigD = {
    stock_selectors: [`#availability::equals(${availabilityText})->in_stock`],
  };
  const { status: statusD, candidates: candidatesD } = await extractStock($, mockConfigD, phrases, stepsD);
  console.log('Result Status:', statusD);
  console.log('Candidates:', candidatesD);
  console.log('Steps Taken:', stepsD);

  // Test Case E: Modifier ::equals selector (fails)
  console.log('\n--- Test Case E: Custom Selector with ::equals modifier (not matching) ---');
  const stepsE: string[] = [];
  const mockConfigE = {
    stock_selectors: ['#availability::equals(nonexistent_value)->pre_order'],
  };
  const { status: statusE, candidates: candidatesE } = await extractStock($, mockConfigE, phrases, stepsE);
  console.log('Result Status:', statusE); // Expect unknown since modifier fails
  console.log('Candidates:', candidatesE);
  console.log('Steps Taken:', stepsE);

  // Test Case F: Modifier ::contains selector (matches)
  console.log('\n--- Test Case F: Custom Selector with ::contains modifier (matching) ---');
  const stepsF: string[] = [];
  const snippet = availabilityText.substring(0, Math.min(availabilityText.length, 5));
  console.log(`Substring of #availability: "${snippet}"`);
  const mockConfigF = {
    stock_selectors: [`#availability::contains(${snippet})->out_of_stock`],
  };
  const { status: statusF, candidates: candidatesF } = await extractStock($, mockConfigF, phrases, stepsF);
  console.log('Result Status:', statusF);
  console.log('Candidates:', candidatesF);
  console.log('Steps Taken:', stepsF);
}

main().catch(console.error);
