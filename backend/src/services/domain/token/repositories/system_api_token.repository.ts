import pool from '../../../../config/database';
import { SystemApiToken, CreateSystemApiToken } from '../../../../models/types';

export const systemApiTokenRepository = {
  create: async (data: CreateSystemApiToken): Promise<SystemApiToken> => {
    const result = await pool.query(
      `INSERT INTO system_api_tokens (admin_id, token_hash, label, description, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.admin_id || null, data.token_hash, data.label, data.description || null, data.expires_at || null]
    );
    return result.rows[0];
  },

  listAll: async (): Promise<Omit<SystemApiToken, 'token_hash'>[]> => {
    const result = await pool.query(
      `SELECT id, admin_id, label, description, created_at, expires_at, last_used_at 
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

  updateLastUsed: async (id: number): Promise<void> => {
    await pool.query(
      'UPDATE system_api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  }
};
