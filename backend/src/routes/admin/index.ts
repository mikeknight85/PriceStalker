import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { adminMiddleware } from '../../middleware/admin';
import { systemService } from '../../services/domain/system';

import usersRoutes from './users';
import settingsRoutes from './settings';
import retailersRoutes from './retailers';
import debugRoutes from './debug';
import tokensRoutes from './tokens';
import logsRoutes from './logs';
import commandsRoutes from './commands';

const router = Router();

// Publicly check if debug is enabled (no auth required for this specific check)
router.get('/debug/status', async (_req, res) => {
  try {
    const settings = await systemService.getSettings();
    const val = settings.debug_page_enabled as any;
    const isEnabled = val === 'true' || val === true;
    res.json({ enabled: isEnabled });
  } catch (e) {
    res.json({ enabled: false });
  }
});

// All other admin routes require auth and admin status
router.use(authMiddleware);
router.use(adminMiddleware);

router.use('/users', usersRoutes);
router.use('/settings', settingsRoutes);
router.use('/retailers', retailersRoutes);
router.use('/debug', debugRoutes);
router.use('/system-tokens', tokensRoutes);
router.use('/logs', logsRoutes);
router.use('/command', commandsRoutes);

export default router;
