import { ScrapedProductWithVoting } from '../../../types/scraper';
import { findPriceConsensus } from '../extractors/prices';
import { performArbitration } from '../arbitration';

export interface ConsensusOptions {
  url: string;
  html: string;
  userId?: number;
  productId?: number;
  finalSkipAiExtraction: boolean;
  anchorPrice?: number;
  extractionSteps: string[];
}

export async function runConsensusPhase(
  options: ConsensusOptions,
  result: ScrapedProductWithVoting
): Promise<void> {
  const { url, html, userId, productId, finalSkipAiExtraction, anchorPrice, extractionSteps } = options;
  const allCandidates = result.priceCandidates || [];

  // Consensus & Arbitration
  const { price: consensus, memberPrice, originalPrice, hasConsensus, winningGroupSources } = findPriceConsensus(allCandidates);
  
  if (memberPrice) {
    result.memberPrice = { price: memberPrice.price, currency: memberPrice.currency };
    extractionSteps.push(`Consensus | Member | Found: ${memberPrice.price} via ${memberPrice.method}`);
  }

  if (originalPrice) {
    result.originalPrice = { price: originalPrice.price, currency: originalPrice.currency };
    extractionSteps.push(`Consensus | Original | Found: ${originalPrice.price} via ${originalPrice.method}`);
  }

  if (hasConsensus && consensus) {
    const selectorInfo = consensus.selector ? ` (${consensus.selector})` : '';
    extractionSteps.push(`Consensus | Win | ${consensus.price} via ${consensus.method}${selectorInfo}`);
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
      const isCorroborated = !winningGroupSources || winningGroupSources.size > 1;
      
      const isJsonLdWithoutCorroboration = method === 'json-ld' && !isCorroborated;
      const isExtremeDrift = anchorPrice && resolvedPrice < (anchorPrice * 0.5);
      
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
