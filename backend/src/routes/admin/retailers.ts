import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { retailerService } from '../../services/domain/retailer';
import { asyncHandler, parseIdParam } from '../../utils/system/route-helpers';
import { randomUUID } from 'node:crypto';

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

/**
 * Re-runs AI auto-mapping for an existing retailer against a product URL.
 *
 * Auto-mapping normally fires only for an unknown domain or a shell config, so
 * the way to fix a bad retailer configuration was to delete the retailer and
 * re-scrape a product through it (issue #74). This re-runs the same generation
 * against a URL the administrator supplies and saves the result, without
 * destroying the row first.
 *
 * Keyed on the URL rather than a retailer id: the URL is what determines which
 * retailer this is, so the two cannot disagree.
 *
 * A product URL is required and cannot be inferred -- mapping works by reading a
 * real product page, and a retailer's home page has no price to learn from.
 */
router.post('/remap', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { url } = req.body ?? {};
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'A product URL from this retailer is required.' });
    return;
  }

  const { regionalMappingCache, configCache } = await import('../../utils/cache');
  const domain = await regionalMappingCache.getLookupDomain(url);

  const existing = await retailerService.getRetailerByDomain(domain);
  if (!existing) {
    res.status(404).json({ error: `No retailer is configured for ${domain}.` });
    return;
  }

  const { acquireHtml } = await import('../../services/scraper/acquisition');
  const { handleAutoMapping } = await import('../../services/scraper/orchestration/maintenance');

  const extractionSteps: string[] = [];
  const acquired = await acquireHtml({
    url,
    domain,
    domainConfig: existing,
    extractionSteps,
    requestId: `REMAP-${randomUUID()}`,
  });

  if (!acquired.html) {
    res.status(502).json({
      error: 'Could not fetch that page. If the retailer blocks plain requests, enable the Browser Scraper for it first.',
      trace: extractionSteps,
    });
    return;
  }

  const config = await handleAutoMapping({
    html: acquired.html,
    url,
    domain,
    currencyHint: existing.currency_hint || null,
    localeHint: 'en-US',
    extractionSteps,
    learnedFlags: acquired.learnedFlags || {},
    isRefresh: true,
  });

  if (!config) {
    res.status(422).json({
      error: 'Auto-mapping could not find a usable price on that page, so nothing was changed.',
      trace: extractionSteps,
    });
    return;
  }

  // The running scraper caches configs; without this the next scrape would keep
  // using the previous one for up to 30 minutes.
  configCache.invalidate(domain);

  res.json({ success: true, retailer: config, trace: extractionSteps });
}, 'Admin | Retailer Remap', 'Admin', 'Failed to re-run auto-mapping'));

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
