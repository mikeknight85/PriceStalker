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

export default router;
