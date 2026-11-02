import { getBrowserSession, closeSession, sessions, MAX_BROWSERS } from '../core/SessionManager.js';
import type { BrowserSession, ScrapeOptions } from '../types.js';
import { scrubUrlCredentials } from '../utils/scrub.js';

export class SessionService {
  /**
   * Acquires a browser session based on the provided options.
   */
  static acquireSession(options: ScrapeOptions): Promise<BrowserSession | null> {
    return getBrowserSession(options);
  }

  /**
   * Releases/Closes a session.
   */
  static releaseSession(session: BrowserSession): Promise<void> {
    return closeSession(session);
  }

  /**
   * Gets the current pool status.
   */
  static getPoolStatus() {
    return {
      activeSessions: sessions.length,
      maxBrowsers: MAX_BROWSERS,
      totalActivePages: sessions.reduce((sum, s) => sum + s.activePages, 0),
      sessions: sessions.map(s => ({
        id: s.id,
        activePages: s.activePages,
        totalScrapes: s.totalScrapes,
        proxyUrl: s.proxyUrl ? scrubUrlCredentials(s.proxyUrl) : null,
        // Surfaced on /health so an operator can see a session being retired
        // rather than inferring it from the log (issue #254).
        tainted: s.tainted,
        taintReason: s.taintReason,
        uptime: Math.floor((Date.now() - parseInt(s.id.split('_')[1])) / 1000)
      }))
    };
  }
}
