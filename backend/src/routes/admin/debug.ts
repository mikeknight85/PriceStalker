import { Router, Response } from 'express';
import axios from 'axios';
import { AuthRequest } from '../../middleware/auth';
import { systemService, databaseHealthMonitor } from '../../services/domain/system';
import { scrapeProductWithVoting } from '../../services/scraper';
import { tryAIExtraction } from '../../services/ai';
import { logger } from '../../utils/system/logger';
import { asyncHandler } from '../../utils/system/route-helpers';

const router = Router();

// Publicly check if debug is enabled
router.get('/status', asyncHandler(async (_req, res) => {
  const settings = await systemService.getSettings();
  const val = settings.debug_page_enabled as any;
  const isEnabled = val === 'true' || val === true;
  res.json({ enabled: isEnabled });
}, 'Admin | Debug Status', 'Debug', 'Failed to fetch debug status'));

// Generic debug extraction - can accept optional mock config
router.post('/extract', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { url, config, mode, returnHtml, use_ai, force_ai, productId } = req.body;
  if (!url) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  // Check if enabled
  const settings = await systemService.getSettings();
  const val = settings.debug_page_enabled as any;
  if (val !== 'true' && val !== true) {
    res.status(403).json({ error: 'Debug page is currently disabled in system settings.' });
    return;
  }

  let result: any = {};

  if (mode === 'bypass') {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': config?.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' },
        timeout: 15000
      });
      result = { html: response.data, name: null, price: null, imageUrl: null, url, stockStatus: 'unknown', aiStatus: null, priceCandidates: [], needsReview: false };
    } catch (e: any) {
      res.status(500).json({ error: `Bypass fetch failed: ${e.message}` });
      return;
    }
  } else {
    // Run the scraper with optional mock config
    // If no config provided, scrapeProductWithVoting will look it up in DB automatically
    result = await scrapeProductWithVoting(url, undefined, undefined, undefined, false, true, config, productId);
  }

  // Run AI extraction if requested (fallback or forced)
  const shouldRunAI = force_ai || (use_ai && (!result.price || !result.price.price));
  if (shouldRunAI) {
    const aiResult = await tryAIExtraction(url, result.html || '', req.userId || 0, undefined, !!force_ai);

    if (aiResult) {
      result.ai_extraction_result = aiResult;
      // If we are forcing AI extraction, override standard results with AI results
      if (force_ai) {
        result.price = aiResult.price;
        result.name = aiResult.name;
        result.imageUrl = aiResult.imageUrl;
        result.stockStatus = aiResult.stockStatus;
      }
    }
  }

  let debugFileUrl = null;
  if (result.html) {
    debugFileUrl = systemService.saveDebugHtml(url, result.html);
  }

  const response = { ...result };
  if (!returnHtml) {
    delete response.html;
  }

  res.json({
    ...response,
    debugFileUrl
  });
}, 'Admin | Debug Extract', 'Debug', 'Failed to run debug extraction'));

// GET /api/admin/debug/db-health
router.get('/db-health', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(databaseHealthMonitor.getStatus());
}, 'Admin | Get DB Health Monitor Status', 'Debug', 'Failed to retrieve database health monitor status'));

// POST /api/admin/debug/db-health/test-alert
router.post('/db-health/test-alert', asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await databaseHealthMonitor.sendAlertEmail(
    'PriceGhost Test Alert',
    'This is a verification email triggered via the API to test the SMTP fallback settings.'
  );
  if (result.success) {
    res.json({ message: 'Test alert successfully sent', details: result });
  } else {
    res.status(500).json({ error: 'Failed to send alert', details: result });
  }
}, 'Admin | Trigger Test DB Alert', 'Debug', 'Failed to send test alert email'));

// POST /api/admin/debug/db-health/simulate
router.post('/db-health/simulate', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { state } = req.body;
  if (state === 'RESET') {
    databaseHealthMonitor.clearSimulation();
    res.json({ message: 'Simulation cleared, returning to live checks' });
    return;
  }
  
  if (state !== 'HEALTHY' && state !== 'DEGRADED' && state !== 'FAILED') {
    res.status(400).json({ error: 'Invalid simulated state. Must be HEALTHY, DEGRADED, FAILED, or RESET.' });
    return;
  }
  
  databaseHealthMonitor.setSimulatedState(state);
  res.json({ message: `Simulating database state: ${state}`, status: databaseHealthMonitor.getStatus() });
}, 'Admin | Simulate DB State', 'Debug', 'Failed to simulate database state'));

export default router;
