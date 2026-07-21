import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { retailerService } from '../../services/domain/retailer';
import { asyncHandler, parseIdParam } from '../../utils/system/route-helpers';

const router = Router();

router.get('/', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const retailers = await retailerService.getAllRetailers(false);
  res.json(retailers);
}, 'Admin | Fetch Retailers', 'Admin', 'Failed to fetch retailers'));

router.get('/lookup', asyncHandler(async (req: AuthRequest, res: Response) => {
  const url = req.query.url as string;
  if (!url) {
    res.status(400).json({ error: 'URL query parameter is required' });
    return;
  }
  const config = await retailerService.getRetailerForUrl(url);
  if (!config) {
    res.status(404).json({ error: 'No configuration found for this URL' });
    return;
  }
  res.json(config);
}, 'Admin | Lookup Retailer', 'Admin', 'Failed to lookup retailer configuration'));

router.get('/domain/:domain', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { domain } = req.params;
  const retailer = await retailerService.getRetailerByDomain(domain);
  if (!retailer) {
    res.status(404).json({ error: 'Retailer not found' });
    return;
  }
  res.json(retailer);
}, 'Admin | Fetch Retailer by Domain', 'Admin', 'Failed to fetch retailer'));

router.post('/test', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { url, config } = req.body;
  if (!url) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  const result = await retailerService.testRetailerConfig(url, config);
  res.json(result);
}, 'System | Debug', 'Debug', 'Failed to run extraction test'));

router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const config = req.body;
  const updated = await retailerService.upsertRetailer(config);
  res.json(updated);
}, 'Admin | Upsert Retailer', 'Admin', 'Failed to save retailer'));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseIdParam(req, 'id');
  if (!id) {
    res.status(400).json({ error: 'Invalid retailer ID' });
    return;
  }
  const success = await retailerService.deleteRetailer(id);
  if (!success) {
    res.status(404).json({ error: 'Retailer not found' });
    return;
  }
  res.json({ success: true });
}, 'Admin | Delete Retailer', 'Admin', 'Failed to delete retailer'));

export default router;
