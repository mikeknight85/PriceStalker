import pool from '../config/database';

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

// What the admin sees — no raw secret, just a boolean
export type AuthConfigAdminView = Omit<AuthConfig, 'oidc_client_secret' | 'updated_at'> & {
  has_client_secret: boolean;
  updated_at: string;
};

// What the public login page sees — enough to render the correct UI, nothing more
export interface AuthConfigPublicView {
  policy: AuthPolicy;
  oidc_enabled: boolean;
  oidc_provider_name: string | null;
}

// Mutations: undefined = unchanged, null = clear, string = set
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

export const authConfigQueries = {
  get: async (): Promise<AuthConfig> => {
    const result = await pool.query(
      `SELECT policy, oidc_enabled, oidc_provider_name, oidc_issuer_url,
              oidc_client_id, oidc_client_secret, oidc_scopes, oidc_jit_enabled,
              oidc_require_email_verified, updated_at
       FROM auth_config WHERE id = 1`,
    );
    // The startup migration ensures a row with id=1 always exists.
    return result.rows[0];
  },

  getAdminView: async (): Promise<AuthConfigAdminView> => {
    const cfg = await authConfigQueries.get();
    return {
      policy: cfg.policy,
      oidc_enabled: cfg.oidc_enabled,
      oidc_provider_name: cfg.oidc_provider_name,
      oidc_issuer_url: cfg.oidc_issuer_url,
      oidc_client_id: cfg.oidc_client_id,
      has_client_secret: cfg.oidc_client_secret !== null && cfg.oidc_client_secret !== '',
      oidc_scopes: cfg.oidc_scopes,
      oidc_jit_enabled: cfg.oidc_jit_enabled,
      oidc_require_email_verified: cfg.oidc_require_email_verified,
      updated_at: cfg.updated_at.toISOString(),
    };
  },

  getPublicView: async (): Promise<AuthConfigPublicView> => {
    const cfg = await authConfigQueries.get();
    return {
      policy: cfg.policy,
      oidc_enabled: cfg.oidc_enabled,
      oidc_provider_name: cfg.oidc_provider_name,
    };
  },

  update: async (changes: AuthConfigUpdate): Promise<AuthConfig> => {
    const fields: string[] = [];
    const values: (string | boolean | null)[] = [];
    let paramIndex = 1;

    const maybePush = (col: string, value: unknown) => {
      if (value === undefined) return;
      fields.push(`${col} = $${paramIndex++}`);
      values.push(value as string | boolean | null);
    };

    maybePush('policy', changes.policy);
    maybePush('oidc_enabled', changes.oidc_enabled);
    maybePush('oidc_provider_name', changes.oidc_provider_name);
    maybePush('oidc_issuer_url', changes.oidc_issuer_url);
    maybePush('oidc_client_id', changes.oidc_client_id);
    maybePush('oidc_client_secret', changes.oidc_client_secret);
    maybePush('oidc_scopes', changes.oidc_scopes);
    maybePush('oidc_jit_enabled', changes.oidc_jit_enabled);
    maybePush('oidc_require_email_verified', changes.oidc_require_email_verified);

    if (fields.length === 0) {
      return authConfigQueries.get();
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    const result = await pool.query(
      `UPDATE auth_config SET ${fields.join(', ')} WHERE id = 1
       RETURNING policy, oidc_enabled, oidc_provider_name, oidc_issuer_url,
                 oidc_client_id, oidc_client_secret, oidc_scopes, oidc_jit_enabled,
                 oidc_require_email_verified, updated_at`,
      values,
    );
    return result.rows[0];
  },
};
