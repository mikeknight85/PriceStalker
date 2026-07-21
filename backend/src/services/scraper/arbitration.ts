import { PriceCandidate } from '../../types/scraper';
import { tryAIArbitration, tryAIExtraction } from '../ai';

export async function performArbitration(
  allCandidates: PriceCandidate[],
  url: string,
  html: string,
  userId: number | undefined,
  productId: number | undefined,
  finalSkipAiExtraction: boolean,
  anchorPrice: number | undefined,
  extractionSteps: string[]
) {
  let aiSuccess = false;
  let price: { price: number; currency: string } | undefined;
  let selectedMethod: string | undefined;
  let aiStatus: 'verified' | 'confirmed' | null = null;
  let needsReview = false;
  let reviewReason: 'no_consensus' | 'ai_correction' | 'oos_guardrail' | 'manual_rescan' | 'first_scan' | undefined;
  let name: string | null = null;
  let imageUrl: string | null = null;

  const standardCandidates = allCandidates.filter(c => c.method !== 'member-price' && c.method !== 'original-price');

  if (allCandidates.length > 0 && userId && html && !finalSkipAiExtraction) {
    extractionSteps.push(`Consensus | Fail | No majority. Triggering arbitration.`);
    try {
      const aiResult = await tryAIArbitration(url, html, allCandidates, userId, productId);
      if (aiResult?.selectedPrice) {
        extractionSteps.push(`Consensus | AI | Arbitration selected ${aiResult.selectedPrice.price} via ${aiResult.selectedPrice.method}`);
        price = aiResult.selectedPrice;
        selectedMethod = aiResult.selectedPrice.method;
        aiStatus = 'verified';
        aiSuccess = true;
      } else {
        extractionSteps.push(`Consensus | AI | Arbitration failed to decide.`);
      }
    } catch (e) {
      extractionSteps.push(`Consensus | AI | Arbitration error: ${e}`);
    }
  }

  // If AI arbitration is disabled or failed, fall back to anchor price (if set)
  if (!aiSuccess) {
    if (anchorPrice && standardCandidates.length > 0) {
      const best = standardCandidates.reduce((p, c) => Math.abs(c.price - anchorPrice) < Math.abs(p.price - anchorPrice) ? c : p);
      extractionSteps.push(`Consensus | Anchor Price | Fallback match to Anchor Price (${anchorPrice} ${best.currency}) via ${best.method}`);
      price = { price: best.price, currency: best.currency };
      selectedMethod = best.method;
      aiStatus = 'confirmed';
    } else if (allCandidates.length > 0) {
      // No anchor price. Pick the best standard candidate if available, otherwise any candidate and mark for review
      const candidatesToSelect = standardCandidates.length > 0 ? standardCandidates : allCandidates;
      const best = [...candidatesToSelect].sort((a, b) => {
        if (Math.abs(a.confidence - b.confidence) > 0.001) {
          return b.confidence - a.confidence;
        }
        return a.price - b.price;
      })[0];
      price = { price: best.price, currency: best.currency };
      selectedMethod = best.method;
      needsReview = true;
      reviewReason = 'no_consensus';
      extractionSteps.push(`Consensus | Fail | No consensus, no AI, no anchor. Selected highest confidence candidate: ${best.price} via ${best.method}`);
    } else if (userId && html && !finalSkipAiExtraction) {
      // Try raw AI extraction if no candidates exist at all
      extractionSteps.push(`Consensus | AI | No candidates. Trying raw AI extraction.`);
      try {
        const aiResult = await tryAIExtraction(url, html, userId, productId);
        if (aiResult?.price && aiResult.confidence > 0.5) {
          extractionSteps.push(`Consensus | AI | Found ${aiResult.price.price}`);
          price = aiResult.price;
          selectedMethod = 'ai';
          needsReview = true;
          reviewReason = 'no_consensus';
          if (!name) name = aiResult.name || null;
          if (!imageUrl) imageUrl = aiResult.imageUrl || null;
        } else {
          extractionSteps.push(`Consensus | AI | Extraction failed or low confidence.`);
        }
      } catch (e) {
        extractionSteps.push(`Consensus | AI | Extraction error.`);
      }
    }
  }

  return { price, selectedMethod, aiStatus, needsReview, reviewReason, name, imageUrl };
}
