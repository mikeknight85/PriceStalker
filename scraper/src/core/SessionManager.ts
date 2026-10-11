import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { log } from '../utils/logger.js';
import type { Browser } from 'puppeteer';
import type { BrowserSession, ScrapeOptions } from '../types.js';
import { errorMessage } from '../types.js';

interface PuppeteerExtra {
  use(plugin: unknown): void;
  launch(options: Record<string, unknown>): Promise<Browser>;
}

const puppeteer = puppeteerExtra as unknown as PuppeteerExtra;
const createAdblockerPlugin = AdblockerPlugin as unknown as (options: { blockTrackers: boolean }) => unknown;

// Initialize Puppeteer with plugins
puppeteer.use(StealthPlugin());
if (process.env.ENABLE_ADBLOCKER !== 'false') {
  // blockTrackers: false ensures anti-bot verification scripts (Turnstile, Reese84, Datadome)
  // are not blocked from reporting telemetry.
  puppeteer.use(createAdblockerPlugin({ blockTrackers: false }));
}

export const DEFAULT_SCRAPER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36';

/**
 * Reads a pool limit from the environment (issue #235).
 *
 * `Number(process.env.X) || fallback` accepts anything that is not 0 or NaN,
 * so `MAX_BROWSERS=-1` would be taken at face value -- and a negative or
 * fractional limit does not fail loudly, it quietly makes the pool unusable
 * (`sessions.length >= -1` is true on an empty pool, so every scrape is
 * rejected as "all browsers busy"). Anything that is not a positive integer is
 * refused and logged, and the default stands.
 */
function poolLimit(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    log(`Ignoring ${name}="${raw}": expected a positive integer, using ${fallback}`, 'WARN');
    return fallback;
  }
  return value;
}

// Browser Pool Configuration
export const MAX_BROWSERS = poolLimit('MAX_BROWSERS', 3);
export const MAX_PAGES_PER_BROWSER = poolLimit('MAX_PAGES_PER_BROWSER', 4);
export const MAX_SCRAPES_PER_BROWSER = poolLimit('MAX_SCRAPES_PER_BROWSER', 50); // Recycle browser after this many scrapes
export const IDLE_TIMEOUT = poolLimit('IDLE_TIMEOUT_MS', 5 * 60 * 1000); // 5 minutes

export const sessions: BrowserSession[] = [];

// Chromium profiles live under a dedicated base directory so leaked ones can
// be identified and swept. Without an explicit userDataDir Puppeteer creates
// /tmp/puppeteer_dev_profile-* directories that are only removed on a clean
// browser.close() — crashed browsers and container stops leaked them until
// /tmp filled up (issue #52).
export const PROFILE_BASE = process.env.PROFILE_BASE_DIR || path.join(os.tmpdir(), 'scraper-profiles');

// How long to wait for the Chromium process to actually exit before deleting
// its profile. `browser.close()` resolves — and 'disconnected' fires — as soon
// as the DevTools pipe drops, while the process is still flushing and
// unlinking its lock files under the profile. Deleting underneath it is what
// produced the ENOTEMPTY warnings in issue #206.
const BROWSER_EXIT_TIMEOUT_MS = 10_000;

// Even after exit, a dying renderer can briefly recreate a file in the tree, so
// the removal is retried with a linear backoff before it is given up on.
const PROFILE_REMOVE_ATTEMPTS = 5;
const PROFILE_REMOVE_BACKOFF_MS = 250;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms).unref();
  });
}

/**
 * Resolves once the session's Chromium process has really exited, or after
 * BROWSER_EXIT_TIMEOUT_MS if it never does. Never rejects: a profile that
 * cannot be deleted must not take a scrape down with it.
 */
async function waitForBrowserExit(session: BrowserSession): Promise<void> {
  const proc = session.browser?.process();
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return;

  await new Promise<void>(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      proc.removeListener('exit', finish);
      resolve();
    };
    const timer = setTimeout(() => {
      log(`Browser process for ${session.id} did not exit within ${BROWSER_EXIT_TIMEOUT_MS}ms; removing profile anyway`, 'WARN');
      finish();
    }, BROWSER_EXIT_TIMEOUT_MS);
    timer.unref();
    proc.once('exit', finish);
  });
}

