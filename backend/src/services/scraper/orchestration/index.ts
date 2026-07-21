import { logger } from '../../../utils/system/logger';
import { 
  ScrapedProduct, 
  ScrapedProductWithVoting, 
  ExtractionMethod 
} from '../../../types/scraper';

import { RetailerConfig } from '../../../models';
import { PageNotAvailableError } from '../transport';
import { acquireHtml } from '../acquisition';

import { initScrapeSession } from './init';
import { runExtractionPhase } from './extraction';
import { runConsensusPhase } from './consensus';
import { runVerificationPhase } from './verification';
import { handleRetailerMaintenance, handleAutoMapping, handleRestoreStatus } from './maintenance';

/**
 * High-level scraper entry point.
 * Returns a simplified product object.
 */
export async function scrapeProduct(url: string, userId?: number): Promise<ScrapedProduct> {
  const res = await scrapeProductWithVoting(url, userId);
  return { 
    name: res.name, 
    price: res.price, 
    memberPrice: res.memberPrice,
    originalPrice: res.originalPrice,
    imageUrl: res.imageUrl, 
    url: res.url, 
    stockStatus: res.stockStatus, 
    aiStatus: res.aiStatus 
  };
}

/**
 * Full-featured scraper orchestration with voting and consensus logic.
 */
export async function scrapeProductWithVoting(
  url: string,
  userId?: number,
  preferredMethod?: ExtractionMethod,
  anchorPrice?: number,
  skipAiVerification?: boolean,
  skipAiExtraction?: boolean,
  overrideConfig?: Partial<RetailerConfig>,
  productId?: number
): Promise<ScrapedProductWithVoting> {
  const requestId = `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const result: ScrapedProductWithVoting = { 
    name: null, 
    price: null, 
    imageUrl: null, 
    url, 
    stockStatus: 'unknown', 
    aiStatus: null, 
    priceCandidates: [], 
    needsReview: false 
  };
  
  let html = '';
  let $: any = null;
  const extractionSteps: string[] = [];

  try {
    // --- Phase 0: Initialization ---
    const session = await initScrapeSession(url, userId, skipAiExtraction, skipAiVerification, overrideConfig);
    let domainConfig = session.domainConfig;
    let { currencyHint, localeHint } = session;

    extractionSteps.push(`Scraper | Identify | Domain: ${session.domain}`);
    extractionSteps.push(`Scraper | Identify | URL: ${url}`);
    extractionSteps.push(`Retailer | Config | ${domainConfig ? `Found for ${session.domain}` : 'Using generic'}`);

    // --- Phase 1: HTML Acquisition ---
    const acqResult = await acquireHtml({
      url,
      domain: session.domain,
      domainConfig: domainConfig || undefined,
      productId,
      requestId,
      extractionSteps
    });

    html = acqResult.html;
    $ = acqResult.$;
    let challenge = acqResult.challengeReason;

    // --- Phase 2: Extraction ---
    const extResults = await runExtractionPhase({
      url,
      userId,
      html,
      $,
      domainConfig,
      currencyHint,
      localeHint,
      extractionSteps
    }, result);
    
    currencyHint = extResults.currencyHint;
    localeHint = extResults.localeHint;

    // --- Phase 3: Validation & Success-First Logic ---
    if (result.priceCandidates && result.priceCandidates.length > 0 && challenge) {
      logger.info(`Scraper | Success-First | Ignoring ${challenge} because price data was found`, 'Scraper', { product_id: productId });
      extractionSteps.push(`Scraper | Success-First | Ignoring ${challenge}`);
      challenge = null;
    }

    await handleRetailerMaintenance(domainConfig, challenge, !!overrideConfig, extractionSteps, productId);

    // --- Phase 4: Auto-Mapping ---
    const isShellConfig = domainConfig && 
      (!domainConfig.price_selectors || domainConfig.price_selectors.length === 0) &&
      (!domainConfig.deal_price_selectors || domainConfig.deal_price_selectors.length === 0) &&
      (!domainConfig.member_price_selectors || domainConfig.member_price_selectors.length === 0) &&
      (!domainConfig.name_selectors || domainConfig.name_selectors.length === 0) &&
      (!domainConfig.image_selectors || domainConfig.image_selectors.length === 0) &&
      (!domainConfig.stock_selectors || domainConfig.stock_selectors.length === 0);

    const isDefinitivelyUnavailable = result.stockStatus === 'out_of_stock' || result.stockStatus === 'not_available';
    const priceExtracted = result.price !== null;

    if (!challenge && !isDefinitivelyUnavailable && !priceExtracted && (!domainConfig || isShellConfig) && session.globalAiSettings.ai_auto_mapping_enabled) {
      domainConfig = await handleAutoMapping({
        html,
        url,
        domain: session.lookupDomain,
        currencyHint,
        localeHint,
        productId,
        extractionSteps,
        learnedFlags: acqResult.learnedFlags,
        isRefresh: !!domainConfig
      });

      if (domainConfig) {
        extractionSteps.push(`Retailer | Auto-Map | Re-running extraction with new config`);
        const cheerio = await import('cheerio');
        const fresh$ = cheerio.load(html);
        const reExtract = await runExtractionPhase({
          url,
          userId,
          html,
          $: fresh$,
          domainConfig,
          currencyHint,
          localeHint,
          extractionSteps
        }, result);
        currencyHint = reExtract.currencyHint;
        localeHint = reExtract.localeHint;
        $ = fresh$;
      }
    }

    // --- Phase 5: Consensus & Arbitration ---
    await runConsensusPhase({
      url,
      html,
      userId,
      productId,
      finalSkipAiExtraction: session.finalSkipAiExtraction,
      anchorPrice,
      extractionSteps
    }, result);

    await handleRestoreStatus(result, domainConfig, !!overrideConfig, challenge, extractionSteps);

    // --- Phase 6: AI Verification ---
    await runVerificationPhase({
      url,
      html,
      userId,
      productId,
      finalSkipAiVerification: session.finalSkipAiVerification,
      extractionSteps
    }, result);

    result.html = html;
    result.extractionSteps = extractionSteps;

    const isOosOrPreOrderSuccess = !result.price && 
      (result.stockStatus === 'out_of_stock' || result.stockStatus === 'pre_order' || result.stockStatus === 'not_available');

    const finalMsg = result.price
      ? `Success | ${session.domain}: ${result.price.currency} ${result.price.price} (${result.selectedMethod})`
      : isOosOrPreOrderSuccess
        ? `Success | ${session.domain}: Out of Stock / Pre-Order (${result.stockStatus})`
        : `Failed | ${session.domain}: No price found`;

    logger.info(`Extraction | ${finalMsg}`, 'Extraction', {
      trace: extractionSteps,
      product_url: url,
      retailer_domain: session.domain,
      product_id: productId,
      requestId
    });
  } catch (error) {
    if (error instanceof PageNotAvailableError) {
      extractionSteps.push(`Scraper | Block | Page no longer exists (404/410)`);
      result.stockStatus = 'not_available';
      logger.warn(`Product | Scrape Failed | Page Gone | ${url}`, 'Scraper', { product_id: productId, requestId });
    } else {
      logger.error(`Product | Scrape Failed | ${url}`, 'Scraper', { product_id: productId, error, requestId });
    }
    result.extractionSteps = extractionSteps;
  } finally {
    // Nullify Cheerio references to ensure garbage collection of DOM elements
    $ = null;
  }
  return result;
}
