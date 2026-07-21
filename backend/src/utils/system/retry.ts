import { AxiosError } from 'axios';
import { logger } from './logger';

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  retryCondition?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 2,
  initialDelay: 1000,
  maxDelay: 30000,
  factor: 2,
  retryCondition: (error: any) => {
    const errorMsg = error?.message?.toLowerCase() || '';
    // Abort retry immediately for billing or quota depletion
    if (errorMsg.includes('prepayment credits are depleted') || errorMsg.includes('billing') || errorMsg.includes('quota exceeded')) {
      return false;
    }
    
    // Check standard Axios response status or custom SDK status
    const status = error?.response?.status || error?.status;
    if (status) {
      return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
    }
    
    // Retry on network errors or timeouts
    return error?.code === 'ECONNABORTED' || errorMsg.includes('timeout');
  },
};

/**
 * Executes a function with exponential backoff retry logic.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
  context: string = 'Retry'
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let delay = opts.initialDelay;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      if (attempt > opts.maxRetries || !opts.retryCondition(error)) {
        throw error;
      }

      // Handle 429 Retry-After header if available
      let currentDelay = delay;
      if (error.response?.status === 429 && error.response.headers?.['retry-after']) {
        const retryAfter = parseInt(error.response.headers['retry-after'], 10);
        if (!isNaN(retryAfter)) {
          // Retry-after can be in seconds or a date string
          currentDelay = retryAfter * 1000;
        }
      }

      const errorMsg = error.response?.data?.error?.message || error.message || 'Unknown error';
      const status = error.response?.status ? ` (${error.response.status})` : '';
      
      logger.warn(
        `AI | ${context} | Attempt ${attempt} failed${status}: ${errorMsg}. Retrying in ${currentDelay}ms...`,
        'AI'
      );

      await new Promise(resolve => setTimeout(resolve, currentDelay));
      delay = Math.min(delay * opts.factor, opts.maxDelay);
    }
  }

  throw lastError;
}
