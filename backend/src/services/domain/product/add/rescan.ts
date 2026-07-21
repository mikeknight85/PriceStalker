import { productRepository } from '../../../../models';
import { scrapeProductWithVoting } from '../../../scraper';

export class ProductRescanService {
  /**
   * Scans an existing product to show the voting modal again.
   */
  async scanProduct(userId: number, productId: number): Promise<any> {
    const product = await productRepository.findById(productId, userId);
    if (!product) throw new Error('Product not found');

    const scrapedData = await scrapeProductWithVoting(
      product.url, 
      userId, 
      undefined, undefined, undefined, undefined, undefined, 
      productId
    );

    const candidates: any[] = scrapedData.priceCandidates.map(c => ({
      price: c.price,
      currency: c.currency,
      method: c.method,
      context: c.context,
      confidence: c.confidence,
      selector: c.selector,
    }));

    if (scrapedData.memberPrice?.price) {
      candidates.push({
        price: scrapedData.memberPrice.price,
        currency: scrapedData.memberPrice.currency,
        method: 'member-price',
        context: 'Member / loyalty price',
        confidence: 0.90,
        selector: undefined
      });
    }

    if (scrapedData.originalPrice?.price) {
      candidates.push({
        price: scrapedData.originalPrice.price,
        currency: scrapedData.originalPrice.currency,
        method: 'original-price',
        context: 'Original / RRP price',
        confidence: 0.85,
        selector: undefined
      });
    }

    return {
      needsReview: true,
      name: scrapedData.name ? scrapedData.name.substring(0, 255) : null,
      imageUrl: scrapedData.imageUrl,
      stockStatus: scrapedData.stockStatus,
      priceCandidates: candidates,
      reviewReason: 'manual_rescan',
      url: product.url,
      id: productId,
      html: scrapedData.html ? scrapedData.html.substring(0, 100_000) : null
    };
  }
}

export const productRescanService = new ProductRescanService();
