import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductAlertService } from '../../src/services/domain/product/notifications/alerts';
import { productNotificationOrchestrator } from '../../src/services/domain/product/notifications/orchestrator';
import * as storeContextModule from '../../src/services/domain/product/repositories/store-context';
import type { Product } from '../../src/models';
import type { ScrapedProductWithVoting } from '../../src/types/scraper';

vi.mock('../../src/services/domain/product/notifications/orchestrator', () => ({
  productNotificationOrchestrator: {
    deliver: vi.fn(),
  },
}));

vi.mock('../../src/services/domain/product/repositories/store-context', () => ({
  getStoreContext: vi.fn(),
  hostOf: vi.fn(),
}));

const mockDeliver = productNotificationOrchestrator.deliver as unknown as ReturnType<typeof vi.fn>;
const mockGetStoreContext = storeContextModule.getStoreContext as unknown as ReturnType<typeof vi.fn>;
const mockHostOf = storeContextModule.hostOf as unknown as ReturnType<typeof vi.fn>;

describe('ProductAlertService', () => {
  let service: ProductAlertService;

  const mockProduct: Product = {
    id: 101,
    name: 'Logitech MX Master 3S',
    url: 'https://shop.example.com/products/mx3s',
    user_id: 1,
    current_price: 99.99,
    target_price: 80.0,
    price_drop_threshold: 5.0,
    stock_status: 'in_stock',
    created_at: new Date(),
    updated_at: new Date(),
    item_id: 10,
  } as Product;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProductAlertService();
    // Default: single store context
    mockGetStoreContext.mockResolvedValue({ storeName: null, storeCount: 1 });
    mockHostOf.mockReturnValue('shop.example.com');
  });

  describe('storeToName noise suppression & resolution', () => {
    it('omits store name when item is tracked at fewer than 2 stores', async () => {
      mockGetStoreContext.mockResolvedValue({ storeName: 'Example Shop', storeCount: 1 });

      await service.notifyPriceAnnounced(mockProduct, { price: 89.99, currency: 'USD' });

      expect(mockDeliver).toHaveBeenCalledTimes(1);
      const [product, eventType, payload] = mockDeliver.mock.calls[0];
      expect(eventType).toBe('price_announced');
      expect(payload.storeName).toBeUndefined();
    });

    it('includes storeName when tracked at 2 or more stores and storeName exists', async () => {
      mockGetStoreContext.mockResolvedValue({ storeName: 'Galaxus', storeCount: 3 });

      await service.notifyPriceAnnounced(mockProduct, { price: 89.99, currency: 'USD' });

      expect(mockDeliver).toHaveBeenCalledTimes(1);
      const [, , payload] = mockDeliver.mock.calls[0];
      expect(payload.storeName).toBe('Galaxus');
    });

    it('falls back to URL host when tracked at 2 or more stores and storeName is null', async () => {
      mockGetStoreContext.mockResolvedValue({ storeName: null, storeCount: 2 });
      mockHostOf.mockReturnValue('shop.example.com');

      await service.notifyPriceAnnounced(mockProduct, { price: 89.99, currency: 'USD' });

      expect(mockDeliver).toHaveBeenCalledTimes(1);
      const [, , payload] = mockDeliver.mock.calls[0];
      expect(payload.storeName).toBe('shop.example.com');
    });
  });

  describe('notifyPriceDrop', () => {
    it('drops notification silently if price decrease is strictly less than threshold', async () => {
      // old: 100, new: 96, drop: 4. threshold is 5.
      await service.notifyPriceDrop(mockProduct, 100, { price: 96, currency: 'USD' });
      expect(mockDeliver).not.toHaveBeenCalled();
    });

    it('triggers delivery when price drop equals or exceeds threshold', async () => {
      // old: 100, new: 95, drop: 5. threshold is 5.
      await service.notifyPriceDrop(mockProduct, 100, { price: 95, currency: 'USD' });
      expect(mockDeliver).toHaveBeenCalledTimes(1);

      const [, eventType, payload, history] = mockDeliver.mock.calls[0];
      expect(eventType).toBe('price_drop');
      expect(payload.oldPrice).toBe(100);
      expect(payload.newPrice).toBe(95);
      expect(payload.threshold).toBe(5);
      expect(history.data.priceChangePercent).toBe(5); // ((100-95)/100)*100 = 5%
    });

    it('handles product with undefined or null threshold as 0', async () => {
      const productNoThreshold = { ...mockProduct, price_drop_threshold: undefined };
      // old: 100, new: 99.5, drop: 0.5 >= 0
      await service.notifyPriceDrop(productNoThreshold, 100, { price: 99.5, currency: 'EUR' });
      expect(mockDeliver).toHaveBeenCalledTimes(1);
    });
  });

  describe('notifyTargetHit', () => {
    it('does not notify if current price is above target price', async () => {
      // target: 80, current: 85
      await service.notifyTargetHit(mockProduct, 95, { price: 85, currency: 'USD' });
      expect(mockDeliver).not.toHaveBeenCalled();
    });

    it('does not notify if previous price was already at or below target price', async () => {
      // target: 80, old: 79, current: 75 -> already alerted previously
      await service.notifyTargetHit(mockProduct, 79, { price: 75, currency: 'USD' });
      expect(mockDeliver).not.toHaveBeenCalled();

      // target: 80, old: 80, current: 80 -> already alerted previously
      await service.notifyTargetHit(mockProduct, 80, { price: 80, currency: 'USD' });
      expect(mockDeliver).not.toHaveBeenCalled();
    });

    it('delivers notification when price drops to target from above target', async () => {
      // target: 80, old: 89, current: 80
      await service.notifyTargetHit(mockProduct, 89, { price: 80, currency: 'USD' });
      expect(mockDeliver).toHaveBeenCalledTimes(1);

      const [, eventType, payload, history] = mockDeliver.mock.calls[0];
      expect(eventType).toBe('target_price');
      expect(payload.targetPrice).toBe(80);
      expect(payload.newPrice).toBe(80);
      expect(history.message).toContain('Price reached your target of 80 (Current: 80 USD)');
    });

    it('delivers notification on initial scrape (oldPrice === null) if price is already <= target', async () => {
      // target: 80, old: null, current: 75
      await service.notifyTargetHit(mockProduct, null, { price: 75, currency: 'USD' });
      expect(mockDeliver).toHaveBeenCalledTimes(1);

      const [, eventType, payload] = mockDeliver.mock.calls[0];
      expect(eventType).toBe('target_price');
      expect(payload.newPrice).toBe(75);
    });
  });

  describe('notifyBackInStock', () => {
    it('formats price into message when price and currency are available', async () => {
      const scrapedData: ScrapedProductWithVoting = {
        price: { price: 129.99, currency: 'EUR' },
        stockStatus: 'in_stock',
        priceCandidates: [],
      } as any;

      await service.notifyBackInStock(mockProduct, scrapedData, 'out_of_stock');
      expect(mockDeliver).toHaveBeenCalledTimes(1);

      const [, eventType, payload, history] = mockDeliver.mock.calls[0];
      expect(eventType).toBe('back_in_stock');
      expect(payload.oldStockStatus).toBe('out_of_stock');
      expect(payload.newStockStatus).toBe('in_stock');
      expect(history.message).toBe('Product is back in stock at EUR 129.99');
    });

    it('renders "Current price: unavailable" when scraped data has no price or currency', async () => {
      const scrapedData: ScrapedProductWithVoting = {
        price: null,
        stockStatus: 'in_stock',
        priceCandidates: [],
      } as any;

      await service.notifyBackInStock(mockProduct, scrapedData, 'out_of_stock');
      expect(mockDeliver).toHaveBeenCalledTimes(1);

      const [, , , history] = mockDeliver.mock.calls[0];
      expect(history.message).toBe('Product is back in stock. Current price: unavailable');
      expect(history.data.newPrice).toBeUndefined();
    });
  });

  describe('notifyNotAvailable', () => {
    it('distinguishes permanent/paused monitoring from transient retry attempts', async () => {
      // Paused case (e.g. 404/410 dead page)
      await service.notifyNotAvailable(mockProduct, 'not_found', true, 1);
      expect(mockDeliver).toHaveBeenCalledTimes(1);

      const [, , payload1, history1] = mockDeliver.mock.calls[0];
      expect(payload1.paused).toBe(true);
      expect(history1.message).toContain('Monitoring paused.');
      expect(history1.data.action).toBe('Monitoring Paused');
      expect(history1.data.reasonCode).toBe('not_found');
      expect(history1.data.failureCount).toBe(1);

      // Unpaused case (e.g. transient timeout or network outage)
      mockDeliver.mockClear();
      await service.notifyNotAvailable(mockProduct, 'timeout', false, 4);
      expect(mockDeliver).toHaveBeenCalledTimes(1);

      const [, , payload2, history2] = mockDeliver.mock.calls[0];
      expect(payload2.paused).toBe(false);
      expect(history2.message).toContain('Still retrying.');
      expect(history2.data.action).toBe('Still Retrying');
      expect(history2.data.failureCount).toBe(4);
    });

    it('handles undefined or null reason code safely', async () => {
      await service.notifyNotAvailable(mockProduct, null, true);
      expect(mockDeliver).toHaveBeenCalledTimes(1);

      const [, , , history] = mockDeliver.mock.calls[0];
      expect(history.data.reasonCode).toBe('unknown_scrape_failure');
    });
  });

  describe('notifyProductRestored', () => {
    it('delivers product_restored alert with notification message and action', async () => {
      await service.notifyProductRestored(mockProduct);
      expect(mockDeliver).toHaveBeenCalledTimes(1);

      const [, eventType, payload, history] = mockDeliver.mock.calls[0];
      expect(eventType).toBe('product_restored');
      expect(payload.productId).toBe(mockProduct.id);
      expect(history.title).toContain('Available again');
      expect(history.message).toBe('The product page is reachable again. Monitoring has resumed.');
      expect(history.data.action).toBe('Monitoring Resumed');
    });
  });
});
