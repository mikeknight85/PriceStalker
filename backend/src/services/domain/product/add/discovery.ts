import { productRepository } from '../../../../models';
import { scrapeProductWithVoting } from '../../../scraper';
import { productPersistenceService } from '../ProductPersistenceService';

export class ProductDiscoveryService {
  /**
   * Handles the "Auto-Track" vs "Review Required" logic for a new product.
   */
  async initiateProductDiscovery(userId: number, url: string, category: string | null, refreshInterval?: number) {
    const scrapedData = await scrapeProductWithVoting(url, userId);

    if (!scrapedData.price && scrapedData.stockStatus !== 'out_of_stock' && scrapedData.stockStatus !== 'pre_order') {
      throw new Error('Could not extract price from the provided URL');
    }

    // AUTO-TRACK: Consensus is clear (either we have a price, or it's out of stock / pre-order)
    if (scrapedData.needsReview === false && (scrapedData.price || scrapedData.stockStatus === 'out_of_stock' || scrapedData.stockStatus === 'pre_order')) {
      const product = await productRepository.create(
        userId,
        url,
        scrapedData.name ? scrapedData.name.substring(0, 255) : null,
        scrapedData.imageUrl || null,
        refreshInterval || 43200,
        scrapedData.stockStatus as any,
        scrapedData.aiStatus || null,
        category
      );

      await productPersistenceService.saveScrapeResult(product.id, userId, scrapedData, 'manual-add');

      const savedProduct = await productRepository.findById(product.id, userId);
      return { ...savedProduct, needsReview: false };
    }

    // REVIEW REQUIRED: Return voting data to client
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
      reviewReason: scrapedData.reviewReason || 'first_scan',
      url,
      category,
      html: scrapedData.html ? scrapedData.html.substring(0, 100_000) : null
    };
  }
}

export const productDiscoveryService = new ProductDiscoveryService();
