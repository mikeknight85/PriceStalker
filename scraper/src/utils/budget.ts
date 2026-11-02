/**
 * How one scrape's time budget is divided (issues #235, #252, #256).
 *
 * `options.timeout` is the budget for the *whole* scrape, not just
 * `page.goto`. That is the invariant the backend's own request timeout is
 * sized against: `transport/remote.ts` sends `browser_timeout` and then waits
 * `browser_timeout + browser_delay + 15s`, on the principle that the scraper
 * self-caps so the backend's arithmetic is right by construction rather than
 * by estimate. Nothing here may raise what the scraper can consume above the
 * number the backend was told -- `navigationBudgetMs + challengeReserveMs` is
 * always within `totalBudgetMs`, and every phase is clamped against the one
 * deadline derived from it.
 *
 * ## Why the challenge loop gets a reserved slice
 *
 * #252 split the budget 60/40 between navigation and everything after it, and
 * #256 reported that split starving the challenge auto-resolve loop. Measured
 * against the trace on that issue the split is *not* what starved it: a 6.2s
 * navigation left ~39s of a 45s budget and both auto-resolve rounds ran to
 * completion. What the trace actually shows is two 8s rounds being too short
 * for the challenge to settle.
 *
 * The split can still bite, though, and not where the issue says. Navigation
 * is capped by its own `page.goto` timeout, so it cannot overrun; what *can*
 * eat the post-navigation slice is the phase between navigation and the
 * challenge loop -- the `waitForSelector` wait (up to 10s) and the hydration
 * delay (`browser_delay`, 3s by default) -- because both were clamped to the
 * whole of the remaining budget. A slow navigation plus those two could leave
 * the second auto-resolve round truncated.
 *
 * So the challenge loop is given a slice up front that the earlier phases are
 * not allowed to spend (`preChallengeRemainingMs`), sized to what the loop
 * could actually use and capped by its share of the total. It is a floor, not
 * a quota: when navigation is quick the loop may use whatever is left.
 */

/** Total scrape budget when the backend sends no `timeout`. */
export const DEFAULT_TOTAL_BUDGET_MS = 45000;

/**
 * Share of the total budget `page.goto` may consume.
 *
 * Unchanged from #252 at the two budgets that occur in practice: the
 * production default of 60s still gives navigation 36s, and the 45s fallback
 * still gives it 27s. The cap below only takes effect for a budget small
 * enough that the two shares would otherwise overlap.
 */
export const NAVIGATION_BUDGET_SHARE = 0.6;

/** Navigation never gets less than this, however small the total budget. */
export const MIN_NAVIGATION_BUDGET_MS = 10000;

/**
 * Ceiling on the challenge loop's reserved slice, as a share of the total.
 *
 * The complement of `NAVIGATION_BUDGET_SHARE`, so the reserve is carved out of
 * the post-navigation slice rather than added on top of the budget: 24s of the
 * 60s production default, which is exactly three full 8s rounds.
 */
export const CHALLENGE_BUDGET_SHARE = 0.4;

/** Wait per challenge auto-resolve attempt when the backend sends none. */
export const DEFAULT_INTERSTITIAL_WAIT_MS = 8000;

/**
 * Auto-resolve attempts when the backend sends none.
 *
 * Raised from 2 to 3 for #256: the trace there shows two 8s rounds expiring
 * with the wall still up, and Cloudflare Turnstile routinely needs longer than
 * 16s to settle. The extra round costs nothing on a page that clears, because
 * the wait is now a poll that returns the moment the challenge goes away
 * (`waitForChallengeToClear`), rather than a blind sleep.
 */
export const DEFAULT_INTERSTITIAL_RETRIES = 3;

/**
 * Allowance per auto-resolve round for the work that is not the wait itself:
 * the round of synthetic input and the `page.content()` read between attempts,
 * measured at roughly 1.5s on the traces in #256 and #255.
 */
