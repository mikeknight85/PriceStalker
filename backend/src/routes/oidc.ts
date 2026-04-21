import { Router, Request, Response } from 'express';
import { userQueries } from '../models';
import { authConfigQueries } from '../models/auth-config';
import { generateToken } from '../middleware/auth';
import {
  isSsoEnabled,
  startFlow,
  completeFlow,
  getFrontendCompleteUrl,
  OidcClaims,
} from '../services/oidc';

const router = Router();

// ---------------------------------------------------------------------------
// Feature flag gate
// ---------------------------------------------------------------------------

router.use((req: Request, res: Response, next) => {
  if (!isSsoEnabled()) {
    res.status(404).json({ error: 'SSO is not enabled on this server' });
    return;
  }
  next();
});

// ---------------------------------------------------------------------------
// GET /api/auth/oidc/config/public
// The login page calls this unauthenticated to decide what to render.
// ---------------------------------------------------------------------------

router.get('/config/public', async (_req: Request, res: Response) => {
  try {
    const view = await authConfigQueries.getPublicView();
    res.json(view);
  } catch (error) {
    console.error('Error fetching public auth config:', error);
    res.status(500).json({ error: 'Failed to fetch auth config' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/oidc/start
// Kicks off the Authorization Code + PKCE flow and 302s to the IdP.
// ---------------------------------------------------------------------------

router.get('/start', async (_req: Request, res: Response) => {
  try {
    const cfg = await authConfigQueries.get();
    if (!cfg.oidc_enabled) {
      res.status(400).json({ error: 'OIDC is not enabled in auth config' });
      return;
    }

    const { authorizationUrl } = await startFlow();
    res.redirect(302, authorizationUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error starting OIDC flow:', error);
    // Fail closed: redirect to frontend with a visible error rather than
    // dumping a stack in JSON (user is mid-browser-flow, not an API call).
    const completeUrl = tryCompleteUrl();
    if (completeUrl) {
      res.redirect(302, `${completeUrl}#error=${encodeURIComponent(message)}`);
    } else {
      res.status(500).json({ error: `Failed to start OIDC flow: ${message}` });
    }
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/oidc/callback
// Provider redirects here with ?code=...&state=... on success or
// ?error=...&error_description=... on failure.
// ---------------------------------------------------------------------------

router.get('/callback', async (req: Request, res: Response) => {
  const completeUrl = tryCompleteUrl();

  const redirectWithError = (message: string) => {
    console.error('OIDC callback error:', message);
    if (completeUrl) {
      res.redirect(302, `${completeUrl}#error=${encodeURIComponent(message)}`);
    } else {
      res.status(500).json({ error: message });
    }
  };

  try {
    const { code, state, error, error_description } = req.query as Record<string, string>;

    // Provider-signalled error (user cancelled, policy denied, etc.)
    if (error) {
      redirectWithError(error_description || error);
      return;
    }

    if (!code || !state) {
      redirectWithError('Missing code or state in callback');
      return;
    }

    const cfg = await authConfigQueries.get();
    if (!cfg.oidc_enabled) {
      redirectWithError('OIDC is not enabled in auth config');
      return;
    }

    // The openid-client library needs the raw URLSearchParams, not Express's
    // already-parsed req.query.
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === 'string') params.append(k, v);
    }

    const claims = await completeFlow(params, state);
    const user = await upsertUserFromClaims(claims, cfg.oidc_jit_enabled);

    if (!user) {
      redirectWithError(
        'No PriceStalker account for this OIDC identity and JIT provisioning is disabled. Ask an admin to create an account.',
      );
      return;
    }

    const token = generateToken(user.id);
    // Hash fragment keeps the JWT out of server access logs.
    res.redirect(302, `${completeUrl}#token=${encodeURIComponent(token)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    redirectWithError(message);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tryCompleteUrl(): string | null {
  try {
    return getFrontendCompleteUrl();
  } catch {
    return null;
  }
}

/**
 * Identity resolution order, per SSO_DESIGN.md:
 *   1. Match by (oidc_issuer, oidc_subject) — returning user.
 *   2. Match by email — existing local user, auto-link to this OIDC identity.
 *   3. JIT-create a new OIDC user (if JIT is enabled).
 *
 * First user in the DB is promoted to admin regardless of the path taken,
 * matching the first-admin rule that already applies to local registration.
 */
async function upsertUserFromClaims(
  claims: OidcClaims,
  jitEnabled: boolean,
) {
  // 1. Match by stable OIDC identity
  const bySubject = await userQueries.findByOidcSubject(claims.issuer, claims.subject);
  if (bySubject) return bySubject;

  // 2. Match by email — link existing local account
  const byEmail = await userQueries.findByEmail(claims.email);
  if (byEmail) {
    await userQueries.linkOidcIdentity(byEmail.id, claims.issuer, claims.subject);
    return byEmail;
  }

  // 3. JIT-create
  if (!jitEnabled) return null;

  const existingCount = await userQueries.count();
  const newUser = await userQueries.createOidc({
    email: claims.email,
    name: claims.name,
    issuer: claims.issuer,
    subject: claims.subject,
  });

  // First user (this one makes the count 1) becomes admin.
  if (existingCount === 0) {
    await userQueries.setAdmin(newUser.id, true);
    newUser.is_admin = true;
  }

  return newUser;
}

export default router;
