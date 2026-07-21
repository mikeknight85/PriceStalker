import { api } from '../../../api/client';

export type AuthPolicy = 'local' | 'oidc' | 'both';

/** The admin view never carries the raw secret, only whether one is stored. */
export interface AuthConfigAdminView {
  policy: AuthPolicy;
  oidc_enabled: boolean;
  oidc_provider_name: string | null;
  oidc_issuer_url: string | null;
  oidc_client_id: string | null;
  has_client_secret: boolean;
  oidc_scopes: string;
  oidc_jit_enabled: boolean;
  oidc_require_email_verified: boolean;
  updated_at: string;
}

/**
 * oidc_client_secret is three-state on the wire:
 *   undefined -> leave the stored secret alone
 *   null      -> clear it
 *   string    -> replace it
 */
export interface AuthConfigUpdate {
  policy?: AuthPolicy;
  oidc_enabled?: boolean;
  oidc_provider_name?: string | null;
  oidc_issuer_url?: string | null;
  oidc_client_id?: string | null;
  oidc_client_secret?: string | null;
  oidc_scopes?: string;
  oidc_jit_enabled?: boolean;
  oidc_require_email_verified?: boolean;
}

export interface DiscoveryResult {
  ok: boolean;
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  jwks_uri?: string;
  error?: string;
}

export const AuthConfigService = {
  get: () => api.get<AuthConfigAdminView>('/admin/auth'),
  update: (changes: AuthConfigUpdate) => api.put<AuthConfigAdminView>('/admin/auth', changes),
  testDiscovery: (issuer_url: string) =>
    api.post<DiscoveryResult>('/admin/auth/test-discovery', { issuer_url }),
};
