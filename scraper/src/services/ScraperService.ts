import { log } from '../utils/logger.js';
import { performHumanLikeActions } from '../core/Actions.js';
import type { BrowserSession, ScrapeOptions, ScrapeResult, ScraperPage } from '../types.js';
import { errorMessage } from '../types.js';
import { parseUserAgent, buildUserAgentMetadata, legacyPlatformFor } from '../utils/userAgent.js';
import { DEFAULT_SCRAPER_USER_AGENT } from '../core/SessionManager.js';
import { buildChallengePattern, looksLikeChallenge } from '../utils/challenge.js';
import { allocateScrapeBudget, createBudgetClock, CHALLENGE_POLL_INTERVAL_MS } from '../utils/budget.js';
import { waitForChallengeToClear } from '../utils/challengeWait.js';

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

      // `options.timeout` is the budget for the *whole* scrape, divided between
      // navigation, the phases after it and the challenge auto-resolve loop's
      // reserved slice. See `utils/budget.ts` for why the loop gets a reserve.
      const budget = allocateScrapeBudget(options);
      const { totalBudgetMs, navigationBudgetMs, challengeReserveMs } = budget;
      const { remainingMs, preChallengeRemainingMs } = createBudgetClock(budget);

      log(
        `Navigating to ${url}... (nav ${navigationBudgetMs}ms, challenge reserve ${challengeReserveMs}ms, of ${totalBudgetMs}ms total)`,
        'DEBUG',
        context
      );
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
        // Clamped to what is left of the budget *minus the challenge reserve*,
        // and never to 0 -- Puppeteer reads a 0 timeout as "wait forever".
        // Clamping against `remainingMs()` here is what let a slow navigation
        // plus a selector wait plus the hydration delay truncate the
        // auto-resolve loop (issue #256).
        const selectorTimeout = Math.max(1, Math.min(10000, preChallengeRemainingMs()));
        await page.waitForSelector(options.waitForSelector, { timeout: selectorTimeout });
        await performHumanLikeActions(page, context);
      }

      if (options.delay) {
        if (abortSignal?.aborted) return null;
        const delayMs = Math.max(0, Math.min(options.delay, preChallengeRemainingMs()));
        if (delayMs > 0) {
          log(`Applying delay: ${delayMs}ms (requested ${options.delay}ms)`, 'DEBUG', context);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }

      if (abortSignal?.aborted) return null;
      let html = await page.content();

      // Some challenge interstitials ("Are you a robot?", "Just a moment...",
      // "Pardon our interruption") auto-resolve once their JS fingerprinting
      // finishes. Give them a few chances before returning the wall page.
      //
      // Recognition is scoped to the title and a size-gated body, and the
      // vendor sensor scripts are deliberately not matched -- see
      // `utils/challenge.ts` for why a false positive here is expensive even
      // though it fails nothing. The wait and the number of attempts are
      // per-request knobs (issue #235) so a retailer that does pay this cost
      // can be tuned down instead of carrying a hardcoded tax.
      //
      // Each attempt *polls* rather than sleeping blind, returning the moment
      // the challenge goes away, and the result records whether it ever did --
      // the route logs that rather than calling every payload a success
      // (issues #256, #255).
      const challengePattern = buildChallengePattern(options.challengePatterns);
      const { interstitialRetries, interstitialWaitMs } = budget;
      const probe = {
        title: () => page?.title() ?? Promise.resolve(''),
        content: () => page?.content() ?? Promise.resolve(html),
      };

      const initialTitle = await page.title().catch(() => '');
      const challengeDetected = looksLikeChallenge(initialTitle, html, challengePattern);
      let challengeUnresolved = challengeDetected;

      for (let attempt = 1; challengeUnresolved && attempt <= interstitialRetries; attempt++) {
        const waitMs = Math.min(interstitialWaitMs, remainingMs());
        if (waitMs < CHALLENGE_POLL_INTERVAL_MS) {
          log(`Challenge interstitial detected but the scrape budget is spent; returning the page as-is`, 'WARN', context);
          break;
        }

        log(`Challenge interstitial detected, waiting up to ${waitMs}ms for auto-resolve (${attempt}/${interstitialRetries})...`, 'INFO', context);
        const outcome = await waitForChallengeToClear(probe, {
          budgetMs: waitMs,
          pattern: challengePattern,
          isAborted: () => abortSignal?.aborted === true,
        });
        if (outcome.html !== null) html = outcome.html;
        if (outcome.aborted) return null;

        if (outcome.cleared) {
          challengeUnresolved = false;
          log(`Challenge interstitial cleared after ${outcome.waitedMs}ms (attempt ${attempt}/${interstitialRetries})`, 'INFO', context);
          break;
        }

        // A round of synthetic input between waits: the behavioural vendors
        // score the absence of input, so an idle page can sit on the wall
        // indefinitely. Skipped when there is no budget left to use it in.
        if (remainingMs() <= CHALLENGE_POLL_INTERVAL_MS) break;
        await performHumanLikeActions(page, context);
        if (abortSignal?.aborted) return null;
        const retryTitle = await page.title().catch(() => '');
        // A read across the navigation a resolving challenge performs rejects;
        // that is not a reason to fail a scrape that has HTML already.
        const refreshed = await page.content().catch(() => null);
        if (refreshed !== null) html = refreshed;
        if (!looksLikeChallenge(retryTitle, html, challengePattern)) {
          challengeUnresolved = false;
          log(`Challenge interstitial cleared after synthetic input (attempt ${attempt}/${interstitialRetries})`, 'INFO', context);
        }
      }

      if (challengeUnresolved) {
        const why =
          interstitialRetries === 0
            ? 'auto-resolve is disabled for this request'
            : `unresolved after ${interstitialRetries} attempt(s)`;
        log(`Challenge interstitial ${why}; returning the wall page (${html.length} bytes)`, 'WARN', context);
      }

      let screenshotBase64 = null;

      if (options.captureScreenshot) {
        log(`Capturing screenshot for ${url}`, 'DEBUG', context);
        screenshotBase64 = await page.screenshot({ encoding: 'base64', fullPage: false });
      }

      return { html, screenshotBase64, challengeDetected, challengeUnresolved };

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
