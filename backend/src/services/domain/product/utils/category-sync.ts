import { userRepository } from '../../../../models';

/**
 * Synchronizes user categories from a comma-separated string.
 */
export async function syncUserCategories(userId: number, categoryString: string | null) {
  if (!categoryString) return;
  const catList = categoryString.split(',').map((c: string) => c.trim()).filter(Boolean);
  if (catList.length > 0) {
    await userRepository.addCategories(userId, catList);
  }
}

