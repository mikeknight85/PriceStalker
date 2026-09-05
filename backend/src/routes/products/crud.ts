import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { productAddService, productHistoryService } from '../../services/domain/product';
import { itemRepository } from '../../models';
import { asyncHandler, parseIdParam, callerIsAdmin } from '../../utils/system/route-helpers';

const router = Router();


router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const products = await productHistoryService.getUserProducts(userId);
  res.json(products);
}, 'Product', 'Products', 'Failed to fetch products'));

/**
 * The same listings, grouped into items (issue #143).
 *
 * Declared before `/:id` on purpose: Express matches in order, and a route
 * added below it would be swallowed by the id parameter and fail as
 * "invalid product id".
 */
router.get('/items', asyncHandler(async (req: AuthRequest, res: Response) => {
  const items = await productHistoryService.getUserItems(req.userId!);
  res.json(items);
}, 'Product', 'Products', 'Failed to fetch items'));

/**
 * Links a store you already track to another product -- "these two are the
 * same thing" (issue #143).
 *
 * Declared before `/:id` for the same reason as `/items`: Express matches in
 * order.
 */
router.post('/items/:itemId/listings', asyncHandler(async (req: AuthRequest, res: Response) => {
  const itemId = parseIdParam(req, 'itemId');
  if (itemId === null) {
    res.status(400).json({ error: 'Invalid product id' });
    return;
  }
  const productId = Number(req.body?.productId);
  if (!Number.isInteger(productId) || productId <= 0) {
    res.status(400).json({ error: 'A productId is required' });
    return;
  }
  const result = await itemRepository.attachListing(productId, itemId, req.userId!);
  res.json(result);
}, 'Product', 'Products', 'Failed to link the store'));

/** Undoes the above: gives a store its own product entry again. */
router.post('/:id/detach', asyncHandler(async (req: AuthRequest, res: Response) => {
  const productId = parseIdParam(req);
  if (productId === null) {
    res.status(400).json({ error: 'Invalid store id' });
    return;
  }
  const item = await itemRepository.detachListing(productId, req.userId!);
  res.json(item);
}, 'Product', 'Products', 'Failed to separate the store'));

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

  const product = await productHistoryService.getProduct(productId, userId, await callerIsAdmin(req));

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

  const updated = await productHistoryService.updateProduct(productId, userId, req.body, await callerIsAdmin(req));
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

  const deleted = await productHistoryService.deleteProduct(productId, userId, await callerIsAdmin(req));

  if (!deleted) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  res.json({ message: 'Product deleted successfully' });
}, 'Product | Delete', 'Products', 'Failed to delete product'));

export default router;
