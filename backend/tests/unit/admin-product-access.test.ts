import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The administrator bypass lifts an ownership check, so the cases that matter
 * most are the ones where it must NOT apply. A regression here is silent: the
 * feature keeps working while the boundary quietly stops holding.
 */

const products = {
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../../src/models', () => ({
  productRepository: products,
  priceHistoryRepository: { findByProductId: vi.fn().mockResolvedValue([]) },
  stockHistoryRepository: { getByProductId: vi.fn().mockResolvedValue([]), getStats: vi.fn().mockResolvedValue(null) },
}));

const info = vi.fn();
vi.mock('../../src/utils/system/logger', () => ({
  logger: { info: (...a: unknown[]) => info(...a), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../src/services/domain/product/utils', () => ({
  syncUserCategories: vi.fn(),
}));

const OWNER = 7;
const ADMIN = 9;
const PRODUCT = { id: 1, user_id: OWNER, name: 'Owned' };

async function service() {
  const mod = await import('../../src/services/domain/product/ProductHistoryService');
  return mod.productHistoryService;
}

describe('Administrator access to another account product', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    products.findById.mockResolvedValue(PRODUCT);
    products.update.mockResolvedValue(PRODUCT);
    products.delete.mockResolvedValue(true);
  });

  describe('the bypass is opt-in', () => {
    it('does not bypass ownership by default', async () => {
      await (await service()).getProduct(1, ADMIN);
      expect(products.findById).toHaveBeenCalledWith(1, ADMIN, { asAdmin: false });
    });

    it('passes the flag through on read, update and delete', async () => {
      const svc = await service();

      await svc.getProduct(1, ADMIN, true);
      expect(products.findById).toHaveBeenCalledWith(1, ADMIN, { asAdmin: true });

      await svc.updateProduct(1, ADMIN, { name: 'x' }, true);
      expect(products.update).toHaveBeenCalledWith(1, ADMIN, { name: 'x' }, undefined, { asAdmin: true });

      await svc.deleteProduct(1, ADMIN, true);
      expect(products.delete).toHaveBeenCalledWith(1, ADMIN, { asAdmin: true });
    });

    it('refuses to delete a product the caller cannot see', async () => {
      // Without the pre-read, delete would report success on a row it never
      // matched, because rowCount 0 and "not yours" look the same from outside.
      products.findById.mockResolvedValue(null);
      expect(await (await service()).deleteProduct(1, ADMIN, false)).toBe(false);
      expect(products.delete).not.toHaveBeenCalled();
    });
  });

  describe('auditing', () => {
    it('logs when an admin reaches into another account', async () => {
      await (await service()).getProduct(1, ADMIN, true);
      expect(info.mock.calls.flat().join(' ')).toContain('Admin view');
    });

    it('logs nothing when an admin acts on their own product', async () => {
      // Otherwise every action an administrator takes on their own dashboard
      // would file an audit line, and the real ones would be lost in it.
      products.findById.mockResolvedValue({ ...PRODUCT, user_id: ADMIN });
      await (await service()).getProduct(1, ADMIN, true);
      expect(info).not.toHaveBeenCalled();
    });

    it('logs nothing for an ordinary user', async () => {
      await (await service()).getProduct(1, OWNER, false);
      expect(info).not.toHaveBeenCalled();
    });
  });

  describe('categories follow the owner, not the editor', () => {
    it('syncs the category to the product owner', async () => {
      const { syncUserCategories } = await import('../../src/services/domain/product/utils');
      products.update.mockResolvedValue({ ...PRODUCT, user_id: OWNER });

      await (await service()).updateProduct(1, ADMIN, { category: 'Games' }, true);

      // Syncing to the admin instead would pollute their own category filter
      // with somebody else's categories.
      expect(syncUserCategories).toHaveBeenCalledWith(OWNER, 'Games');
    });
  });
});
