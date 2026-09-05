import { queryOptions } from '@tanstack/react-query';
import { ProductService } from '../features/products/services/ProductService';
import { ProfileService } from '../features/settings/services/ProfileService';
import { NotificationService } from '../features/notifications/services/NotificationService';
import { SharedService } from '../services/SharedService';
import { AdminSystemService } from '../features/admin/services/AdminSystemService';
import { UserAdminService } from '../features/admin/services/UserAdminService';
import { RetailerAdminService } from '../features/admin/services/RetailerAdminService';

export const queryKeys = {
  adminUsers: ['admin', 'users'] as const,
  adminTokens: ['admin', 'system-tokens'] as const,
  adminRetailers: ['admin', 'retailers'] as const,
  products: { all: ['products'] as const, items: ['products', 'items'] as const, detail: (id: number) => ['products', id] as const },
  discoveryStatus: ['settings', 'discovery-status'] as const,
  profile: ['profile'] as const,
  currencies: ['settings', 'currencies'] as const,
  notificationSettings: ['settings', 'notifications'] as const,
  adminSystemSettings: ['admin', 'system-settings'] as const,
  priceHistory: (productId: number, days: number) => ['products', productId, 'price-history', days] as const,
  stockHistory: (productId: number, days: number) => ['products', productId, 'stock-history', days] as const,
  notifications: { recent: (limit: number) => ['notifications', 'recent', limit] as const, history: (page: number, limit: number, filter: string) => ['notifications', 'history', page, limit, filter] as const },
};

/**
 * How often the dashboard and product detail poll for scraper results while the
 * user is looking at them. React Query leaves `refetchIntervalInBackground` at
 * its default of false, so a hidden or unfocused tab stops polling on its own
 * and we do not keep hitting the API for a window nobody is watching.
 */
const PRODUCT_POLL_INTERVAL = 15_000;
const PRODUCT_DETAIL_POLL_INTERVAL = 30_000;

export const productListQuery = () => queryOptions({
  queryKey: queryKeys.products.all,
  queryFn: ({ signal }) => ProductService.getAll({ signal }),
  staleTime: PRODUCT_POLL_INTERVAL,
  refetchInterval: PRODUCT_POLL_INTERVAL,
});

/**
 * The grouped view (issue #143). Same poll interval as the flat list, so
 * switching between them does not change how fresh the numbers are.
 */
export const itemListQuery = () => queryOptions({
  queryKey: queryKeys.products.items,
  queryFn: ({ signal }) => ProductService.getItems({ signal }),
  staleTime: PRODUCT_POLL_INTERVAL,
  refetchInterval: PRODUCT_POLL_INTERVAL,
});

export const productDetailQuery = (id: number) => queryOptions({
  queryKey: queryKeys.products.detail(id),
  queryFn: ({ signal }) => ProductService.getById(id, { signal }),
  staleTime: PRODUCT_DETAIL_POLL_INTERVAL,
  refetchInterval: PRODUCT_DETAIL_POLL_INTERVAL,
});

export const discoveryStatusQuery = () => queryOptions({
  queryKey: queryKeys.discoveryStatus,
  queryFn: ({ signal }) => ProductService.getSearchStatus({ signal }),
  staleTime: 10 * 60_000,
});

export const profileQuery = () => queryOptions({
  queryKey: queryKeys.profile,
  queryFn: ({ signal }) => ProfileService.getProfile({ signal }),
  staleTime: 10 * 60_000,
});

export const currenciesQuery = () => queryOptions({
  queryKey: queryKeys.currencies,
  queryFn: ({ signal }) => SharedService.getCurrencies({ signal }),
  staleTime: 10 * 60_000,
});

export const notificationSettingsQuery = () => queryOptions({
  queryKey: queryKeys.notificationSettings,
  queryFn: ({ signal }) => ProfileService.getNotificationSettings({ signal }),
  staleTime: 10 * 60_000,
});

/**
 * Admin lists fall out of date on their own: the scraper auto-creates retailer
 * configs, SSO provisions users on first sign-in, and tokens can be managed by
 * scripts. Polling means an administrator sees those without reloading.
 *
 * Slower than the product dashboard because these change on human timescales,
 * and React Query stops polling a hidden tab by itself.
 */
const ADMIN_POLL_INTERVAL = 30_000;

export const adminUsersQuery = () => queryOptions({
  queryKey: queryKeys.adminUsers,
  queryFn: ({ signal }) => UserAdminService.getUsers({ signal }),
  staleTime: ADMIN_POLL_INTERVAL,
  refetchInterval: ADMIN_POLL_INTERVAL,
});

export const adminTokensQuery = () => queryOptions({
  queryKey: queryKeys.adminTokens,
  queryFn: ({ signal }) => AdminSystemService.getSystemApiTokens({ signal }),
  staleTime: ADMIN_POLL_INTERVAL,
  refetchInterval: ADMIN_POLL_INTERVAL,
});

export const adminRetailersQuery = () => queryOptions({
  queryKey: queryKeys.adminRetailers,
  queryFn: ({ signal }) => RetailerAdminService.getRetailers({ signal }),
  staleTime: ADMIN_POLL_INTERVAL,
  refetchInterval: ADMIN_POLL_INTERVAL,
});

export const adminSystemSettingsQuery = () => queryOptions({
  queryKey: queryKeys.adminSystemSettings,
  queryFn: ({ signal }) => AdminSystemService.getSystemSettings({ signal }),
  staleTime: 10 * 60_000,
});

export const priceHistoryQuery = (productId: number, days = 30) => queryOptions({
  queryKey: queryKeys.priceHistory(productId, days),
  queryFn: ({ signal }) => ProductService.getPriceHistory(productId, days, { signal }),
  staleTime: 5 * 60_000,
});

export const stockHistoryQuery = (productId: number, days = 30) => queryOptions({
  queryKey: queryKeys.stockHistory(productId, days),
  queryFn: ({ signal }) => ProductService.getStockHistory(productId, days, { signal }),
  staleTime: 5 * 60_000,
});

export const recentNotificationsQuery = (limit: number) => queryOptions({
  queryKey: queryKeys.notifications.recent(limit),
  queryFn: ({ signal }) => NotificationService.getRecent(limit, { signal }),
  staleTime: 30_000,
});

export const notificationHistoryQuery = (page: number, limit: number, filter = 'all') => queryOptions({
  queryKey: queryKeys.notifications.history(page, limit, filter),
  queryFn: ({ signal }) => NotificationService.getHistory(page, limit, filter, { signal }),
  staleTime: 30_000,
});
