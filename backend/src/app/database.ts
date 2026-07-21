import pool from '../config/database';
import { logger, initLoggerPersistence } from '../utils/system/logger';
import { databaseHealthMonitor } from '../services/domain/system/DatabaseHealthMonitor';

/**
 * Initializes database-related logic and performs connectivity verification.
 */
export async function initializeDatabase() {
  // Initialize logger persistence with the database pool
  initLoggerPersistence(pool);

  // Instead of exiting immediately, log pool-level unexpected errors and allow reconnection
  pool.on('error', (err) => {
    // CRITICAL: Use console.error directly to avoid recursive logging loops if the DB is down
    console.error('[Database] Unexpected database client pool error:', err);
    databaseHealthMonitor.forceCheck();
  });

  // Perform background startup check instead of blocking/crashing
  verifyConnectionBackground();
}

async function verifyConnectionBackground() {
  let attempts = 0;
  const maxAttempts = 12; // Try for 2 minutes (10s intervals)
  
  while (attempts < maxAttempts) {
    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1 FROM users LIMIT 1');
        logger.info('System | Database | Verification successful', 'Database');
        databaseHealthMonitor.markHealthy();
        return;
      } finally {
        client.release();
      }
    } catch (error) {
      attempts++;
      logger.warn(`System | Database | Connection attempt ${attempts}/${maxAttempts} failed. Retrying...`, 'Database');
      databaseHealthMonitor.markDegraded(error as Error);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  logger.error('System | Database | Verification failed after max attempts. Entering offline mode.', 'Database');
  databaseHealthMonitor.markFailed();
}
