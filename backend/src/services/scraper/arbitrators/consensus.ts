import { PriceCandidate } from '../../../types/scraper';
import { groupPriceCandidates, pricesMatch } from './utils';

/**
 * Arbitrates between multiple price candidates to find a consensus value.
 * Splits results into Primary (Normal) price, Member price, and Original price.
 */
export function findPriceConsensus(candidates: PriceCandidate[]) {
  if (candidates.length === 0) return { price: null, memberPrice: null, originalPrice: null, hasConsensus: false, winningGroupSources: new Set<string>() };
  
  // Separate Member and Original candidates from the rest
  const memberCandidates = candidates.filter(c => c.method === 'member-price');
  const originalCandidates = candidates.filter(c => c.method === 'original-price');
  const standardCandidates = candidates.filter(c => c.method !== 'member-price' && c.method !== 'original-price');

  // --- 1. Find Member Price Consensus ---
  let memberPrice: PriceCandidate | null = null;
  if (memberCandidates.length > 0) {
    const groups = groupPriceCandidates(memberCandidates);
    groups.sort((a, b) => b.length - a.length);
    memberPrice = groups[0][0];
  }

  // --- 2. Find Original Price Consensus ---
  let originalPrice: PriceCandidate | null = null;
  if (originalCandidates.length > 0) {
    const groups = groupPriceCandidates(originalCandidates);
    groups.sort((a, b) => b.length - a.length);
    originalPrice = groups[0][0];
  }

  // --- 3. Find Primary (Normal) Price Consensus ---
  if (standardCandidates.length === 0) {
    return { price: null, memberPrice, originalPrice, hasConsensus: false, winningGroupSources: new Set<string>() };
  }

  // 1. Strict Priority: Deal Prices (Public)
  const dealCandidates = standardCandidates.filter(c => c.method === 'deal-price');
  if (dealCandidates.length > 0) {
    const groups = groupPriceCandidates(dealCandidates);
    groups.sort((a, b) => b.length - a.length);
    const hasConsensus = !(groups.length > 1 && groups[0].length === groups[1].length);
    const winningGroupSources = new Set(groups[0].map(c => `${c.method}:${c.selector || ''}`));
    return { price: groups[0][0], memberPrice, originalPrice, hasConsensus, winningGroupSources };
  }

  // 2. Next Priority: Pre-order Prices (Public)
  const preOrderCandidates = standardCandidates.filter(c => c.method === 'pre-order-price');
  if (preOrderCandidates.length > 0) {
     const groups = groupPriceCandidates(preOrderCandidates);
     groups.sort((a, b) => b.length - a.length);
     const hasConsensus = !(groups.length > 1 && groups[0].length === groups[1].length);
     const winningGroupSources = new Set(groups[0].map(c => `${c.method}:${c.selector || ''}`));
     return { price: groups[0][0], memberPrice, originalPrice, hasConsensus, winningGroupSources };
  }

  // 3. Weighted Fallback (Custom CSS > JSON-LD > Generic)
  const groups: { candidates: PriceCandidate[], totalWeight: number, sources: Set<string> }[] = [];
  for (const c of standardCandidates) {
    let weight = 1.0;
    if (c.method.startsWith('expert-')) weight = 5.0; 
    else if (c.method === 'json-ld') weight = 2.0;
    else if (c.method === 'custom-regex') weight = 1.6;
    else if (c.method === 'custom-css') weight = 1.5;
    else if (c.method === 'generic-css') weight = 0.2; 

    const sourceKey = `${c.method}:${c.selector || ''}`;

    let found = false;
    for (const g of groups) {
      if (pricesMatch(c.price, g.candidates[0].price)) {
        g.candidates.push(c);
        if (!g.sources.has(sourceKey)) {
          g.totalWeight += weight;
          g.sources.add(sourceKey);
        }
        found = true;
        break;
      }
    }
    if (!found) {
      groups.push({ 
        candidates: [c], 
        totalWeight: weight, 
        sources: new Set([sourceKey]) 
      });
    }
  }

  if (groups.length === 0) return { price: null, memberPrice, originalPrice, hasConsensus: false, winningGroupSources: new Set<string>() };

  groups.sort((a, b) => b.totalWeight - a.totalWeight);
  const topGroup = groups[0];
  let hasConsensus = topGroup.totalWeight >= 1.0;

  // Tie detection: if the top two groups have equal weight, no majority consensus is possible
  if (groups.length > 1 && Math.abs(topGroup.totalWeight - groups[1].totalWeight) < 0.001) {
    hasConsensus = false;
  }

  return { 
    price: topGroup.candidates[0], 
    memberPrice,
    originalPrice,
    hasConsensus,
    winningGroupSources: topGroup.sources
  };
}
