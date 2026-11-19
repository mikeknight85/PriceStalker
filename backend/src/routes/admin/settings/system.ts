import { Router, Response } from 'express';
import axios from 'axios';
import { AuthRequest } from '../../../middleware/auth';
import { systemService } from '../../../services/domain/system';
import { telemetryService } from '../../../services/domain/system/telemetry.service';
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

// Get telemetry status & payload preview
router.get('/telemetry', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const status = await telemetryService.getStatus();
  res.json(status);
}, 'Admin | Fetch Telemetry Status', 'Admin', 'Failed to fetch telemetry status'));

// Trigger manual telemetry ping (for testing)
router.post('/telemetry/ping', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const result = await telemetryService.sendPing();
  res.json(result);
}, 'Admin | Trigger Telemetry Ping', 'Admin', 'Failed to trigger telemetry ping'));

const VALID_RESET_SCOPES = ['all', 'selectors', 'phrases', 'network'] as const;
type ResetScope = typeof VALID_RESET_SCOPES[number];

// Reset system settings to canonical defaults (issue #264)
const handleReset = asyncHandler(async (req: AuthRequest, res: Response) => {
  const scope = req.body?.scope || 'all';
  if (!VALID_RESET_SCOPES.includes(scope)) {
    return res.status(400).json({ error: `Invalid scope: must be one of ${VALID_RESET_SCOPES.join(', ')}` });
  }
  const { settings, reset_count } = await systemService.resetToDefaults(scope as ResetScope, req.userId!);
  res.json({ success: true, settings, reset_count });
}, 'Admin | Reset Settings', 'Admin', 'Failed to reset system settings');

router.post('/reset', handleReset);

export default router;
