import pool from '../../../../config/database';

export interface PasswordResetToken {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

export const passwordResetRepository = {
  create: async (userId: number, tokenHash: string, expiresAt: Date): Promise<void> => {
    // One live token per user: a new request supersedes older unused ones.
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL',
      [userId]
    );
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );
  },

  findValidByHash: async (tokenHash: string): Promise<PasswordResetToken | null> => {
    const result = await pool.query(
      `SELECT * FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    );
    return result.rows[0] || null;
  },

  markUsed: async (id: number): Promise<void> => {
    await pool.query(
      'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  },

  deleteExpired: async (): Promise<number> => {
    const result = await pool.query(
      "DELETE FROM password_reset_tokens WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '1 day'"
    );
    return result.rowCount || 0;
  },
};
