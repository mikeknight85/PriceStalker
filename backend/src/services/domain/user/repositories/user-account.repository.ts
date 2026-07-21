import pool from '../../../../config/database';
import { User, UserProfile } from '../../../../models/types';

export const userAccountRepository = {
  findByEmail: async (email: string): Promise<User | null> => {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  },

  findById: async (id: number): Promise<User | null> => {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  create: async (email: string, passwordHash: string, currency: string = 'AUD', locale: string = 'en-AU'): Promise<User> => {
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, currency, locale) VALUES ($1, $2, $3, $4) RETURNING *',
      [email, passwordHash, currency, locale]
    );
    return result.rows[0];
  },

  // --- OIDC / SSO identity ---------------------------------------------------

  /** Look up a user by their stable external identity (issuer + subject). */
  findByOidcSubject: async (issuer: string, subject: string): Promise<User | null> => {
    const result = await pool.query(
      'SELECT * FROM users WHERE oidc_issuer = $1 AND oidc_subject = $2',
      [issuer, subject]
    );
    return result.rows[0] || null;
  },

  /** Bind an existing local account to an external identity. */
  linkOidcIdentity: async (id: number, issuer: string, subject: string): Promise<boolean> => {
    const result = await pool.query(
      `UPDATE users
          SET oidc_issuer = $1, oidc_subject = $2,
              auth_provider = CASE WHEN auth_provider = 'local' THEN 'oidc' ELSE auth_provider END
        WHERE id = $3`,
      [issuer, subject, id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Create a user from OIDC claims (JIT provisioning). password_hash is left
   * NULL deliberately: these accounts have no password and must not be able to
   * authenticate through the local login path.
   */
  createOidc: async (
    params: { email: string; name: string | null; issuer: string; subject: string },
    currency: string = 'AUD',
    locale: string = 'en-AU'
  ): Promise<User> => {
    const result = await pool.query(
      `INSERT INTO users (email, name, oidc_issuer, oidc_subject, auth_provider, currency, locale)
       VALUES ($1, $2, $3, $4, 'oidc', $5, $6)
       RETURNING *`,
      [params.email, params.name, params.issuer, params.subject, currency, locale]
    );
    return result.rows[0];
  },

  count: async (): Promise<number> => {
    const result = await pool.query('SELECT COUNT(*)::int AS n FROM users');
    return result.rows[0].n;
  },

  updatePassword: async (id: number, passwordHash: string): Promise<boolean> => {
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  // Admin queries
  findAll: async (): Promise<UserProfile[]> => {
    const result = await pool.query(
      'SELECT id, email, name, currency, locale, is_admin, disabled, created_at FROM users ORDER BY created_at ASC'
    );
    return result.rows;
  },

  delete: async (id: number): Promise<boolean> => {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  setAdmin: async (id: number, isAdmin: boolean): Promise<boolean> => {
    const result = await pool.query(
      'UPDATE users SET is_admin = $1 WHERE id = $2',
      [isAdmin, id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  adminUpdateUser: async (
    id: number,
    updates: { email?: string; name?: string; currency?: string; locale?: string; password_hash?: string; is_admin?: boolean; disabled?: boolean }
  ): Promise<UserProfile | null> => {
    const fields: string[] = [];
    const values: (string | boolean | number | null)[] = [];
    let paramIndex = 1;

    if (updates.email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      values.push(updates.email);
    }
    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.currency !== undefined) {
      fields.push(`currency = $${paramIndex++}`);
      values.push(updates.currency);
    }
    if (updates.locale !== undefined) {
      fields.push(`locale = $${paramIndex++}`);
      values.push(updates.locale);
    }
    if (updates.password_hash !== undefined) {
      fields.push(`password_hash = $${paramIndex++}`);
      values.push(updates.password_hash);
    }
    if (updates.is_admin !== undefined) {
      fields.push(`is_admin = $${paramIndex++}`);
      values.push(updates.is_admin);
    }
    if (updates.disabled !== undefined) {
      fields.push(`disabled = $${paramIndex++}`);
      values.push(updates.disabled);
    }

    if (fields.length === 0) return null;

    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, email, name, currency, locale, is_admin, disabled, created_at`,
      values
    );
    return result.rows[0] || null;
  },
};
