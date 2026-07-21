import { PriceCandidate } from '../../../types/scraper';

/**
 * Checks if two prices are approximately equal (within 5% tolerance).
 */
export function pricesMatch(p1: number, p2: number) { 
  if (p1 === p2) return true;
  return Math.abs(p1 - p2) / ((p1 + p2) / 2) < 0.05; 
}

/**
 * Groups price candidates by approximate value.
 */
export function groupPriceCandidates(candidates: PriceCandidate[]): PriceCandidate[][] {
  const groups: PriceCandidate[][] = [];
  for (const c of candidates) {
    let found = false;
    for (const g of groups) {
      if (pricesMatch(c.price, g[0].price)) {
        g.push(c);
        found = true;
        break;
      }
    }
    if (!found) groups.push([c]);
  }
  return groups;
}
