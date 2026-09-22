import { afterEach, describe, expect, it } from 'vitest';
import { invalidateProductHistory } from './productCache';
import { queryKeys } from './queries';
import { queryClient } from './queryClient';

const PRODUCT_ID = 7;
const HISTORY_STALE_TIME = 5 * 60_000;

/** Counts how often a cached history entry actually reaches its queryFn. */
function countingFetch(queryKey: readonly unknown[]) {
  let calls = 0;
  const fetch = async () => {
    await queryClient.fetchQuery({
      queryKey,
      queryFn: async () => {
        calls += 1;
        return { prices: [] };
      },
      staleTime: HISTORY_STALE_TIME,
    });
  };
  return { fetch, calls: () => calls };
}

afterEach(() => {
  queryClient.clear();
});

describe('invalidateProductHistory', () => {
  it('sends the next history fetch to the network instead of the cache (issue #195)', async () => {
    const history = countingFetch(queryKeys.priceHistory(PRODUCT_ID, 30));

    await history.fetch();
    await history.fetch();
    // Without invalidation a fetchQuery inside the stale window resolves from
    // the cache, which is why a refreshed price never reached the tab.
    expect(history.calls()).toBe(1);

    await invalidateProductHistory(PRODUCT_ID);
    await history.fetch();
    expect(history.calls()).toBe(2);
  });

  it('covers every range of both the price and the stock history', async () => {
    const week = countingFetch(queryKeys.priceHistory(PRODUCT_ID, 7));
    const allTime = countingFetch(queryKeys.priceHistory(PRODUCT_ID, 0));
    const stock = countingFetch(queryKeys.stockHistory(PRODUCT_ID, 30));

    await Promise.all([week.fetch(), allTime.fetch(), stock.fetch()]);
    await invalidateProductHistory(PRODUCT_ID);
    await Promise.all([week.fetch(), allTime.fetch(), stock.fetch()]);

    expect([week.calls(), allTime.calls(), stock.calls()]).toEqual([2, 2, 2]);
  });

  it('leaves another product alone', async () => {
    const other = countingFetch(queryKeys.priceHistory(PRODUCT_ID + 1, 30));

    await other.fetch();
    await invalidateProductHistory(PRODUCT_ID);
    await other.fetch();

    expect(other.calls()).toBe(1);
  });
});
