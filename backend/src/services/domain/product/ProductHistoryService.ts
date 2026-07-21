import { 
  productRepository, 
  priceHistoryRepository, 
  stockHistoryRepository, 
  userRepository,
  ProductWithLatestPrice,
  ProductWithSparkline
} from '../../../models';
import { syncUserCategories } from './utils';

export class ProductHistoryService {
  async getUserProducts(userId: number): Promise<ProductWithSparkline[]> {
    return await productRepository.findByUserIdWithSparkline(userId);
  }

  async getProduct(productId: number, userId: number): Promise<ProductWithLatestPrice | null> {
    return await productRepository.findById(productId, userId);
  }

  async deleteProduct(productId: number, userId: number): Promise<boolean> {
    return await productRepository.delete(productId, userId);
  }

  async bulkUpdatePauseStatus(ids: number[], userId: number, paused: boolean): Promise<number> {
    return await productRepository.bulkSetCheckingPaused(ids, userId, paused);
  }

  async updateProduct(productId: number, userId: number, data: any): Promise<ProductWithLatestPrice | null> {
    if (data.category !== undefined) {
      data.category = data.category?.trim() || null;
    }
    const updated = await productRepository.update(productId, userId, data);
    
    if (updated && data.category) {
      await syncUserCategories(userId, data.category);
    }
    
    return await productRepository.findById(productId, userId);
  }

  async getPriceHistory(productId: number, userId: number, days?: number) {
    const product = await productRepository.findById(productId, userId);
    if (!product) throw new Error('Product not found');

    const prices = await priceHistoryRepository.findByProductId(productId, days);
    return { product, prices };
  }

  async getStockHistory(productId: number, userId: number, days: number = 30) {
    const product = await productRepository.findById(productId, userId);
    if (!product) throw new Error('Product not found');

    let history = await stockHistoryRepository.getByProductId(productId, days);
    let stats = await stockHistoryRepository.getStats(productId, days);

    if (history.length === 0 && product.stock_status) {
      const startOfPeriod = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const createdDate = product.created_at ? new Date(product.created_at) : startOfPeriod;
      
      const syntheticEntry = {
        id: 0,
        product_id: productId,
        status: product.stock_status,
        changed_at: createdDate.toISOString(),
      };
      
      history = [syntheticEntry as any];

      const isAvailable = product.stock_status === 'in_stock' || 
                        product.stock_status === 'pre_order' || 
                        product.stock_status === 'member_only';
      const daysInStatus = Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / (24 * 60 * 60 * 1000)));

      stats = {
        availability_percent: isAvailable ? 100 : 0,
        outage_count: isAvailable ? 0 : 1,
        avg_outage_days: null,
        longest_outage_days: null,
        current_status: product.stock_status,
        days_in_current_status: daysInStatus
      };
    }

    return { history, stats };
  }
}

export const productHistoryService = new ProductHistoryService();