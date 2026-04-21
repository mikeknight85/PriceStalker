// OIDC client cache + flow state store.
//
// The openid-client Client is expensive to construct (requires hitting the
// provider's .well-known endpoint and parsing the JWKS). We cache one Client
// and invalidate it whenever the admin saves the auth config.
//
// Flow state (state, code_verifier, nonce) lives in memory keyed by the state
// value. This is safe with a single backend replica — see SSO_DESIGN.md.

import { Client, Issuer, TokenSet, generators } from 'openid-client';
import { authConfigQueries, AuthConfig } from '../models/auth-config';

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

export function isSsoEnabled(): boolean {
  return process.env.ENABLE_SSO === 'true';
}

// ---------------------------------------------------------------------------
// Redirect URI derivation
// ---------------------------------------------------------------------------

export function getRedirectUri(): string {
  const override = process.env.OIDC_REDIRECT_URI_OVERRIDE;
  if (override) return override;
  const base = process.env.PUBLIC_URL;
  if (!base) {
    throw new Error(
      'PUBLIC_URL env var is required when SSO is enabled (or set OIDC_REDIRECT_URI_OVERRIDE)',
    );
  }
  return `${base.replace(/\/+$/, '')}/api/auth/oidc/callback`;
}

export function getFrontendCompleteUrl(): string {
  const base = process.env.PUBLIC_URL;
  if (!base) {
    throw new Error('PUBLIC_URL env var is required when SSO is enabled');
  }
  return `${base.replace(/\/+$/, '')}/auth/sso-complete`;
}

// ---------------------------------------------------------------------------
// Client cache
// ---------------------------------------------------------------------------

let cachedClient: Client | null = null;
let cachedClientKey: string | null = null;

function configCacheKey(cfg: AuthConfig): string {
  // Cache key includes everything that would change the issued Client.
  // Redirect URI is environment-derived but we still include it so env changes
  // also invalidate.
  return JSON.stringify({
    issuer: cfg.oidc_issuer_url,
    clientId: cfg.oidc_client_id,
    clientSecret: cfg.oidc_client_secret, // rotating the secret should rebuild the client
    redirect: getRedirectUri(),
  });
}

export function invalidateOidcClient(): void {
  cachedClient = null;
  cachedClientKey = null;
}

export async function getOidcClient(): Promise<Client> {
  const cfg = await authConfigQueries.get();

  if (!cfg.oidc_enabled) {
    throw new Error('OIDC is not enabled');
  }
  if (!cfg.oidc_issuer_url || !cfg.oidc_client_id) {
    throw new Error('OIDC issuer URL and client ID are required');
  }

  const key = configCacheKey(cfg);
  if (cachedClient && cachedClientKey === key) {
    return cachedClient;
  }

  const issuer = await Issuer.discover(cfg.oidc_issuer_url);
  cachedClient = new issuer.Client({
    client_id: cfg.oidc_client_id,
    // openid-client expects undefined (not null) for public clients. We don't
    // support public clients for now; a secret is required.
    client_secret: cfg.oidc_client_secret ?? undefined,
    redirect_uris: [getRedirectUri()],
    response_types: ['code'],
  });
  cachedClientKey = key;
  return cachedClient;
}

// ---------------------------------------------------------------------------
// Flow state store
// ---------------------------------------------------------------------------

interface FlowState {
  codeVerifier: string;
  nonce: string;
  expiresAt: number;
}

const FLOW_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const flowStates = new Map<string, FlowState>();

// Periodic cleanup of expired entries. Single process, so this is fine.
const flowStateSweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of flowStates.entries()) {
    if (value.expiresAt < now) flowStates.delete(key);
  }
}, 60 * 1000);
// Don't keep the event loop alive just for the sweeper.
flowStateSweeper.unref?.();

export function storeFlowState(state: string, codeVerifier: string, nonce: string): void {
  flowStates.set(state, {
    codeVerifier,
    nonce,
    expiresAt: Date.now() + FLOW_STATE_TTL_MS,
  });
}

export function consumeFlowState(state: string): FlowState | null {
  const entry = flowStates.get(state);
  if (!entry) return null;
  flowStates.delete(state); // single-use
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}

// ---------------------------------------------------------------------------
// Flow helpers — thin wrappers over openid-client so route code stays small.
// ---------------------------------------------------------------------------

export interface StartedFlow {
  authorizationUrl: string;
  state: string;
}

export async function startFlow(): Promise<StartedFlow> {
  const cfg = await authConfigQueries.get();
  const client = await getOidcClient();

  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);
  const state = generators.state();
  const nonce = generators.nonce();

  storeFlowState(state, codeVerifier, nonce);

  const authorizationUrl = client.authorizationUrl({
    scope: cfg.oidc_scopes,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return { authorizationUrl, state };
}

export interface OidcClaims {
  issuer: string;
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export async function completeFlow(
  params: URLSearchParams,
  state: string,
): Promise<OidcClaims> {
  const client = await getOidcClient();

  const stored = consumeFlowState(state);
  if (!stored) {
    throw new Error('Invalid or expired OIDC state. Please retry the login.');
  }

  const tokenSet: TokenSet = await client.callback(
    getRedirectUri(),
    Object.fromEntries(params) as Record<string, string>,
    {
      state,
      nonce: stored.nonce,
      code_verifier: stored.codeVerifier,
    },
  );

  const claims = tokenSet.claims();

  // userinfo gives us email/name if not in the ID token (Authentik, for
  // example, puts them there only if the right scopes are requested).
  let email = typeof claims.email === 'string' ? claims.email : undefined;
  let emailVerified = claims.email_verified === true;
  let name =
    typeof claims.name === 'string'
      ? claims.name
      : typeof claims.preferred_username === 'string'
      ? claims.preferred_username
      : null;

  if (!email || typeof claims.email_verified !== 'boolean') {
    if (tokenSet.access_token) {
      const info = await client.userinfo(tokenSet.access_token);
      if (!email && typeof info.email === 'string') email = info.email;
      if (typeof info.email_verified === 'boolean') emailVerified = info.email_verified;
      if (!name) {
        if (typeof info.name === 'string') name = info.name;
        else if (typeof info.preferred_username === 'string') name = info.preferred_username;
      }
    }
  }

  if (!email) {
    throw new Error('Provider did not return an email claim — cannot log in.');
  }
  if (!emailVerified) {
    throw new Error(
      'Provider did not assert email_verified. Refusing to auto-link or create an account.',
    );
  }

  const issuer = typeof claims.iss === 'string' ? claims.iss : '';
  const subject = typeof claims.sub === 'string' ? claims.sub : '';
  if (!issuer || !subject) {
    throw new Error('Provider did not return a usable iss/sub pair.');
  }

  return { issuer, subject, email, emailVerified, name };
}
