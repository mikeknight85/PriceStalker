import { retailerRepository, RetailerConfig } from '../../../models';
import { getUrlLookup } from '../../../utils/scraping/urlHelper';

export class RetailerQueryService {
  /**
   * Get all retailers
   */
  async getAllRetailers(includeInactive: boolean = true): Promise<RetailerConfig[]> {
    return await retailerRepository.getAll(includeInactive);
  }

  /**
   * Get retailer by domain
   */
  async getRetailerByDomain(domain: string): Promise<RetailerConfig | null> {
    return await retailerRepository.getByDomain(domain);
  }

  /**
   * Look up retailer config for a specific URL
   */
  async getRetailerForUrl(url: string): Promise<RetailerConfig | null> {
    const urlLookup = getUrlLookup(url);
    return await retailerRepository.getConfigForUrl(urlLookup);
  }
}
