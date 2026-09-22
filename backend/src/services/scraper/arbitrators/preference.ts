import { PriceCandidate } from '../../../types/scraper';
import { groupPriceCandidates, withGroupCurrency } from './utils';

/**
 * The saved extraction preference (issue #159, second symptom).
 *
 * When a user opens Troubleshoot Price and picks the right candidate,
 * `products.preferred_extraction_method` records the method that produced it.
 * That column was written and then never read by the engine, so the next
 * refresh re-ran arbitration from scratch and happily selected the same wrong
 * figure again -- the user's correction lasted exactly one scrape.
 *
 * This module answers one question: given this scrape's candidates and the
 * saved method, which candidate did the user mean?
 *
 * It is deliberately a *preference*, not a pin:
 *
 * - It only ever selects from candidates found on *this* scrape. If the
 *   preferred method yields nothing -- the deal ended, the element moved, the
 *   retailer config changed -- the caller falls back to normal arbitration
 *   rather than leaving the product priceless.
 * - It selects; it does not validate. The out-of-stock guardrails in
 *   `runConsensusPhase` still run afterwards on whatever it picks, so a
 *   preference for a low-confidence method cannot smuggle a stale price past
 *   them.
 * - It runs *after* extraction, so the retailer-rules-over-global-defaults
 *   cascade (issue #159, first symptom) has already decided which selectors
 *   were allowed to produce candidates. The preference chooses among what that
 *   cascade produced; it cannot resurrect a selector the cascade excluded.
 */

/**
 * Price types that are not what a shopper pays today. `findPriceConsensus`
 * filters these out of the standard-price pool, and AI arbitration was made to
 * honour that filter too (issue #167), because a members-only price standing in
 * as the product's price is the single worst answer the pipeline can give.
 *
 * The voting modal does let a user pick one of these -- they appear as their
 * own tabs -- so the column can legitimately hold one. Honouring it here would
 * quietly reintroduce exactly the bug #167 closed, so a preference for one is
 * reported and ignored.
 */
const SECONDARY_METHODS: readonly string[] = ['member-price', 'original-price'];

export interface PreferredSelection {
  /** The candidate to use as the standard price. */
  candidate: PriceCandidate;
  /** `method:selector` keys of the winning group, for the OOS guardrails. */
  sources: Set<string>;
  /** How many candidates agreed on the winning price. */
  groupSize: number;
  /** How many candidates carried the preferred method at all. */
  totalMatches: number;
}

export type PreferenceOutcome =
  /** No preference stored: the caller must behave exactly as it did before. */
  | { status: 'none' }
  /** A preference is stored but names a member/original price type. */
  | { status: 'secondary'; method: string }
  /** A preference is stored but produced no candidate on this scrape. */
  | { status: 'unmatched'; method: string }
  /** A preference is stored and this scrape can honour it. */
  | { status: 'applied'; method: string; selection: PreferredSelection };

/**
 * Picks the candidate the saved preference points at, or explains why it could
 * not. Never throws and never invents a candidate.
 *
 * The preference is a *method*, not a selector, because that is what the voting
 * modal reports and what the column stores. Several candidates can therefore
 * carry it, so the winner is chosen the same way the deal-price and
 * pre-order-price priority paths choose theirs: group by approximate price,
 * take the largest group. On a tie the first group wins, matching those paths.
 */
export function selectPreferredCandidate(
  candidates: PriceCandidate[],
  preferredMethod: string | null | undefined
): PreferenceOutcome {
  const method = (preferredMethod || '').trim();
  if (!method) return { status: 'none' };
  if (SECONDARY_METHODS.includes(method)) return { status: 'secondary', method };

  const matching = candidates.filter(c => c.method === method && Number.isFinite(c.price));
  if (matching.length === 0) return { status: 'unmatched', method };

  const groups = groupPriceCandidates(matching);
  groups.sort((a, b) => b.length - a.length);
  const winner = groups[0];

  return {
    status: 'applied',
    method,
    selection: {
      candidate: withGroupCurrency(winner),
      sources: new Set(winner.map(c => `${c.method}:${c.selector || ''}`)),
      groupSize: winner.length,
      totalMatches: matching.length
    }
  };
}
