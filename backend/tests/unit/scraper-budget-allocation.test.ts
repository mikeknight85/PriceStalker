import { describe, it, expect } from 'vitest';
import {
  allocateScrapeBudget,
  createBudgetClock,
  CHALLENGE_BUDGET_SHARE,
  CHALLENGE_POLL_INTERVAL_MS,
  CHALLENGE_ROUND_OVERHEAD_MS,
  DEFAULT_INTERSTITIAL_RETRIES,
  DEFAULT_INTERSTITIAL_WAIT_MS,
  DEFAULT_TOTAL_BUDGET_MS,
  MIN_NAVIGATION_BUDGET_MS,
  NAVIGATION_BUDGET_SHARE,
} from '../../../scraper/src/utils/budget';
import {
  MIN_REQUEST_TIMEOUT_MS,
  REMOTE_RESPONSE_OVERHEAD_MS,
} from '../../src/services/scraper/transport/remote';

/**
 * The scrape budget allocation, pinned (issue #256).
 *
 * #256 is a regression report against the 60/40 split #252 introduced, so the
 * numbers it turns on are asserted here rather than left to be re-derived from
 * the source next time. Imported from the scraper workspace, not
 * reimplemented: a copy of the arithmetic in the test would pass happily while
 * production drifted.
 */

/** What `acquisition/remote.ts` sends: the `browser_timeout` default. */
const PRODUCTION_BUDGET_MS = 60000;
/** What `acquisition/remote.ts` sends as `delay`: the `browser_delay` default. */
const PRODUCTION_DELAY_MS = 3000;

describe('allocateScrapeBudget', () => {
  it('keeps the #252 navigation share at the two budgets that occur in practice', () => {
    // Unchanged by this fix, deliberately: the split was not what starved the
    // challenge loop on the trace in #256.
    expect(allocateScrapeBudget({ timeout: PRODUCTION_BUDGET_MS }).navigationBudgetMs).toBe(36000);
    expect(allocateScrapeBudget({}).navigationBudgetMs).toBe(27000);
    expect(NAVIGATION_BUDGET_SHARE).toBe(0.6);
    expect(DEFAULT_TOTAL_BUDGET_MS).toBe(45000);
  });

  it('reserves the challenge loop a slice of the budget the earlier phases cannot spend', () => {
    const budget = allocateScrapeBudget({ timeout: PRODUCTION_BUDGET_MS });

    // 0.4 of 60s, which is exactly three full 8s auto-resolve rounds.
    expect(budget.challengeReserveMs).toBe(24000);
    expect(budget.challengeReserveMs).toBe(
      DEFAULT_INTERSTITIAL_RETRIES * DEFAULT_INTERSTITIAL_WAIT_MS
    );
    expect(CHALLENGE_BUDGET_SHARE).toBe(0.4);
  });

  it('never allocates more than the whole budget', () => {
    // The backend sizes its request timeout against the budget it sent, so
    // nothing here may hand out more of it than there is. The one exception is
    // the navigation floor, which predates this change and deliberately wins
    // against an unusably small budget -- the reserve then gets nothing.
    for (const timeout of [1, 500, 5000, 12000, 15000, 25000, 45000, 60000, 75000, 120000]) {
      const budget = allocateScrapeBudget({ timeout });

      expect(budget.challengeReserveMs).toBeLessThanOrEqual(
        Math.max(0, budget.totalBudgetMs - budget.navigationBudgetMs)
      );
      expect(budget.navigationBudgetMs + budget.challengeReserveMs).toBeLessThanOrEqual(
        Math.max(budget.totalBudgetMs, MIN_NAVIGATION_BUDGET_MS)
      );
    }
  });

  it('shrinks the reserve rather than overcommitting when the navigation floor wins', () => {
    const budget = allocateScrapeBudget({ timeout: 15000 });

    expect(budget.navigationBudgetMs).toBe(MIN_NAVIGATION_BUDGET_MS);
    expect(budget.challengeReserveMs).toBe(5000);
    expect(budget.navigationBudgetMs + budget.challengeReserveMs).toBe(15000);
  });

  it('reserves nothing when the auto-resolve loop is disabled', () => {
    // A retailer tuned to skip the loop (issue #235) must not have the
    // hydration delay clamped against a reserve nothing will use.
    const budget = allocateScrapeBudget({ timeout: PRODUCTION_BUDGET_MS, interstitialRetries: 0 });

    expect(budget.challengeReserveMs).toBe(0);
    expect(budget.navigationBudgetMs).toBe(36000);
  });

  it('sizes the reserve to the configured rounds when they are cheaper than the share', () => {
    const budget = allocateScrapeBudget({
      timeout: PRODUCTION_BUDGET_MS,
      interstitialRetries: 1,
      interstitialWaitMs: 4000,
    });

    expect(budget.challengeReserveMs).toBe(4000 + CHALLENGE_ROUND_OVERHEAD_MS);
    expect(budget.interstitialRetries).toBe(1);
    expect(budget.interstitialWaitMs).toBe(4000);
  });

  it('defaults three auto-resolve rounds of 8s', () => {
    const budget = allocateScrapeBudget({ timeout: PRODUCTION_BUDGET_MS });

    expect(budget.interstitialRetries).toBe(3);
    expect(budget.interstitialWaitMs).toBe(8000);
  });

  it('rejects a nonsense timeout rather than taking it at face value', () => {
    for (const timeout of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '60000', null, undefined]) {
      expect(allocateScrapeBudget({ timeout }).totalBudgetMs).toBe(DEFAULT_TOTAL_BUDGET_MS);
    }
    expect(allocateScrapeBudget({ timeout: 90000.7 }).totalBudgetMs).toBe(90000);
  });
});