export const CHALLENGE_ROUND_OVERHEAD_MS = 2000;

/** How often the auto-resolve wait re-checks whether the challenge has gone. */
export const CHALLENGE_POLL_INTERVAL_MS = 1000;

/** A positive finite integer, or the fallback. Rejects 0, negatives and NaN. */
export const positiveIntOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;

/** A non-negative finite integer, or the fallback. 0 is a meaningful value. */
export const nonNegativeIntOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;

export interface ScrapeBudgetInput {
  /** `options.timeout`: the total budget for the scrape, in ms. */
  timeout?: unknown;
  interstitialWaitMs?: unknown;
  interstitialRetries?: unknown;
}

export interface ScrapeBudget {
  /** Everything the scrape may consume, in ms. */
  totalBudgetMs: number;
  /** `page.goto` timeout. */
  navigationBudgetMs: number;
  /** Slice the phases before the challenge loop may not spend. */
  challengeReserveMs: number;
  /** Auto-resolve attempts to make. */
  interstitialRetries: number;
  /** Longest single auto-resolve wait. */
  interstitialWaitMs: number;
}

/**
 * Divides one scrape's budget between navigation, the phases after it and the
 * challenge auto-resolve loop.
 *
 * The reserve never exceeds what is left after navigation, so
 * `navigationBudgetMs + challengeReserveMs <= totalBudgetMs` holds for every
 * budget large enough for `MIN_NAVIGATION_BUDGET_MS`. Below that the
 * navigation floor wins -- as it did before this change -- and the reserve is
 * shrunk to nothing rather than overcommitted.
 */
export function allocateScrapeBudget(input: ScrapeBudgetInput = {}): ScrapeBudget {
  const totalBudgetMs = positiveIntOr(input.timeout, DEFAULT_TOTAL_BUDGET_MS);
  const interstitialRetries = nonNegativeIntOr(input.interstitialRetries, DEFAULT_INTERSTITIAL_RETRIES);
  const interstitialWaitMs = positiveIntOr(input.interstitialWaitMs, DEFAULT_INTERSTITIAL_WAIT_MS);

  // Never reserve more than the loop could spend: with the loop disabled
  // (`interstitialRetries: 0`) the reserve is 0 and the hydration delay gets
  // the whole remaining budget, exactly as before this change.
  const wantedReserveMs = interstitialRetries * (interstitialWaitMs + CHALLENGE_ROUND_OVERHEAD_MS);
  const cappedReserveMs = Math.min(wantedReserveMs, Math.round(totalBudgetMs * CHALLENGE_BUDGET_SHARE));

  const navigationBudgetMs = Math.max(
    MIN_NAVIGATION_BUDGET_MS,
    Math.min(Math.round(totalBudgetMs * NAVIGATION_BUDGET_SHARE), totalBudgetMs - cappedReserveMs)
  );
  const challengeReserveMs = Math.min(cappedReserveMs, Math.max(0, totalBudgetMs - navigationBudgetMs));

  return { totalBudgetMs, navigationBudgetMs, challengeReserveMs, interstitialRetries, interstitialWaitMs };
}

export interface BudgetClock {
  /** Wall-clock instant the whole scrape must be finished by. */
  deadline: number;
  /** Time left before the deadline. Negative once it has passed. */
  remainingMs(): number;
  /**
   * Time the phases *before* the challenge loop may still spend: what is left,
   * less the loop's reserved slice. Clamp `waitForSelector` and the hydration
   * delay against this rather than against `remainingMs()`.
   */
  preChallengeRemainingMs(): number;
}

/** Starts the one deadline every phase of the scrape is clamped against. */
export function createBudgetClock(budget: ScrapeBudget, now: () => number = Date.now): BudgetClock {
  const deadline = now() + budget.totalBudgetMs;
  return {
    deadline,
    remainingMs: () => deadline - now(),
    preChallengeRemainingMs: () => deadline - now() - budget.challengeReserveMs,
  };
}
