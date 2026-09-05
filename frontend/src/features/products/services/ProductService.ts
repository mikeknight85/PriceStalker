import { api, type RequestOptions } from '../../../api/client';
import { 
  ItemWithListings,
  Product, 
  ProductWithStats, 
  CreateProductResponse, 
  PriceReviewResponse,
  PriceHistory,
  ProductSourceHistory,
  StockStatusStats,
  SearchResult
} from '../../../types/api';

export const ProductService = {
  getAll: (options?: RequestOptions) => api.get<Product[]>('/products', options),
  /** The same listings, grouped into items (issue #143). */
  getItems: (options?: RequestOptions) => api.get<ItemWithListings[]>('/products/items', options),

  /**
   * Links a store you already track to another product -- "these two are the
   * same thing". Returns what alert settings the move discarded, if any, so the
   * user can be told rather than finding out when an alert stops arriving.
   */
  attachToItem: (itemId: number, productId: number) =>
    api.post<{ movedFromItemId: number; discardedAlertSettings: { target_price: number | null; price_drop_threshold: number | null; notify_back_in_stock: boolean } | null }>(
      `/products/items/${itemId}/listings`, { productId }
    ),

  /** Undoes the above: gives this store its own product entry again. */
  detachFromItem: (productId: number) =>
    api.post<{ id: number; name: string }>(`/products/${productId}/detach`, {}),

  getById: (id: number, options?: RequestOptions) => api.get<ProductWithStats>(`/products/${id}`, options),

  create: (data: {
    url: string,
    refreshInterval?: number,
    selectedPrice?: number,
    selectedMethod?: string,
    selectedCurrency?: string,
    category?: string | null,
    name?: string | null,
    imageUrl?: string | null,
    stockStatus?: string | null,
    html?: string | null,
    selector?: string | null
  }) => api.post<CreateProductResponse>('/products', {
    url: data.url,
    refresh_interval: data.refreshInterval,
    selectedPrice: data.selectedPrice,
    selectedMethod: data.selectedMethod,
    selectedCurrency: data.selectedCurrency,
    category: data.category,
    name: data.name,
    imageUrl: data.imageUrl,
    stockStatus: data.stockStatus,
    html: data.html,
    selector: data.selector,
  }),

  scan: (id: number) => api.post<PriceReviewResponse>(`/products/${id}/scan`),

  confirmSelection: (id: number, data: {
    selectedPrice?: number;
    selectedMethod?: string;
    selectedCurrency?: string;
    name?: string | null;
    imageUrl?: string | null;
    stockStatus?: string | null;
    html?: string | null;
    selector?: string | null;
  }) => api.post<Product>(`/products/${id}/confirm`, data),

  update: (id: number, data: Partial<Product>) => 
    api.put<Product>(`/products/${id}`, data),

  delete: (id: number) => api.delete(`/products/${id}`),

  bulkPause: (ids: number[], paused: boolean) => 
    api.post('/products/bulk/pause', { ids, paused }),

  getSearchStatus: (options?: RequestOptions) =>
    api.get<{ enabled: boolean }>('/settings/discovery/status', options),

  search: (query: string) => 
    api.get<SearchResult[]>('/products/search', { params: { q: query } }),

  // Price related
  getPriceHistory: (productId: number, days?: number, options?: RequestOptions) =>
    api.get<{ product: Product; prices: PriceHistory[] }>(`/prices/${productId}/history`, {
      ...options,
      params: { ...options?.params, ...(days ? { days } : {}) },
    }),

  refreshPrice: (productId: number) =>
    api.post<{ price: number; currency: string }>(`/prices/${productId}/refresh`),

  // Stock related
  getStockHistory: (productId: number, days?: number, options?: RequestOptions) =>
    api.get<{ history: ProductSourceHistory[], stats: StockStatusStats }>(`/prices/${productId}/stock-history`, {
      ...options,
      params: { ...options?.params, ...(days ? { days } : {}) },
    }),
};
