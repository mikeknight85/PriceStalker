import { api } from '../../../api/client';
import { 
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
  getAll: () => api.get<Product[]>('/products'),

  getById: (id: number) => api.get<ProductWithStats>(`/products/${id}`),

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

  getSearchStatus: () =>
    api.get<{ enabled: boolean }>('/settings/discovery/status'),

  search: (query: string) => 
    api.get<SearchResult[]>('/products/search', { params: { q: query } }),

  // Price related
  getPriceHistory: (productId: number, days?: number) =>
    api.get<{ product: Product; prices: PriceHistory[] }>(`/prices/${productId}/history${days ? `?days=${days}` : ''}`),

  refreshPrice: (productId: number) =>
    api.post<{ price: number; currency: string }>(`/prices/${productId}/refresh`),

  // Stock related
  getStockHistory: (productId: number, days?: number) =>
    api.get<{ history: ProductSourceHistory[], stats: StockStatusStats }>(`/prices/${productId}/stock-history${days ? `?days=${days}` : ''}`),
};
