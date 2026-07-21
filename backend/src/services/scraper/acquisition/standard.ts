import axios, { AxiosError } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { logger } from '../../../utils/system/logger';
import { settingsCache } from '../../../utils/cache';
import { 
  getHeaders, 
  PageNotAvailableError
} from '../transport';
import { RetailerConfig } from '../../../models';
import { withRetry } from '../../../utils/system/retry';

export interface StandardAcquisitionOptions {
  url: string;
  domain: string;
  domainConfig?: RetailerConfig;
  extractionSteps: string[];
  requestId?: string;
}

export async function acquireStandardHtml(options: StandardAcquisitionOptions): Promise<string> {
  const { url, domain, domainConfig, extractionSteps, requestId } = options;
  const useProxy = domainConfig?.use_proxy || false;

  const timeoutSetting = await settingsCache.get('scraper_timeout');
  const timeout = timeoutSetting ? parseInt(timeoutSetting, 10) : 30000;
  const headers = await getHeaders(domainConfig?.user_agent || undefined);

  const currentProxy = useProxy ? await settingsCache.getScraperProxy() : undefined;
  const httpsAgent = currentProxy ? new HttpsProxyAgent(currentProxy) : undefined;
  
  if (currentProxy) {
    extractionSteps.push(`Request | Proxy | Using: ${currentProxy}`);
  }
  extractionSteps.push(`Request | HTTP | UA: ${headers['User-Agent'] ? 'Yes' : 'No'} | Proxy: ${currentProxy ? 'Yes' : 'No'}`);

  let response;
  const start = Date.now();
  try {
    response = await withRetry(
      () => axios.get(url, { headers, timeout, httpsAgent }),
      { maxRetries: 1 },
      'Axios'
    );
    const latency = Date.now() - start;
    const status = response.status;
    const finalUrl = response.request?.res?.responseUrl || response.request?.url || url;
    logger.info(`Scraper | Axios | [${requestId || 'N/A'}] | Success | Status: ${status} | Url: ${finalUrl} | Latency: ${latency}ms`, 'Scraper', {
      requestId,
      latency,
      status,
      url,
      finalUrl,
      proxy: currentProxy ? true : false,
      domain
    });
  } catch (err: any) {
    const isProxyErr = currentProxy && (
      err.code === 'ECONNREFUSED' || 
      err.code === 'EHOSTUNREACH' || 
      err.code === 'ENETUNREACH' || 
      err.code === 'ECONNRESET' ||
      err.message?.toLowerCase().includes('proxy') ||
      err.message?.toLowerCase().includes('tunnel')
    );

    if (isProxyErr) {
      extractionSteps.push(`Request | Proxy Fallback | Proxy failed (${err.code || 'Error'}). Retrying without proxy.`);
      logger.warn(`Scraper | Axios | [${requestId || 'N/A'}] | Proxy connection failed (${err.message}). Retrying without proxy.`, 'Scraper', { requestId, domain });
      
      const fallbackStart = Date.now();
      try {
        response = await withRetry(
          () => axios.get(url, { headers, timeout, httpsAgent: undefined }),
          { maxRetries: 2 },
          'Axios-Fallback'
        );
        const latency = Date.now() - fallbackStart;
        const status = response.status;
        const finalUrl = response.request?.res?.responseUrl || response.request?.url || url;
        logger.info(`Scraper | Axios | [${requestId || 'N/A'}] | Success (Proxy Fallback) | Status: ${status} | Url: ${finalUrl} | Latency: ${latency}ms`, 'Scraper', {
          requestId,
          latency,
          status,
          url,
          finalUrl,
          proxy: false,
          domain
        });
      } catch (fallbackErr: any) {
        handleAxiosError(fallbackErr, url, extractionSteps, requestId);
      }
    } else {
      handleAxiosError(err, url, extractionSteps, requestId);
    }
  }

  if (!response) {
    throw new Error('Request failed to yield a response');
  }

  const finalUrl = response.request?.res?.responseUrl || response.request?.url;
  if (finalUrl) {
    validateUrl(url, finalUrl, requestId);
  }

  let html = response.data;
  if (typeof html !== 'string') html = JSON.stringify(html);
  return html;
}

function handleAxiosError(err: any, url: string, extractionSteps: string[], requestId?: string) {
  const status = err.response?.status;
  const errCode = err.code || (status ? `HTTP ${status}` : 'Unknown');
  logger.debug(`Scraper | Axios | [${requestId || 'N/A'}] | Error Code: ${errCode}`, 'Scraper', { requestId });
  
  if (status === 404 || status === 410) {
    throw new PageNotAvailableError(`Page not found (${status}): ${url}`);
  }

  if (err instanceof AxiosError && status === 403) {
    throw new BotChallengeError('HTTP 403 Forbidden');
  } else {
    extractionSteps.push(`Request | Error | ${errCode}: ${err.message}`);
    throw err;
  }
}

function validateUrl(originalUrl: string, finalUrl: string, requestId?: string) {
  try {
    const finalObj = new URL(finalUrl);
    const originalObj = new URL(originalUrl);
    const finalPath = finalObj.pathname.toLowerCase();
    const errorPatterns = ['/404', '/not-found', '/error', '/search', '/unsupported'];
    const isErrorPath = errorPatterns.some(pattern => finalPath.startsWith(pattern));
    
    if (isErrorPath || (originalObj.pathname.length > 5 && (finalPath === '/' || finalPath === ''))) {
      logger.warn(`Scraper | Axios | [${requestId || 'N/A'}] | Soft 404 | Redirected from ${originalUrl} to ${finalUrl}`, 'Scraper', { requestId });
      throw new PageNotAvailableError(`Soft 404: Redirected to error or root page: ${finalUrl}`);
    }
  } catch (urlErr) {
    if (urlErr instanceof PageNotAvailableError) throw urlErr;
  }
}

export class BotChallengeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BotChallengeError';
  }
}

