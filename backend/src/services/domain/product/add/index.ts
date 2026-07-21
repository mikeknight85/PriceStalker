import { productRepository } from '../../../../models';
import { cleanUrl } from '../../../../utils/scraping/urlHelper';
import { productDiscoveryService } from './discovery';
import { productConfirmationService } from './confirmation';
import { productRescanService } from './rescan';

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

    if (selectedPrice !== undefined && selectedMethod) {
      return productConfirmationService.confirmNewProduct(userId, cleanedUrl, options);
    } 
    
    return productDiscoveryService.initiateProductDiscovery(userId, cleanedUrl, category, refresh_interval);
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
