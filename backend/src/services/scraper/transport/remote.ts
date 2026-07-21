import axios from 'axios';
import { logger } from '../../../utils/system/logger';
import { PageNotAvailableError } from './errors';

/**
 * Fetches HTML via the remote scraper instance (ruski).
 */
export async function fetchRemoteHtml(url: string, remoteScraperUrl: string, options: any = {}): Promise<string> {
  const maxRetries = 3;
  let retryCount = 0;

  // Generate a unique Request ID for traceability across services
  const requestId = options.requestId || `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const productId = options.productId;
  const isDebug = options.debug || process.env.LOG_LEVEL === 'debug';

  while (retryCount <= maxRetries) {
    const controller = new AbortController();
    const abortTimeout = setTimeout(() => controller.abort(), 65000); // 65s safety timeout

    try {
      const logPrefix = `Remote Scraper | [${requestId}]${productId ? ` [PROD-${productId}]` : ''}`;

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
        timeout: 60000,
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
        logger.warn(`Remote Scraper | [${requestId}] | Aborted | Request for ${url} was canceled by backend`, 'Scraper');
        throw new Error('Remote Scraper request aborted');
      }

      const status = error.response?.status;
      const msg = error.response?.data?.error || error.message;

      // SPECIFIC: 404/410 means the page is gone.
      if (status === 404 || status === 410) {
        throw new PageNotAvailableError(`Page not found (${status}): ${url}`);
      }

      // Handle Rate Limiting (503) with Exponential Backoff
      if (status === 503 && retryCount < maxRetries) {
        retryCount++;
        const delay = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
        logger.warn(`Remote Scraper | [${requestId}] | Busy | Retrying in ${delay}ms...`, 'Scraper');
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(`Remote Scraper Failed (${status}): ${msg}`);
    } finally {
      clearTimeout(abortTimeout);
    }
  }

  throw new Error('Remote Scraper Failed: Max retries exceeded');
}
