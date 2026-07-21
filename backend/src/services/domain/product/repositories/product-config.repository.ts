import pool from '../../../../config/database';
import { StockStatus, AIStatus } from '../../../../models/types';
import { calculateNextCheckSeconds } from '../../../../utils/system/scheduler-helpers';

export const productConfigRepository = {
  updateLastChecked: async (id: number, refreshInterval: number): Promise<void> => {
    const nextCheckSeconds = calculateNextCheckSeconds(refreshInterval);

    await pool.query(
      `UPDATE products
       SET last_checked = CURRENT_TIMESTAMP,
           next_check_at = CURRENT_TIMESTAMP + ($2 || ' seconds')::interval
       WHERE id = $1`,
      [id, nextCheckSeconds]
    );
  },

  updateStockStatus: async (id: number, stockStatus: StockStatus, aiStatus?: AIStatus): Promise<void> => {
    if (aiStatus) {
      await pool.query(
        'UPDATE products SET stock_status = $1, ai_status = $2 WHERE id = $3',
        [stockStatus, aiStatus, id]
      );
    } else {
      await pool.query(
        'UPDATE products SET stock_status = $1 WHERE id = $2',
        [stockStatus, id]
      );
    }
  },

  updateExtractionMethod: async (id: number, method: string): Promise<void> => {
    await pool.query(
      'UPDATE products SET preferred_extraction_method = $1, needs_price_review = false WHERE id = $2',
      [method, id]
    );
  },

  getPreferredExtractionMethod: async (id: number): Promise<string | null> => {
    const result = await pool.query(
      'SELECT preferred_extraction_method FROM products WHERE id = $1',
      [id]
    );
    return result.rows[0]?.preferred_extraction_method || null;
  },

  updateAnchorPrice: async (id: number, price: number): Promise<void> => {
    await pool.query(
      'UPDATE products SET anchor_price = $1 WHERE id = $2',
      [price, id]
    );
  },

  getAnchorPrice: async (id: number): Promise<number | null> => {
    const result = await pool.query(
      'SELECT anchor_price FROM products WHERE id = $1',
      [id]
    );
    return result.rows[0]?.anchor_price ? parseFloat(result.rows[0].anchor_price) : null;
  },

  isAiVerificationDisabled: async (id: number): Promise<boolean> => {
    const result = await pool.query(
      'SELECT ai_verification_disabled FROM products WHERE id = $1',
      [id]
    );
    return result.rows[0]?.ai_verification_disabled === true;
  },

  isAiExtractionDisabled: async (id: number): Promise<boolean> => {
    const result = await pool.query(
      'SELECT ai_extraction_disabled FROM products WHERE id = $1',
      [id]
    );
    return result.rows[0]?.ai_extraction_disabled === true;
  },
};
