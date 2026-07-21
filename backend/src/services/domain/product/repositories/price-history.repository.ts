import pool from '../../../../config/database';
import { 
  PriceHistory,
  AIStatus
} from '../../../../models/types';

export const priceHistoryRepository = {
  findByProductId: async (
    productId: number,
    days?: number
  ): Promise<PriceHistory[]> => {
    let query = `
      SELECT * FROM price_history
      WHERE product_id = $1
    `;
    const values: (number | string)[] = [productId];

    if (days) {
      query += ` AND recorded_at >= CURRENT_TIMESTAMP - ($2 || ' days')::interval`;
      values.push(days.toString());
    }

    query += ' ORDER BY recorded_at ASC';

    const result = await pool.query(query, values);
    return result.rows;
  },

  create: async (
    productId: number,
    price: number,
    currency: string = 'USD',
    aiStatus: AIStatus = null,
    details: any = null,
    priceType: string = 'standard'
  ): Promise<PriceHistory> => {
    const result = await pool.query(
      `INSERT INTO price_history (product_id, price, currency, ai_status, details, price_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [productId, price, currency, aiStatus, details, priceType]
    );
    return result.rows[0];
  },

  getLatest: async (productId: number, priceType: string = 'standard'): Promise<PriceHistory | null> => {
    const result = await pool.query(
      `SELECT * FROM price_history
       WHERE product_id = $1 AND price_type = $2
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [productId, priceType]
    );
    return result.rows[0] || null;
  },

  getStats: async (productId: number): Promise<{
    min_price: number;
    max_price: number;
    avg_price: number;
    price_count: number;
  } | null> => {
    const result = await pool.query(
      `SELECT
         MIN(price) as min_price,
         MAX(price) as max_price,
         AVG(price)::decimal(10,2) as avg_price,
         COUNT(*) as price_count
       FROM price_history
       WHERE product_id = $1`,
      [productId]
    );
    return result.rows[0] || null;
  },
};
