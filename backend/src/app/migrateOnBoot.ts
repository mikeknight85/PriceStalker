import pool from '../config/database';
import { umzug } from '../config/migrate';
import { logger } from '../utils/system/logger';

/**
 * Applies pending schema migrations during startup.
 *
 * Migrations were previously a manual developer step (`pnpm run db:migrate`), with
 * nothing invoking them at boot. Schema state therefore depended on an operator
 * remembering to run them, and a stale schema surfaced only as runtime errors on
 * whichever feature happened to touch a missing column.
 *
 * This blocks startup until migrations succeed. That is deliberate: serving
 * requests against a half-migrated schema produces confusing partial failures
 * that look like application bugs. A database that is merely slow to come up is
 * waited out; a database that is reachable but cannot be migrated is fatal.
 */
const MAX_ATTEMPTS = 30;
const RETRY_DELAY_MS = 2000;

async function waitForDatabase(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
        return;
      } finally {
        client.release();
      }
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          `Database unreachable after ${MAX_ATTEMPTS} attempts: ${(error as Error).message}`
        );
      }
      logger.warn(
        `System | Migrations | Database not ready (attempt ${attempt}/${MAX_ATTEMPTS}), retrying...`,
        'Database'
      );
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

export async function runMigrationsOnBoot(): Promise<void> {
  if (process.env.SKIP_MIGRATIONS === 'true') {
    logger.warn('System | Migrations | Skipped via SKIP_MIGRATIONS', 'Database');
    return;
  }

  await waitForDatabase();

  const pending = await umzug.pending();
  if (pending.length === 0) {
    logger.info('System | Migrations | Schema up to date', 'Database');
    return;
  }

  logger.info(
    `System | Migrations | Applying ${pending.length} migration(s): ${pending.map(m => m.name).join(', ')}`,
    'Database'
  );
  const applied = await umzug.up();
  logger.info(
    `System | Migrations | Applied ${applied.length} migration(s) successfully`,
    'Database'
  );
}
