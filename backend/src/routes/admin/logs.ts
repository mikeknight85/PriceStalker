import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { systemService } from '../../services/domain/system';
import { asyncHandler } from '../../utils/system/route-helpers';

const router = Router();

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page, limit, level, context, search } = req.query;
  const result = await systemService.getLogs({
    page: parseInt(page as string) || 1,
    limit: parseInt(limit as string) || 30,
    level: level as string,
    context: context as string,
    search: search as string
  });
  res.json(result);
}, 'Admin | Fetch Logs', 'Admin', 'Failed to fetch system logs'));

router.delete('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    res.status(400).json({ error: 'IDs array required' });
    return;
  }
  const deleted = await systemService.deleteLogs(ids);
  res.json({ success: true, deleted });
}, 'Admin | Delete Logs', 'Admin', 'Failed to delete logs'));

router.delete('/clear', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { level, context } = req.query;
  const deleted = await systemService.clearLogs({ 
    level: level as string, 
    context: context as string 
  });
  res.json({ success: true, deleted });
}, 'Admin | Clear Logs', 'Admin', 'Failed to clear logs'));

export default router;
