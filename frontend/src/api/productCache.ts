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
