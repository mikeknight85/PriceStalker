import { getBrowserSession, closeSession, sessions, MAX_BROWSERS } from '../core/SessionManager.mjs';

export class SessionService {
  /**
   * Acquires a browser session based on the provided options.
   */
  static async acquireSession(options) {
    return await getBrowserSession(options);
  }

  /**
   * Releases/Closes a session.
   */
  static async releaseSession(session) {
    return await closeSession(session);
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
        proxyUrl: s.proxyUrl,
        uptime: Math.floor((Date.now() - parseInt(s.id.split('_')[1])) / 1000)
      }))
    };
  }
}
