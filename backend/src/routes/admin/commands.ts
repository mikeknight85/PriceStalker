import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { systemService } from '../../services/domain/system';
import { logger } from '../../utils/system/logger';
import { asyncHandler } from '../../utils/system/route-helpers';

const router = Router();

// Generic Admin Command API
router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { command } = req.body;
  logger.info(`Admin | Command Requested: ${command}`, 'Admin');
  
  switch (command) {
    case 'clear-settings-cache':
      const { configCache, regionalMappingCache, settingsCache } = await import('../../utils/cache');
      configCache.invalidate();
      regionalMappingCache.clear();
      settingsCache.clear();
      logger.info('Admin | System caches cleared manually', 'System');
      res.json({ success: true, message: 'System caches cleared successfully' });
      break;
    case 'run-migration':
      const result = await systemService.runMigrations();
      res.json(result);
      break;
    case 'test-searxng':
      const { url } = req.body.params || {};
      if (!url) {
        res.status(400).json({ success: false, error: 'SearXNG URL is required' });
        return;
      }
      try {
        const { default: axios } = await import('axios');
        const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        const testEndpoint = cleanUrl.includes('/search') ? cleanUrl : `${cleanUrl}/search`;
        const response = await axios.get(testEndpoint, {
          params: { q: 'test', format: 'json' },
          timeout: 5000
        });
        if (response.data && response.data.results) {
          res.json({ success: true, message: `Connected to SearXNG. Found ${response.data.results.length} results for 'test'.` });
        } else {
          res.status(400).json({ success: false, error: 'SearXNG returned an unexpected response format.' });
        }
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
      break;
    default:
      res.status(400).json({ success: false, message: 'Unknown command' });
      break;
  }
}, 'Admin | Command', 'Admin', 'Internal command failure'));

export default router;
