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

// Get cached Gemini models
router.get('/gemini/models', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const settings = await systemService.getSettings();
  const modelsStr = settings.gemini_available_models;
  const refreshedAt = settings.gemini_models_refreshed_at;
  res.json({
    models: modelsStr ? JSON.parse(modelsStr) : [],
    refreshed_at: refreshedAt,
  });
}, 'Admin | Fetch Gemini Models', 'Admin', 'Failed to fetch Gemini models'));

// Refresh Gemini models
router.post('/gemini/models/refresh', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { api_key } = req.body;
  let apiKey = api_key;
  if (!apiKey) {
    const settings = await systemService.getAISettings();
    apiKey = settings.gemini_api_key;
  }
  if (!apiKey) {
    res.status(400).json({ error: 'Gemini API key is required' });
    return;
  }

  const result = await systemService.refreshGeminiModels(apiKey);
  res.json(result);
}, 'Admin | Gemini Models Refresh', 'Admin', 'Failed to refresh Gemini models'));

export default router;
