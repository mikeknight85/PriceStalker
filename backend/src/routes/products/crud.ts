import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { productAddService, productHistoryService } from '../../services/domain/product';
import { asyncHandler, parseIdParam } from '../../utils/system/route-helpers';

const router = Router();

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const products = await productHistoryService.getUserProducts(userId);
  res.json(products);
}, 'Product', 'Products', 'Failed to fetch products'));

router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { url } = req.body;
  const userId = req.userId!;
  
  if (!url) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  const result = await productAddService.addProduct(userId, url, req.body);
  
  if (result.needsReview) {
    res.json(result);
  } else {
    res.status(201).json(result);
  }
}, 'Product | Add', 'Products', 'Failed to add product'));

router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const productId = parseIdParam(req);

  if (productId === null) {
    res.status(400).json({ error: 'Invalid product ID' });
    return;
  }

  const product = await productHistoryService.getProduct(productId, userId);

  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  res.json(product);
}, 'Product | Fetch', 'Products', 'Failed to fetch product'));

router.put('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const productId = parseIdParam(req);

  if (productId === null) {
    res.status(400).json({ error: 'Invalid product ID' });
    return;
  }

  const updated = await productHistoryService.updateProduct(productId, userId, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  res.json(updated);
}, 'Product | Update', 'Products', 'Failed to update product'));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const productId = parseIdParam(req);

  if (productId === null) {
    res.status(400).json({ error: 'Invalid product ID' });
    return;
  }

  const deleted = await productHistoryService.deleteProduct(productId, userId);

  if (!deleted) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  res.json({ message: 'Product deleted successfully' });
}, 'Product | Delete', 'Products', 'Failed to delete product'));

export default router;
