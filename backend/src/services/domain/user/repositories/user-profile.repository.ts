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
      'SELECT id, email, name, currency, locale, preferred_currency, default_refresh_interval, is_admin, categories, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Just this user's preferred check interval for new products (issue #239).
   *
   * A separate, one-column read because the product-add path needs it on every
   * add and has no use for the rest of the profile. NULL means the account has
   * no preference and should follow the instance default.
   */
  getDefaultRefreshInterval: async (id: number): Promise<number | null> => {
    const result = await pool.query(
      'SELECT default_refresh_interval FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0]?.default_refresh_interval ?? null;
  },

  updateProfile: async (
    id: number,
    updates: {
      name?: string;
      currency?: string | null;
      locale?: string | null;
      preferred_currency?: string | null;
      default_refresh_interval?: number | null;
    }
  ): Promise<UserProfile | null> => {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
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
    // null is a value here, not an omission: it clears the preference so new
    // products follow the instance default again (issue #239).
    if (updates.default_refresh_interval !== undefined) {
      fields.push(`default_refresh_interval = $${paramIndex++}`);
      values.push(updates.default_refresh_interval);
    }

    if (fields.length === 0) return null;

    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, email, name, currency, locale, preferred_currency, default_refresh_interval, is_admin, categories, created_at`,
      values
    );
    return result.rows[0] || null;
  },
};
