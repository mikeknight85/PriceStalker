import { productRepository, ProductWithLatestPrice } from '../../../../models';
import { productPersistenceService } from '../ProductPersistenceService';
import { logger } from '../../../../utils/system/logger';

export class ProductConfirmationService {
  /**
   * Creates and confirms a product when the client provides a pre-selected candidate.
   */
  async confirmNewProduct(userId: number, url: string, options: any) {
    const { 
      refresh_interval, 
      selectedPrice, 
      selectedMethod, 
      selectedCurrency, 
      category,
      name,
      imageUrl,
      stockStatus,
      html,
      selector: manualSelector,
      memberPrice,
      originalPrice
    } = options;

    const product = await productRepository.create(
      userId,
      url,
      name ? name.substring(0, 255) : null,
      imageUrl || null,
      refresh_interval || 43200,
      (stockStatus || 'unknown') as any,
      'confirmed',
      category || null
    );

    await productPersistenceService.saveScrapeResult(
      product.id, 
      userId, 
      {
        ...options,
        price: { price: selectedPrice, currency: selectedCurrency || 'AUD' },
        memberPrice,
        originalPrice,
        selectedMethod,
        html
      } as any, 
      'manual-add',
      manualSelector
    );

    return await productRepository.findById(product.id, userId);
  }

  /**
   * Confirms a user's selection for an existing product (re-voting).
   */
  async confirmProductSelection(userId: number, productId: number, selection: any): Promise<ProductWithLatestPrice | null> {
    const product = await productRepository.findById(productId, userId);
    if (!product) throw new Error('Product not found');

    const { selectedPrice, selectedCurrency, selectedMethod, memberPrice, originalPrice } = selection;

    await productPersistenceService.saveScrapeResult(
      productId,
      userId,
      {
        ...selection,
        price: selectedPrice !== undefined ? { price: selectedPrice, currency: selectedCurrency || 'AUD' } : undefined,
        memberPrice,
        originalPrice,
        selectedMethod
      } as any,
      'manual-confirm',
      selection.selector
    );

    // EXPLICITLY clear needs_price_review and update checking status
    await productRepository.update(productId, userId, {
      needs_price_review: false,
      ai_status: 'confirmed'
    });

    if (product.checking_paused) {
      logger.info(`Product ${productId} | Status | Unpausing checking after manual selection confirmation.`, 'Products', { product_id: productId });
      await productRepository.bulkSetCheckingPaused([productId], userId, false);
    }

    return await productRepository.findById(productId, userId);
  }
}

export const productConfirmationService = new ProductConfirmationService();
