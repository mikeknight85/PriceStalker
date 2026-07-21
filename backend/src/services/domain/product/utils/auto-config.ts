import { retailerRepository } from '../../../../models';
import { systemService } from '../../system';
import { regionalMappingCache, configCache } from '../../../../utils/cache';
import { logger } from '../../../../utils/system/logger';
import pool from '../../../../config/database';
import { PoolClient } from 'pg';
import { ScrapedProductWithVoting } from '../../../../types/scraper';
import { getRetailerDescription } from '../../../../utils/scraping/retailerHelper';
import { normalizeSelector } from '../../../scraper/core';
import { 
  getAllGenericSelectors, 
  resolveWinningSelector, 
  cleanSelectorArray, 
  resolveRetailerName 
} from './auto-config.helpers';

/**
 * Automatically updates or creates a retailer configuration based on scraping results.
 */
export async function runAutoRetailerConfig(params: {
  url: string;
  productId: number;
  html?: string;
  scrapedData?: ScrapedProductWithVoting;
  manualSelector?: string;
  source: 'manual-add' | 'manual-confirm' | 'refresh' | 'scan' | 'auto-track';
  client?: PoolClient;
}) {
  const { url, productId, html, scrapedData, manualSelector, source, client: outerClient } = params;
  
  try {
    const updatesDisabled = await systemService.getSetting('retailer_updates_disabled');
    if (updatesDisabled === 'true') {
      logger.debug(`Product ${productId} | Retailer Config | Auto-update skipped (globally disabled)`, 'Products');
      return;
    }

    const domain = await regionalMappingCache.getLookupDomain(url);
    const configTrace: string[] = [];
    configTrace.push(`<strong>[Auto-Config] ${domain}</strong>`);
    configTrace.push(`<small>${url}</small>`);

    const ownClient = !outerClient;
    const client = outerClient || await pool.connect();
    try {
      if (ownClient) {
        await client.query('BEGIN');
      }

      const existing = await retailerRepository.getByDomainForUpdate(domain, client);
      if (existing) {
        configTrace.push(`Status | Existing config found (ID: ${existing.id})`);
      } else {
        configTrace.push(`Status | No existing config, will create new`);
      }

      let priceSelectors = [...(existing?.price_selectors || [])];
      let dealPriceSelectors = [...(existing?.deal_price_selectors || [])];
      let memberPriceSelectors = [...(existing?.member_price_selectors || [])];
      let preOrderPriceSelectors = [...(existing?.pre_order_price_selectors || [])];
      let originalPriceSelectors = [...(existing?.original_price_selectors || [])];

      const allGenericSelectors = await getAllGenericSelectors();

      // 1. Resolve selector to prioritize
      let { selector: winningSelector, method: winningMethod } = resolveWinningSelector(scrapedData, manualSelector);

      let targetArrayName = 'price_selectors';
      let targetArray = priceSelectors;

      if (winningMethod === 'deal-price') {
        targetArrayName = 'deal_price_selectors';
        targetArray = dealPriceSelectors;
      } else if (winningMethod === 'member-price') {
        targetArrayName = 'member_price_selectors';
        targetArray = memberPriceSelectors;
      } else if (winningMethod === 'preorder-price') {
        targetArrayName = 'pre_order_price_selectors';
        targetArray = preOrderPriceSelectors;
      } else if (winningMethod === 'original-price') {
        targetArrayName = 'original_price_selectors';
        targetArray = originalPriceSelectors;
      }

      // 1.5 Load existing metadata or default to empty
      const metadata = existing?.selector_metadata || { selectors: {} };
      if (!metadata.selectors) {
        metadata.selectors = {};
      }

      if (winningSelector) {
        winningSelector = normalizeSelector(winningSelector);
        const normalizedWinning = winningSelector.trim().toLowerCase();
        const isGeneric = allGenericSelectors.has(normalizedWinning);

        if (isGeneric) {
          configTrace.push(`Selectors | Ignored generic selector from promotion: ${winningSelector}`);
        } else {
          // Remove if already exists so we can unshift/prioritize it
          const index = targetArray.findIndex(s => s.trim().toLowerCase() === normalizedWinning);
          if (index !== -1) {
            targetArray.splice(index, 1);
            configTrace.push(`Selectors | Prioritized existing selector in ${targetArrayName}: ${winningSelector}`);
          } else {
            configTrace.push(`Selectors | Added new winning selector to ${targetArrayName}: ${winningSelector}`);
          }
          targetArray.unshift(winningSelector);

          // Update success stats
          if (!metadata.selectors[normalizedWinning]) {
            metadata.selectors[normalizedWinning] = { last_matched_at: '', match_count: 0, consecutive_failures: 0 };
          }
          metadata.selectors[normalizedWinning].last_matched_at = new Date().toISOString();
          metadata.selectors[normalizedWinning].match_count = (metadata.selectors[normalizedWinning].match_count || 0) + 1;
          metadata.selectors[normalizedWinning].consecutive_failures = 0;
        }
      }

      // Deduplicate and filter out any pre-existing generic selectors
      priceSelectors = cleanSelectorArray(priceSelectors, allGenericSelectors);
      dealPriceSelectors = cleanSelectorArray(dealPriceSelectors, allGenericSelectors);
      memberPriceSelectors = cleanSelectorArray(memberPriceSelectors, allGenericSelectors);
      preOrderPriceSelectors = cleanSelectorArray(preOrderPriceSelectors, allGenericSelectors);
      originalPriceSelectors = cleanSelectorArray(originalPriceSelectors, allGenericSelectors);

      // Increment consecutive failures for all other custom selectors that were not the winner
      const allCustomArrays = [
        priceSelectors,
        dealPriceSelectors,
        memberPriceSelectors,
        preOrderPriceSelectors,
        originalPriceSelectors
      ];
      for (const arr of allCustomArrays) {
        for (const sel of arr) {
          const normSel = sel.trim().toLowerCase();
          if (winningSelector && normSel === winningSelector.trim().toLowerCase()) {
            continue; // already updated as winner
          }
          if (!metadata.selectors[normSel]) {
            metadata.selectors[normSel] = { last_matched_at: '', match_count: 0, consecutive_failures: 0 };
          }
          metadata.selectors[normSel].consecutive_failures = (metadata.selectors[normSel].consecutive_failures || 0) + 1;
        }
      }

      // Eviction scoring helper
      const getSelectorScore = (sel: string) => {
        const norm = sel.trim().toLowerCase();
        if (winningSelector && norm === winningSelector.trim().toLowerCase()) {
          return Infinity; // current winner always gets priority
        }
        const stats = metadata.selectors[norm];
        if (!stats) return 0;
        return (stats.match_count || 0) - (stats.consecutive_failures || 0) * 2;
      };

      const sortAndCapSelectorArray = (arr: string[]): string[] => {
        return arr
          .map(s => ({ original: s, score: getSelectorScore(s) }))
          .sort((a, b) => b.score - a.score)
          .map(item => item.original)
          .slice(0, 10);
      };

      // 2. Resolve retailer name
      const finalName = await resolveRetailerName(domain, existing, scrapedData, html);
      const nameSource = existing?.name ? 'DB' : (scrapedData?.retailerName ? 'Scraped' : 'Input');
      configTrace.push(`Identity | Resolved Name: ${finalName || 'Unknown'} (Source: ${nameSource})`);

      const finalUpsertData = {
        ...existing,
        domain,
        name: finalName,
        price_selectors: sortAndCapSelectorArray(priceSelectors),
        deal_price_selectors: sortAndCapSelectorArray(dealPriceSelectors),
        member_price_selectors: sortAndCapSelectorArray(memberPriceSelectors),
        pre_order_price_selectors: sortAndCapSelectorArray(preOrderPriceSelectors),
        original_price_selectors: sortAndCapSelectorArray(originalPriceSelectors),
        active: true,
        selector_metadata: metadata,
        description: getRetailerDescription(existing, source === 'manual-add' ? 'scan' : (source === 'manual-confirm' ? 're-scan' : source))
      };

      await retailerRepository.upsert(finalUpsertData, client);
      
      if (ownClient) {
        await client.query('COMMIT');
      }
      
      logger.info(`Retailer | Config | Auto-Updated for ${domain} (${source})`, 'Products', {
        product_id: productId,
        trace: configTrace,
        selectors_added: winningSelector ? [winningSelector] : []
      });

      if (ownClient) {
        configCache.invalidate(domain);
      }
    } catch (err) {
      if (ownClient) {
        await client.query('ROLLBACK');
      }
      throw err;
    } finally {
      if (ownClient) {
        client.release();
      }
    }
  } catch (err) {
    logger.error(`Retailer | Config Auto-Update Failed | Product: ${productId}: ${err}`, 'Products');
  }
}
