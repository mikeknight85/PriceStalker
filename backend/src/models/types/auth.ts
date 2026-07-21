export type AuthPolicy = 'local' | 'oidc' | 'both';

export interface AuthConfig {
  policy: AuthPolicy;
  oidc_enabled: boolean;
  oidc_provider_name: string | null;
  oidc_issuer_url: string | null;
  oidc_client_id: string | null;
  oidc_client_secret: string | null;
  oidc_scopes: string;
  oidc_jit_enabled: boolean;
  oidc_require_email_verified: boolean;
  updated_at: Date;
}

/** What an admin sees: never the raw secret, only whether one is set. */
export type AuthConfigAdminView = Omit<AuthConfig, 'oidc_client_secret' | 'updated_at'> & {
  has_client_secret: boolean;
  updated_at: string;
};

/** What the unauthenticated login page sees: enough to render, nothing more. */
export interface AuthConfigPublicView {
  policy: AuthPolicy;
  oidc_enabled: boolean;
  oidc_provider_name: string | null;
}

/** Mutations: undefined = leave unchanged, null = clear, value = set. */
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

/** Identity claims resolved from a completed OIDC flow. */
export interface OidcClaims {
  issuer: string;
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}
