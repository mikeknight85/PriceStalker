import { describe, it, expect, vi, beforeEach } from 'vitest';
import { productDiscoveryService } from '../../src/services/domain/product/add/discovery';
import { productConfirmationService } from '../../src/services/domain/product/add/confirmation';
import { productRepository } from '../../src/models';
import { productPersistenceService } from '../../src/services/domain/product/ProductPersistenceService';
import { scrapeProductWithVoting } from '../../src/services/scraper';
import { assertUrlIsSafe } from '../../src/utils/system/url-safety';

vi.mock('../../src/models', () => ({
  productRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    bulkSetCheckingPaused: vi.fn(),
  },
}));

vi.mock('../../src/services/domain/product/ProductPersistenceService', () => ({
  productPersistenceService: {
    saveScrapeResult: vi.fn(),
  },
}));

vi.mock('../../src/services/scraper', () => ({
  scrapeProductWithVoting: vi.fn(),
}));

vi.mock('../../src/utils/system/url-safety', () => ({
  assertUrlIsSafe: vi.fn().mockResolvedValue(undefined),
}));

describe('ProductDiscoveryService & ProductConfirmationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ProductDiscoveryService.initiateProductDiscovery', () => {
    it('throws descriptive error on bot_challenge with browser scraper', async () => {
      vi.mocked(scrapeProductWithVoting).mockResolvedValueOnce({
        failureReason: 'bot_challenge',
        failureDetail: 'Cloudflare Turnstile',
        learnedFlags: { use_browser_scraper: true },
        price: null,
        stockStatus: 'unknown',
      } as any);

      await expect(
        productDiscoveryService.initiateProductDiscovery(1, 'https://protected.test/item', null)
      ).rejects.toThrow(
        /The retailer blocked the request \(Cloudflare Turnstile\)\. The Browser Scraper was used/
      );
      expect(assertUrlIsSafe).toHaveBeenCalledWith('https://protected.test/item', { policy: 'allow-private-lan' });
    });

    it('throws descriptive error on page_unavailable', async () => {
      vi.mocked(scrapeProductWithVoting).mockResolvedValueOnce({
        failureReason: 'page_unavailable',
        price: null,
        stockStatus: 'unknown',
      } as any);

      await expect(
        productDiscoveryService.initiateProductDiscovery(1, 'https://store.test/404', null)
      ).rejects.toThrow(/The product page could not be found/);
    });

    it('auto-tracks product when consensus is clear and currency is present', async () => {
      vi.mocked(scrapeProductWithVoting).mockResolvedValueOnce({
        needsReview: false,
        price: { price: 49.99, currency: 'USD' },
        stockStatus: 'in_stock',
        name: 'Super Gadget',
        imageUrl: 'https://store.test/img.png',
        aiStatus: 'verified',
      } as any);

      vi.mocked(productRepository.create).mockResolvedValueOnce({ id: 10 } as any);
      vi.mocked(productRepository.findById).mockResolvedValueOnce({
        id: 10,
        name: 'Super Gadget',
        current_price: 49.99,
      } as any);

      const result = await productDiscoveryService.initiateProductDiscovery(
        1,
        'https://store.test/gadget',
        'Tech',
        300
      );

      expect(result.needsReview).toBe(false);
      expect(result.id).toBe(10);
      expect(productRepository.create).toHaveBeenCalledWith(
        1,
        'https://store.test/gadget',
        'Super Gadget',
        'https://store.test/img.png',
        300,
        'in_stock',
        'verified',
        'Tech'
      );
      expect(productPersistenceService.saveScrapeResult).toHaveBeenCalledWith(
        10,
        1,
        expect.any(Object),
        'manual-add'
      );
    });

    it('requires review when price has no currency or needsReview is true', async () => {
      vi.mocked(scrapeProductWithVoting).mockResolvedValueOnce({
        needsReview: true,
        reviewReason: 'no_consensus',
        price: { price: 19.99, currency: null },
        stockStatus: 'in_stock',
        name: 'Ambiguous Item',
        imageUrl: null,
        priceCandidates: [
          { price: 19.99, currency: 'USD', method: 'schema-org', context: 'Standard', confidence: 0.8 },
        ],
        memberPrice: { price: 15.99, currency: 'USD' },
        originalPrice: { price: 29.99, currency: 'USD' },
        html: '<html>...</html>',
      } as any);

      const result = await productDiscoveryService.initiateProductDiscovery(
        1,
        'https://store.test/ambiguous',
        'Deals'
      );

      expect(result.needsReview).toBe(true);
      expect(result.reviewReason).toBe('no_consensus');
      expect(result.priceCandidates).toHaveLength(3); // standard + member + original
      expect(result.priceCandidates[1].method).toBe('member-price');
      expect(result.priceCandidates[2].method).toBe('original-price');
    });
  });

  describe('ProductConfirmationService', () => {
    describe('confirmNewProduct', () => {
      it('throws 400 when price or currency is missing', async () => {
        await expect(
          productConfirmationService.confirmNewProduct(1, 'https://store.test/item', {
            selectedPrice: null,
            selectedCurrency: 'USD',
          })
        ).rejects.toThrow('A price and currency are required to confirm a product');

        await expect(
          productConfirmationService.confirmNewProduct(1, 'https://store.test/item', {
            selectedPrice: 20,
            selectedCurrency: '',
          })
        ).rejects.toThrow('A price and currency are required to confirm a product');
      });

      it('creates and confirms product successfully', async () => {
        vi.mocked(productRepository.create).mockResolvedValueOnce({ id: 25 } as any);
        vi.mocked(productRepository.findById).mockResolvedValueOnce({
          id: 25,
          name: 'Confirmed Item',
          current_price: 35.5,
        } as any);

        const result = await productConfirmationService.confirmNewProduct(
          1,
          'https://store.test/item',
          {
            selectedPrice: 35.5,
            selectedCurrency: 'EUR',
            name: 'Confirmed Item',
            stockStatus: 'in_stock',
            category: 'Books',
          }
        );

        expect(result?.id).toBe(25);
        expect(productRepository.create).toHaveBeenCalledWith(
          1,
          'https://store.test/item',
          'Confirmed Item',
          null,
          expect.any(Number),
          'in_stock',
          'confirmed',
          'Books'
        );
        expect(productPersistenceService.saveScrapeResult).toHaveBeenCalledWith(
          25,
          1,
          expect.objectContaining({
            price: { price: 35.5, currency: 'EUR' },
          }),
          'manual-add',
          undefined
        );
      });
    });

    describe('confirmProductSelection', () => {
      it('throws 404 when product is not found', async () => {
        vi.mocked(productRepository.findById).mockResolvedValueOnce(null);

        await expect(
          productConfirmationService.confirmProductSelection(1, 999, { selectedPrice: 10, selectedCurrency: 'USD' })
        ).rejects.toThrow('Product not found');
      });

      it('throws 400 when price is provided without currency', async () => {
        vi.mocked(productRepository.findById).mockResolvedValueOnce({ id: 5 } as any);

        await expect(
          productConfirmationService.confirmProductSelection(1, 5, { selectedPrice: 10, selectedCurrency: '' })
        ).rejects.toThrow('A currency is required when confirming a price');
      });

      it('confirms selection, unpauses checking if paused, and updates review status', async () => {
        vi.mocked(productRepository.findById)
          .mockResolvedValueOnce({ id: 5, checking_paused: true } as any) // initial check
          .mockResolvedValueOnce({ id: 5, checking_paused: false, current_price: 15 } as any); // after update

        const result = await productConfirmationService.confirmProductSelection(1, 5, {
          selectedPrice: 15,
          selectedCurrency: 'USD',
          selectedMethod: 'manual',
          selector: '.custom-price',
        });

        expect(result?.id).toBe(5);
        expect(productRepository.update).toHaveBeenCalledWith(5, 1, {
          needs_price_review: false,
          ai_status: 'confirmed',
        });
        expect(productRepository.bulkSetCheckingPaused).toHaveBeenCalledWith([5], 1, false);
      });
    });
  });
});
