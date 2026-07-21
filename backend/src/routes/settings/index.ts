import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { systemService } from '../../services/domain/system';
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
