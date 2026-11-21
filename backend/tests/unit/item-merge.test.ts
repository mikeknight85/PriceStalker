import { describe, it, expect, vi, beforeEach } from 'vitest';
import pool from '../../src/config/database';
import { itemRepository } from '../../src/services/domain/product/repositories/item.repository';
import { syncUserCategories } from '../../src/services/domain/product/utils/category-sync';

// Mock DB client
const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

vi.mock('../../src/config/database', () => ({
  default: {
    connect: vi.fn(() => Promise.resolve(mockClient)),
    query: vi.fn((...args: any[]) => mockClient.query(...args)),
  },
}));

vi.mock('../../src/services/domain/product/utils/category-sync', () => ({
  syncUserCategories: vi.fn(),
}));

describe('itemRepository.mergeItems and promotion guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects merging an item into itself with 409', async () => {
    await expect(itemRepository.mergeItems(42, 42, 1)).rejects.toThrow('Cannot merge an item into itself');
  });

  it('rejects when target item not found with 404', async () => {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.includes('BEGIN')) return {};
      if (sql.includes('FROM items WHERE id = $1')) return { rowCount: 0, rows: [] };
      if (sql.includes('ROLLBACK')) return {};
      return { rowCount: 0, rows: [] };
    });

    await expect(itemRepository.mergeItems(10, 20, 1)).rejects.toThrow('Target item not found');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('rejects when source item not found with 404', async () => {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.includes('BEGIN')) return {};
      if (sql.includes('target_price')) return { rowCount: 0, rows: [] };
      if (sql.includes('FROM items WHERE id = $1')) return { rowCount: 1, rows: [{ id: 20, category: null }] };
      if (sql.includes('ROLLBACK')) return {};
      return { rowCount: 0, rows: [] };
    });

    await expect(itemRepository.mergeItems(10, 20, 1)).rejects.toThrow('Source item not found');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('moves all listings to target, ensures primary, unions tags, deletes source item, and returns discarded settings', async () => {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.includes('BEGIN')) return {};
      if (sql.includes('SELECT id, category FROM items WHERE id = $1')) return { rowCount: 1, rows: [{ id: 20, category: 'Audio' }] };
      if (sql.includes('SELECT id, category, target_price')) {
        return {
          rowCount: 1,
          rows: [{ id: 10, category: 'Electronics, Audio', target_price: 150, price_drop_threshold: 15, notify_back_in_stock: true }],
        };
      }
      if (sql.includes('UPDATE products SET item_id = $1, is_primary = false')) {
        return { rowCount: 2 };
      }
      if (sql.includes('UPDATE items SET category = $1 WHERE id = $2')) {
        return { rowCount: 1 };
      }
      if (sql.includes('UPDATE products SET category = $1 WHERE item_id = $2')) {
        return { rowCount: 2 };
      }
      if (sql.includes('UPDATE products') && sql.includes('SET is_primary = true')) {
        return { rowCount: 1 };
      }
      if (sql.includes('DELETE FROM items WHERE id = $1 AND user_id = $2')) {
        return { rowCount: 1 };
      }
      if (sql.includes('COMMIT')) return {};
      return { rowCount: 0, rows: [] };
    });

    const result = await itemRepository.mergeItems(10, 20, 1);
    expect(result.movedCount).toBe(2);
    expect(result.discardedAlertSettings).toEqual({
      target_price: 150,
      price_drop_threshold: 15,
      notify_back_in_stock: true,
    });
    expect(mockClient.query).toHaveBeenCalledWith(
      'UPDATE items SET category = $1 WHERE id = $2 AND user_id = $3',
      ['Audio, Electronics', 20, 1]
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      'UPDATE products SET category = $1 WHERE item_id = $2 AND user_id = $3',
      ['Audio, Electronics', 20, 1]
    );
    expect(syncUserCategories).toHaveBeenCalledWith(1, 'Audio, Electronics');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('attaching a listing promotes a sibling on the previous item if listings remain and unions tags', async () => {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.includes('BEGIN')) return {};
      if (sql.includes('SELECT id, category FROM items WHERE id = $1')) return { rowCount: 1, rows: [{ id: 20, category: 'Gadgets' }] };
      if (sql.includes('SELECT p.id, p.item_id, p.category')) {
        return {
          rowCount: 1,
          rows: [{ id: 100, item_id: 10, category: 'Gaming', target_price: null, price_drop_threshold: null, notify_back_in_stock: false }],
        };
      }
      if (sql.includes('UPDATE products SET item_id = $1, is_primary = false')) {
        return { rowCount: 1 };
      }
      if (sql.includes('UPDATE items SET category = $1 WHERE id = $2')) {
        return { rowCount: 1 };
      }
      if (sql.includes('UPDATE products SET category = $1 WHERE item_id = $2')) {
        return { rowCount: 2 };
      }
      if (sql.includes('UPDATE products') && sql.includes('SET is_primary = true')) {
        return { rowCount: 1 };
      }
      if (sql.includes('DELETE FROM items WHERE id = $1')) {
        // Old item still has listings, so DELETE removes 0 rows
        return { rowCount: 0 };
      }
      if (sql.includes('COMMIT')) return {};
      return { rowCount: 0, rows: [] };
    });

    const result = await itemRepository.attachListing(100, 20, 1);
    expect(result.movedFromItemId).toBe(10);
    expect(result.discardedAlertSettings).toBeNull();
    expect(mockClient.query).toHaveBeenCalledWith(
      'UPDATE items SET category = $1 WHERE id = $2 AND user_id = $3',
      ['Gadgets, Gaming', 20, 1]
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE products\n           SET is_primary = true'),
      [10]
    );
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });

  it('syncProductCategoryToItem updates parent item and sibling listings when product has item_id', async () => {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT item_id FROM products')) {
        return { rowCount: 1, rows: [{ item_id: 42 }] };
      }
      return { rowCount: 1, rows: [] };
    });

    await itemRepository.syncProductCategoryToItem(100, 1, 'Tech, Smart Home');

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE items SET category = $1'),
      ['Tech, Smart Home', 42, 1]
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE products SET category = $1 WHERE item_id = $2'),
      ['Tech, Smart Home', 42, 1]
    );
  });
});
