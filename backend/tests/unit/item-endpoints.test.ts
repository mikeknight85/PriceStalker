import { describe, it, expect, vi, beforeEach } from 'vitest';
import { productHistoryService } from '../../src/services/domain/product/ProductHistoryService';
import { productRepository, priceHistoryRepository, userRepository } from '../../src/models';

vi.mock('../../src/models', () => ({
  productRepository: {
    findByUserIdWithSparkline: vi.fn(),
  },
  priceHistoryRepository: {
    findByProductId: vi.fn(),
  },
  stockHistoryRepository: {
    getByProductId: vi.fn(),
    getStats: vi.fn(),
  },
  userRepository: {
    findById: vi.fn(),
  },
}));

describe('Item endpoints and service methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProduct = (overrides = {}) => ({
    id: 10,
    user_id: 1,
    url: 'https://shop.example/product',
    name: 'Sony Headphones',
    item_id: 42,
    is_primary: true,
    item_name: 'Sony WH-1000XM5',
    item_image_url: 'https://example.com/sony.jpg',
    item_category: 'audio',
    category: 'audio',
    current_price: 299,
    converted_price: 299,
    currency: 'USD',
    converted_currency: 'USD',
    target_price: 250,
    price_drop_threshold: 20,
    notify_back_in_stock: true,
    stock_status: 'in_stock',
    retailer_name: 'ShopExample',
    sparkline_data: [{ recorded_at: '2026-01-01', price: 299 }],
    created_at: new Date('2026-01-01'),
    ...overrides,
  });

  it('getUserItem returns a single item by id', async () => {
    vi.mocked(productRepository.findByUserIdWithSparkline).mockResolvedValue([
      mockProduct({ id: 10, item_id: 42, current_price: 299, converted_price: 299 }),
      mockProduct({ id: 11, item_id: 42, is_primary: false, url: 'https://other.example/p', retailer_name: 'OtherShop', current_price: 289, converted_price: 289 }),
      mockProduct({ id: 20, item_id: 99, name: 'Different Product' }),
    ] as any);
    vi.mocked(userRepository.findById).mockResolvedValue({ id: 1, currency: 'USD' } as any);

    const item = await productHistoryService.getUserItem(42, 1);
    expect(item).not.toBeNull();
    expect(item!.id).toBe(42);
    expect(item!.name).toBe('Sony WH-1000XM5');
    expect(item!.store_count).toBe(2);
    expect(item!.best_price).toBe(289);
    expect(item!.listings).toHaveLength(2);
  });

  it('getUserItem returns null for nonexistent itemId', async () => {
    vi.mocked(productRepository.findByUserIdWithSparkline).mockResolvedValue([
      mockProduct({ id: 10, item_id: 42 }),
    ] as any);
    vi.mocked(userRepository.findById).mockResolvedValue({ id: 1, currency: 'USD' } as any);

    const item = await productHistoryService.getUserItem(999, 1);
    expect(item).toBeNull();
  });

  it('getItemPriceHistory fetches and aggregates series across all store listings', async () => {
    vi.mocked(productRepository.findByUserIdWithSparkline).mockResolvedValue([
      mockProduct({ id: 10, item_id: 42, retailer_name: 'Amazon', current_price: 300, converted_price: 300 }),
      mockProduct({ id: 11, item_id: 42, is_primary: false, retailer_name: 'JB Hi-Fi', current_price: 289, converted_price: 289 }),
    ] as any);
    vi.mocked(userRepository.findById).mockResolvedValue({ id: 1, currency: 'USD' } as any);

    vi.mocked(priceHistoryRepository.findByProductId).mockImplementation(async (productId: number) => {
      if (productId === 10) {
        return [
          { id: 1, product_id: 10, price: 320, currency: 'USD', recorded_at: '2026-01-01', ai_status: null, details: null, price_type: 'standard' },
          { id: 2, product_id: 10, price: 300, currency: 'USD', recorded_at: '2026-01-15', ai_status: null, details: null, price_type: 'standard' },
        ];
      }
      return [
        { id: 3, product_id: 11, price: 310, currency: 'USD', recorded_at: '2026-01-05', ai_status: null, details: null, price_type: 'standard' },
        { id: 4, product_id: 11, price: 289, currency: 'USD', recorded_at: '2026-01-20', ai_status: null, details: null, price_type: 'standard' },
      ];
    });

    const result = await productHistoryService.getItemPriceHistory(42, 1, 30);
    expect(result).not.toBeNull();
    expect(result!.item.id).toBe(42);
    expect(result!.series).toHaveLength(2);

    expect(result!.series[0].productId).toBe(11); // sorted cheapest first
    expect(result!.series[0].retailerName).toBe('JB Hi-Fi');
    expect(result!.series[0].prices).toHaveLength(2);

    expect(result!.series[1].productId).toBe(10);
    expect(result!.series[1].retailerName).toBe('Amazon');
    expect(result!.series[1].prices).toHaveLength(2);
  });

  it('getItemStockHistory fetches and aggregates stock history across store listings', async () => {
    const { stockHistoryRepository } = await import('../../src/models');
    vi.mocked(productRepository.findByUserIdWithSparkline).mockResolvedValue([
      mockProduct({ id: 10, item_id: 42, retailer_name: 'Amazon', stock_status: 'in_stock' }),
      mockProduct({ id: 11, item_id: 42, is_primary: false, retailer_name: 'JB Hi-Fi', stock_status: 'out_of_stock' }),
    ] as any);
    vi.mocked(userRepository.findById).mockResolvedValue({ id: 1, currency: 'USD' } as any);

    vi.mocked(stockHistoryRepository.getByProductId).mockImplementation(async (productId: number) => {
      if (productId === 10) {
        return [{ id: 1, product_id: 10, status: 'in_stock', recorded_at: '2026-01-01' }] as any;
      }
      return [{ id: 2, product_id: 11, status: 'out_of_stock', recorded_at: '2026-01-01' }] as any;
    });

    vi.mocked(stockHistoryRepository.getStats).mockImplementation(async (productId: number) => {
      if (productId === 10) {
        return { availability_percent: 100, outage_count: 0, avg_outage_days: null, longest_outage_days: null, current_status: 'in_stock', days_in_current_status: 10 };
      }
      return { availability_percent: 0, outage_count: 1, avg_outage_days: 10, longest_outage_days: 10, current_status: 'out_of_stock', days_in_current_status: 10 };
    });

    const result = await productHistoryService.getItemStockHistory(42, 1, 30);
    expect(result).not.toBeNull();
    expect(result!.item.id).toBe(42);
    expect(result!.series).toHaveLength(2);
    expect(result!.series[0].retailerName).toBe('Amazon');
    expect(result!.series[0].stockStatus).toBe('in_stock');
    expect(result!.series[0].stats.availability_percent).toBe(100);
    expect(result!.series[1].retailerName).toBe('JB Hi-Fi');
    expect(result!.series[1].stockStatus).toBe('out_of_stock');
    expect(result!.series[1].stats.availability_percent).toBe(0);
  });
});
