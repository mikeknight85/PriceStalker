import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { productHistoryService } from '../../services/domain/product';
import { logger } from '../../utils/system/logger';

const router = Router();

// Bulk pause/resume products
router.post('/pause', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { ids, paused } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'Product IDs array is required' });
      return;
    }

    if (typeof paused !== 'boolean') {
      res.status(400).json({ error: 'Paused status (boolean) is required' });
      return;
    }

    const updated = await productHistoryService.bulkUpdatePauseStatus(ids, userId, paused);

    res.json({ 
      message: `${updated} product(s) ${paused ? 'paused' : 'resumed'}`,
      updated
    });
  } catch (error) {
    logger.error(`Product | Bulk Update Failed | ${error}`, 'Products');
    res.status(500).json({ error: 'Failed to update pause status' });
  }
});

export default router;
