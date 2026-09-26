import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Product } from '../../src/models/types';
import type { ScrapedProductWithVoting } from '../../src/types/scraper';
import type { UnavailableReason } from '../../src/types/availability';

/**
 * The other half of the `bot_or_challenge` fix (issue #67), asserted where the
 * damage was: `ProductRefreshService`.
 *
 * With no `unavailableReason`, a denied refresh is neither transient nor
 * definitive, so it fell into `else if (!reason)` -- the branch for a page that
 * was actually read -- and cleared the product's failure state. A retailer could
 * refuse every scheduled refresh forever: failure_streak stayed at zero,
 * `notifyNotAvailable` never fired, and the product page showed nothing at all.
 * The comment above that branch names "a bot challenge" among the transient
 * failures it counts. It did not count them.
 *
 * The first test here reproduces the old behaviour by returning no reason, which
 * is what the scraper used to return for a challenge. The rest assert the fix.
 */

const { repo, prices, persistence, notifications, scrape } = vi.hoisted(() => ({
  repo: {
    getPreferredExtractionMethod: vi.fn().mockResolvedValue(null),
    getAnchorPrice: vi.fn().mockResolvedValue(null),
    isAiVerificationDisabled: vi.fn().mockResolvedValue(true),
    isAiExtractionDisabled: vi.fn().mockResolvedValue(true),
    recordFailure: vi.fn().mockResolvedValue(1),
    clearFailureState: vi.fn().mockResolvedValue(undefined),
    setPageGoneStreak: vi.fn().mockResolvedValue(undefined),
    setUnavailableReason: vi.fn().mockResolvedValue(undefined),
    setPaused: vi.fn().mockResolvedValue(undefined),
  },
  prices: { getLatest: vi.fn().mockResolvedValue(null) },
  persistence: { saveScrapeResult: vi.fn().mockResolvedValue(null) },
  notifications: {
    notifyNotAvailable: vi.fn().mockResolvedValue(undefined),
    notifyBackInStock: vi.fn().mockResolvedValue(undefined),
    notifyProductRestored: vi.fn().mockResolvedValue(undefined),
    notifyPriceDrop: vi.fn().mockResolvedValue(undefined),
    notifyTargetHit: vi.fn().mockResolvedValue(undefined),
    notifyPriceAnnounced: vi.fn().mockResolvedValue(undefined),
  },
  scrape: vi.fn(),
}));

vi.mock('../../src/models', () => ({
  productRepository: repo,
  priceHistoryRepository: prices,
}));

vi.mock('../../src/services/scraper', () => ({ scrapeProductWithVoting: scrape }));

vi.mock('../../src/services/domain/product/ProductPersistenceService', () => ({
  productPersistenceService: persistence,
}));

vi.mock('../../src/services/domain/product/notifications/index', () => ({
  productNotificationService: notifications,
}));

vi.mock('../../src/utils/system/url-safety', () => ({
  assertUrlIsSafe: vi.fn().mockResolvedValue(undefined),
  UnsafeUrlError: class UnsafeUrlError extends Error {},
}));

vi.mock('../../src/utils/system/logger', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));

const product = (over: Partial<Product> = {}): Product => ({
  id: 42,
  user_id: 1,
  url: 'https://www.target.com.au/p/thing/123',
  stock_status: 'in_stock',
  page_gone_streak: 0,
  checking_paused: false,
  auto_paused: false,
  ...over,
} as Product);

/** What the scraper returns for a denied page: no price, and a reason or not. */
const denied = (unavailableReason?: UnavailableReason): ScrapedProductWithVoting => ({
  name: null,
  price: null,
  imageUrl: null,
  url: 'https://www.target.com.au/p/thing/123',
  stockStatus: 'unknown',
  aiStatus: null,
  priceCandidates: [],
  needsReview: false,
  failureReason: 'bot_challenge',
  failureDetail: 'Akamai Behavioural Challenge',
  unavailableReason,
});

async function refresh(scraped: ScrapedProductWithVoting, over: Partial<Product> = {}) {
  scrape.mockResolvedValue(scraped);
  const { productRefreshService } = await import('../../src/services/domain/product/ProductRefreshService');
  await productRefreshService.refreshProduct(product(over));
}

describe('a denied refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.recordFailure.mockResolvedValue(1);
  });

  it('used to clear the failure state, which is the bug', async () => {
    // The scraper's old return for a challenge: failureReason set, no
    // unavailableReason. Kept as a test so the shape of the fault stays on
    // record -- this is the branch that made a bot wall invisible.
    await refresh(denied(undefined));
    expect(repo.clearFailureState).toHaveBeenCalledWith(42);
    expect(repo.recordFailure).not.toHaveBeenCalled();
  });

  it('now counts the failure instead', async () => {
    await refresh(denied('bot_or_challenge'));
    expect(repo.recordFailure).toHaveBeenCalledWith(42, 'bot_or_challenge');
    expect(repo.clearFailureState).not.toHaveBeenCalled();
  });

  it('never marks the product gone or pauses it', async () => {
    // A bot check is not evidence the listing was removed.
    await refresh(denied('bot_or_challenge'));
    expect(repo.setPageGoneStreak).not.toHaveBeenCalled();
    expect(repo.setUnavailableReason).not.toHaveBeenCalled();
    expect(repo.setPaused).not.toHaveBeenCalled();
  });

  it('leaves the product status alone rather than writing unknown over it', async () => {
    await refresh(denied('bot_or_challenge'));
    const [, , scraped] = persistence.saveScrapeResult.mock.calls[0];
    expect((scraped as ScrapedProductWithVoting).stockStatus).toBe('unknown');
    // 'unknown' is what persistence declines to overwrite a known status with,
    // which is why the transient branch does not have to touch the status.
    expect(repo.setPaused).not.toHaveBeenCalled();
  });

  it('tells the user once, on the sixth consecutive denial', async () => {
    repo.recordFailure.mockResolvedValue(6);
    await refresh(denied('bot_or_challenge'));
    expect(notifications.notifyNotAvailable).toHaveBeenCalledTimes(1);
    const [, reason, definitive, failures] = notifications.notifyNotAvailable.mock.calls[0];
    expect(reason).toBe('bot_or_challenge');
    expect(definitive).toBe(false);
    expect(failures).toBe(6);
  });

  it('does not notify again after the threshold has passed', async () => {
    repo.recordFailure.mockResolvedValue(7);
    await refresh(denied('bot_or_challenge'));
    expect(notifications.notifyNotAvailable).not.toHaveBeenCalled();
  });

  it('still clears the failure state when a scrape really did read the page', async () => {
    const ok: ScrapedProductWithVoting = {
      ...denied(undefined),
      failureReason: undefined,
      failureDetail: undefined,
      stockStatus: 'in_stock',
      price: { price: 79, currency: 'AUD' },
    };
    await refresh(ok);
    expect(repo.clearFailureState).toHaveBeenCalledWith(42);
    expect(repo.recordFailure).not.toHaveBeenCalled();
  });
});