describe('the scenario reported in #256', () => {
  /**
   * The reporter's own trace does not show the split starving anything: a
   * 6.2s navigation and two completed 8s rounds, 25.3s in total against a 45s
   * budget. The mechanism he describes needs the slow navigation he mentions
   * elsewhere, so that is what is driven here.
   */
  const driveToChallengeLoop = (timeout: number, navigationMs: number, delayMs: number) => {
    let clock = 0;
    const budget = allocateScrapeBudget({ timeout });
    const { remainingMs, preChallengeRemainingMs } = createBudgetClock(budget, () => clock);

    clock += navigationMs;
    const delaySpent = Math.max(0, Math.min(delayMs, preChallengeRemainingMs()));
    clock += delaySpent;

    return { budget, delaySpent, remainingAtLoop: remainingMs() };
  };

  it('leaves every configured round intact after a 25s navigation on the production budget', () => {
    const { budget, delaySpent, remainingAtLoop } = driveToChallengeLoop(
      PRODUCTION_BUDGET_MS,
      25000,
      PRODUCTION_DELAY_MS
    );

    expect(delaySpent).toBe(PRODUCTION_DELAY_MS);
    expect(remainingAtLoop).toBe(32000);
    expect(remainingAtLoop).toBeGreaterThanOrEqual(budget.challengeReserveMs);
  });

  it('protects the reserve from the hydration delay when navigation eats the budget', () => {
    // 25s navigation out of the 45s fallback budget. Before the reserve, the
    // 3s delay was clamped against the whole 20s remainder and took its 3s,
    // leaving 17s -- not enough for the rounds plus their synthetic input, so
    // the last round was the thing that got truncated. Now the delay is the
    // phase that gives way.
    const { budget, delaySpent, remainingAtLoop } = driveToChallengeLoop(
      DEFAULT_TOTAL_BUDGET_MS,
      25000,
      PRODUCTION_DELAY_MS
    );

    expect(delaySpent).toBe(2000);
    expect(remainingAtLoop).toBe(18000);
    expect(remainingAtLoop).toBe(budget.challengeReserveMs);
  });

  it('gives up the hydration delay rather than the challenge reserve', () => {
    // Navigation that consumes its whole 27s share, then a delay far larger
    // than what is left. The delay is the phase that loses.
    const { budget, delaySpent, remainingAtLoop } = driveToChallengeLoop(
      DEFAULT_TOTAL_BUDGET_MS,
      27000,
      20000
    );

    expect(delaySpent).toBe(0);
    expect(remainingAtLoop).toBe(18000);
    expect(remainingAtLoop).toBe(budget.challengeReserveMs);
  });

  it('still fits a full round in the reserve it guarantees', () => {
    const budget = allocateScrapeBudget({ timeout: DEFAULT_TOTAL_BUDGET_MS });

    expect(budget.challengeReserveMs).toBeGreaterThanOrEqual(budget.interstitialWaitMs);
    expect(budget.challengeReserveMs).toBeGreaterThan(CHALLENGE_POLL_INTERVAL_MS);
  });
});

describe('the backend request timeout still covers the scraper (issue #252)', () => {
  /**
   * #252's principle: the scraper self-caps, so the backend's arithmetic is
   * right by construction rather than by estimate. The challenge reserve must
   * not break that -- it redistributes the budget, it does not add to it.
   */
  const requestTimeoutFor = (browserTimeout: number, browserDelay: number) =>
    Math.max(MIN_REQUEST_TIMEOUT_MS, browserTimeout + browserDelay + REMOTE_RESPONSE_OVERHEAD_MS);

  it('outlives the scraper deadline by the response overhead at every budget', () => {
    for (const timeout of [15000, 25000, 45000, 60000, 90000, 120000]) {
      const budget = allocateScrapeBudget({ timeout });
      const requestTimeout = requestTimeoutFor(timeout, PRODUCTION_DELAY_MS);

      // The scraper's own deadline is totalBudgetMs. The delay is counted
      // inside that budget and added again here, which is deliberate slack.
      expect(requestTimeout - budget.totalBudgetMs).toBeGreaterThanOrEqual(REMOTE_RESPONSE_OVERHEAD_MS);
      expect(budget.navigationBudgetMs).toBeLessThanOrEqual(
        Math.max(budget.totalBudgetMs, MIN_NAVIGATION_BUDGET_MS)
      );
    }
  });

  it('cannot be widened past the budget by a large interstitial configuration', () => {
    // A retailer tuned to 6 rounds of 20s asks for 120s of waiting. The
    // reserve is a floor inside the budget, not a licence to exceed it, so
    // the backend's maths stays right.
    const budget = allocateScrapeBudget({
      timeout: 60000,
      interstitialRetries: 6,
      interstitialWaitMs: 20000,
    });

    expect(budget.challengeReserveMs).toBe(24000);
    expect(budget.totalBudgetMs).toBe(60000);
    expect(requestTimeoutFor(60000, PRODUCTION_DELAY_MS)).toBe(78000);
  });
});

describe('createBudgetClock', () => {
  it('counts the whole scrape, not just one phase', () => {
    let clock = 1_000_000;
    const budget = allocateScrapeBudget({ timeout: PRODUCTION_BUDGET_MS });
    const { deadline, remainingMs, preChallengeRemainingMs } = createBudgetClock(budget, () => clock);

    expect(deadline).toBe(1_060_000);
    expect(remainingMs()).toBe(60000);
    expect(preChallengeRemainingMs()).toBe(36000);

    clock += 50000;
    expect(remainingMs()).toBe(10000);
    expect(preChallengeRemainingMs()).toBe(-14000);
  });
});
