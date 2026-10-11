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
}

export interface ScrapeResult {
  html: string;
  screenshotBase64: string | null;
}

export type ScraperPage = Page;

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
