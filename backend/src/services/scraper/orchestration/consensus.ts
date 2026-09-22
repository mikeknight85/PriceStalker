import { ScrapedProductWithVoting } from '../../../types/scraper';
import { findPriceConsensus } from '../extractors/prices';
import { selectPreferredCandidate } from '../arbitrators/preference';
import { pricesMatch } from '../arbitrators/utils';
import { performArbitration } from '../arbitration';

export interface ConsensusOptions {
  url: string;
  html: string;
  userId?: number;
  productId?: number;
  finalSkipAiExtraction: boolean;
  anchorPrice?: number;
  /**
   * `products.preferred_extraction_method`: the method behind the candidate the
   * user picked in Troubleshoot Price. Typed as a plain string because the
   * column also holds values that are not `ExtractionMethod`s -- `manual` for a
   * hand-typed price, for one -- and those simply match no candidate and fall
   * through, which is the right answer for them.
   */
  preferredMethod?: string | null;
  extractionSteps: string[];
}

export async function runConsensusPhase(
  options: ConsensusOptions,
  result: ScrapedProductWithVoting
): Promise<void> {
  const { url, html, userId, productId, finalSkipAiExtraction, anchorPrice, preferredMethod, extractionSteps } = options;
  const allCandidates = result.priceCandidates || [];

  // Consensus & Arbitration
  //
  // findPriceConsensus runs unchanged and always: it resolves the member and
  // original prices too, and its answer is what a saved preference has to beat
  // -- and what the engine falls back to when there is no preference, or the
  // preferred method found nothing this time.
  const consensusResult = findPriceConsensus(allCandidates);
  const { price: consensus, memberPrice, originalPrice, hasConsensus } = consensusResult;
  let winningGroupSources = consensusResult.winningGroupSources;

  if (memberPrice) {
    result.memberPrice = { price: memberPrice.price, currency: memberPrice.currency };
    extractionSteps.push(`Consensus | Member | Found: ${memberPrice.price} via ${memberPrice.method}`);
  }

  if (originalPrice) {
    result.originalPrice = { price: originalPrice.price, currency: originalPrice.currency };
    extractionSteps.push(`Consensus | Original | Found: ${originalPrice.price} via ${originalPrice.method}`);
  }

  // The user's saved Troubleshoot Price choice (issue #159).
  //
  // `products.preferred_extraction_method` was written on every confirmation
  // and read by ProductRefreshService, which passed it all the way down here --
  // where nothing looked at it. A correction therefore survived exactly one
  // scrape: the next refresh re-derived the winner from scratch and picked the
  // same wrong candidate again, which is what "Refresh Price shows the wrong
  // price again" describes.
  //
  // This is the seam because it is the last point at which the standard price
  // is still undecided but every candidate is already in hand. Putting it
  // inside findPriceConsensus would have meant threading product state into a
  // pure arbitration function and reordering its priority paths; putting it in
  // extraction would have meant a preference could not express "the JSON-LD
  // one, not the deal one" at all.
  const preference = selectPreferredCandidate(allCandidates, preferredMethod);

  if (preference.status === 'secondary') {
    extractionSteps.push(
      `Consensus | Preference | Saved choice ${preference.method} is a member/original price type and cannot stand in as the standard price; ignoring`
    );
  } else if (preference.status === 'unmatched') {
    extractionSteps.push(
      `Consensus | Preference | Saved choice ${preference.method} matched no candidate this scrape; falling back to normal arbitration`
    );
  }

  if (preference.status === 'applied') {
    const chosen = preference.selection.candidate;
    const selectorInfo = chosen.selector ? ` (${chosen.selector})` : '';
    extractionSteps.push(
      `Consensus | Preference | Saved choice honoured: ${chosen.price} via ${preference.method}${selectorInfo}` +
      ` (${preference.selection.groupSize}/${preference.selection.totalMatches} candidates of that method agreed)`
    );

    if (consensus && !pricesMatch(consensus.price, chosen.price)) {
      extractionSteps.push(
        `Consensus | Preference | Overrides ${consensus.price} via ${consensus.method}, which would otherwise have ` +
        (hasConsensus ? 'won consensus' : 'gone to arbitration')
      );
    }

    result.price = { price: chosen.price, currency: chosen.currency };
    result.selectedMethod = chosen.method;

    // The guardrails below judge corroboration from the sources behind the
    // price that actually won. Leaving the consensus group's sources in place
    // would have them grade a different candidate's evidence.
    winningGroupSources = preference.selection.sources;
  } else if (hasConsensus && consensus) {
    const selectorInfo = consensus.selector ? ` (${consensus.selector})` : '';
    extractionSteps.push(`Consensus | Win | ${consensus.price} via ${consensus.method}${selectorInfo}`);

    // Say when a deal or pre-order price won by rule rather than by weight
    // (issue #159).
    //
    // findPriceConsensus gives those methods strict priority: one deal-price
    // candidate beats any number of standard ones, whatever their confidence
    // and wherever their selector came from. That is deliberate -- a deal price
    // is what you would actually pay -- but it is invisible. A user whose
    // retailer rule found the right standard price saw a different figure win
    // and had nothing in the trace to explain it, which reads as the retailer
    // rules being ignored.
    const strictPriority = consensus.method === 'deal-price' || consensus.method === 'pre-order-price';
    if (strictPriority) {
      const beaten = allCandidates.filter(c =>
        c.method !== consensus.method &&
        c.method !== 'member-price' &&
        c.method !== 'original-price'
      );
      if (beaten.length > 0) {
        const others = [...new Set(beaten.map(c => `${c.method} ${c.price}`))].slice(0, 4).join(', ');
        extractionSteps.push(
          `Consensus | Priority | ${consensus.method} takes precedence over standard prices by rule, not by score. Also found: ${others}`
        );
      }
    }
    result.price = { price: consensus.price, currency: consensus.currency };
    result.selectedMethod = consensus.method;
  } else {
    const arbResult = await performArbitration(
      allCandidates,
      url,
      html,
      userId,
      productId,
      finalSkipAiExtraction,
      anchorPrice,
      extractionSteps
    );
    
    if (arbResult.price) result.price = arbResult.price;
    if (arbResult.selectedMethod) result.selectedMethod = arbResult.selectedMethod;
    if (arbResult.aiStatus) result.aiStatus = arbResult.aiStatus;
    if (arbResult.needsReview) result.needsReview = arbResult.needsReview;
    if (arbResult.reviewReason) result.reviewReason = arbResult.reviewReason;
    if (arbResult.name && !result.name) result.name = arbResult.name;
    if (arbResult.imageUrl && !result.imageUrl) result.imageUrl = arbResult.imageUrl;
  }

  // A winning price without a resolved currency cannot be persisted, so flag
  // it for manual confirmation on both the add and refresh paths.
  if (result.price && !result.price.currency) {
    result.needsReview = true;
    result.reviewReason = result.reviewReason || 'missing_currency';
    extractionSteps.push('Consensus | Review | Winning price has no resolved currency');
  }

  // RRP sanity guardrail: original-price candidates come partly from generic
  // strikethrough/"was"-style selectors, which can match unrelated numbers
  // (financing text, bundle offers, related-product cards). A real RRP is
  // never below the resolved standard price and not absurdly above it — drop
  // anything else so it cannot pollute the original-price history (issue #55).
  if (result.price?.price && result.originalPrice?.price) {
    const standard = result.price.price;
    const original = result.originalPrice.price;
    if (original < standard || original > standard * 10) {
      extractionSteps.push(`Consensus | Guardrail | Discarded implausible original price ${original} (standard ${standard})`);
      result.originalPrice = null;
    }
  }

  // Out of Stock (OOS) price guardrails
  if (result.stockStatus === 'out_of_stock' || result.stockStatus === 'not_available') {
    if (result.price) {
      const resolvedPrice = result.price.price;
      const method = result.selectedMethod || '';
      
      const highConfidenceMethods = [
        'deal-price',
        'member-price',
        'pre-order-price',
        'json-ld',
        'custom-css',
        'custom-regex',
        'expert-ai',
        'ai-extraction',
        'manual-selector',
        'ai'
      ];
      
      const isHighConfidence = highConfidenceMethods.includes(method) || method.startsWith('expert-');
      // Absent sources means we do not know it was corroborated, not that it
      // was (issue #167). The old `!winningGroupSources ||` read a missing set
      // as proof of corroboration, so an uncorroborated json-ld price walked
      // straight through the guardrail this block exists to apply.
      const isCorroborated = !!winningGroupSources && winningGroupSources.size > 1;

      const isJsonLdWithoutCorroboration = method === 'json-ld' && !isCorroborated;

      // Drift in both directions. Only the downward half was checked, so a
      // price that spiked -- a currency mix-up, a wrong element, a bundle price
      // where the unit price belonged -- passed unchallenged while the same
      // magnitude of error downward was caught.
      const isExtremeDrift = !!anchorPrice &&
        (resolvedPrice < anchorPrice * 0.5 || resolvedPrice > anchorPrice * 2.5);
      
      if (!isHighConfidence || isJsonLdWithoutCorroboration || isExtremeDrift) {
        let reason = '';
        if (!isHighConfidence) reason = `low confidence method (${method})`;
        else if (isJsonLdWithoutCorroboration) reason = 'uncorroborated json-ld';
        else if (isExtremeDrift) reason = `extreme drift (price ${resolvedPrice} vs anchor ${anchorPrice})`;
        
        extractionSteps.push(`Consensus | Guardrail | Price nullified due to ${reason}`);
        result.price = null;
        if (allCandidates.length > 0) {
          result.needsReview = true;
          result.reviewReason = 'oos_guardrail';
        }
      } else {
        extractionSteps.push(`Consensus | Guardrail | Retaining price ${resolvedPrice} via high confidence method (${method}) during OOS`);
      }
    } else {
      if (allCandidates.length > 0) {
        result.needsReview = true;
        result.reviewReason = 'oos_guardrail';
      }
    }
  }
}
