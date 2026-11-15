import type { Browser, Page } from 'puppeteer';

export interface ScrapeOptions {
  proxyUrl?: string;
  userAgent?: string;
  referrer?: string;
  requestId?: string | number;
  productId?: string | number;
  debug?: boolean;
  forceNewSession?: boolean;
  sessionId?: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  /**
   * Total budget for the whole scrape, not just `page.goto` (issue #235).
   *
   * It used to be handed verbatim to `page.goto`, which left the
   * post-navigation phase -- human-like actions, the hydration delay, the
   * challenge auto-resolve loop, the screenshot -- entirely outside any
   * deadline. A navigation that finished just inside the budget could still be
   * killed by the backend's own request timeout, losing a scrape that worked.
   * `ScraperService` now splits this across navigation and post-navigation.
   */
  timeout?: number;
  waitForSelector?: string;
  delay?: number;
  captureScreenshot?: boolean;
  challengePatterns?: string[];
  /** Wait per challenge auto-resolve attempt, ms. Default 8000 (issue #235). */
  interstitialWaitMs?: number;
  /** Challenge auto-resolve attempts. Default 2, 0 disables the loop (issue #235). */
  interstitialRetries?: number;
  acceptLanguage?: string;
}

export interface LogContext {
  requestId?: string | number;
  productId?: string | number;
  forceDebug?: boolean;
  metadata?: unknown;
}

export interface BrowserSession {
  id: string;
  browser: Browser | null;
  launchPromise: Promise<Browser> | null;
  activePages: number;
  totalScrapes: number;
  idleTimer: NodeJS.Timeout | null;
  proxyUrl: string | null;
  userAgent: string | null;
  lastActivity: number;
  userDataDir: string | null;
  /**
   * Set when this session must never serve another request (issue #254).
   *
   * A scrape that was aborted mid-flight, or that failed with a CDP protocol
   * error, can leave the browser wedged while `browser.connected` still
   * reports true. The flag takes the session out of the pool immediately; the
   * browser itself is closed as soon as its last in-flight page is done, so a
   * concurrent scrape on the same browser is not pulled out from under.
   */
  tainted: boolean;
  /** Why the session was tainted, for the log line that closes it. */
  taintReason: string | null;
}

export interface ScrapeResult {
  html: string;
  screenshotBase64: string | null;
  /**
   * A challenge interstitial was recognised after navigation (issue #255).
   *
   * False does not mean the page is clean in the backend's sense: this is the
   * scraper's cheap "is another auto-resolve round worth paying for" test, not
   * `transport/detection.ts`, which is what decides whether a retailer is
   * BLOCKED.
   */
  challengeDetected: boolean;
  /**
   * The HTML in this result still looks like a challenge interstitial, so the
   * auto-resolve attempts were exhausted and what is being returned is the
   * wall page rather than the product page (issue #255). Implies
   * `challengeDetected`.
   */
  challengeUnresolved: boolean;
}

export type ScraperPage = Page;

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