/**
 * Deletes a directory, retrying the transient failures (ENOTEMPTY, EBUSY,
 * EPERM) that a process still releasing its locks produces. Returns whether it
 * succeeded; it never throws, so a failed cleanup leaves the directory for the
 * startup sweep instead of breaking the caller.
 */
async function removeDirWithRetry(dir: string, label: string): Promise<boolean> {
  for (let attempt = 1; attempt <= PROFILE_REMOVE_ATTEMPTS; attempt++) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      return true;
    } catch (error) {
      if (attempt === PROFILE_REMOVE_ATTEMPTS) {
        log(`Failed to remove ${label} after ${attempt} attempts: ${errorMessage(error)}`, 'WARN');
        return false;
      }
      log(`Retrying removal of ${label} (attempt ${attempt}): ${errorMessage(error)}`, 'DEBUG');
      await delay(PROFILE_REMOVE_BACKOFF_MS * attempt);
    }
  }
  return false;
}

// Both closeSession() and the browser's 'disconnected' handler reap the same
// profile. Memoising the work per session means the second caller awaits the
// first one's result rather than racing it or silently skipping the wait.
const profileRemovals = new WeakMap<BrowserSession, Promise<void>>();

/**
 * Deletes a session's Chromium profile directory once the browser process has
 * exited. Safe to call repeatedly and from anywhere: the returned promise
 * never rejects, and concurrent callers share one removal.
 */
function removeProfileDir(session: BrowserSession): Promise<void> {
  const pending = profileRemovals.get(session);
  if (pending) return pending;

  const dir = session.userDataDir;
  if (!dir) return Promise.resolve();
  session.userDataDir = null;

  const task = (async () => {
    await waitForBrowserExit(session);
    await removeDirWithRetry(dir, `profile dir for ${session.id}`);
  })().catch((error: unknown) => {
    log(`Profile cleanup for ${session.id} failed: ${errorMessage(error)}`, 'WARN');
  });

  profileRemovals.set(session, task);
  return task;
}

/**
 * Removes profile directories that no live session owns: leftovers in
 * PROFILE_BASE from a previous process, plus legacy puppeteer_dev_profile-*
 * directories created before profiles were pinned to PROFILE_BASE.
 */
export async function cleanupStaleProfiles() {
  const live = new Set(sessions.map(s => s.userDataDir).filter(Boolean));
  for (const [base, prefix] of [[PROFILE_BASE, 'session_'], [os.tmpdir(), 'puppeteer_dev_profile-']] as const) {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(base);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(base, entry);
      if (!entry.startsWith(prefix) || live.has(full)) continue;
      if (await removeDirWithRetry(full, `stale profile ${full}`)) {
        log(`Removed stale browser profile ${full}`, 'INFO');
      }
    }
  }
}

/**
 * Forcefully closes a browser session and removes it from the pool
 */
export async function closeSession(session: BrowserSession) {
  const index = sessions.indexOf(session);
  if (index > -1) sessions.splice(index, 1);

  if (session.idleTimer) {
    clearTimeout(session.idleTimer);
    session.idleTimer = null;
  }

  try {
    log(`Closing browser session ${session.id} (Total Scrapes: ${session.totalScrapes})`, 'INFO');
    if (session.browser && session.browser.connected) {
      await session.browser.close();
    }
  } catch (error) {
    log(`Error closing browser ${session.id}: ${errorMessage(error)}`, 'ERROR');
  }
  await removeProfileDir(session);
}

/**
 * Closes every session (used on process shutdown so no profile survives).
 */
export async function shutdownAllSessions() {
  await Promise.all([...sessions].map(session => closeSession(session)));
}

/**
 * Watchdog to clean up hung or disconnected browsers
 */
