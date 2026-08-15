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
puppeteer.use(createAdblockerPlugin({ blockTrackers: true }));

// Browser Pool Configuration
export const MAX_BROWSERS = 3;
export const MAX_PAGES_PER_BROWSER = 4;
export const MAX_SCRAPES_PER_BROWSER = 50; // Recycle browser after this many scrapes
export const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export const sessions: BrowserSession[] = [];

// Chromium profiles live under a dedicated base directory so leaked ones can
// be identified and swept. Without an explicit userDataDir Puppeteer creates
// /tmp/puppeteer_dev_profile-* directories that are only removed on a clean
// browser.close() — crashed browsers and container stops leaked them until
// /tmp filled up (issue #52).
export const PROFILE_BASE = path.join(os.tmpdir(), 'scraper-profiles');

/**
 * Deletes a session's Chromium profile directory. Safe to call repeatedly;
 * failures are logged and left for the startup sweep.
 */
async function removeProfileDir(session: BrowserSession) {
  const dir = session.userDataDir;
  if (!dir) return;
  session.userDataDir = null;
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    log(`Failed to remove profile dir for ${session.id}: ${errorMessage(error)}`, 'WARN');
  }
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
      try {
        await fs.rm(full, { recursive: true, force: true });
        log(`Removed stale browser profile ${full}`, 'INFO');
      } catch (error) {
        log(`Failed to remove stale profile ${full}: ${errorMessage(error)}`, 'WARN');
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
    '--window-size=1920,1080'
  ];

  if (proxyUrl) {
    args.push(`--proxy-server=${proxyUrl}`);
  }

  if (userAgent) {
    args.push(`--user-agent=${userAgent}`);
  }

  log(`Launching new browser instance for ${id} (Proxy: ${proxyUrl || 'None'}, UA: ${userAgent ? 'Custom' : 'Default'})`, 'INFO');
  
  session.launchPromise = fs.mkdir(userDataDir, { recursive: true }).then(() => puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: 'new',
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
