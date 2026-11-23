import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncUserCategories } from '../../src/services/domain/product/utils/category-sync';
import { userRepository } from '../../src/models';

vi.mock('../../src/models', () => ({
  userRepository: {
    addCategories: vi.fn(),
  },
}));

const mockAddCategories = userRepository.addCategories as unknown as ReturnType<typeof vi.fn>;

describe('syncUserCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when categoryString is null or undefined', async () => {
    await syncUserCategories(1, null);
    await syncUserCategories(1, undefined as any);
    expect(mockAddCategories).not.toHaveBeenCalled();
  });

  it('does nothing when categoryString is an empty string', async () => {
    await syncUserCategories(1, '');
    expect(mockAddCategories).not.toHaveBeenCalled();
  });

  it('does nothing when categoryString consists only of commas and whitespace', async () => {
    await syncUserCategories(1, '   ');
    await syncUserCategories(1, ', ,  ,   ');
    expect(mockAddCategories).not.toHaveBeenCalled();
  });

  it('splits comma-separated categories, trims whitespace, and filters empty tokens', async () => {
    await syncUserCategories(5, '  Electronics , Audio,  Smart Home , ,  ');
    expect(mockAddCategories).toHaveBeenCalledTimes(1);
    expect(mockAddCategories).toHaveBeenCalledWith(5, ['Electronics', 'Audio', 'Smart Home']);
  });

  it('handles a single category with surrounding whitespace', async () => {
    await syncUserCategories(12, '   Laptops   ');
    expect(mockAddCategories).toHaveBeenCalledTimes(1);
    expect(mockAddCategories).toHaveBeenCalledWith(12, ['Laptops']);
  });
});
