import pool from '../../../../config/database';
import { 
  StockStatus,
  StockStatusHistory,
  StockStatusStats
} from '../../../../models/types';

export const stockHistoryRepository = {
  // Get all status changes for a product
  getByProductId: async (productId: number, days?: number): Promise<StockStatusHistory[]> => {
    let query = `
      SELECT * FROM stock_status_history
      WHERE product_id = $1
    `;
    const values: (number | string)[] = [productId];

    if (days) {
      query += ` AND changed_at >= CURRENT_TIMESTAMP - ($2 || ' days')::interval`;
      values.push(days.toString());
    }

    query += ' ORDER BY changed_at ASC';

    const result = await pool.query(query, values);
    const rows = result.rows as StockStatusHistory[];

    // Backfill history start if a days window is specified
    if (days) {
      const startOfPeriod = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const firstEntryTime = rows.length > 0 ? new Date(rows[0].changed_at) : null;

      if (!firstEntryTime || firstEntryTime > startOfPeriod) {
        const prePeriod = await stockHistoryRepository.getLatestBefore(productId, startOfPeriod);
        if (prePeriod) {
          rows.unshift({
            ...prePeriod,
            changed_at: startOfPeriod
          });
        }
      }
    }

    return rows;
  },

  // Get the most recent status before a specific date
  getLatestBefore: async (productId: number, beforeDate: Date): Promise<StockStatusHistory | null> => {
    const result = await pool.query(
      `SELECT * FROM stock_status_history
       WHERE product_id = $1 AND changed_at < $2
       ORDER BY changed_at DESC
       LIMIT 1`,
      [productId, beforeDate]
    );
    return (result.rows[0] as StockStatusHistory) || null;
  },

  // Get the most recent status for a product
  getLatest: async (productId: number): Promise<StockStatusHistory | null> => {
    const result = await pool.query(
      `SELECT * FROM stock_status_history
       WHERE product_id = $1
       ORDER BY changed_at DESC
       LIMIT 1`,
      [productId]
    );
    return result.rows[0] || null;
  },

  // Record a status change (only if status actually changed)
  recordChange: async (productId: number, status: StockStatus): Promise<StockStatusHistory | null> => {
    // First check if this is actually a change
    const latest = await stockHistoryRepository.getLatest(productId);

    // If status is the same as the last recorded status, don't create a new record
    if (latest && latest.status === status) {
      return null;
    }

    const result = await pool.query(
      `INSERT INTO stock_status_history (product_id, status)
       VALUES ($1, $2)
       RETURNING *`,
      [productId, status]
    );
    return result.rows[0];
  },

  // Calculate availability statistics
  getStats: async (productId: number, days: number = 30): Promise<StockStatusStats | null> => {
    // Get all status changes within the period
    const history = await stockHistoryRepository.getByProductId(productId, days);

    if (history.length === 0) {
      return null;
    }

    const now = new Date();
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Calculate time spent in each status
    let inStockMs = 0;
    let outOfStockMs = 0;
    const outages: number[] = []; // Duration of each outage in ms
    let currentOutageStart: Date | null = null;

    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      const entryTime = new Date(entry.changed_at);
      const nextEntry = history[i + 1];
      const nextTime = nextEntry ? new Date(nextEntry.changed_at) : now;

      // Only count time within our period
      const segmentStart = entryTime < periodStart ? periodStart : entryTime;
      const segmentEnd = nextTime;

      if (segmentEnd <= periodStart) continue; // This segment is before our period

      const duration = segmentEnd.getTime() - segmentStart.getTime();

      if (entry.status === 'in_stock' || entry.status === 'pre_order') {
        inStockMs += duration;
        if (currentOutageStart) {
          // Outage ended
          outages.push(entryTime.getTime() - currentOutageStart.getTime());
          currentOutageStart = null;
        }
      } else if (entry.status === 'out_of_stock') {
        outOfStockMs += duration;
        if (!currentOutageStart) {
          currentOutageStart = entryTime;
        }
      }
    }

    const totalMs = now.getTime() - periodStart.getTime();
    const availabilityPercent = totalMs > 0 ? Math.round((inStockMs / totalMs) * 100) : 0;

    const avgOutageDays = outages.length > 0
      ? outages.reduce((a, b) => a + b, 0) / outages.length / (24 * 60 * 60 * 1000)
      : null;

    const longestOutageDays = outages.length > 0
      ? Math.max(...outages) / (24 * 60 * 60 * 1000)
      : null;

    const currentStatus = history[history.length - 1].status;
    const lastChangeTime = new Date(history[history.length - 1].changed_at);
    const daysInCurrentStatus = Math.floor((now.getTime() - lastChangeTime.getTime()) / (24 * 60 * 60 * 1000));

    return {
      availability_percent: availabilityPercent,
      outage_count: outages.length,
      avg_outage_days: avgOutageDays ? Math.round(avgOutageDays * 10) / 10 : null,
      longest_outage_days: longestOutageDays ? Math.round(longestOutageDays * 10) / 10 : null,
      current_status: currentStatus,
      days_in_current_status: daysInCurrentStatus,
    };
  },
};
