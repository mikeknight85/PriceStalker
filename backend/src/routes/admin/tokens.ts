import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { systemApiTokenService } from '../../services/domain/token';
import {
  SCOPE_FULL,
  TokenScope,
  parseScopes
} from '../../services/domain/token/scopes';
import { asyncHandler, parseIdParam } from '../../utils/system/route-helpers';

const router = Router();

router.get('/', asyncHandler(async (_req: AuthRequest, res: Response) => {
  const tokens = await systemApiTokenService.listTokens();
  res.json(tokens);
}, 'Admin | Fetch System Tokens', 'Admin', 'Failed to fetch system API tokens'));

/** The vocabulary, so the UI does not have to carry its own copy. */
router.get('/scopes', asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json({ scopes: systemApiTokenService.describeScopes() });
}, 'Admin | Fetch Token Scopes', 'Admin', 'Failed to fetch token scopes'));

router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { label, description, expires_at, scopes } = req.body;
  if (!label) {
    res.status(400).json({ error: 'Label is required' });
    return;
  }

  // The REST shape before issue #217 was `{ label, description, expires_at }`,
  // and callers using it still exist. Omitting `scopes` therefore keeps the
  // behaviour those callers were written against -- full access -- rather than
  // handing them a token that 403s on the next line of their script. The
  // service logs it as a warning, and the Admin UI always sends an explicit
  // list, so the quiet case is the one nobody is looking at.
  const requested: TokenScope[] =
    scopes === undefined ? [SCOPE_FULL] : parseScopes(scopes);

  // Every token must name a user: `authMiddleware` no longer falls back to
  // user 1 for one that does not, so issuing an unlinked token would issue a
  // token that cannot authenticate. `adminMiddleware` has already resolved a
  // user by this point; the guard is here so that stays true.
  if (!req.userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const result = await systemApiTokenService.createSystemToken({
    label,
    description,
    admin_id: req.userId,
    expires_at: expires_at ? new Date(expires_at) : undefined,
    scopes: requested
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
