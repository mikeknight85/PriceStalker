import { describe, it, expect, vi } from 'vitest';
import { buildChallengePattern } from '../../../scraper/src/utils/challenge';
import {
  waitForChallengeToClear,
  type ChallengePageProbe,
} from '../../../scraper/src/utils/challengeWait';
import { scrapeOutcomeLog } from '../../../scraper/src/utils/outcome';
import type { ScrapeResult } from '../../../scraper/src/types';

/**
 * The challenge auto-resolve wait and how its result is reported
 * (issues #256, #255).
 *
 * Both are exercised against the scraper workspace's own modules. The wait
 * takes an abstract page probe and an injectable clock precisely so this runs
 * without a browser -- a real Cloudflare or DataDome challenge cannot be
 * reproduced in a unit test, so what is pinned here is the loop's behaviour
 * given a page that does or does not clear.
 */

const pattern = buildChallengePattern();

/** A wall page: small enough for the body phrase gate in `challenge.ts`. */
const WALL_HTML = '<html><body><h1>Just a moment...</h1></body></html>';
/** A product page: past the size gate and carrying no challenge marker. */
const PRODUCT_HTML = `<html><body><h1>Nintendo Switch 2</h1>${'<div class="x">y</div>'.repeat(1200)}</body></html>`;

/**
 * A fake page whose state is a scripted sequence of (title, html) pairs: entry
 * n is what the nth poll sees. The last entry repeats once the script runs
 * out, so a one-entry script is a page that never changes.
 */
function scriptedProbe(steps: ReadonlyArray<{ title: string; html: string } | 'throw'>) {
  let index = -1;

  const step = () => steps[Math.min(Math.max(index, 0), steps.length - 1)];

  const probe: ChallengePageProbe = {
    title: async () => {
      const current = step();
      if (current === 'throw') throw new Error('Execution context was destroyed');
      return current.title;
    },
    content: async () => {
      const current = step();
      if (current === 'throw') throw new Error('Execution context was destroyed');
      return current.html;
    },
  };

  return {
    probe,
    advance: () => {
      index++;
    },
  };
}

/** Drives the wait on a virtual clock, advancing the script on every sleep. */
function runWait(
  steps: ReadonlyArray<{ title: string; html: string } | 'throw'>,
  budgetMs: number,
  extra: { isAborted?: () => boolean } = {}
) {
  let clock = 0;
  const scripted = scriptedProbe(steps);
  const sleeps: number[] = [];

  return waitForChallengeToClear(scripted.probe, {
    budgetMs,
    pattern,
    pollIntervalMs: 1000,
    isAborted: extra.isAborted,
    now: () => clock,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      clock += ms;
      scripted.advance();
    },
  }).then(outcome => ({ outcome, sleeps }));
}

describe('waitForChallengeToClear (issue #256)', () => {
  it('returns as soon as the challenge clears instead of sleeping out the round', async () => {
    const { outcome, sleeps } = await runWait(
      [
        { title: 'Just a moment...', html: WALL_HTML },
        { title: 'Just a moment...', html: WALL_HTML },
        { title: 'Nintendo Switch 2', html: PRODUCT_HTML },
      ],
      8000
    );

    expect(outcome.cleared).toBe(true);
    expect(outcome.html).toBe(PRODUCT_HTML);
    // Three polls of 1s, not the full 8s blind sleep the loop used to pay.
    expect(outcome.waitedMs).toBe(3000);
    expect(sleeps).toEqual([1000, 1000, 1000]);
  });

  it('reports the wall page when the challenge outlasts the round', async () => {
    const { outcome, sleeps } = await runWait([{ title: 'Just a moment...', html: WALL_HTML }], 8000);

    expect(outcome.cleared).toBe(false);
    expect(outcome.aborted).toBe(false);
    expect(outcome.html).toBe(WALL_HTML);
    expect(outcome.waitedMs).toBe(8000);
    expect(sleeps).toHaveLength(8);
  });

  it('never overruns the budget it was given', async () => {
    const { outcome } = await runWait([{ title: 'Just a moment...', html: WALL_HTML }], 2500);

    // The last poll is shortened to what is left rather than overshooting, so
    // the scraper cannot consume more than the backend was told to expect.
    expect(outcome.waitedMs).toBe(2500);
  });

  it('treats a read that throws as "not cleared yet", not as a failure', async () => {
    // A challenge resolving navigates the page, and page.content() across that
    // navigation rejects. Giving up there would abandon the wait at the moment
    // it was about to succeed.
    const { outcome } = await runWait(
      [
        { title: 'Just a moment...', html: WALL_HTML },
        'throw',
        { title: 'Nintendo Switch 2', html: PRODUCT_HTML },
      ],
      8000
    );

    expect(outcome.cleared).toBe(true);
    expect(outcome.html).toBe(PRODUCT_HTML);
  });

  it('stops on abort and says so', async () => {
    let polls = 0;
    const { outcome } = await runWait([{ title: 'Just a moment...', html: WALL_HTML }], 8000, {
      isAborted: () => ++polls > 2,
    });

    expect(outcome.aborted).toBe(true);
    expect(outcome.cleared).toBe(false);
    expect(outcome.waitedMs).toBe(3000);
  });

  it('does nothing at all when handed no budget', async () => {
    const probe: ChallengePageProbe = {
      title: vi.fn(async () => 'Just a moment...'),
      content: vi.fn(async () => WALL_HTML),
    };

    const outcome = await waitForChallengeToClear(probe, { budgetMs: 0, pattern });

    expect(outcome.cleared).toBe(false);
    expect(outcome.html).toBeNull();
    expect(probe.title).not.toHaveBeenCalled();
  });
});

describe('scrapeOutcomeLog (issue #255)', () => {
  const result = (over: Partial<ScrapeResult>): ScrapeResult => ({
    html: WALL_HTML,
    screenshotBase64: null,
    challengeDetected: false,
    challengeUnresolved: false,
    ...over,
  });

  const url = 'https://www.ebgames.com.au/product/nintendo-switch-2/330016';

  it('does not log an unresolved challenge as a success', () => {
    const outcome = scrapeOutcomeLog(
      url,
      result({ html: 'x'.repeat(37262), challengeDetected: true, challengeUnresolved: true })
    );

    expect(outcome.level).toBe('WARN');
    expect(outcome.message).not.toContain('Success');
    expect(outcome.message).toBe(`Unresolved challenge wall returned: ${url} (37262 bytes)`);
  });

  it('logs a clean page as a plain success', () => {
    const outcome = scrapeOutcomeLog(url, result({ html: 'x'.repeat(1621160) }));

    expect(outcome.level).toBe('INFO');
    expect(outcome.message).toBe(`Success: ${url} (1621160 bytes)`);
  });

  it('distinguishes a challenge that auto-resolved from one that was never there', () => {
    const resolved = scrapeOutcomeLog(
      url,
      result({ html: PRODUCT_HTML, challengeDetected: true, challengeUnresolved: false })
    );

    expect(resolved.level).toBe('INFO');
    expect(resolved.message).toContain('Success after challenge auto-resolve');
  });
});
