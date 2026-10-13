import axios, { AxiosInstance } from 'axios';
import {
  PriceStalkerClientConfig,
  Item,
  ProductListing,
  PriceHistoryResult,
  StockHistoryResult,
  RetailerConfig,
  SystemLogsResponse,
  SearXNGSearchResult,
  ExtractionResult
} from './types.js';

export class PriceStalkerApiClient {
  private client: AxiosInstance;
  readonly baseUrl: string;

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

    // Intercept error responses to provide clear messages and token scope guidance
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 403) {
          const data = error.response.data;
          const required = data?.required ? (Array.isArray(data.required) ? data.required.join(', ') : data.required) : undefined;
          const message = required
            ? `Forbidden: System API token lacks required scope [${required}]. Grant this scope in Admin -> API Tokens.`
            : `Forbidden: Access denied (${data?.error || 'insufficient token privileges'}).`;
          const enhancedError = new Error(message);
          (enhancedError as any).status = 403;
          (enhancedError as any).response = error.response;
          return Promise.reject(enhancedError);
        }
        if (error.response?.data?.error) {
          const message = typeof error.response.data.error === 'string'
            ? error.response.data.error
            : JSON.stringify(error.response.data.error);
          const enhancedError = new Error(message);
          (enhancedError as any).status = error.response.status;
          (enhancedError as any).response = error.response;
          return Promise.reject(enhancedError);
        }
        return Promise.reject(error);
      }
    );
  }

  // --- Items & Products ---

  async getItems(): Promise<Item[]> {
    const response = await this.client.get<Item[]>('/api/products/items');
    return Array.isArray(response.data) ? response.data : [];
  }

  async getItem(productId: number): Promise<ProductListing> {
    const response = await this.client.get<ProductListing>(`/api/products/${productId}`);
    return response.data;
  }

  // --- Search ---

  async searchItems(query: string): Promise<SearXNGSearchResult[]> {
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

  async getStockHistory(productId: number, days: number = 30): Promise<StockHistoryResult> {
    const response = await this.client.get<StockHistoryResult>(`/api/prices/${productId}/stock-history`, {
      params: { days }
    });
    return response.data;
  }

  async refreshProductPrice(productId: number): Promise<any> {
    const response = await this.client.post(`/api/prices/${productId}/refresh`);
    return response.data;
  }

  // --- Retailers ---

  async getRetailerByDomain(domain: string): Promise<RetailerConfig | null> {
    try {
      const response = await this.client.get<RetailerConfig>(`/api/admin/retailers/domain/${encodeURIComponent(domain)}`);
      return response.data;
    } catch (e: any) {
      if (e.response?.status === 404) return null;
      throw e;
    }
  }

  // --- Diagnostics & System Operations ---

  async clearCaches(): Promise<{ success: boolean; message: string }> {
    // Note: The backend route is singular '/api/admin/command'
    const response = await this.client.post<{ success: boolean; message: string }>('/api/admin/command', {
      command: 'clear-settings-cache'
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

  async getDbHealth(): Promise<any> {
    const response = await this.client.get('/api/admin/debug/db-health');
    return response.data;
  }

  async getVersion(): Promise<{ version: string }> {
    const response = await this.client.get<{ version: string }>('/api/system/version');
    return response.data;
  }

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
}
