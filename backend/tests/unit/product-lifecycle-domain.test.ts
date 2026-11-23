import { describe, it, expect, vi, beforeEach } from 'vitest';
import { productLifecycleRepository } from '../../src/services/domain/product/repositories/product-lifecycle.repository';
import pool from '../../src/config/database';
import { itemRepository } from '../../src/services/domain/product/repositories/item.repository';

vi.mock('../../src/config/database', () => {
  const query = vi.fn();
  const release = vi.fn();
  const connect = vi.fn().mockResolvedValue({ query, release });
  return {
    default: {
      query,
      connect,
    },
  };
});

vi.mock('../../src/services/domain/product/repositories/item.repository', () => ({
  itemRepository: {
    create: vi.fn(),
    updateAlertSettings: vi.fn(),
  },
}));

describe('Product Lifecycle Repository Domain Invariants', () => {
  const mockPool = pool as unknown as { query: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> };
  let mockClient: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    mockPool.connect.mockResolvedValue(mockClient);
  });

  describe('create transaction semantics', () => {
    it('creates product and canonical item together in a single transaction', async () => {
      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return {};
        if (sql.includes('INSERT INTO products')) {
          return {
            rows: [
              {
                id: 101,
                user_id: 1,
                url: 'https://store.example/item/101',
                item_id: 42,
                is_primary: true,
              },
            ],
          };
        }
        return { rows: [] };
      });

      const mockItem = { id: 42, name: 'Item 42' };
      (itemRepository.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockItem);

      const created = await productLifecycleRepository.create(
        1,
        'https://store.example/item/101',
        'Test Product',
        'https://store.example/image.png'
      );

      expect(created.id).toBe(101);
      expect(created.item_id).toBe(42);

      // Verify BEGIN -> itemRepository.create -> INSERT products -> COMMIT -> release
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(itemRepository.create).toHaveBeenCalledWith(
        1,
        'Test Product',
        'https://store.example/image.png',
        null,
        mockClient
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('rolls back transaction on error and releases connection', async () => {
      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql === 'BEGIN') return {};
        if (sql.includes('INSERT INTO products')) {
          throw new Error('Database constraint violation');
        }
        return {};
      });

      (itemRepository.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 50 });

      await expect(
        productLifecycleRepository.create(1, 'https://broken.example', 'Broken Product', null)
      ).rejects.toThrow('Database constraint violation');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('update routing and interval recalculation', () => {
    it('routes alert settings (target_price, price_drop_threshold) to itemRepository, NOT products table', async () => {
      mockPool.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT p.item_id, p.user_id FROM products')) {
          return { rows: [{ item_id: 42, user_id: 1 }] };
        }
        if (sql.includes('UPDATE products SET')) {
          return { rows: [{ id: 7, item_id: 42, name: 'Updated Listing' }] };
        }
        return { rows: [] };
      });

      (itemRepository.updateAlertSettings as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 42,
        target_price: 49.99,
      });

      await productLifecycleRepository.update(7, 1, {
        name: 'Updated Listing',
        target_price: 49.99,
        price_drop_threshold: 5,
        notify_back_in_stock: true,
      });

      // Item alert settings were routed to itemRepository with itemId (42)
      expect(itemRepository.updateAlertSettings).toHaveBeenCalledWith(
        42,
        1,
        {
          target_price: 49.99,
          price_drop_threshold: 5,
          notify_back_in_stock: true,
        },
        mockPool
      );

      // Products table update was executed for listing name
      expect(mockPool.query).toHaveBeenCalled();
      const updateCall = mockPool.query.mock.calls.find(call => call[0].includes('UPDATE products SET'));
      expect(updateCall).toBeDefined();
      const productUpdateSql = updateCall![0];
      expect(productUpdateSql).toContain('name = $1');
      // The SQL must NOT attempt to write target_price or price_drop_threshold to products!
      expect(productUpdateSql).not.toContain('target_price =');
      expect(productUpdateSql).not.toContain('price_drop_threshold =');
    });

    it('recalculates next_check_at dynamically when refresh_interval is updated', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 7, refresh_interval: 3600 }],
      });

      await productLifecycleRepository.update(7, 1, {
        refresh_interval: 3600,
      });

      expect(mockPool.query).toHaveBeenCalled();
      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('next_check_at = GREATEST(CURRENT_TIMESTAMP');
      expect(sql).toContain('refresh_interval = $1');
    });
  });
});
