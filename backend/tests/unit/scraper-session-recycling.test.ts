import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CDP_PROBE_TIMEOUT_MS } from '../../../scraper/src/core/health';
import {
  closeSession,
  markSessionTainted,
  sessions,
  sweepSessions,
  STUCK_SESSION_TIMEOUT_MS,
} from '../../../scraper/src/core/SessionManager';
import type { BrowserSession } from '../../../scraper/src/types';

/**
 * Retiring a wedged session, without losing the #208 profile cleanup
 * (issue #254).
 *
 * Two things have to hold at once here. A session wedged by an aborted scrape
 * must leave the pool immediately instead of serving the next request, and
 * tearing it down must still delete its Chromium profile directory and must
 * still not throw into the request path -- which is the machinery issue #208
 * put in place (`waitForBrowserExit`, retry-with-backoff, and the
 * `profileRemovals` WeakMap that lets `closeSession` and the `'disconnected'`
 * handler share one removal).
 *
 * `browser.close()` is the hazard: it goes over the same DevTools connection
 * that has wedged, and Puppeteer waits its 180s `protocolTimeout` for an
 * answer that never comes. So the close is capped and the process killed, and
 * the profile is removed either way.
 */

const BROWSER_CLOSE_TIMEOUT_MS = 10_000;

interface FakeBrowserOptions {
  connected?: boolean;
  /** 'hangs' is the wedged case: the close never settles. */
  close?: 'resolves' | 'rejects' | 'hangs';
  /** Whether the OS process is still running. Default: already exited. */
  alive?: boolean;
  /** Whether a CDP round trip is ever answered. Default: yes. */
  answersCdp?: boolean;
  pid?: number;
}

type PuppeteerBrowser = NonNullable<BrowserSession['browser']>;

/**
 * An EventEmitter standing in for Chromium's child process, because
 * `waitForBrowserExit` (issue #208) listens for its 'exit' event.
 */
type FakeProcess = EventEmitter & {
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
  pid?: number;
  kill: () => boolean;
};

function fakeProcess(options: FakeBrowserOptions): FakeProcess {
  return Object.assign(new EventEmitter(), {
    exitCode: options.alive ? null : 0,
    signalCode: null as NodeJS.Signals | null,
    pid: options.pid,
    kill: () => true,
  });
}

function fakeBrowser(options: FakeBrowserOptions = {}): { browser: PuppeteerBrowser; proc: FakeProcess } {
  const mode = options.close ?? 'resolves';
  const proc = fakeProcess(options);
  const browser = {
    connected: options.connected ?? true,
    version: () =>
      options.answersCdp === false
        ? new Promise<string>(() => {})
        : Promise.resolve('HeadlessChrome/154.0.0.0'),
    process: () => proc,
    close: () => {
      if (mode === 'hangs') return new Promise<void>(() => {});
      if (mode === 'rejects') return Promise.reject(new Error("Network.enable timed out. Increase the 'protocolTimeout' setting"));
      return Promise.resolve();
    },
  };
  // Narrowed to the members the session lifecycle touches; see the fake in
  // scraper-session-health.test.ts for the same reasoning.
  return { browser: browser as unknown as PuppeteerBrowser, proc };
}

