import pool from '../../../../config/database';
import { UserProfile } from '../../../../models/types';

export const userProfileRepository = {
  addCategories: async (userId: number, categories: string[]): Promise<void> => {
    if (!categories || categories.length === 0) return;
    
    await pool.query(
      `UPDATE users 
       SET categories = (
         SELECT jsonb_agg(DISTINCT x)
         FROM (
           SELECT jsonb_array_elements_text(categories) as x FROM users WHERE id = $1
           UNION
           SELECT unnest($2::text[]) as x
         ) t
       )
       WHERE id = $1`,
      [userId, categories]
    );
  },

  getProfile: async (id: number): Promise<UserProfile | null> => {
    const result = await pool.query(
      'SELECT id, email, name, currency, locale, preferred_currency, is_admin, categories, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  updateProfile: async (
    id: number,
    updates: { name?: string; currency?: string; locale?: string; preferred_currency?: string }
  ): Promise<UserProfile | null> => {
    const fields: string[] = [];
    const values: (string | number)[] = [];
    let paramIndex = 1;

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
    if (updates.preferred_currency !== undefined) {
      fields.push(`preferred_currency = $${paramIndex++}`);
      values.push(updates.preferred_currency);
    }

    if (fields.length === 0) return null;

    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, email, name, currency, locale, preferred_currency, is_admin, categories, created_at`,
      values
    );
    return result.rows[0] || null;
  },
};
