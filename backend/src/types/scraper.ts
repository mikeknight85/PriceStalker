import { ParsedPrice } from '../utils/scraping/priceParser';

export type StockStatus = 'in_stock' | 'out_of_stock' | 'pre_order' | 'not_available' | 'member_only' | 'unknown';
export type AIStatus = 'verified' | 'corrected' | 'confirmed' | null;

export interface ExtractionCandidate {
  value?: string | number | null;
  method: string;
  selector?: string;
  context?: string;
  confidence: number;
}

export interface PriceCandidate extends ExtractionCandidate {
  price: number;
  currency: string;
}

export interface ScrapedProduct {
  name: string | null;
  retailerName?: string | null;
  price: ParsedPrice | null;
  memberPrice?: ParsedPrice | null;
  originalPrice?: ParsedPrice | null;
  imageUrl: string | null;
  url: string;
  stockStatus: StockStatus;
  aiStatus: AIStatus;
  html?: string;
}

export type ReviewReason = 'no_consensus' | 'ai_correction' | 'oos_guardrail' | 'manual_rescan' | 'first_scan';

export interface ScrapedProductWithVoting extends ScrapedProduct {
  priceCandidates: PriceCandidate[];
  nameCandidates?: ExtractionCandidate[];
  imageCandidates?: ExtractionCandidate[];
  retailerNameCandidates?: ExtractionCandidate[];
  stockCandidates?: ExtractionCandidate[];
  extractionSteps?: string[];
  needsReview: boolean;
  selectedMethod?: string;
  reviewReason?: ReviewReason;
}

export type ExtractionMethod = 'json-ld' | 'site-specific' | 'generic-css' | 'custom-css' | 'custom-regex' | 'ai' | 'generic' | 'deal-price' | 'member-price' | 'pre-order-price' | 'original-price';
