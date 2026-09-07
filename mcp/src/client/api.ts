import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  PriceStalkerClientConfig,
  Item,
  ProductListing,
  PriceHistoryResult,
  StockHistoryResult,
  RetailerConfig,
  ExtractionResult,
  SystemLogsResponse,
  SearXNGSearchResult
} from './types.js';

export class PriceStalkerApiClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(config: PriceStalkerClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiToken}`
      }
    });
  }

  // --- Items & Products ---

  async getItems(): Promise<Item[]> {
    const response = await this.client.get<Item[]>('/api/products/items');
    return Array.isArray(response.data) ? response.data : [];
  }

  async getProducts(): Promise<ProductListing[]> {
    const response = await this.client.get<ProductListing[]>('/api/products');
    return Array.isArray(response.data) ? response.data : [];
  }

  async getProduct(productId: number): Promise<ProductListing> {
    const response = await this.client.get<ProductListing>(`/api/products/${productId}`);
    return response.data;
  }

  async addProduct(url: string, options: {
    target_price?: number;
    price_drop_threshold?: number;
    notify_back_in_stock?: boolean;
    name?: string;
  } = {}): Promise<any> {
    const response = await this.client.post('/api/products', {
      url,
      ...options
    });
    return response.data;
  }

  async updateProduct(productId: number, data: Partial<ProductListing>): Promise<ProductListing> {
    const response = await this.client.put<ProductListing>(`/api/products/${productId}`, data);
    return response.data;
  }

  async deleteProduct(productId: number): Promise<{ message: string }> {
    const response = await this.client.delete<{ message: string }>(`/api/products/${productId}`);
    return response.data;
  }

  async attachListing(itemId: number, productId: number): Promise<any> {
    const response = await this.client.post(`/api/products/items/${itemId}/listings`, { productId });
    return response.data;
  }

  async detachListing(productId: number): Promise<any> {
    const response = await this.client.post(`/api/products/${productId}/detach`);
    return response.data;
  }

  async bulkPause(productIds: number[], paused: boolean): Promise<{ message: string; updated: number }> {
    const response = await this.client.post<{ message: string; updated: number }>('/api/products/bulk/pause', {
      ids: productIds,
      paused
    });
    return response.data;
  }

  async scanProduct(productId: number): Promise<any> {
    const response = await this.client.post(`/api/products/${productId}/scan`);
    return response.data;
  }

  async confirmProductSelection(productId: number, selection: any): Promise<any> {
    const response = await this.client.post(`/api/products/${productId}/confirm`, selection);
    return response.data;
  }

  // --- Search ---

  async searchWeb(query: string): Promise<SearXNGSearchResult[]> {
    const response = await this.client.get<SearXNGSearchResult[]>('/api/products/search', {
      params: { q: query }
    });
    return Array.isArray(response.data) ? response.data : [];
  }

  // --- Prices & Stock History ---

  async getPriceHistory(productId: number, days?: number): Promise<PriceHistoryResult> {
    const response = await this.client.get<PriceHistoryResult>(`/api/prices/${productId}/history`, {
      params: days ? { days } : undefined
    });
    return response.data;
  }

  async refreshProductPrice(productId: number): Promise<any> {
    const response = await this.client.post(`/api/prices/${productId}/refresh`);
    return response.data;
  }

  async getStockHistory(productId: number, days: number = 30): Promise<StockHistoryResult> {
    const response = await this.client.get<StockHistoryResult>(`/api/prices/${productId}/stock-history`, {
      params: { days }
    });
    return response.data;
  }

  // --- Retailers & Scraping Config ---

  async getRetailers(): Promise<RetailerConfig[]> {
    const response = await this.client.get<RetailerConfig[]>('/api/admin/retailers');
    return Array.isArray(response.data) ? response.data : [];
  }

  async getRetailerByDomain(domain: string): Promise<RetailerConfig | null> {
    try {
      const response = await this.client.get<RetailerConfig>(`/api/admin/retailers/domain/${encodeURIComponent(domain)}`);
      return response.data;
    } catch (e: any) {
      if (e.response?.status === 404) return null;
      throw e;
    }
  }

  async lookupRetailer(url: string): Promise<RetailerConfig | null> {
    try {
      const response = await this.client.get<RetailerConfig>('/api/admin/retailers/lookup', {
        params: { url }
      });
      return response.data;
    } catch (e: any) {
      if (e.response?.status === 404) return null;
      throw e;
    }
  }

  async testRetailerConfig(url: string, config: any): Promise<ExtractionResult> {
    const response = await this.client.post<ExtractionResult>('/api/admin/retailers/test', {
      url,
      config
    });
    return response.data;
  }

  async upsertRetailer(config: Partial<RetailerConfig>): Promise<RetailerConfig> {
    const response = await this.client.post<RetailerConfig>('/api/admin/retailers', config);
    return response.data;
  }

  async remapRetailer(url: string): Promise<any> {
    const response = await this.client.post('/api/admin/retailers/remap', { url });
    return response.data;
  }

  async deleteRetailer(retailerId: number): Promise<{ success: boolean }> {
    const response = await this.client.delete<{ success: boolean }>(`/api/admin/retailers/${retailerId}`);
    return response.data;
  }

  // --- Debug & Extraction ---

  async debugExtract(options: {
    url: string;
    config?: any;
    mode?: 'bypass' | 'standard';
    returnHtml?: boolean;
    use_ai?: boolean;
    force_ai?: boolean;
    productId?: number;
  }): Promise<ExtractionResult> {
    const response = await this.client.post<ExtractionResult>('/api/admin/debug/extract', options);
    return response.data;
  }

  async getDbHealth(): Promise<any> {
    const response = await this.client.get('/api/admin/debug/db-health');
    return response.data;
  }

  // --- Admin Commands & System ---

  async clearCaches(): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post<{ success: boolean; message: string }>('/api/admin/commands', {
      command: 'clear-settings-cache'
    });
    return response.data;
  }

  async runMigrations(): Promise<any> {
    const response = await this.client.post('/api/admin/commands', {
      command: 'run-migration'
    });
    return response.data;
  }

  async getLogs(params: {
    page?: number;
    limit?: number;
    level?: string;
    context?: string;
    search?: string;
  } = {}): Promise<SystemLogsResponse> {
    const response = await this.client.get<SystemLogsResponse>('/api/admin/logs', { params });
    return response.data;
  }

  async clearLogs(params: { level?: string; context?: string } = {}): Promise<{ success: boolean; deleted: number }> {
    const response = await this.client.delete<{ success: boolean; deleted: number }>('/api/admin/logs/clear', {
      params
    });
    return response.data;
  }

  async getVersion(): Promise<{ version: string }> {
    const response = await this.client.get<{ version: string }>('/api/system/version');
    return response.data;
  }

  // --- Notifications ---

  async testNotificationChannel(channel: string, target?: string): Promise<{ message: string }> {
    const response = await this.client.post<{ message: string }>(`/api/settings/notification-tests/${channel}`, {
      target
    });
    return response.data;
  }

  // --- AI Provider Tests ---

  async testAiProvider(provider: string, payload: {
    api_key?: string;
    model?: string;
    base_url?: string;
    project_id?: string;
    location?: string;
  }): Promise<any> {
    const endpoint = provider.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const response = await this.client.post(`/api/admin/settings/ai/tests/test-${endpoint}`, payload);
    return response.data;
  }
}
