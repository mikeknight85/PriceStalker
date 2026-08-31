import { ParsedPrice } from '../utils/scraping/priceParser';
import type { UnavailableReason } from './availability';

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

/**
 * Why a scrape produced no usable price. The log already knew this; the caller
 * did not, so an add failed with a flat "Could not extract price" no matter
 * whether the retailer served a CAPTCHA, the page was gone, or auto-mapping
 * rejected the config it generated.
 */
export type ScrapeFailureReason =
  | 'bot_challenge'
  | 'page_unavailable'
  | 'auto_map_rejected'
  | 'no_price_found';

export type ReviewReason = 'no_consensus' | 'ai_correction' | 'oos_guardrail' | 'manual_rescan' | 'first_scan' | 'missing_currency';

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
  // Flags learned during acquisition (e.g. the page only rendered via the
  // browser scraper), persisted to the retailer config on save.
  learnedFlags?: { use_browser_scraper?: boolean };
  /** Set only when the scrape produced no usable price. */
  failureReason?: ScrapeFailureReason;
  /** Free-text detail for the reason, e.g. which challenge was detected. */
  failureDetail?: string;
  /**
   * Why the page could not be read, when it could not be. Distinguishes a page
   * that is genuinely gone from one we merely failed to fetch -- the two get
   * opposite treatment during a refresh.
   */
  unavailableReason?: UnavailableReason;
}

export type ExtractionMethod = 'json-ld' | 'site-specific' | 'generic-css' | 'custom-css' | 'custom-regex' | 'ai' | 'generic' | 'deal-price' | 'member-price' | 'pre-order-price' | 'original-price';
