import { productRepository } from '../../../../models';
import { scrapeProductWithVoting } from '../../../scraper';
import { productPersistenceService } from '../ProductPersistenceService';
import type { ScrapeFailureReason } from '../../../../types/scraper';

/**
 * Turns the scrape's failure reason into something the person adding the
 * product can act on.
 *
 * Every one of these previously surfaced as "Could not extract price from the
 * provided URL" with a bare 400, while the log recorded exactly what happened
 * a few lines earlier.
 */
function describeScrapeFailure(reason?: ScrapeFailureReason, detail?: string): string {
  switch (reason) {
    case 'bot_challenge':
      return `The retailer blocked the request${detail ? ` (${detail})` : ''}. Enable the Browser Scraper for this retailer under Admin -> Retailers, or configure a proxy, then try again.`;
    case 'page_unavailable':
      return 'The product page could not be found. Check the URL is still live and points at a product rather than a search or category page.';
    case 'auto_map_rejected':
      return 'AI auto-mapping could not find a usable price on this page, so no retailer configuration was saved. Add price selectors for this retailer under Admin -> Retailers, or use the Live Tester to work them out.';
    case 'no_price_found':
    default:
      return 'No price could be found on this page. If the price is rendered by JavaScript, enable the Browser Scraper for this retailer under Admin -> Retailers.';
  }
}

export class ProductDiscoveryService {
  /**
   * Handles the "Auto-Track" vs "Review Required" logic for a new product.
   */
  async initiateProductDiscovery(userId: number, url: string, category: string | null, refreshInterval?: number) {
    const scrapedData = await scrapeProductWithVoting(url, userId);

    if (!scrapedData.price && scrapedData.stockStatus !== 'out_of_stock' && scrapedData.stockStatus !== 'pre_order') {
      throw new Error(describeScrapeFailure(scrapedData.failureReason, scrapedData.failureDetail));
    }

    const requiresCurrencyReview = Boolean(scrapedData.price && !scrapedData.price.currency);

    // AUTO-TRACK: Consensus is clear (either we have a price, or it's out of stock / pre-order).
    // A numeric price without a known currency must be confirmed manually.
    if (!requiresCurrencyReview && scrapedData.needsReview === false && (scrapedData.price || scrapedData.stockStatus === 'out_of_stock' || scrapedData.stockStatus === 'pre_order')) {
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
