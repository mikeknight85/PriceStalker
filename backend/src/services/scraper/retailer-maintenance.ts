import { retailerRepository, RetailerConfig } from '../../models';
import { logger } from '../../utils/system/logger';

/**
 * Updates a retailer's status if they are detected as blocked.
 */
export async function flagBlockedRetailer(
  domainConfig: RetailerConfig, 
  challenge: string,
  extractionSteps: string[]
): Promise<void> {
  try {
    await retailerRepository.upsert({
      ...domainConfig,
      status: 'BLOCKED',
      description: `Auto-flagged: ${challenge} detected during extraction`
    });
    extractionSteps.push(`Retailer | Status | Updated to BLOCKED`);
  } catch (e) {
    logger.error(`Scraper | Status | Failed to update for ${domainConfig.domain}`, 'Scraper', e);
  }
}

/**
 * Restores a retailer's status if a successful scrape occurs after a block.
 */
export async function restoreRetailerStatus(
  domainConfig: RetailerConfig,
  extractionSteps: string[]
): Promise<void> {
  if (domainConfig.status !== 'OK') {
    try {
      await retailerRepository.upsert({
        ...domainConfig,
        status: 'OK',
        description: `Auto-restored: Successful extraction completed`
      });
      extractionSteps.push(`Retailer | Status | Restored to OK`);
    } catch (e) {
      logger.error(`Retailer | Status | Failed to restore for ${domainConfig.domain}`, 'Scraper', e);
    }
  }
}
