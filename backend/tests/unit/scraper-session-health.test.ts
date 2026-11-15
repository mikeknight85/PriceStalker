import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  CDP_PROBE_TIMEOUT_MS,
  isProcessGone,
  isProtocolError,
  isSessionResponsive,
  probeCdp,
  type CdpProbeTarget,
} from '../../../scraper/src/core/health';
import { findReusableSession, isSessionEligible } from '../../../scraper/src/core/pool';
import type { BrowserSession } from '../../../scraper/src/types';

/**
 * Wedged browser sessions must not be handed to the next request (issue #254).
 *
 * The crux of that issue is that `browser.connected` stays true on a Chromium
 * whose DevTools connection has wedged, so the pool kept serving it and every
 * `browser.newPage()` failed with `ProtocolError: Network.enable timed out`.
 * These exercise the scraper workspace's own liveness probe and pool
 * selection; the Puppeteer `Browser` is faked down to the three members the
 * probe touches, so no Chromium is launched.
 */

const LIMITS = { maxPagesPerBrowser: 4, maxScrapesPerBrowser: 50 };

/** A browser that answers CDP, or one that accepted the command and never will. */
function fakeBrowser(
  options: { connected?: boolean; answers?: boolean | 'hangs'; exited?: boolean } = {}
): CdpProbeTarget {
  const answers = options.answers ?? true;
  return {
    connected: options.connected ?? true,
    process: () => (options.exited ? { exitCode: 1, signalCode: null } : { exitCode: null, signalCode: null }),
    version: () => {
      if (answers === 'hangs') return new Promise<string>(() => {});
      if (answers === false) return Promise.reject(new Error('Protocol error (Browser.getVersion): Target closed'));
      return Promise.resolve('HeadlessChrome/154.0.0.0');
    },
  };
}

function fakeSession(over: Partial<BrowserSession> = {}): BrowserSession {
  return {
    id: 'session_1791872680287_335',
    browser: null,
    launchPromise: null,
    activePages: 0,
    totalScrapes: 1,
    idleTimer: null,
    proxyUrl: 'http://192.168.50.200:8888',
    userAgent: null,
    lastActivity: Date.now(),
    userDataDir: '/tmp/scraper-profiles/session_1791872680287_335',
    tainted: false,
    taintReason: null,
    ...over,
  };
}

type PuppeteerBrowser = NonNullable<BrowserSession['browser']>;

/**
 * Puts a fake browser in the session's `browser` slot.
 *
 * The slot is a Puppeteer `Browser`, of which the liveness probe uses three
 * members; the double implements exactly those. The assertion is confined to
 * this one helper so the fake stays honest about them, without pulling a real
 * browser into a unit test and without widening anything to `any`.
 */
const asBrowser = (browser: CdpProbeTarget): PuppeteerBrowser => browser as unknown as PuppeteerBrowser;

const withBrowser = (session: BrowserSession, browser: CdpProbeTarget): BrowserSession =>
  Object.assign(session, { browser: asBrowser(browser) });

/** A launch that has not settled yet, as `createNewSession` leaves it. */
const pendingLaunch = (): BrowserSession['launchPromise'] => Promise.resolve(asBrowser(fakeBrowser()));

afterEach(() => {
  vi.useRealTimers();
});

describe('probeCdp', () => {
  it('accepts a browser that answers a round trip', async () => {
    await expect(probeCdp(fakeBrowser())).resolves.toBe(true);
  });

  it('rejects a browser whose DevTools connection never answers', async () => {
    vi.useFakeTimers();
    const verdict = probeCdp(fakeBrowser({ answers: 'hangs' }));

    // This is the #254 state exactly: connected, process alive, CDP silent.
    await vi.advanceTimersByTimeAsync(CDP_PROBE_TIMEOUT_MS);
    await expect(verdict).resolves.toBe(false);
  });

  it('does not wait the probe timeout when the command fails outright', async () => {
    await expect(probeCdp(fakeBrowser({ answers: false }))).resolves.toBe(false);
  });

  it('rejects a disconnected transport and an exited process without sending anything', async () => {
    const disconnected = fakeBrowser({ connected: false, answers: 'hangs' });
    const exited = fakeBrowser({ exited: true, answers: 'hangs' });

    await expect(probeCdp(disconnected)).resolves.toBe(false);
    await expect(probeCdp(exited)).resolves.toBe(false);
  });
});

describe('isProcessGone', () => {
  it('reads an exit code or a signal as gone, and nothing else', () => {
    expect(isProcessGone(null)).toBe(false);
    expect(isProcessGone({ exitCode: null, signalCode: null })).toBe(false);
    expect(isProcessGone({ exitCode: 0, signalCode: null })).toBe(true);
    expect(isProcessGone({ exitCode: null, signalCode: 'SIGKILL' })).toBe(true);
  });
});

describe('isSessionResponsive', () => {
  it('refuses a session already marked unusable without probing it', async () => {
    const session = withBrowser(fakeSession({ tainted: true }), fakeBrowser({ answers: 'hangs' }));

    await expect(isSessionResponsive(session)).resolves.toBe(false);
  });

  it('accepts a session that is still launching', async () => {
    const launching = fakeSession({ browser: null, launchPromise: pendingLaunch() });

    await expect(isSessionResponsive(launching)).resolves.toBe(true);
  });

  it('refuses a session with neither a browser nor a launch in flight', async () => {
    await expect(isSessionResponsive(fakeSession())).resolves.toBe(false);
  });
});

