import { Pool } from 'pg';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

let dbPool: Pool | null = null;

/**
 * Initializes the logger with a database pool for persistence.
 * @param pool The PostgreSQL connection pool
 */
export const initLoggerPersistence = (pool: Pool) => {
  dbPool = pool;
};

export async function saveToDb(level: LogLevel, msg: string, context?: string, details?: any) {
  try {
    if (!dbPool) return;
    
    await dbPool.query(
      'INSERT INTO system_logs (level, context, message, details) VALUES ($1, $2, $3, $4)',
      [level, context || 'General', msg, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    // Silent fail for DB logging to prevent infinite loops or console spamming
  }
}
