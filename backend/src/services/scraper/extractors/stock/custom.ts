import { CheerioAPI } from 'cheerio';
import { StockStatus } from '../../../../types/scraper';
import { RetailerConfig } from '../../../../models';
import { parseSelector } from '../metadata';
import { evaluateSelector } from '../../core/engine';
import { logger } from '../../../../utils/system/logger';

import type { StockCandidate } from './index';

/**
 * Extracts stock status using site-specific custom selectors.
 */
export function checkCustomStockSelectors(
  $: CheerioAPI, 
  domainConfig: Partial<RetailerConfig>,
  phrases?: { pre: string[], oos: string[], is: string[] },
  isGlobal = false,
  html: string = ''
): StockCandidate[] {
  const candidates: StockCandidate[] = [];
  if (!domainConfig.stock_selectors || domainConfig.stock_selectors.length === 0) {
    return candidates;
  }
  
  const prePhrases = (domainConfig.pre_order_phrases?.length ? domainConfig.pre_order_phrases : phrases?.pre) || [];
  const oosPhrases = (domainConfig.out_of_stock_phrases?.length ? domainConfig.out_of_stock_phrases : phrases?.oos) || [];
  const isPhrases = (domainConfig.in_stock_phrases?.length ? domainConfig.in_stock_phrases : phrases?.is) || [];
  const memberPhrases = (domainConfig.member_only_phrases?.length ? domainConfig.member_only_phrases : []) || [];
  const methodLabel = isGlobal ? 'global-selector' : 'site-specific';
  const confidence = isGlobal ? 0.85 : 0.95;

  for (const s of domainConfig.stock_selectors) {
    try {
      const results = evaluateSelector($, html, s);
      
      for (const res of results) {
        if (!res.value) continue;
        const text = res.value;
        const lowerText = text.trim().toLowerCase();

        if (res.status) {
          candidates.push({
            value: res.status as StockStatus,
            method: methodLabel,
            selector: s,
            context: text.trim(),
            confidence
          });
          continue;
        }

        if (lowerText) {
          let matchedStatus: StockStatus | null = null;
          if (memberPhrases.some((p: string) => lowerText.includes(p.toLowerCase()))) {
            matchedStatus = 'member_only';
          } else if (prePhrases.some((p: string) => lowerText.includes(p.toLowerCase()))) {
            matchedStatus = 'pre_order';
          } else if (oosPhrases.some((p: string) => lowerText.includes(p.toLowerCase()))) {
            matchedStatus = 'out_of_stock';
          } else if (isPhrases.some((p: string) => lowerText.includes(p.toLowerCase()))) {
            matchedStatus = 'in_stock';
          }

          if (matchedStatus) {
            candidates.push({
              value: matchedStatus,
              method: methodLabel,
              selector: s,
              context: text.trim(),
              confidence
            });
          } else {
            // Not pushed as a candidate (issue #167).
            //
            // The resolver already skips `unknown` when picking a winner, so
            // these never decided anything -- they only padded the candidate
            // list surfaced in the debug view, where they outnumbered the
            // useful entries.
            //
            // Logged instead, because the information is worth having: a
            // selector that matched text nobody recognises usually means the
            // retailer's phrasing has changed and the phrase lists need a new
            // entry.
            logger.debug(
              `Extract | Stock | Selector matched unrecognised text: ${s} -> "${text.trim().slice(0, 80)}"`,
              'Scraper'
            );
          }
        }
      }
    } catch (e) {
      // A broken selector should not take the scrape down, but it should not
      // vanish either: silently swallowing this is why a malformed custom rule
      // looked like a retailer that simply had no stock information.
      logger.debug(`Extract | Stock | Selector failed: ${s} (${(e as Error)?.message ?? e})`, 'Scraper');
    }
  }

  return candidates;
}
