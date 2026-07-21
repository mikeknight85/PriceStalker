import { productLifecycleRepository } from './product-lifecycle.repository';
import { productLookupRepository } from './product-lookup.repository';
import { productQueryCoreRepository } from './product-core.repository';
import { productDashboardRepository } from './product-dashboard.repository';
import { productConfigRepository } from './product-config.repository';

export const productRepository = {
  ...productLifecycleRepository,
  ...productLookupRepository,
  ...productQueryCoreRepository,
  ...productDashboardRepository,
  ...productConfigRepository,
};

export * from './product-lifecycle.repository';
export * from './product-lookup.repository';
export * from './product-core.repository';
export * from './product-dashboard.repository';
export * from './product-config.repository';
