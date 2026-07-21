import pool from '../../../../config/database';
import { 
  ProductWithLatestPrice, 
} from '../../../../models/types';

export const productQueryCoreRepository = {
  findByUserId: async (userId: number): Promise<ProductWithLatestPrice[]> => {
    const result = await pool.query(
      `SELECT p.*, ph.price as current_price, ph.currency, ph.ai_status,
              u.currency as converted_currency,
              CASE 
                WHEN ph.currency = u.currency THEN ph.price
                ELSE ph.price * er.rate 
              END as converted_price,
              COALESCE(rc.name, rc.domain) as retailer_name
       FROM products p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN LATERAL (
         SELECT price, currency, ai_status FROM price_history
         WHERE product_id = p.id AND price_type = 'standard'
         ORDER BY recorded_at DESC
         LIMIT 1
       ) ph ON true
       LEFT JOIN exchange_rates er ON er.from_currency = ph.currency AND er.to_currency = u.currency
       LEFT JOIN LATERAL (
         SELECT name, domain FROM retailer_configs
         WHERE p.url LIKE '%' || domain || '%'
         AND active = true
         ORDER BY length(domain) DESC
         LIMIT 1
       ) rc ON true
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [userId]
    );
    return result.rows;
  },

  findById: async (id: number, userId: number): Promise<ProductWithLatestPrice | null> => {
    const result = await pool.query(
      `SELECT p.*, ph.price as current_price, ph.currency, ph.ai_status,
              ph_m.price as member_price,
              ph_o.price as original_price,
              u.currency as converted_currency,
              CASE
                WHEN ph.currency = u.currency THEN ph.price
                ELSE ph.price * er.rate
              END as converted_price,
              COALESCE(rc.name, rc.domain) as retailer_name,
              (SELECT MIN(price) FROM price_history WHERE product_id = p.id) as min_price
       FROM products p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN LATERAL (
         SELECT price, currency, ai_status FROM price_history
         WHERE product_id = p.id AND price_type = 'standard'
         ORDER BY recorded_at DESC
         LIMIT 1
       ) ph ON true
       LEFT JOIN LATERAL (
         SELECT price FROM price_history
         WHERE product_id = p.id AND price_type = 'member-price'
         ORDER BY recorded_at DESC
         LIMIT 1
       ) ph_m ON true
       LEFT JOIN LATERAL (
         SELECT price FROM price_history
         WHERE product_id = p.id AND price_type = 'original-price'
         ORDER BY recorded_at DESC
         LIMIT 1
       ) ph_o ON true
       LEFT JOIN exchange_rates er ON er.from_currency = ph.currency AND er.to_currency = u.currency
       LEFT JOIN LATERAL (
         SELECT name, domain FROM retailer_configs
         WHERE p.url LIKE '%' || domain || '%'
         AND active = true
         ORDER BY length(domain) DESC
         LIMIT 1
       ) rc ON true
       WHERE p.id = $1 AND p.user_id = $2`,
      [id, userId]
    );
    return result.rows[0] || null;
  },
};
