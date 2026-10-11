import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { systemService } from '../../services/domain/system';
import { defaultCheckIntervalService } from '../../services/domain/product';
import { settingsCache } from '../../utils/cache';
import { logger } from '../../utils/system/logger';
import notificationRoutes from './notifications';
import notificationTestRoutes from './notification-tests';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Check if product search is enabled
router.get('/discovery/status', async (_req: AuthRequest, res: Response) => {
  try {
    const enabled = await settingsCache.isSearXNGEnabled();
    res.json({ enabled });
  } catch (error: any) {
    logger.error(`Settings | Fetch Search Status Failed | ${error.message}`, 'Settings', error);
    res.status(500).json({ error: 'Failed to check search status' });
  }
});

/**
 * The check interval a new product should start at for the signed-in user, and
 * the instance default behind it (issue #239).
 *
 * Resolved server-side so the Add Product form never has to know the ranking,
 * and so a non-admin can see the effective default without being handed the
 * whole of Admin -> System.
 */
router.get('/product-defaults', async (req: AuthRequest, res: Response) => {
  try {
    const defaults = await defaultCheckIntervalService.getDefaults(req.userId!);
    res.json(defaults);
  } catch (error: any) {
    logger.error(`Settings | Fetch Product Defaults Failed | ${error.message}`, 'Settings', error);
    res.status(500).json({ error: 'Failed to fetch product defaults' });
  }
});

// Get global currencies
router.get('/currencies', async (_req: AuthRequest, res: Response) => {
  try {
    const currencies = await systemService.getCurrencies();
    res.json(currencies);
  } catch (error: any) {
    logger.error(`Settings | Fetch Global Currencies Failed | ${error.message}`, 'Settings', error);
    res.status(500).json({ error: 'Failed to fetch global currencies' });
  }
});

// Sub-routes
router.use('/notifications/test', notificationTestRoutes);
router.use('/notifications', notificationRoutes);

export default router;
