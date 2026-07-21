import { Router, Request, Response } from 'express';
import { authConfigRepository } from '../../services/domain/auth/repositories/auth-config.repository';
import { authService } from '../../services/domain/auth';
import {
  isSsoEnabled,
  startFlow,
  completeFlow,
  getFrontendCompleteUrl,
} from '../../services/domain/auth/oidc';
import { generateToken } from '../../middleware/auth';
import { logger } from '../../utils/system/logger';

const router = Router();

// ---------------------------------------------------------------------------
// Feature flag gate
// ---------------------------------------------------------------------------

router.use((_req: Request, res: Response, next) => {
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
    res.json(await authConfigRepository.getPublicView());
  } catch (error) {
    logger.error('Auth | OIDC | Failed to fetch public auth config', 'Auth', error);
    res.status(500).json({ error: 'Failed to fetch auth config' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/oidc/start
// Kicks off Authorization Code + PKCE and 302s to the identity provider.
// ---------------------------------------------------------------------------

router.get('/start', async (_req: Request, res: Response) => {
  try {
    const cfg = await authConfigRepository.get();
    if (!cfg.oidc_enabled) {
      res.status(400).json({ error: 'OIDC is not enabled in auth config' });
      return;
    }

    const { authorizationUrl } = await startFlow();
    res.redirect(302, authorizationUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Auth | OIDC | Failed to start flow', 'Auth', error);
    // Fail visibly to the user rather than dumping JSON: they are mid-browser
    // flow, not making an API call.
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
// The provider redirects here with ?code&state, or ?error&error_description.
// ---------------------------------------------------------------------------

router.get('/callback', async (req: Request, res: Response) => {
  const completeUrl = tryCompleteUrl();

  const redirectWithError = (message: string) => {
    logger.error(`Auth | OIDC | Callback failed: ${message}`, 'Auth');
    if (completeUrl) {
      res.redirect(302, `${completeUrl}#error=${encodeURIComponent(message)}`);
    } else {
      res.status(500).json({ error: message });
    }
  };

  try {
    const { code, state, error, error_description } = req.query as Record<string, string>;

    // Provider-signalled failure: user cancelled, policy denied, and so on.
    if (error) {
      redirectWithError(error_description || error);
      return;
    }

    if (!code || !state) {
      redirectWithError('Missing code or state in callback');
      return;
    }

    const cfg = await authConfigRepository.get();
    if (!cfg.oidc_enabled) {
      redirectWithError('OIDC is not enabled in auth config');
      return;
    }

    // openid-client needs raw URLSearchParams, not Express's parsed req.query.
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === 'string') params.append(k, v);
    }

    const claims = await completeFlow(params, state);
    const user = await authService.resolveOidcUser(claims, cfg.oidc_jit_enabled);

    if (!user) {
      redirectWithError(
        'No PriceStalker account for this OIDC identity and JIT provisioning is disabled. Ask an admin to create an account.'
      );
      return;
    }

    const token = generateToken(user.id);
    logger.info(`Auth | OIDC | Login succeeded | ID: ${user.id} | Email: ${user.email}`, 'Auth');
    // The fragment keeps the JWT out of server access logs and Referer headers.
    res.redirect(302, `${completeUrl}#token=${encodeURIComponent(token)}`);
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : 'Unknown error');
  }
});

function tryCompleteUrl(): string | null {
  try {
    return getFrontendCompleteUrl();
  } catch {
    return null;
  }
}

export default router;
