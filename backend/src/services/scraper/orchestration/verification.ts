import { ScrapedProductWithVoting } from '../../../types/scraper';

export interface VerificationOptions {
  url: string;
  html: string;
  userId?: number;
  productId?: number;
  finalSkipAiVerification: boolean;
  extractionSteps: string[];
}

export async function runVerificationPhase(
  options: VerificationOptions,
  result: ScrapedProductWithVoting
): Promise<void> {
  const { url, html, userId, productId, finalSkipAiVerification, extractionSteps } = options;

  if (result.price && userId && html && !result.aiStatus && !finalSkipAiVerification) {
    try {
      const { tryAIVerification } = await import('../../ai');
      const v = await tryAIVerification(url, html, result.price.price, result.price.currency, userId, productId);
      if (v && v.isCorrect) {
        extractionSteps.push(`Verification | AI | Verified: Correct`);
        result.aiStatus = 'verified';
      } else if (v && v.suggestedPrice) {
        extractionSteps.push(`Verification | AI | Corrected: ${result.price.price} -> ${v.suggestedPrice.price}`);
        result.price = v.suggestedPrice;
        result.aiStatus = 'corrected';
        result.needsReview = true;
        result.reviewReason = 'ai_correction';
      }
    } catch (e) {
      extractionSteps.push(`Verification | AI | Error`);
    }
  }
}
