import { productRepository } from '../../../../models';
import { cleanUrl } from '../../../../utils/scraping/urlHelper';
import { productDiscoveryService } from './discovery';
import { productConfirmationService } from './confirmation';
import { productRescanService } from './rescan';
import { defaultCheckIntervalService } from '../DefaultCheckIntervalService';

export class ProductAddService {
  /**
   * Main entry point for adding a product.
   */
  async addProduct(userId: number, url: string, options: any): Promise<any> {
    const cleanedUrl = cleanUrl(url);
    
    // Check for duplicate
    const existingId = await productRepository.findDuplicateUrl(cleanedUrl, userId);
    if (existingId) {
      const err = new Error('Duplicate product');
      (err as any).statusCode = 409;
      (err as any).existingProductId = existingId;
      throw err;
    }

    const { selectedPrice, selectedMethod, category: rawCategory, refresh_interval } = options;
    const category = rawCategory?.trim() || null;

    // Resolved once, here, so both paths below create the product with the same
    // interval and neither needs its own fallback (issue #239). An interval the
    // request carried wins; otherwise this is the user's default, then the
    // instance default, then 12 hours.
    const refreshInterval = await defaultCheckIntervalService.resolveForNewProduct(userId, refresh_interval);

    if (selectedPrice !== undefined && selectedMethod) {
      return productConfirmationService.confirmNewProduct(userId, cleanedUrl, {
        ...options,
        refresh_interval: refreshInterval,
      });
    } 
    
    return productDiscoveryService.initiateProductDiscovery(userId, cleanedUrl, category, refreshInterval);
  }

  async scanProduct(userId: number, productId: number): Promise<any> {
    return productRescanService.scanProduct(userId, productId);
  }

  async confirmProductSelection(userId: number, productId: number, selection: any) {
    return productConfirmationService.confirmProductSelection(userId, productId, selection);
  }
}

export const productAddService = new ProductAddService();
export * from './discovery';
export * from './confirmation';
export * from './rescan';
