export interface SystemApiToken {
  id: number;
  admin_id: number | null;
  token_hash: string;
  label: string;
  description: string | null;
  created_at: Date;
  expires_at: Date | null;
  last_used_at: Date | null;
  /**
   * What this token is allowed to do. See
   * `services/domain/token/scopes.ts` for the vocabulary.
   *
   * Tokens issued before migration 022 were backfilled with `['*']`.
   */
  scopes: string[];
  /**
   * The first 11 characters of the token (`ps_` plus 8 hex), stored so
   * verification can find the one candidate row by index instead of
   * bcrypt-comparing every row.
   *
   * Null for tokens issued before migration 022 -- only the bcrypt hash was
   * stored then, so the prefix is unrecoverable. Null therefore means "this
   * row can only be found by the legacy scan", and the Admin UI shows such a
   * token as deprecated.
   */
  token_prefix: string | null;
}

/** A system token row with a public shape -- never carries the hash. */
export type PublicSystemApiToken = Omit<SystemApiToken, 'token_hash'>;

export interface CreateSystemApiToken {
  admin_id?: number;
  token_hash: string;
  label: string;
  description?: string;
  expires_at?: Date;
  scopes: string[];
  token_prefix: string;
}
