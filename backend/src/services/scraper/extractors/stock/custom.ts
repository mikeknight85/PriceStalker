import { CheerioAPI } from 'cheerio';
import { StockStatus } from '../../../../types/scraper';
import { RetailerConfig } from '../../../../models';
import { parseSelector } from '../metadata';
import { evaluateSelector } from '../../core/engine';

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
            candidates.push({
              value: 'unknown',
              method: methodLabel,
              selector: s,
              context: text.trim(),
              confidence: 0.10
            });
          }
        }
      }
    } catch (e) {}
  }

  return candidates;
}
