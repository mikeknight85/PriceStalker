import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { systemApiTokenService } from '../../services/domain/token';
import { asyncHandler, parseIdParam } from '../../utils/system/route-helpers';

const router = Router();

router.get('/', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const tokens = await systemApiTokenService.listTokens();
  res.json(tokens);
}, 'Admin | Fetch System Tokens', 'Admin', 'Failed to fetch system API tokens'));

router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { label, description, expires_at } = req.body;
  if (!label) {
    res.status(400).json({ error: 'Label is required' });
    return;
  }

  const result = await systemApiTokenService.createSystemToken({
    label,
    description,
    admin_id: req.userId,
    expires_at: expires_at ? new Date(expires_at) : undefined
  });

  res.status(201).json({
    message: 'System API token created successfully',
    token: result.token,
    systemToken: result.systemToken
  });
}, 'Admin | Create System Token', 'Admin', 'Failed to create system API token'));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseIdParam(req);
  if (id === null) {
    res.status(400).json({ error: 'Invalid token ID' });
    return;
  }

  const deleted = await systemApiTokenService.deleteToken(id);
  if (!deleted) {
    res.status(404).json({ error: 'Token not found' });
    return;
  }

  res.json({ message: 'System API token deleted successfully' });
}, 'Admin | Delete System Token', 'Admin', 'Failed to delete system API token'));

export default router;
