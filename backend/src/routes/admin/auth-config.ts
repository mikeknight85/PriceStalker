import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { authConfigRepository } from '../../services/domain/auth/repositories/auth-config.repository';
import { invalidateOidcClient } from '../../services/domain/auth/oidc';
import { AuthPolicy, AuthConfigUpdate } from '../../models/types';
import { asyncHandler } from '../../utils/system/route-helpers';

// Mounted under /api/admin, which already applies auth + admin middleware.
const router = Router();

const VALID_POLICIES: AuthPolicy[] = ['local', 'oidc', 'both'];

// GET /api/admin/auth -- current config, never the raw secret
router.get('/', asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.json(await authConfigRepository.getAdminView());
}, 'Admin | Auth Config', 'Auth', 'Failed to fetch auth config'));

// PUT /api/admin/auth -- update config.
//
// oidc_client_secret semantics: undefined keeps the existing value, null or ''
// clears it, a string sets it. Pasting a new value is the only way to rotate,
// since the secret is never sent to the client.
router.put('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = req.body as Partial<AuthConfigUpdate>;

  if (body.policy !== undefined && !VALID_POLICIES.includes(body.policy)) {
    const err = new Error(`policy must be one of: ${VALID_POLICIES.join(', ')}`);
    (err as any).statusCode = 400;
    throw err;
  }

  const changes: AuthConfigUpdate = { ...body };
  // The admin UI sends '' when the masked input is cleared; treat that as
  // "remove the secret". undefined means the field was not touched.
  if (changes.oidc_client_secret === '') {
    changes.oidc_client_secret = null;
  }

  // Guardrail: enabling OIDC without an issuer or client ID yields a login page
  // that cannot work. Refuse rather than half-configure it.
  if (changes.oidc_enabled === true) {
    const current = await authConfigRepository.get();
    const nextIssuer = changes.oidc_issuer_url ?? current.oidc_issuer_url;
    const nextClientId = changes.oidc_client_id ?? current.oidc_client_id;
    if (!nextIssuer || !nextClientId) {
      const err = new Error('Cannot enable OIDC without both issuer URL and client ID configured');
      (err as any).statusCode = 400;
      throw err;
    }
  }

  await authConfigRepository.update(changes);
  // Any of issuer/client/secret may have rotated: force fresh discovery on the
  // next flow rather than reusing a client built from stale config.
  invalidateOidcClient();

  res.json(await authConfigRepository.getAdminView());
}, 'Admin | Auth Config', 'Auth', 'Failed to update auth config'));

export default router;
