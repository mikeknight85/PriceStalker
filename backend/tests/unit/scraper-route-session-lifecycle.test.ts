import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { sessions } from '../../../scraper/src/core/SessionManager';
import type { BrowserSession, ScrapeResult } from '../../../scraper/src/types';

/**
 * The scrape route's session lifecycle (issues #254, #255).
 *
 * This drives the real Express route over a real socket, with the browser
 * behind it faked, because the two things being asserted are both wiring: that
 * an aborted or protocol-errored scrape retires its session instead of
 * returning it to the warm pool, and that a wall page is not announced as a
 * success.
 */

const { scrape, releaseSession, acquired } = vi.hoisted(() => ({
  scrape: vi.fn(),
  releaseSession: vi.fn().mockResolvedValue(undefined),
  acquired: { session: null as BrowserSession | null },
}));

vi.mock('../../../scraper/src/services/ScraperService', () => ({
  ScraperService: { scrape },
}));

vi.mock('../../../scraper/src/services/SessionService', () => ({
  SessionService: {
    acquireSession: vi.fn(async () => acquired.session),
    releaseSession,
    getPoolStatus: () => ({ activeSessions: sessions.length, maxBrowsers: 3, totalActivePages: 0, sessions: [] }),
  },
}));

const logLines: string[] = [];
vi.mock('../../../scraper/src/utils/logger', () => ({
  log: (message: string, type = 'INFO') => {
    logLines.push(`${type} ${message}`);
  },
}));

const fakeSession = (): BrowserSession => ({
  id: 'session_1791872680287_335',
  browser: null,
  launchPromise: null,
  activePages: 1,
  totalScrapes: 0,
  idleTimer: null,
  proxyUrl: 'http://scraper:pa55word@192.168.50.200:8888',
  userAgent: null,
  lastActivity: Date.now(),
  userDataDir: null,
  tainted: false,
  taintReason: null,
});

const result = (over: Partial<ScrapeResult> = {}): ScrapeResult => ({
  html: '<html><body>product</body></html>',
  screenshotBase64: null,
  challengeDetected: false,
  challengeUnresolved: false,
  ...over,
});

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  logLines.length = 0;
  vi.clearAllMocks();
  releaseSession.mockResolvedValue(undefined);
  acquired.session = fakeSession();

  const router = (await import('../../../scraper/src/api/routes')).default;
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/', router);

  server = app.listen(0);
  await new Promise<void>(resolve => server.once('listening', () => resolve()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

const postScrape = (body: unknown, init: RequestInit = {}) =>
  fetch(`${baseUrl}/scrape`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    ...init,
  });

describe('a completed scrape keeps its session (issue #254)', () => {
  it('returns a healthy session to the warm pool', async () => {
    scrape.mockResolvedValue(result());

    const response = await postScrape({ url: 'https://www.bigw.com.au/product/x/p/1' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ challengeUnresolved: false });
    expect(acquired.session?.tainted).toBe(false);
    expect(releaseSession).not.toHaveBeenCalled();
    if (acquired.session?.idleTimer) clearTimeout(acquired.session.idleTimer);
  });
});

describe('a wedged scrape retires its session (issue #254)', () => {
  it('discards the session when the client disconnects mid-scrape', async () => {
    const abort = new AbortController();
    let resolveScrape: (() => void) | undefined;
    scrape.mockImplementation(
      () =>
        new Promise<null>(resolve => {
          resolveScrape = () => resolve(null);
        })
    );

    const inflight = postScrape(
      { url: 'https://www.bigw.com.au/product/mirabella-pumpkin-inflatable/p/6069020' },
      { signal: abort.signal }
    ).catch(() => undefined);

    // Wait until the handler is actually in the scrape before dropping the
    // connection, which is the sequence the trace on #254 shows.
    await vi.waitFor(() => expect(scrape).toHaveBeenCalled());
    abort.abort();
    await vi.waitFor(() => expect(acquired.session?.tainted).toBe(true));

    resolveScrape?.();
    await inflight;

    expect(acquired.session?.taintReason).toBe('scrape aborted by client disconnect');
    await vi.waitFor(() => expect(releaseSession).toHaveBeenCalledWith(acquired.session));
    expect(acquired.session?.idleTimer).toBeNull();
  });

  it('discards the session on a CDP protocol error', async () => {
    const wedged = new Error(
      "Network.enable timed out. Increase the 'protocolTimeout' setting in launch/connect calls for a higher timeout if needed."
    );
    wedged.name = 'ProtocolError';
    scrape.mockRejectedValue(wedged);

    const response = await postScrape({ url: 'https://www.bigw.com.au/product/x/p/1' });

    expect(response.status).toBe(500);
    expect(acquired.session?.tainted).toBe(true);
    expect(acquired.session?.taintReason).toContain('CDP protocol error');
    expect(releaseSession).toHaveBeenCalledWith(acquired.session);
  });

  it('keeps the session for an ordinary site failure', async () => {
    // A navigation timeout is the retailer being slow, not the browser being
    // broken. Recycling here would relaunch Chromium on every slow page.
    scrape.mockRejectedValue(new Error('Navigation timeout of 36000 ms exceeded'));

    const response = await postScrape({ url: 'https://www.bigw.com.au/product/x/p/1' });

    expect(response.status).toBe(500);
    expect(acquired.session?.tainted).toBe(false);
    expect(releaseSession).not.toHaveBeenCalled();
    if (acquired.session?.idleTimer) clearTimeout(acquired.session.idleTimer);
  });
});

describe('the route does not call a wall page a success (issue #255)', () => {
  it('logs an unresolved challenge as a warning', async () => {
    scrape.mockResolvedValue(
      result({ html: 'x'.repeat(37262), challengeDetected: true, challengeUnresolved: true })
    );

    const response = await postScrape({
      url: 'https://www.ebgames.com.au/product/nintendo-switch-2/330016',
    });

    expect(response.status).toBe(200);
    expect(logLines.some(line => line.startsWith('WARN Unresolved challenge wall returned:'))).toBe(true);
    expect(logLines.some(line => line.includes('Success:'))).toBe(false);
    if (acquired.session?.idleTimer) clearTimeout(acquired.session.idleTimer);
  });

  it('still logs a clean page as a success', async () => {
    scrape.mockResolvedValue(result({ html: 'x'.repeat(1621160) }));

    await postScrape({ url: 'https://www.bigw.com.au/product/x/p/1' });

    expect(logLines.some(line => line === 'INFO Success: https://www.bigw.com.au/product/x/p/1 (1621160 bytes)')).toBe(true);
    if (acquired.session?.idleTimer) clearTimeout(acquired.session.idleTimer);
  });
});

describe('the route never logs proxy credentials', () => {
  it('redacts them from the request and session lines', async () => {
    scrape.mockResolvedValue(result());

    await postScrape(
      { url: 'https://www.bigw.com.au/product/x/p/1', options: { proxyUrl: acquired.session?.proxyUrl } },
    );

    expect(logLines.some(line => line.includes('pa55word'))).toBe(false);
    expect(logLines.some(line => line.includes('[REDACTED]:[REDACTED]@192.168.50.200:8888'))).toBe(true);
    if (acquired.session?.idleTimer) clearTimeout(acquired.session.idleTimer);
  });
});
