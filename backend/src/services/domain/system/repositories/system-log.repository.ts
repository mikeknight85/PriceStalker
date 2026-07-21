import pool from '../../../../config/database';
import { SystemLog } from '../../../../models/types';

export const systemLogRepository = {
  findAll: async (options: {
    page?: number;
    limit?: number;
    level?: string;
    context?: string;
    search?: string;
  }): Promise<{ logs: SystemLog[]; total: number; pages: number; contexts: string[] }> => {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, options.limit || 30);
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (options.level) {
      where.push(`level = $${paramIndex++}`);
      values.push(options.level);
    }
    if (options.context) {
      where.push(`context = $${paramIndex++}`);
      values.push(options.context);
    }
    if (options.search) {
      where.push(`message ILIKE $${paramIndex++}`);
      values.push(`%${options.search}%`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    
    // Get logs
    const logsResult = await pool.query(
      `SELECT * FROM system_logs ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    // Get total count for pagination
    const countResult = await pool.query(`SELECT COUNT(*) FROM system_logs ${whereClause}`, values);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get unique contexts for filters
    const contextsResult = await pool.query('SELECT DISTINCT context FROM system_logs ORDER BY context ASC');
    const contexts = contextsResult.rows.map(r => r.context);

    return {
      logs: logsResult.rows,
      total,
      pages: Math.ceil(total / limit),
      contexts
    };
  },

  deleteByIds: async (ids: number[]): Promise<number> => {
    if (ids.length === 0) return 0;
    const result = await pool.query('DELETE FROM system_logs WHERE id = ANY($1)', [ids]);
    return result.rowCount || 0;
  },

  clearAll: async (options?: { level?: string; context?: string }): Promise<number> => {
    const where: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (options?.level) {
      where.push(`level = $${paramIndex++}`);
      values.push(options.level);
    }
    if (options?.context) {
      where.push(`context = $${paramIndex++}`);
      values.push(options.context);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const result = await pool.query(`DELETE FROM system_logs ${whereClause}`, values);
    return result.rowCount || 0;
  },

  cleanup: async (days: number = 14): Promise<number> => {
    const result = await pool.query(`DELETE FROM system_logs WHERE created_at < NOW() - ($1 * INTERVAL '1 day')`, [days]);
    return result.rowCount || 0;
  }
};