export function startWatchdog() {
  setInterval(() => {
    const now = Date.now();
    for (const session of [...sessions]) {
      if (session.browser && !session.browser.connected) {
        log(`Removing dead session ${session.id}`, 'WARN');
        closeSession(session);
        continue;
      }

      const stuckTimeout = 10 * 60 * 1000;
      if (session.activePages > 0 && (now - session.lastActivity) > stuckTimeout) {
        log(`Forcefully killing stuck session ${session.id} (${session.activePages} pages hung)`, 'ERROR');
        closeSession(session);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Launches a new browser instance and initializes the session
 */
export async function createNewSession(proxyUrl: string | null = null, userAgent: string | null = null): Promise<BrowserSession> {
  const id = `session_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  const userDataDir = path.join(PROFILE_BASE, id);

  const session: BrowserSession = {
    id,
    browser: null,
    launchPromise: null,
    activePages: 0,
    totalScrapes: 0,
    idleTimer: null,
    proxyUrl,
    userAgent,
    lastActivity: Date.now(),
    userDataDir
  };

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1920,1080'
  ];

  if (proxyUrl) {
    args.push(`--proxy-server=${proxyUrl}`);
  }

  const effectiveUa = userAgent || DEFAULT_SCRAPER_USER_AGENT;
  args.push(`--user-agent=${effectiveUa}`);

  log(`Launching new browser instance for ${id} (Proxy: ${proxyUrl || 'None'}, UA: ${userAgent ? 'Custom' : 'Default'})`, 'INFO');
  
  session.launchPromise = fs.mkdir(userDataDir, { recursive: true }).then(() => puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: true,
    userDataDir,
    args
  })).then((browser: Browser) => {
    session.browser = browser;
    session.launchPromise = null;

    browser.on('disconnected', () => {
      log(`Browser session ${session.id} disconnected`, 'WARN');
      const idx = sessions.indexOf(session);
      if (idx > -1) sessions.splice(idx, 1);
      // A crashed browser never reaches closeSession, so reap its profile here.
      void removeProfileDir(session);
    });

    return browser;
  }).catch((error: unknown) => {
    log(`Failed to launch browser for ${id}: ${errorMessage(error)}`, 'ERROR');
    const idx = sessions.indexOf(session);
    if (idx > -1) sessions.splice(idx, 1);
    void removeProfileDir(session);
    throw error;
  });

  sessions.push(session);
  return session;
}

/**
 * Finds or creates an available browser session.
 */
export async function getBrowserSession(options: ScrapeOptions = {}): Promise<BrowserSession | null> {
  const reqProxy = options.proxyUrl || null;
  const reqUA = options.userAgent || null;
  const forceNew = options.forceNewSession === true;
  const targetId = options.sessionId || null;

  log(`Session Acquisition | Proxy: ${reqProxy || 'None'}, UA: ${reqUA ? 'Custom' : 'Default'}, ForceNew: ${forceNew}`, 'DEBUG');

  // 1. Direct Targeting by Session ID (Debug/Control)
  if (targetId) {
    const target = sessions.find(s => s.id === targetId && (!s.browser || s.browser.connected));
    if (target) {
      if (target.idleTimer) {
        clearTimeout(target.idleTimer);
        target.idleTimer = null;
      }
      target.activePages++;
      if (target.launchPromise) {
        try {
          await target.launchPromise;
        } catch (e) {
          target.activePages--;
          return null;
        }
      }
      return target;
    }
    log(`Targeted session ${targetId} not found or disconnected`, 'WARN');
  }

  // 2. Find existing matching session (Group by Proxy + UA)
  if (!forceNew) {
    let session = sessions.find(s => 
      s.proxyUrl === reqProxy && 
      s.userAgent === reqUA &&
      s.activePages < MAX_PAGES_PER_BROWSER &&
      s.totalScrapes < MAX_SCRAPES_PER_BROWSER &&
      (!s.browser || s.browser.connected)
    );

    if (session) {
      if (session.idleTimer) {
        clearTimeout(session.idleTimer);
        session.idleTimer = null;
      }
      session.activePages++;
      
      if (session.launchPromise) {
        try {
          await session.launchPromise;
        } catch (e) {
          session.activePages--;
          return null;
        }
      }
      return session;
    }
  }

  // 3. Handle Pool Capacity & Recycling
  if (sessions.length >= MAX_BROWSERS) {
    // Look for an idle session to recycle
    const idleSession = sessions.find(s => s.activePages === 0);
    if (idleSession) {
      log(`Recycling idle session ${idleSession.id} to accommodate new request (ForceNew: ${forceNew})`, 'INFO');
      await closeSession(idleSession);
    } else {
      // No idle sessions, and pool is full
      log(`Pool capacity reached (${MAX_BROWSERS} browsers) and all instances are busy.`, 'WARN');
      return null;
    }
  }

  // 4. Create New Session
  const newSession = await createNewSession(reqProxy, reqUA);
  newSession.activePages++;
  try {
    await newSession.launchPromise;
    return newSession;
  } catch (e) {
    return null;
  }
}
