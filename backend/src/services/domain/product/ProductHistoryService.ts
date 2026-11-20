import { 
  productRepository, 
  priceHistoryRepository, 
  stockHistoryRepository, 
  userRepository,
  ProductWithLatestPrice,
  ProductWithSparkline,
  ItemWithListings
} from '../../../models';
import { syncUserCategories } from './utils';
import { groupIntoItems } from './utils/group-into-items';
import { hostOf } from './repositories/store-context';
import { logger } from '../../../utils/system/logger';

export class ProductHistoryService {
  async getUserProducts(userId: number): Promise<ProductWithSparkline[]> {
    return await productRepository.findByUserIdWithSparkline(userId);
  }

  /**
   * The same listings, grouped into the items they belong to (issue #143).
   *
   * Built from getUserProducts rather than its own query, so the flat and
   * grouped views cannot disagree about a price, and so the exchange rate
   * triangulation exists in one place.
   */
  async getUserItems(userId: number): Promise<ItemWithListings[]> {
    const [products, user] = await Promise.all([
      productRepository.findByUserIdWithSparkline(userId),
      userRepository.findById(userId),
    ]);
    return groupIntoItems(products, user?.currency ?? null);
  }

  async getUserItem(itemId: number, userId: number): Promise<ItemWithListings | null> {
    const items = await this.getUserItems(userId);
    return items.find(item => item.id === itemId) ?? null;
  }

  async getItemPriceHistory(itemId: number, userId: number, days?: number) {
    const item = await this.getUserItem(itemId, userId);
    if (!item) return null;

    const series = await Promise.all(
      item.listings.map(async (listing) => {
        const prices = await priceHistoryRepository.findByProductId(listing.id, days);
        return {
          productId: listing.id,
          retailerName: listing.retailer_name || hostOf(listing.url) || 'Store',
          url: listing.url,
          currency: listing.currency || 'USD',
          prices,
        };
      })
    );

    return { item, series };
  }

  async getItemStockHistory(itemId: number, userId: number, days: number = 30) {
    const item = await this.getUserItem(itemId, userId);
    if (!item) return null;

    const series = await Promise.all(
      item.listings.map(async (listing) => {
        let history = await stockHistoryRepository.getByProductId(listing.id, days);
        let stats = await stockHistoryRepository.getStats(listing.id, days);

        if (history.length === 0 && listing.stock_status) {
          const startOfPeriod = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          const createdDate = listing.created_at ? new Date(listing.created_at) : startOfPeriod;

          const syntheticEntry = {
            id: 0,
            product_id: listing.id,
            status: listing.stock_status,
            changed_at: createdDate.toISOString(),
          };

          history = [syntheticEntry as any];

          const isAvailable = listing.stock_status === 'in_stock' ||
                            listing.stock_status === 'pre_order' ||
                            listing.stock_status === 'member_only';
          const daysInStatus = Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / (24 * 60 * 60 * 1000)));

          stats = {
            availability_percent: isAvailable ? 100 : 0,
            outage_count: isAvailable ? 0 : 1,
            avg_outage_days: null,
            longest_outage_days: null,
            current_status: listing.stock_status,
            days_in_current_status: daysInStatus
          };
        }

        return {
          productId: listing.id,
          retailerName: listing.retailer_name || hostOf(listing.url) || 'Store',
          url: listing.url,
          stockStatus: listing.stock_status,
          history,
          stats,
        };
      })
    );

    return { item, series };
  }

  async getProduct(productId: number, userId: number, asAdmin = false): Promise<ProductWithLatestPrice | null> {
    const product = await productRepository.findById(productId, userId, { asAdmin });
    this.auditAdminAccess('view', product, userId, asAdmin);
    return product;
  }

  async deleteProduct(productId: number, userId: number, asAdmin = false): Promise<boolean> {
    // Read first so the audit line can name the owner; the row is gone after.
    const product = await productRepository.findById(productId, userId, { asAdmin });
    if (!product) return false;
    this.auditAdminAccess('delete', product, userId, asAdmin);
    return await productRepository.delete(productId, userId, { asAdmin });
  }

  /**
   * An administrator reaching into another account's product is legitimate but
   * not routine, so it leaves a trace. Acting on your own product logs nothing.
   */
  private auditAdminAccess(
    action: string,
    product: { id: number; user_id?: number } | null,
    userId: number,
    asAdmin: boolean
  ): void {
    if (!asAdmin || !product || product.user_id === userId) return;
    logger.info(
      `Product ${product.id} | Admin ${action} | Admin ${userId} accessed a product owned by user ${product.user_id}`,
      'Admin',
      { product_id: product.id }
    );
  }

  async bulkUpdatePauseStatus(ids: number[], userId: number, paused: boolean): Promise<number> {
    return await productRepository.bulkSetCheckingPaused(ids, userId, paused);
  }

  async updateProduct(productId: number, userId: number, data: any, asAdmin = false): Promise<ProductWithLatestPrice | null> {
    if (data.category !== undefined) {
      data.category = data.category?.trim() || null;
    }
    const updated = await productRepository.update(productId, userId, data, undefined, { asAdmin });

    // Categories belong to the owner of the product, not to whoever edited it.
    // Syncing them to the admin's own list would pollute their category filter
    // with somebody else's categories.
    if (updated && data.category) {
      await syncUserCategories(updated.user_id ?? userId, data.category);
    }

    const product = await productRepository.findById(productId, userId, { asAdmin });
    this.auditAdminAccess('update', product, userId, asAdmin);
    return product;
  }

  async getPriceHistory(productId: number, userId: number, days?: number, asAdmin = false) {
    const product = await productRepository.findById(productId, userId, { asAdmin });
    if (!product) throw new Error('Product not found');

    const prices = await priceHistoryRepository.findByProductId(productId, days);
    return { product, prices };
  }

  async getStockHistory(productId: number, userId: number, days: number = 30, asAdmin = false) {
    const product = await productRepository.findById(productId, userId, { asAdmin });
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