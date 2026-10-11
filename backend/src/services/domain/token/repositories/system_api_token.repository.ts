import pool from '../../../../config/database';
import {
  SystemApiToken,
  CreateSystemApiToken,
  PublicSystemApiToken
} from '../../../../models/types';

/**
 * Columns that are safe to hand back over the API: everything except
 * `token_hash`. `token_prefix` is included deliberately -- it is the first 11
 * characters of a 64-hex secret, which is how an operator tells which token
 * sits in which config file, and 32 known bits of a 256-bit random value do
 * not help anyone guess the rest.
 */
const PUBLIC_COLUMNS = `
  id, admin_id, label, description, created_at, expires_at, last_used_at,
  scopes, token_prefix
`;

export const systemApiTokenRepository = {
  create: async (data: CreateSystemApiToken): Promise<SystemApiToken> => {
    const result = await pool.query(
      `INSERT INTO system_api_tokens
         (admin_id, token_hash, label, description, expires_at, scopes, token_prefix)
       VALUES ($1, $2, $3, $4, $5, $6::text[], $7)
       RETURNING *`,
      [
        data.admin_id || null,
        data.token_hash,
        data.label,
        data.description || null,
        data.expires_at || null,
        data.scopes,
        data.token_prefix
      ]
    );
    return result.rows[0];
  },

  listAll: async (): Promise<PublicSystemApiToken[]> => {
    const result = await pool.query(
      `SELECT ${PUBLIC_COLUMNS}
       FROM system_api_tokens
       ORDER BY created_at DESC`
    );
    return result.rows;
  },

  findById: async (id: number): Promise<SystemApiToken | null> => {
    const result = await pool.query(
      'SELECT * FROM system_api_tokens WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  deleteById: async (id: number): Promise<boolean> => {
    const result = await pool.query(
      'DELETE FROM system_api_tokens WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  findByTokenHash: async (tokenHash: string): Promise<SystemApiToken | null> => {
    const result = await pool.query(
      'SELECT * FROM system_api_tokens WHERE token_hash = $1',
      [tokenHash]
    );
    return result.rows[0] || null;
  },

  /**
   * Candidate rows for a presented token, found by its public prefix.
   *
   * Returns a list rather than a single row because `token_prefix` carries no
   * uniqueness constraint: 8 hex characters is a 4.3 billion space, so a
   * collision is vanishingly unlikely, but a UNIQUE index would turn that
   * unlikely event into a failed token creation. Verification bcrypt-compares
   * each candidate instead, which is correct either way.
   */
  findByPrefix: async (prefix: string): Promise<SystemApiToken[]> => {
    const result = await pool.query(
      'SELECT * FROM system_api_tokens WHERE token_prefix = $1',
      [prefix]
    );
    return result.rows;
  },

  /**
   * Rows issued before migration 022, which have no recoverable prefix.
   *
   * This is the only set the linear bcrypt scan has to cover: anything created
   * since stores a prefix and is found by index. The set shrinks to empty as
   * operators regenerate their tokens, at which point the scan can be deleted.
   */
  listWithoutPrefix: async (): Promise<SystemApiToken[]> => {
    const result = await pool.query(
      'SELECT * FROM system_api_tokens WHERE token_prefix IS NULL'
    );
    return result.rows;
  },

  updateLastUsed: async (id: number): Promise<void> => {
    await pool.query(
      'UPDATE system_api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  }
};
