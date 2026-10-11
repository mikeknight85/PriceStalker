import { randomUUID } from 'node:crypto';
import axios from 'axios';
import { logger } from '../../../utils/system/logger';
import { PageNotAvailableError } from './errors';

/** Matches the scraper service's own default when no `timeout` is sent. */
const DEFAULT_BROWSER_TIMEOUT_MS = 60000;

/** Floor, so a tiny per-retailer timeout cannot make the request unservable. */
const MIN_REQUEST_TIMEOUT_MS = 70000;

/**
 * Slack on top of the scraper's own budget.
 *
 * `options.timeout` is the scraper's budget for the *whole* scrape -- it splits
 * that number across `page.goto` and the post-navigation phase (see
 * `scraper/src/services/ScraperService.ts`). So this only has to cover what
 * sits outside that budget: the screenshot, serialising a multi-megabyte HTML
 * body to JSON, and the hop back over the network.
 *
 * It was `+ 10000`, back when `timeout` went straight to `page.goto` and the
 * post-navigation phase -- the hydration delay plus two 8s auto-resolve rounds
 * with their synthetic input, roughly 23s -- was outside it entirely. A
 * `page.goto` that *succeeded* late in the window was then aborted here before
 * the scrape could return, losing a scrape that had worked. `browserDelay` is
 * still added even though the scraper now counts the delay inside its own
 * budget: double-counting it is free headroom on the one phase whose length the
 * backend actually knows.
 */
const REMOTE_RESPONSE_OVERHEAD_MS = 15000;

/**
 * Fetches HTML via the remote scraper instance (ruski).
 */
export async function fetchRemoteHtml(url: string, remoteScraperUrl: string, options: any = {}): Promise<string> {
  const maxRetries = 3;
  let retryCount = 0;

  // Generate a unique Request ID for traceability across services
  const requestId = options.requestId || `REQ-${randomUUID()}`;
  const productId = options.productId;
  const isDebug = options.debug || process.env.LOG_LEVEL === 'debug';

  while (retryCount <= maxRetries) {
    const controller = new AbortController();
    const browserTimeout = typeof options.timeout === 'number' ? options.timeout : DEFAULT_BROWSER_TIMEOUT_MS;
    const browserDelay = typeof options.delay === 'number' ? options.delay : 0;
    const requestTimeout = Math.max(
      MIN_REQUEST_TIMEOUT_MS,
      browserTimeout + browserDelay + REMOTE_RESPONSE_OVERHEAD_MS
    );
    const abortTimeout = setTimeout(() => controller.abort(), requestTimeout + 5000);

    try {
      const logPrefix = `Browser Scraper | [${requestId}]${productId ? ` [PROD-${productId}]` : ''}`;

      if (retryCount > 0) {
        logger.info(`${logPrefix} | Retry ${retryCount}/${maxRetries} | ${url}`, 'Scraper');
      } else {
        logger.debug(`${logPrefix} | Requesting | ${url} (via ${remoteScraperUrl})`, 'Scraper');
      }

      const endpoint = remoteScraperUrl.endsWith('/scrape') ? remoteScraperUrl : `${remoteScraperUrl}/scrape`;
      
      const payload = {
        url,
        options: {
          ...options,
          requestId,
          productId,
          debug: isDebug
        }
      };

      logger.debug(`SENDING PAYLOAD | UA: ${payload.options.userAgent || 'MISSING'}`, 'Scraper');

      const start = Date.now();
      const response = await axios.post(endpoint, payload, { 
        timeout: requestTimeout,
        signal: controller.signal
      });

      const latency = Date.now() - start;
      logger.info(`${logPrefix} | Success | Url: ${url} | Latency: ${latency}ms`, 'Scraper', {
        requestId,
        productId,
        url,
        latency
      });

      return response.data.html || '';

    } catch (error: any) {
      if (axios.isCancel(error) || error.name === 'AbortError') {
        logger.warn(`Browser Scraper | [${requestId}] | Aborted | Request for ${url} was canceled by backend`, 'Scraper');
        throw new Error('Browser Scraper request aborted');
      }

      const status = error.response?.status;
      const msg = error.response?.data?.error || error.message;

      // The scraper service itself never responds 404/410 (it maps page
      // failures to 500/503), so this status means the configured Remote
      // Scraper URL endpoint does not exist — a configuration problem, never
      // evidence that the product page is gone.
      if (status === 404 || status === 410) {
        throw new Error(`Browser Scraper endpoint not found (${status}) — check the Browser Scraper URL setting`);
      }

      // Handle Rate Limiting (503) with Exponential Backoff
      if (status === 503 && retryCount < maxRetries) {
        retryCount++;
        const delay = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
        logger.warn(`Browser Scraper | [${requestId}] | Busy | Retrying in ${delay}ms...`, 'Scraper');
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(`Browser Scraper failed (${status}): ${msg}`);
    } finally {
      clearTimeout(abortTimeout);
    }
  }

  throw new Error('Browser Scraper failed: max retries exceeded');
}
