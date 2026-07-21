import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { SearchService } from '../../services/domain/product/SearchService';
import { asyncHandler } from '../../utils/system/route-helpers';

const router = Router();
const searchService = new SearchService();

/**
 * GET /api/products/search?q=...
 * Performs a name-based product search via SearXNG.
 */
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    res.status(400).json({ error: 'Search query (q) is required' });
    return;
  }

  const results = await searchService.search(q);
  res.json(results);
}, 'Product | Search', 'Products', 'Failed to perform product search'));

export default router;
