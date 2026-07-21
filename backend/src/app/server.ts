import app from './app';
import { initializeDatabase } from './database';
import { runMigrationsOnBoot } from './migrateOnBoot';
import { logger } from '../utils/system/logger';
import { startScheduler } from '../services/scheduler';
import { startSettingsListener, databaseHealthMonitor } from '../services/domain/system';
import fs from 'fs';
import path from 'path';

import { currencyCache } from '../utils/i18n/currency/cache';

const PORT = process.env.PORT || 3001;

function rotateLogsOnStartup() {
  try {
    const logDir = process.env.LOG_DIR_PATH || path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) return;

    const filesToRotate = ['backend.log', 'error.log'];
    const maxStartupSize = 5 * 1024 * 1024; // 5MB

    for (const fileName of filesToRotate) {
      const filePath = path.join(logDir, fileName);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size > maxStartupSize) {
          const oldPath = path.join(logDir, `${fileName}.startup-old`);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
          fs.renameSync(filePath, oldPath);
          console.log(`Rotated large log file on startup: ${fileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        }
      }
    }
  } catch (err) {
    console.error('Failed to rotate logs on startup:', err);
  }
}

/**
 * Orchestrates the server startup sequence.
 */
export async function startServer() {
  try {
    // Rotate logs if they exceed size limit on startup
    rotateLogsOnStartup();

    // 1. Initialize DB and Logger Persistence
    await initializeDatabase();

    // 2. Bring the schema up to date before anything reads or writes it.
    //    Blocks startup on purpose: serving requests against a half-migrated
    //    schema fails in ways that look like application bugs.
    await runMigrationsOnBoot();

    // Preload regional/currency cache
    try {
      await currencyCache.refresh();
      logger.info('System | Server | Currency Cache pre-loaded successfully.', 'Server');
    } catch (cacheErr) {
      logger.error('System | Server | Failed to pre-load Currency Cache', 'Server', cacheErr);
    }

    // Start database settings change listener
    startSettingsListener();

    // Start database health checker monitor daemon
    databaseHealthMonitor.start();

    // 3. Start Express Listener
    app.listen(PORT, () => {
      logger.info(`System | Server | Running on port ${PORT}`, 'Server');

      // 4. Start the background price checker scheduler
      if (process.env.NODE_ENV !== 'test') {
        startScheduler();
      }
    });
  } catch (error) {
    logger.error('System | Server | Failed to start', 'Server', error);
    process.exit(1);
  }
}
