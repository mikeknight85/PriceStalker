import pool from '../../../../config/database';
import { StockStatus, AIStatus } from '../../../../models/types';
import { calculateNextCheckSeconds } from '../../../../utils/system/scheduler-helpers';
import { asExecutor, type Executor } from './executor';

export const productConfigRepository = {
  /**
   * Records a transport failure: the retailer could not be reached, which says
   * nothing about whether the product still exists.
   *
   * Kept separate from the page-gone streak on purpose. Merging them would let
   * a retailer having a bad afternoon eventually mark products as gone, which is
   * the opposite of what the evidence supports.
   */
  recordFailure: async (id: number, reason: string): Promise<number> => {
    const result = await pool.query(
      `UPDATE products
          SET failure_streak = failure_streak + 1,
              last_failure_at = CURRENT_TIMESTAMP,
              unavailable_reason = $2
        WHERE id = $1
      RETURNING failure_streak`,
      [id, reason]
    );
    return result.rows[0]?.failure_streak ?? 0;
  },

  /** Clears failure state after a scrape that actually reached the page. */
  clearFailureState: async (id: number): Promise<void> => {
    await pool.query(
      `UPDATE products
          SET failure_streak = 0,
              unavailable_reason = NULL
        WHERE id = $1
          AND (failure_streak <> 0 OR unavailable_reason IS NOT NULL)`,
      [id]
    );
  },

  /** Records why a product is unavailable, without touching failure counters. */
  setUnavailableReason: async (id: number, reason: string | null): Promise<void> => {
    await pool.query('UPDATE products SET unavailable_reason = $2 WHERE id = $1', [id, reason]);
  },

  /**
   * Pauses or resumes monitoring, recording whether the system or a user did it.
   *
   * The distinction is what lets the UI say "we stopped checking because the
   * page is gone" rather than leaving a user wondering why their product went
   * quiet -- and what stops an automatic resume from overriding a deliberate
   * user pause.
   */
  setPaused: async (id: number, paused: boolean, byUser: boolean): Promise<void> => {
    await pool.query(
      'UPDATE products SET checking_paused = $2, auto_paused = $3 WHERE id = $1',
      [id, paused, paused ? !byUser : false]
    );
  },

  setPageGoneStreak: async (id: number, streak: number): Promise<void> => {
    await pool.query(
      'UPDATE products SET page_gone_streak = $2 WHERE id = $1',
      [id, streak]
    );
  },

  updateLastChecked: async (id: number, refreshInterval: number, executor?: Executor): Promise<void> => {
    const nextCheckSeconds = calculateNextCheckSeconds(refreshInterval);

    await asExecutor(executor).query(
      `UPDATE products
       SET last_checked = CURRENT_TIMESTAMP,
           next_check_at = CURRENT_TIMESTAMP + ($2 || ' seconds')::interval
       WHERE id = $1`,
      [id, nextCheckSeconds]
    );
  },

  updateStockStatus: async (id: number, stockStatus: StockStatus, aiStatus?: AIStatus, executor?: Executor): Promise<void> => {
    const db = asExecutor(executor);
    if (aiStatus) {
      await db.query(
        'UPDATE products SET stock_status = $1, ai_status = $2 WHERE id = $3',
        [stockStatus, aiStatus, id]
      );
    } else {
      await db.query(
        'UPDATE products SET stock_status = $1 WHERE id = $2',
        [stockStatus, id]
      );
    }
  },

  updateExtractionMethod: async (id: number, method: string, executor?: Executor): Promise<void> => {
    await asExecutor(executor).query(
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

  updateAnchorPrice: async (id: number, price: number, executor?: Executor): Promise<void> => {
    await asExecutor(executor).query(
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
