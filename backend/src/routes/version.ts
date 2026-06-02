import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { checkForUpdate, getCurrentVersion } from '../services/updateCheck';

const router = Router();

// Authenticated — only logged-in users see what's running and whether an
// update is available.
router.get('/check', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await checkForUpdate();
    res.json(result);
  } catch (error) {
    console.error('[Version] check failed:', error);
    res.status(500).json({
      current: getCurrentVersion(),
      latest: null,
      isOutdated: false,
      releaseUrl: null,
      publishedAt: null,
      checkedAt: new Date().toISOString(),
      disabled: false,
      error: 'check failed',
      channel: process.env.PRICESTALKER_CHANNEL === 'beta' ? 'beta' : 'stable',
    });
  }
});

export default router;
