import express from 'express';
import { log } from '../utils/logger.js';
import { ScraperService } from '../services/ScraperService.js';
import { SessionService } from '../services/SessionService.js';
import { IDLE_TIMEOUT, MAX_SCRAPES_PER_BROWSER, markSessionTainted } from '../core/SessionManager.js';
import { isProtocolError } from '../core/health.js';
import { scrapeOutcomeLog } from '../utils/outcome.js';
import type { ScrapeOptions } from '../types.js';
import { errorMessage } from '../types.js';
import { scrubUrlCredentials } from '../utils/scrub.js';

const router = express.Router();

// Scrape endpoint
router.post('/scrape', async (req, res) => {
  const { url, options = {} } = req.body as { url?: string; options?: ScrapeOptions };
  
  // Diagnostic log for identity debugging. The proxy URL carries inline
  // credentials in the usual deployment, so it is never logged raw.
  const proxyForLog = options.proxyUrl ? scrubUrlCredentials(options.proxyUrl) : 'None';
  log(`Incoming Scrape Request | URL: ${url} | UA: ${options.userAgent || 'None'} | Proxy: ${proxyForLog}`, 'INFO');

  const context = {
    requestId: options.requestId,
    productId: options.productId,
    forceDebug: (options.debug === true || process.env.DEBUG === 'true') && process.env.DEBUG !== 'false'
  };

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const session = await SessionService.acquireSession(options);
  
  if (!session) {
    const status = SessionService.getPoolStatus();
    log(`Rate limiting request: ${url} (All ${status.activeSessions} browsers busy)`, 'WARN', context);
    return res.status(503).json({ 
      error: 'Server busy. All browser instances at capacity. Please try again in a moment.' 
    });
  }

  session.totalScrapes++;
  session.lastActivity = Date.now();
  
  log(`Scraping: ${url} (Session: ${session.id}, Active: ${session.activePages}, Total: ${session.totalScrapes}) [Proxy: ${proxyForLog}, UA: ${options.userAgent || 'None'}, Ref: ${options.referrer || 'None'}]`, 'INFO', context);

  const abortController = new AbortController();

  res.on('close', () => {
    if (!res.writableEnded) {
      log(`Client disconnected: ${url}. Aborting request.`, 'WARN', context);
      abortController.abort();
      // The abort closes the page out from under whatever CDP command was in
      // flight, which is what leaves the browser wedged with
      // `browser.connected` still true (issue #254). The session is retired
      // rather than returned to the warm pool, where the next request for the
      // same proxy and User-Agent would inherit it and fail every
      // `browser.newPage()` with `Network.enable timed out` until the idle
      // timer expired. A browser relaunch is cheap next to that.
      markSessionTainted(session, 'scrape aborted by client disconnect');
    }
  });

  try {
    const result = await ScraperService.scrape(url, session, options, abortController.signal);
    
    if (abortController.signal.aborted) {
      log(`Scrape aborted for ${url}`, 'DEBUG', context);
      return;
    }

    if (!result) {
      throw new Error('Scrape failed or returned no data');
    }

    // Never "Success" for a wall page: the flag comes from what the scrape
    // observed on the live page, not from re-sniffing the HTML here (#255).
    const outcome = scrapeOutcomeLog(url, result);
    log(outcome.message, outcome.level, context);
    res.json(result);

  } catch (error) {
    // A CDP protocol failure means the DevTools connection, not the page, is
    // the problem, and the browser behind it is not safe to reuse (#254).
    if (isProtocolError(error)) {
      markSessionTainted(session, `CDP protocol error: ${errorMessage(error)}`);
    }

    if (abortController.signal.aborted) {
      log(`Scrape aborted: ${url}`, 'DEBUG', context);
    } else {
      const message = errorMessage(error);
      log(`Scrape Error: ${url} | ${message}`, 'ERROR', context);
      res.status(500).json({ error: message });
    }
  } finally {
    session.activePages--;
    session.lastActivity = Date.now();

    if (session.activePages === 0) {
      if (session.tainted) {
        // Retired, not pooled. `releaseSession` goes through `closeSession`,
        // which still owns the profile-directory removal from issue #208.
        log(`Discarding session ${session.id}: ${session.taintReason || 'marked unusable'}`, 'WARN', context);
        await SessionService.releaseSession(session);
      } else if (session.totalScrapes >= MAX_SCRAPES_PER_BROWSER) {
        log(`Recycling exhausted session ${session.id}`, 'INFO', context);
        await SessionService.releaseSession(session);
      } else {
        session.idleTimer = setTimeout(async () => {
          if (session.activePages === 0) {
            log(`Closing idle session ${session.id} after ${IDLE_TIMEOUT/1000}s`, 'DEBUG', context);
            await SessionService.releaseSession(session);
          }
        }, IDLE_TIMEOUT);
      }
    }
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    pool: SessionService.getPoolStatus()
  });
});

export default router;
