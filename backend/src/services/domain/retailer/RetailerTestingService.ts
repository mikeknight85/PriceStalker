import { scrapeProductWithVoting } from '../../scraper';
import { logger } from '../../../utils/system/logger';
import { scrubUrlCredentials } from '../../../utils/system/logging/scrubber';
import { assertUrlIsSafe } from '../../../utils/system/url-safety';

export class RetailerTestingService {
  /**
   * Test a retailer configuration live
   */
  async testRetailerConfig(url: string, config: any): Promise<any> {
    // The URL comes straight from the admin request body and is handed to the
    // scraper, so it is checked before anything leaves the process (issue
    // #165). UnsafeUrlError carries statusCode 400, which asyncHandler
    // surfaces with its message instead of a generic 500.
    await assertUrlIsSafe(url);

    logger.info(`Retailer ${config?.domain || 'generic'} | Config Test | ${scrubUrlCredentials(url)}`, 'Retailers');

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
