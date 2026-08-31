import { log } from '../utils/logger.js';
import { performHumanLikeActions } from '../core/Actions.js';
import type { BrowserSession, ScrapeOptions, ScrapeResult, ScraperPage } from '../types.js';
import { errorMessage } from '../types.js';
import { parseUserAgent, buildUserAgentMetadata } from '../utils/userAgent.js';

export class ScraperService {
  /**
   * Performs the scraping operation for a given URL using the provided session and options.
   */
  static async scrape(
    url: string,
    session: BrowserSession,
    options: ScrapeOptions = {},
    abortSignal?: AbortSignal,
  ): Promise<ScrapeResult | null> {
    let page: ScraperPage | null = null;
    const context = {
      requestId: options.requestId,
      productId: options.productId,
      forceDebug: (options.debug === true || process.env.DEBUG === 'true') && process.env.DEBUG !== 'false'
    };

    try {
      if (!session.browser) throw new Error('Browser not available in session');
      
      page = await session.browser.newPage();

      // Debugging: Capture console and request events (filtered to reduce noise)
      if (context.forceDebug) {
        page.on('console', msg => {
          const text = msg.text();
          if (!text.includes('New Relic') && !text.includes('ERR_BLOCKED_BY_CLIENT') && !text.includes('WebGL')) {
            log(`Browser Console: ${text}`, 'DEBUG', context);
          }
        });
        page.on('requestfailed', request => {
          const errText = request.failure()?.errorText || '';
          if (!errText.includes('ERR_BLOCKED_BY_CLIENT') && !errText.includes('net::ERR_ABORTED')) {
            log(`Request Failed: ${request.url()} | ${errText}`, 'DEBUG', context);
          }
        });
        page.on('response', response => {
          if (response.status() >= 400 && response.status() !== 404 && response.status() !== 401 && response.status() !== 403) {
            log(`HTTP ${response.status()}: ${response.url()}`, 'DEBUG', context);
          }
        });
      }

      // Setup abortion listener
      const onAbort = async () => {
        if (page) {
          log(`Aborting active page for ${url}`, 'WARN', context);
          await page.close().catch(error => log(`Error closing aborted page: ${errorMessage(error)}`, 'DEBUG', context));
          page = null;
        }
      };
      
      if (abortSignal) {
        abortSignal.addEventListener('abort', onAbort);
      }

      if (options.userAgent) {
        if (context.forceDebug) log(`Applying User-Agent: ${options.userAgent}`, 'DEBUG', context);
        // The metadata is what keeps Sec-CH-UA in step with the string. Calling
        // setUserAgent with the string alone leaves Chrome reporting its own
        // build in the client hints, so the page announces one browser in the
        // User-Agent and another in the hints -- and overrides the coordinated
        // override the stealth plugin had already set up.
        const identity = parseUserAgent(options.userAgent);
        const metadata = buildUserAgentMetadata(identity);
        if (metadata) {
          await page.setUserAgent(options.userAgent, metadata);
        } else {
          // Firefox and Safari send no client hints, so there is nothing to
          // keep in step and the bare string is correct.
          if (context.forceDebug) log(`No client hints for ${identity.family} UA`, 'DEBUG', context);
          await page.setUserAgent(options.userAgent);
        }
      }

      if (options.referrer) {
        log(`Setting referrer: ${options.referrer}`, 'DEBUG', context);
        await page.setExtraHTTPHeaders({ 'Referer': options.referrer });
      }

      await page.setViewport({ width: 1920, height: 1080 });
      await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: 'light' },
        { name: 'prefers-reduced-motion', value: 'no-preference' }
      ]);

      if (abortSignal?.aborted) return null;
      
      log(`Navigating to ${url}...`, 'DEBUG', context);
      await page.goto(url, {
        waitUntil: options.waitUntil || 'networkidle2',
        timeout: options.timeout || 60000,
        referer: options.referrer || undefined
      });
      log(`Navigation complete: ${url}`, 'DEBUG', context);

      if (abortSignal?.aborted) return null;
      await performHumanLikeActions(page, context);

      if (options.waitForSelector) {
        if (abortSignal?.aborted) return null;
        log(`Waiting for selector: ${options.waitForSelector}`, 'DEBUG', context);
        await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
        await performHumanLikeActions(page, context);
      }

      if (options.delay) {
        if (abortSignal?.aborted) return null;
        log(`Applying delay: ${options.delay}ms`, 'DEBUG', context);
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }

      if (abortSignal?.aborted) return null;
      let html = await page.content();

      // Some challenge interstitials ("Are you a robot?", "Just a moment...")
      // auto-resolve after their JS fingerprinting finishes. Give them a
      // couple of chances before returning the wall page.
      const challengePattern = /are you a robot|just a moment|access denied|verify you are human/i;
      for (let attempt = 1; attempt <= 2 && challengePattern.test(html); attempt++) {
        log(`Challenge interstitial detected, waiting for auto-resolve (${attempt}/2)...`, 'INFO', context);
        await new Promise(resolve => setTimeout(resolve, 8000));
        if (abortSignal?.aborted) return null;
        await performHumanLikeActions(page, context);
        html = await page.content();
      }

      let screenshotBase64 = null;

      if (options.captureScreenshot) {
        log(`Capturing screenshot for ${url}`, 'DEBUG', context);
        screenshotBase64 = await page.screenshot({ encoding: 'base64', fullPage: false });
      }
      
      return { html, screenshotBase64 };

    } catch (error) {
      if (!abortSignal?.aborted) {
        log(`Scrape Internal Error: ${errorMessage(error)}`, 'ERROR', {
          ...context,
          metadata: { stack: error instanceof Error ? error.stack : undefined },
        });
      }
      throw error;
    } finally {
      if (page) {
        await page.close().catch(error => log(`Failed to close page: ${errorMessage(error)}`, 'DEBUG', context));
      }
    }
  }
}
