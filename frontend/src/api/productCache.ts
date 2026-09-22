import type { Product, ProductWithStats } from '../types/api';
import { queryClient } from './queryClient';
import { queryKeys } from './queries';

/** Applies a canonical product mutation response without discarding detail-only stats. */
export function syncProductCaches(updated: Product): void {
  queryClient.setQueryData<Product[]>(queryKeys.products.all, (products) =>
    products?.map((product) => product.id === updated.id ? { ...product, ...updated } : product),
  );
  queryClient.setQueryData<ProductWithStats>(queryKeys.products.detail(updated.id), (product) =>
    product ? { ...product, ...updated } : product,
  );
}

/**
 * Drops the cached price and stock history of a product after an action that
 * recorded a new reading.
 *
 * The detail page pulls its history through `queryClient.fetchQuery`, which
 * resolves straight from the cache while the entry is still fresh. With a five
 * minute `staleTime` that meant refetching after "Refresh Price" handed back
 * exactly the rows the Price History tab was already showing, and the new price
 * only appeared after a full reload (issue #195). Marking the entries invalid
 * sends that fetch to the network again, and refetches the stock history tab
 * on the spot when it is the one on screen.
 */
export async function invalidateProductHistory(productId: number): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.priceHistoryAll(productId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.stockHistoryAll(productId) }),
  ]);
}