describe('isSessionEligible', () => {
  const match = { proxyUrl: 'http://192.168.50.200:8888', userAgent: null };

  it('matches on proxy and User-Agent together', () => {
    expect(isSessionEligible(withBrowser(fakeSession(), fakeBrowser()), match, LIMITS)).toBe(true);
    expect(
      isSessionEligible(withBrowser(fakeSession({ proxyUrl: null }), fakeBrowser()), match, LIMITS)
    ).toBe(false);
    expect(
      isSessionEligible(withBrowser(fakeSession({ userAgent: 'Mozilla/5.0' }), fakeBrowser()), match, LIMITS)
    ).toBe(false);
  });

  it('excludes a tainted session even though everything else about it matches', () => {
    const tainted = withBrowser(
      fakeSession({ tainted: true, taintReason: 'scrape aborted by client disconnect' }),
      fakeBrowser()
    );

    expect(isSessionEligible(tainted, match, LIMITS)).toBe(false);
  });

  it('still honours the page and scrape limits', () => {
    expect(
      isSessionEligible(withBrowser(fakeSession({ activePages: 4 }), fakeBrowser()), match, LIMITS)
    ).toBe(false);
    expect(
      isSessionEligible(withBrowser(fakeSession({ totalScrapes: 50 }), fakeBrowser()), match, LIMITS)
    ).toBe(false);
    expect(
      isSessionEligible(withBrowser(fakeSession(), fakeBrowser({ connected: false })), match, LIMITS)
    ).toBe(false);
  });
});

describe('findReusableSession (issue #254)', () => {
  const match = { proxyUrl: 'http://192.168.50.200:8888', userAgent: null };

  it('does not hand a wedged session to the next request', async () => {
    const wedged = withBrowser(fakeSession({ id: 'wedged' }), fakeBrowser({ answers: 'hangs' }));
    const discarded: string[] = [];

    const chosen = await findReusableSession({
      pool: [wedged],
      match,
      limits: LIMITS,
      // The real probe is `isSessionResponsive`, driven on its own above; here
      // it stands in for "the browser did not answer".
      probe: async () => false,
      discard: async session => {
        discarded.push(session.id);
      },
    });

    expect(chosen).toBeNull();
    expect(discarded).toEqual(['wedged']);
  });

  it('skips past the wedged session to a healthy one with the same proxy and UA', async () => {
    const wedged = withBrowser(fakeSession({ id: 'wedged' }), fakeBrowser({ answers: 'hangs' }));
    const healthy = withBrowser(fakeSession({ id: 'healthy' }), fakeBrowser());
    const pool = [wedged, healthy];
    const discarded: string[] = [];

    const chosen = await findReusableSession({
      pool,
      match,
      limits: LIMITS,
      probe: session => isSessionResponsive(session, 10),
      discard: async session => {
        discarded.push(session.id);
        session.tainted = true;
        pool.splice(pool.indexOf(session), 1);
      },
    });

    expect(chosen?.id).toBe('healthy');
    expect(discarded).toEqual(['wedged']);
  });

  it('probes the session it is about to hand over, not just the pool flags', async () => {
    const session = withBrowser(fakeSession({ id: 'warm' }), fakeBrowser());
    const probe = vi.fn(async () => true);

    const chosen = await findReusableSession({
      pool: [session],
      match,
      limits: LIMITS,
      probe,
      discard: async () => {},
    });

    expect(chosen?.id).toBe('warm');
    expect(probe).toHaveBeenCalledWith(session);
  });

  it('does not probe a session that is still launching', async () => {
    const launching = fakeSession({ id: 'launching', launchPromise: pendingLaunch() });
    const probe = vi.fn(async () => false);

    const chosen = await findReusableSession({
      pool: [launching],
      match,
      limits: LIMITS,
      probe,
      discard: async () => {},
    });

    expect(chosen?.id).toBe('launching');
    expect(probe).not.toHaveBeenCalled();
  });
});

describe('isProtocolError', () => {
  it('recognises the failures that mean the DevTools connection is the problem', () => {
    const networkEnable = new Error(
      "Network.enable timed out. Increase the 'protocolTimeout' setting in launch/connect calls for a higher timeout if needed."
    );
    networkEnable.name = 'ProtocolError';

    expect(isProtocolError(networkEnable)).toBe(true);
    expect(isProtocolError(new Error('Protocol error (Input.dispatchMouseEvent): Internal error'))).toBe(true);
    expect(isProtocolError(new Error('Protocol error (Runtime.callFunctionOn): Target closed'))).toBe(true);
    expect(isProtocolError(new Error('Session closed. Most likely the page has been closed.'))).toBe(true);
  });

  it('does not throw away a healthy browser because a site was slow', () => {
    // A navigation or selector timeout says the retailer was slow, not that
    // the browser is broken. Tainting on these would recycle a browser on
    // every slow page and trade #254 for a worse bug.
    expect(isProtocolError(new Error('Navigation timeout of 36000 ms exceeded'))).toBe(false);
    expect(
      isProtocolError(new Error('Waiting for selector `.price` failed: Waiting failed: 10000ms exceeded'))
    ).toBe(false);
    expect(isProtocolError(new Error('net::ERR_CONNECTION_REFUSED at https://example.com'))).toBe(false);
    expect(isProtocolError(null)).toBe(false);
    expect(isProtocolError(undefined)).toBe(false);
  });
});