/** A session with a real profile directory on disk, so its removal is observable. */
async function sessionWithProfile(over: Partial<BrowserSession> = {}): Promise<BrowserSession> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pricestalker-session-'));
  await fs.mkdir(path.join(dir, 'Default'), { recursive: true });
  await fs.writeFile(path.join(dir, 'Default', 'Cookies'), 'x');

  const session: BrowserSession = {
    id: `session_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    browser: fakeBrowser().browser,
    launchPromise: null,
    activePages: 0,
    totalScrapes: 3,
    idleTimer: null,
    proxyUrl: 'http://192.168.50.200:8888',
    userAgent: null,
    lastActivity: Date.now(),
    userDataDir: dir,
    tainted: false,
    taintReason: null,
    ...over,
  };

  sessions.push(session);
  return session;
}

const exists = async (dir: string): Promise<boolean> => {
  try {
    await fs.stat(dir);
    return true;
  } catch {
    return false;
  }
};

beforeEach(() => {
  sessions.splice(0, sessions.length);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  sessions.splice(0, sessions.length);
});

describe('closeSession still removes the profile directory (issue #208)', () => {
  it('removes it on an ordinary close', async () => {
    const session = await sessionWithProfile();

    await closeSession(session);

    expect(await exists(session.userDataDir ?? '')).toBe(false);
    expect(sessions).not.toContain(session);
  });

  it('removes it when the browser close rejects', async () => {
    const session = await sessionWithProfile({ browser: fakeBrowser({ close: 'rejects' }).browser });
    const dir = session.userDataDir ?? '';

    // Must not throw: closeSession is awaited from the request path.
    await expect(closeSession(session)).resolves.toBeUndefined();
    expect(await exists(dir)).toBe(false);
  });

  it('shares one removal between concurrent callers', async () => {
    // The `profileRemovals` WeakMap: closeSession() and the 'disconnected'
    // handler both reap the same profile, and the second must await the first
    // rather than racing it.
    const session = await sessionWithProfile();
    const dir = session.userDataDir ?? '';

    await Promise.all([closeSession(session), closeSession(session)]);

    expect(await exists(dir)).toBe(false);
    expect(session.userDataDir).toBeNull();
  });
});

describe('a wedged browser does not stall the request path (issue #254)', () => {
  it('gives up on the graceful close and kills the process instead', async () => {
    vi.useFakeTimers();
    const killSpy = vi.spyOn(process, 'kill').mockReturnValue(true);
    const wedged = fakeBrowser({ close: 'hangs', alive: true, answersCdp: false, pid: 4242 });
    const session = await sessionWithProfile({ browser: wedged.browser });
    const dir = session.userDataDir ?? '';

    const closing = closeSession(session);
    // Puppeteer would wait its 180s protocolTimeout here. Nothing may.
    await vi.advanceTimersByTimeAsync(BROWSER_CLOSE_TIMEOUT_MS);

    // The negative pid takes Chromium's whole process group.
    expect(killSpy).toHaveBeenCalledWith(-4242, 'SIGKILL');

    // And the profile is still reaped once the process is really gone, which
    // is the #208 contract this must not break.
    wedged.proc.exitCode = 137;
    wedged.proc.emit('exit');
    await closing;
    vi.useRealTimers();
    expect(await exists(dir)).toBe(false);
  });
});

describe('sweepSessions (issue #254)', () => {
  it('reaps an idle session that was marked unusable', async () => {
    const session = await sessionWithProfile();
    markSessionTainted(session, 'scrape aborted by client disconnect');
    const dir = session.userDataDir ?? '';

    await sweepSessions();

    expect(sessions).not.toContain(session);
    expect(await exists(dir)).toBe(false);
  });

  it('reaps a session whose CDP connection no longer answers, though it reports connected', async () => {
    // The #254 state: connected true, process alive, no answer to anything.
    const wedged = fakeBrowser({ alive: true, answersCdp: false });
    const session = await sessionWithProfile({ browser: wedged.browser });

    vi.useFakeTimers();
    const sweeping = sweepSessions();
    // The liveness probe times out, then the profile removal waits for the
    // process to exit before deleting underneath it (issue #208).
    await vi.advanceTimersByTimeAsync(CDP_PROBE_TIMEOUT_MS);
    wedged.proc.exitCode = 0;
    wedged.proc.emit('exit');
    await sweeping;
    vi.useRealTimers();

    expect(session.tainted).toBe(true);
    expect(session.taintReason).toBe('CDP liveness probe failed');
    expect(sessions).not.toContain(session);
  });

  it('leaves a healthy idle session in the pool', async () => {
    const session = await sessionWithProfile({ browser: fakeBrowser({ alive: true }).browser });
    const dir = session.userDataDir ?? '';

    await sweepSessions();

    expect(sessions).toContain(session);
    expect(session.tainted).toBe(false);
    expect(await exists(dir)).toBe(true);
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('does not probe a session with pages in flight, but still kills a stuck one', async () => {
    const busy = await sessionWithProfile({ activePages: 1, lastActivity: Date.now() });
    const stuck = await sessionWithProfile({
      activePages: 2,
      lastActivity: Date.now() - STUCK_SESSION_TIMEOUT_MS - 1000,
    });

    await sweepSessions();

    expect(sessions).toContain(busy);
    expect(sessions).not.toContain(stuck);
    await closeSession(busy);
  });
});
