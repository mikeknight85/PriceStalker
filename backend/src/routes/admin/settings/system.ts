import { Router, Response } from 'express';
import axios from 'axios';
import { AuthRequest } from '../../../middleware/auth';
import { systemService } from '../../../services/domain/system';
import { asyncHandler } from '../../../utils/system/route-helpers';

const router = Router();

// Get system settings
router.get('/', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const settings = await systemService.getSettings();
  res.json(settings);
}, 'Admin | Fetch Settings', 'Admin', 'Failed to fetch system settings'));

// Update system settings
router.put('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const settings = await systemService.updateSettings(req.body, req.userId!);
  res.json(settings);
}, 'Admin | Update Settings', 'Admin', 'Failed to update system settings'));

// Reset system settings to canonical defaults (issue #264)
router.post('/reset', asyncHandler(async (req: AuthRequest, res: Response) => {
  const scope = req.body?.scope || 'all';
  const settings = await systemService.resetToDefaults(scope, req.userId!);
  res.json(settings);
}, 'Admin | Reset Settings', 'Admin', 'Failed to reset system settings'));

export default router;
