import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { productAddService } from '../../services/domain/product';
import { logger } from '../../utils/system/logger';

const router = Router();

// Start a full re-scan of an existing product (initial voting process)
router.post('/:id/scan', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const productId = parseInt(req.params.id, 10);

    if (isNaN(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const result = await productAddService.scanProduct(userId, productId);
    res.json(result);
  } catch (error: any) {
    if (error.message === 'Product not found') {
      return res.status(404).json({ error: error.message });
    }
    logger.error(`Product ${req.params.id} | Scan Failed | ${error}`, 'Products');
    res.status(500).json({ error: 'Failed to scan product' });
  }
});

// Confirm selection for a re-scanned product
router.post('/:id/confirm', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const productId = parseInt(req.params.id, 10);

    if (isNaN(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const updatedProduct = await productAddService.confirmProductSelection(userId, productId, req.body);
    res.json(updatedProduct);
  } catch (error: any) {
    if (error.message === 'Product not found') {
      return res.status(404).json({ error: error.message });
    }
    logger.error(`Product ${req.params.id} | Confirm Failed | ${error}`, 'Products');
    res.status(500).json({ error: 'Failed to confirm selection' });
  }
});

export default router;
