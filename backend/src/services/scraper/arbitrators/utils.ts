import { PriceCandidate } from '../../../types/scraper';

/**
 * Whether two prices are close enough to be the same price.
 *
 * The tolerance exists to group one price scraped several ways -- 1099,
 * 1099.00, "1,099.00" -- and to absorb rounding, not to forgive genuinely
 * different figures.
 *
 * A bare 5% relative rule did the opposite as prices rose (issue #167):
 *
 *   1000 vs 1040   ->  matched, a 40.00 difference
 *   1000 vs 1051   ->  matched, a 51.00 difference
 *    850 vs 880    ->  matched, a 30.00 difference
 *
 * Those are separate prices by any reading, and merging them lets consensus
 * settle on one when it should be reporting disagreement.
 *
 * The relative rule is kept and capped in absolute terms. The cap is what fixes
 * the cases above; the floor keeps sub-cent rounding grouping on cheap items,
 * where the relative rule is already tight.
 *
 * The cap is 5.00 rather than the 1.00 the issue proposed. 1.00 also stops
 * `100 vs 104` matching, which existing consensus tests rely on and which is
 * ordinary mid-range grouping -- above about 20 the relative rule would never
 * apply again, making this an absolute-only comparison by the back door.
 * Splitting groups that belong together turns into "no consensus", which sends
 * scrapes to arbitration or manual review. 5.00 leaves every existing grouping
 * behaviour intact and still catches the merges that were plainly wrong.
 *
 * Deliberately not tightened at the low end either. `1.00 vs 1.04` also matches
 * under 5%, which the issue notes, but the harm is small and the fix is not.
 */
const MIN_ABSOLUTE_TOLERANCE = 0.02;
const MAX_ABSOLUTE_TOLERANCE = 5.00;

export function pricesMatch(p1: number, p2: number) {
  if (p1 === p2) return true;

  const average = (p1 + p2) / 2;
  const relative = Math.abs(average) * 0.05;
  const tolerance = Math.min(Math.max(relative, MIN_ABSOLUTE_TOLERANCE), MAX_ABSOLUTE_TOLERANCE);

  return Math.abs(p1 - p2) < tolerance;
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

/**
 * Returns the group's first candidate, backfilling its currency from another
 * group member when the first one could not resolve a currency. Candidates
 * group by price alone, so a currency-less candidate can otherwise win a group
 * whose other members positively identified the currency.
 *
 * Lives here rather than beside `findPriceConsensus` because every path that
 * picks a representative from a price group needs it -- the deal/pre-order
 * priority paths, the weighted fallback, and the saved-preference path.
 */
export function withGroupCurrency(group: PriceCandidate[]): PriceCandidate {
  const first = group[0];
  if (first.currency) return first;
  const donor = group.find(c => c.currency);
  return donor ? { ...first, currency: donor.currency } : first;
}
