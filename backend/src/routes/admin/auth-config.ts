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

// POST /api/admin/auth/test-discovery -- fetch the provider's well-known
// document so an admin can validate an issuer URL before saving it. Saving a
// wrong URL otherwise only fails at the first real login attempt.
router.post('/test-discovery', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { issuer_url } = req.body as { issuer_url?: string };

  if (!issuer_url || typeof issuer_url !== 'string') {
    res.status(400).json({ ok: false, error: 'issuer_url is required' });
    return;
  }

  // Per spec the discovery document lives at
  //   {issuer}/.well-known/openid-configuration
  // Trailing slashes are normalised so either form can be pasted.
  const normalized = issuer_url.replace(/\/+$/, '');
  const discoveryUrl = `${normalized}/.well-known/openid-configuration`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(discoveryUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      res.status(400).json({
        ok: false,
        error: `Provider returned HTTP ${response.status} for ${discoveryUrl}`,
      });
      return;
    }

    const doc = (await response.json()) as Record<string, string | undefined>;

    // A usable discovery document must carry all four of these.
    const missing = (['issuer', 'authorization_endpoint', 'token_endpoint', 'jwks_uri'] as const)
      .filter(f => !doc[f]);
    if (missing.length > 0) {
      res.status(400).json({
        ok: false,
        error: `Discovery document missing required fields: ${missing.join(', ')}`,
      });
      return;
    }

    res.json({
      ok: true,
      issuer: doc.issuer,
      authorization_endpoint: doc.authorization_endpoint,
      token_endpoint: doc.token_endpoint,
      jwks_uri: doc.jwks_uri,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ ok: false, error: `Failed to reach ${discoveryUrl}: ${message}` });
  }
}, 'Admin | Auth Discovery', 'Auth', 'Discovery test failed'));

export default router;
