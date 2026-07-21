import { scrapeProductWithVoting } from '../../scraper';
import { logger } from '../../../utils/system/logger';

export class RetailerTestingService {
  /**
   * Test a retailer configuration live
   */
  async testRetailerConfig(url: string, config: any): Promise<any> {
    logger.info(`Retailer ${config?.domain || 'generic'} | Config Test | ${url}`, 'Retailers');

    // Run the scraper with this temporary config
    const result = await scrapeProductWithVoting(url, undefined, undefined, undefined, undefined, true, config);

    return {
      success: !!result.price,
      name: result.name,
      price: result.price,
      imageUrl: result.imageUrl,
      stockStatus: result.stockStatus,
      priceCandidates: result.priceCandidates,
      html: result.html?.substring(0, 50000), // Include snippet of HTML for debugging
      error: !result.price ? 'No price could be extracted with these settings' : undefined
    };
  }
}
