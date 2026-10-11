import { log } from '../utils/logger.js';
import { performHumanLikeActions } from '../core/Actions.js';
import type { BrowserSession, ScrapeOptions, ScrapeResult, ScraperPage } from '../types.js';
import { errorMessage } from '../types.js';
import { parseUserAgent, buildUserAgentMetadata, legacyPlatformFor } from '../utils/userAgent.js';
import { DEFAULT_SCRAPER_USER_AGENT } from '../core/SessionManager.js';
import { buildChallengePattern, looksLikeChallenge } from '../utils/challenge.js';

/** Total scrape budget when the backend sends no `timeout`. */
const DEFAULT_TOTAL_BUDGET_MS = 45000;

/**
 * Share of the total budget `page.goto` may consume.
 *
 * `options.timeout` used to go straight to `page.goto`, leaving everything
 * after navigation -- human-like actions, the hydration delay, the challenge
 * auto-resolve loop, the screenshot -- outside any deadline at all. The
 * backend sized its own request timeout as `timeout + delay + 10s`, which
 * covered the delay once and nothing else, so a navigation that *succeeded*
 * late in the window was then aborted by the backend before the scrape could
 * return: losing a scrape that worked, which is the exact failure this work set
 * out to prevent.
 *
 * Splitting the budget here rather than widening the backend's slack keeps one
 * number meaningful end to end: `timeout` is what the whole scrape may take, so
 * the backend can size its request timeout against it and be right.
 *
 * 60/40 leaves 24s of the 60s default for the post-navigation phase, which
 * covers a 3s hydration delay plus two 8s auto-resolve rounds with their
 * synthetic input and still has room for the screenshot.
 */
const NAVIGATION_BUDGET_SHARE = 0.6;

/** Navigation never gets less than this, however small the total budget. */
const MIN_NAVIGATION_BUDGET_MS = 10000;

const DEFAULT_INTERSTITIAL_WAIT_MS = 8000;
const DEFAULT_INTERSTITIAL_RETRIES = 2;

/** A positive finite integer, or the fallback. Rejects 0, negatives and NaN. */
const positiveIntOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;

/** A non-negative finite integer, or the fallback. 0 is a meaningful value. */
const nonNegativeIntOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;

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

      const targetUa = options.userAgent || DEFAULT_SCRAPER_USER_AGENT;
      if (context.forceDebug) log(`Applying User-Agent: ${targetUa}`, 'DEBUG', context);
      const identity = parseUserAgent(targetUa);
      const metadata = buildUserAgentMetadata(identity);

      try {
        const client = await page.target().createCDPSession();
        await client.send('Network.setUserAgentOverride', {
          userAgent: targetUa,
          acceptLanguage: options.acceptLanguage || 'en-US,en;q=0.9',
          platform: legacyPlatformFor(identity.platform),
          userAgentMetadata: metadata
        });
      } catch (cdpErr) {
        log(`CDP UserAgentOverride notice: ${errorMessage(cdpErr)}`, 'DEBUG', context);
      }

      if (metadata) {
        await page.setUserAgent(targetUa, metadata);
      } else {
        if (context.forceDebug) log(`No client hints for ${identity.family} UA`, 'DEBUG', context);
        await page.setUserAgent(targetUa);
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

      // `options.timeout` is the budget for the *whole* scrape, split between
      // navigation and everything after it. See NAVIGATION_BUDGET_SHARE.
      const totalBudgetMs = positiveIntOr(options.timeout, DEFAULT_TOTAL_BUDGET_MS);
      const navigationBudgetMs = Math.max(
        MIN_NAVIGATION_BUDGET_MS,
        Math.round(totalBudgetMs * NAVIGATION_BUDGET_SHARE)
      );
      const deadline = Date.now() + totalBudgetMs;
      const remainingMs = () => deadline - Date.now();

      log(`Navigating to ${url}... (nav ${navigationBudgetMs}ms of ${totalBudgetMs}ms total)`, 'DEBUG', context);
      await page.goto(url, {
        waitUntil: options.waitUntil || 'domcontentloaded',
        timeout: navigationBudgetMs,
        referer: options.referrer || undefined
      });
      log(`Navigation complete: ${url} (${remainingMs()}ms of budget left)`, 'DEBUG', context);

      if (abortSignal?.aborted) return null;
      await performHumanLikeActions(page, context);

      if (options.waitForSelector) {
        if (abortSignal?.aborted) return null;
        log(`Waiting for selector: ${options.waitForSelector}`, 'DEBUG', context);
        // Clamped to what is left of the budget, and never to 0 -- Puppeteer
        // reads a 0 timeout as "wait forever".
        const selectorTimeout = Math.max(1, Math.min(10000, remainingMs()));
        await page.waitForSelector(options.waitForSelector, { timeout: selectorTimeout });
        await performHumanLikeActions(page, context);
      }

      if (options.delay) {
        if (abortSignal?.aborted) return null;
        const delayMs = Math.max(0, Math.min(options.delay, remainingMs()));
        if (delayMs > 0) {
          log(`Applying delay: ${delayMs}ms (requested ${options.delay}ms)`, 'DEBUG', context);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }

      if (abortSignal?.aborted) return null;
      let html = await page.content();

      // Some challenge interstitials ("Are you a robot?", "Just a moment...",
      // "Pardon our interruption") auto-resolve once their JS fingerprinting
      // finishes. Give them a couple of chances before returning the wall page.
      //
      // Recognition is scoped to the title and a size-gated body, and the
      // vendor sensor scripts are deliberately not matched -- see
      // `utils/challenge.ts` for why a false positive here is expensive even
      // though it fails nothing. The wait and the number of attempts are
      // per-request knobs (issue #235) so a retailer that does pay this cost
      // can be tuned down instead of carrying a hardcoded 21s tax.
      const challengePattern = buildChallengePattern(options.challengePatterns);
      const interstitialRetries = nonNegativeIntOr(options.interstitialRetries, DEFAULT_INTERSTITIAL_RETRIES);
      const interstitialWaitMs = positiveIntOr(options.interstitialWaitMs, DEFAULT_INTERSTITIAL_WAIT_MS);

      for (let attempt = 1; attempt <= interstitialRetries; attempt++) {
        const title = await page.title().catch(() => '');
        if (!looksLikeChallenge(title, html, challengePattern)) break;

        const waitMs = Math.min(interstitialWaitMs, remainingMs());
        if (waitMs <= 0) {
          log(`Challenge interstitial detected but the scrape budget is spent; returning the page as-is`, 'WARN', context);
          break;
        }

        log(`Challenge interstitial detected, waiting ${waitMs}ms for auto-resolve (${attempt}/${interstitialRetries})...`, 'INFO', context);
        await new Promise(resolve => setTimeout(resolve, waitMs));
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
