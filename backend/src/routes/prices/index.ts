import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { productHistoryService, productRefreshService } from '../../services/domain/product';
import { logger } from '../../utils/system/logger';
import { asyncHandler } from '../../utils/system/route-helpers';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get price history for a product
router.get('/:productId/history', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const productId = parseInt(req.params.productId, 10);

  if (isNaN(productId)) {
    res.status(400).json({ error: 'Invalid product ID' });
    return;
  }

  const days = req.query.days ? parseInt(req.query.days as string, 10) : undefined;
  const result = await productHistoryService.getPriceHistory(productId, userId, days);

  res.json(result);
}, 'Prices | Fetch History', 'Prices', 'Failed to fetch price history'));

// Force immediate price refresh
router.post('/:productId/refresh', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const productId = parseInt(req.params.productId, 10);

  if (isNaN(productId)) {
    res.status(400).json({ error: 'Invalid product ID' });
    return;
  }

  // Verify product belongs to user
  const product = await productHistoryService.getProduct(productId, userId);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const result = await productRefreshService.refreshProduct(product);

  res.json({
    message: result.stockStatus === 'out_of_stock'
      ? 'Product is currently out of stock'
      : 'Price refreshed successfully',
    ...result
  });
}, 'Prices | Refresh', 'Prices', 'Failed to refresh price'));

// Get stock status history for a product
router.get('/:productId/stock-history', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const productId = parseInt(req.params.productId, 10);

  if (isNaN(productId)) {
    res.status(400).json({ error: 'Invalid product ID' });
    return;
  }

  const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
  const result = await productHistoryService.getStockHistory(productId, userId, days);

  res.json(result);
}, 'Prices | Fetch Stock History', 'Prices', 'Failed to fetch stock status history'));

export default router;
