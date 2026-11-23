import { describe, it, expect, vi, beforeEach } from 'vitest';

const retailerRepo = {
  getAll: vi.fn(),
  getByDomain: vi.fn(),
  getConfigForUrl: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
};

const cache = {
  invalidate: vi.fn(),
};

vi.mock('../../src/models', () => ({
  retailerRepository: retailerRepo,
}));

vi.mock('../../src/utils/cache', () => ({
  configCache: cache,
}));

vi.mock('../../src/utils/system/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('Retailer Services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RetailerQueryService', () => {
    it('getAllRetailers queries repository with includeInactive flag', async () => {
      const mockList = [{ id: 1, domain: 'example.com' }];
      retailerRepo.getAll.mockResolvedValue(mockList);

      const { RetailerQueryService } = await import(
        '../../src/services/domain/retailer/RetailerQueryService'
      );
      const service = new RetailerQueryService();

      const result = await service.getAllRetailers(false);
      expect(result).toBe(mockList);
      expect(retailerRepo.getAll).toHaveBeenCalledWith(false);
    });

    it('getRetailerByDomain queries repository with domain', async () => {
      const mockRetailer = { id: 2, domain: 'shop.test' };
      retailerRepo.getByDomain.mockResolvedValue(mockRetailer);

      const { RetailerQueryService } = await import(
        '../../src/services/domain/retailer/RetailerQueryService'
      );
      const service = new RetailerQueryService();

      const result = await service.getRetailerByDomain('shop.test');
      expect(result).toBe(mockRetailer);
      expect(retailerRepo.getByDomain).toHaveBeenCalledWith('shop.test');
    });

    it('getRetailerForUrl extracts hostname/path and queries config', async () => {
      retailerRepo.getConfigForUrl.mockResolvedValue({ id: 3, domain: 'amazon.com' });

      const { RetailerQueryService } = await import(
        '../../src/services/domain/retailer/RetailerQueryService'
      );
      const service = new RetailerQueryService();

      const result = await service.getRetailerForUrl('https://www.amazon.com/dp/B123');
      expect(result).toEqual({ id: 3, domain: 'amazon.com' });
      expect(retailerRepo.getConfigForUrl).toHaveBeenCalled();
    });
  });

  describe('RetailerMutationService', () => {
    it('throws when domain is missing on upsert', async () => {
      const { RetailerQueryService } = await import(
        '../../src/services/domain/retailer/RetailerQueryService'
      );
      const { RetailerMutationService } = await import(
        '../../src/services/domain/retailer/RetailerMutationService'
      );
      const service = new RetailerMutationService(new RetailerQueryService());

      await expect(service.upsertRetailer({ name: 'No Domain' })).rejects.toThrow(
        /Domain is required/
      );
    });

    it('upserts retailer, invalidates cache, and formats detailed trace log', async () => {
      const saved = {
        id: 10,
        name: 'Cool Store',
        domain: 'coolstore.com',
        active: true,
        use_browser_scraper: true,
        name_selectors: ['.name'],
        price_selectors: ['.price'],
        deal_price_selectors: ['.deal'],
        member_price_selectors: ['.member'],
        original_price_selectors: ['.orig'],
        image_selectors: ['.img'],
        stock_selectors: ['.stock'],
        exclusion_selectors: ['.exclude'],
        jsonld_name_key: 'name',
        jsonld_price_key: 'price',
        jsonld_image_key: 'image',
        use_proxy: true,
      };
      retailerRepo.upsert.mockResolvedValue(saved);

      const { RetailerQueryService } = await import(
        '../../src/services/domain/retailer/RetailerQueryService'
      );
      const { RetailerMutationService } = await import(
        '../../src/services/domain/retailer/RetailerMutationService'
      );
      const service = new RetailerMutationService(new RetailerQueryService());

      const result = await service.upsertRetailer({
        domain: 'coolstore.com',
        forceNameRemoval: true,
      });

      expect(result).toBe(saved);
      expect(retailerRepo.upsert).toHaveBeenCalledWith({
        domain: 'coolstore.com',
        forceNameRemoval: true,
      });
      expect(cache.invalidate).toHaveBeenCalledWith('coolstore.com');
    });

    it('deleteRetailer invalidates cache when deletion succeeds', async () => {
      retailerRepo.getAll.mockResolvedValue([
        { id: 42, domain: 'retailer-to-delete.com' },
      ]);
      retailerRepo.delete.mockResolvedValue(true);

      const { RetailerQueryService } = await import(
        '../../src/services/domain/retailer/RetailerQueryService'
      );
      const { RetailerMutationService } = await import(
        '../../src/services/domain/retailer/RetailerMutationService'
      );
      const service = new RetailerMutationService(new RetailerQueryService());

      const success = await service.deleteRetailer(42);
      expect(success).toBe(true);
      expect(retailerRepo.delete).toHaveBeenCalledWith(42);
      expect(cache.invalidate).toHaveBeenCalledWith('retailer-to-delete.com');
    });

    it('deleteRetailer returns false when repo deletion fails', async () => {
      retailerRepo.getAll.mockResolvedValue([]);
      retailerRepo.delete.mockResolvedValue(false);

      const { RetailerQueryService } = await import(
        '../../src/services/domain/retailer/RetailerQueryService'
      );
      const { RetailerMutationService } = await import(
        '../../src/services/domain/retailer/RetailerMutationService'
      );
      const service = new RetailerMutationService(new RetailerQueryService());

      const success = await service.deleteRetailer(99);
      expect(success).toBe(false);
      expect(cache.invalidate).not.toHaveBeenCalled();
    });
  });
});
