import { Router, Response } from 'express';
import { AuthRequest } from '../../../../middleware/auth';
import { systemService } from '../../../../services/domain/system';
import { asyncHandler } from '../../../../utils/system/route-helpers';

const router = Router();

// Get global AI settings
router.get('/', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const settings = await systemService.getAISettings();
  res.json(settings);
}, 'Admin | AI Settings Fetch', 'Admin', 'Failed to fetch global AI settings'));

// Update global AI settings
router.put('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const settings = await systemService.updateAISettings(req.body, req.userId!);
  res.json(settings);
}, 'Admin | AI Settings Update', 'Admin', 'Failed to update global AI settings'));

// Get cached models for any provider
router.get('/:provider/models', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { provider } = req.params;
  const result = await systemService.getProviderModels(provider);
  res.json(result);
}, 'Admin | Fetch Provider Models', 'Admin', 'Failed to fetch provider models'));

// Refresh models for any provider
router.post('/:provider/models/refresh', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { provider } = req.params;
  const { api_key, base_url } = req.body;
  const result = await systemService.refreshProviderModels(provider, { apiKey: api_key, baseUrl: base_url });
  res.json(result);
}, 'Admin | Provider Models Refresh', 'Admin', 'Failed to refresh provider models'));

export default router;
