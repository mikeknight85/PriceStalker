/**
 * The challenge auto-resolve wait (issue #256).
 *
 * It used to be `await new Promise(r => setTimeout(r, waitMs))` -- a blind
 * sleep for the whole round, with the page re-read only once the round was
 * over. That made the wait length a guess that was wrong in both directions:
 * a challenge that cleared in 2s still cost the full 8s, and a challenge that
 * needed 10s was declared a wall at 8s. #256 is the second of those; the trace
 * on it shows both 8s rounds expiring with the wall still up and the scrape
 * returning the 37KB interstitial.
 *
 * So the wait polls instead, and returns the instant the page stops looking
 * like a challenge. Paying for a third round (see
 * `DEFAULT_INTERSTITIAL_RETRIES`) then costs nothing on a page that clears
 * early, which is what makes a longer total settle window affordable.
 *
 * The page is reached through `ChallengePageProbe` rather than a Puppeteer
 * `Page` so this is exercised by tests without a browser.
 */

import { looksLikeChallenge } from './challenge.js';
import { CHALLENGE_POLL_INTERVAL_MS } from './budget.js';

/** The two reads this needs from the page under inspection. */
export interface ChallengePageProbe {
  title(): Promise<string>;
  content(): Promise<string>;
}

export interface ChallengeWaitOptions {
  /** Longest this wait may take, in ms. */
  budgetMs: number;
  /** Compiled phrase list, from `buildChallengePattern`. */
  pattern: RegExp | null;
  pollIntervalMs?: number;
  /** Checked after every poll so a client disconnect stops the wait. */
  isAborted?: () => boolean;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable for tests. */
  now?: () => number;
}

export interface ChallengeWaitOutcome {
  /** The page no longer looks like a challenge. */
  cleared: boolean;
  /** The request was aborted part-way through the wait. */
  aborted: boolean;
  /** Latest HTML read, or null when no read succeeded. */
  html: string | null;
  /** How long the wait actually took. */
  waitedMs: number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

/**
 * Polls the page until the challenge clears, the budget runs out, or the
 * request is aborted.
 *
 * A read that throws is treated as "not cleared yet", not as a failure: a
 * challenge resolving navigates the page, and `page.content()` across that
 * navigation rejects with an execution-context error. Giving up there would
 * abandon the wait at the exact moment it was about to succeed.
 */
export async function waitForChallengeToClear(
  probe: ChallengePageProbe,
  options: ChallengeWaitOptions
): Promise<ChallengeWaitOutcome> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const pollIntervalMs = Math.max(1, options.pollIntervalMs ?? CHALLENGE_POLL_INTERVAL_MS);
  const isAborted = options.isAborted ?? (() => false);

  const startedAt = now();
  const waitedMs = () => now() - startedAt;
  let html: string | null = null;

  for (;;) {
    const leftMs = options.budgetMs - waitedMs();
    if (leftMs <= 0) break;

    await sleep(Math.min(pollIntervalMs, leftMs));
    if (isAborted()) return { cleared: false, aborted: true, html, waitedMs: waitedMs() };

    let snapshot: { title: string; html: string } | null = null;
    try {
      const [title, content] = await Promise.all([probe.title(), probe.content()]);
      snapshot = { title, html: content };
    } catch {
      snapshot = null;
    }

    if (!snapshot) continue;
    html = snapshot.html;
    if (!looksLikeChallenge(snapshot.title, snapshot.html, options.pattern)) {
      return { cleared: true, aborted: false, html, waitedMs: waitedMs() };
    }
  }

  return { cleared: false, aborted: false, html, waitedMs: waitedMs() };
}
