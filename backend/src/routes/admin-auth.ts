import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import {
  authConfigQueries,
  AuthPolicy,
  AuthConfigUpdate,
} from '../models/auth-config';
import { invalidateOidcClient } from '../services/oidc';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

const VALID_POLICIES: AuthPolicy[] = ['local', 'oidc', 'both'];

// GET /api/admin/auth — current config (no raw secret)
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const config = await authConfigQueries.getAdminView();
    res.json(config);
  } catch (error) {
    console.error('Error fetching auth config:', error);
    res.status(500).json({ error: 'Failed to fetch auth config' });
  }
});

// PUT /api/admin/auth — update config.
// oidc_client_secret semantics: undefined = keep existing, null/"" = clear,
// string = set to new value. Plain strings on the wire are the only way to
// rotate the secret (admin pastes new value).
router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as Partial<AuthConfigUpdate>;

    if (body.policy !== undefined && !VALID_POLICIES.includes(body.policy)) {
      res.status(400).json({ error: `policy must be one of: ${VALID_POLICIES.join(', ')}` });
      return;
    }

    // Normalize the secret field: the admin UI sends '' when the user clears
    // the masked input; treat that as "clear it". `undefined` means the field
    // wasn't touched and we leave the stored value alone.
    const changes: AuthConfigUpdate = { ...body };
    if (changes.oidc_client_secret === '') {
      changes.oidc_client_secret = null;
    }

    // Guardrail: enabling OIDC without an issuer URL or client ID will produce
    // a broken login page. Refuse rather than silently half-configure.
    if (changes.oidc_enabled === true) {
      const current = await authConfigQueries.get();
      const nextIssuer = changes.oidc_issuer_url ?? current.oidc_issuer_url;
      const nextClientId = changes.oidc_client_id ?? current.oidc_client_id;
      if (!nextIssuer || !nextClientId) {
        res.status(400).json({
          error: 'Cannot enable OIDC without both issuer URL and client ID configured',
        });
        return;
      }
    }

    await authConfigQueries.update(changes);
    // Any change might have rotated issuer/client/secret — force a fresh
    // openid-client discovery on the next flow.
    invalidateOidcClient();
    const updated = await authConfigQueries.getAdminView();
    res.json(updated);
  } catch (error) {
    console.error('Error updating auth config:', error);
    res.status(500).json({ error: 'Failed to update auth config' });
  }
});

// POST /api/admin/auth/test-discovery — hit the provider's well-known
// endpoint and report success/error so the admin can validate the issuer URL
// before saving it.
router.post('/test-discovery', async (req: AuthRequest, res: Response) => {
  const { issuer_url } = req.body as { issuer_url?: string };

  if (!issuer_url || typeof issuer_url !== 'string') {
    res.status(400).json({ ok: false, error: 'issuer_url is required' });
    return;
  }

  // OIDC discovery: per spec, the well-known doc lives at
  //   {issuer}/.well-known/openid-configuration
  // We normalize trailing slashes so users can paste the issuer URL either way.
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

    const doc = (await response.json()) as {
      issuer?: string;
      authorization_endpoint?: string;
      token_endpoint?: string;
      jwks_uri?: string;
    };

    // Sanity: a real OIDC discovery doc must have these fields
    const missing = (['issuer', 'authorization_endpoint', 'token_endpoint', 'jwks_uri'] as const)
      .filter((f) => !doc[f]);
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
});

export default router;
