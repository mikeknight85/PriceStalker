import { Umzug } from 'umzug';
import pool from './database';
import { logger } from '../utils/system/logger';
import path from 'path';

const umzug = new Umzug({
  migrations: {
    glob: [`../migrations/!(*.d.ts|*.map).${__filename.endsWith('.ts') ? 'ts' : 'js'}`, { cwd: __dirname }],
  },
  context: pool,
  storage: {
    async executed({ context: pool }) {
      await pool.query(`CREATE TABLE IF NOT EXISTS migrations (name VARCHAR(255) PRIMARY KEY)`);
      const { rows } = await pool.query('SELECT name FROM migrations');
      return rows.map((r: { name: string }) => r.name);
    },
    async logMigration({ name, context: pool }) {
      await pool.query('INSERT INTO migrations (name) VALUES ($1)', [name]);
    },
    async unlogMigration({ name, context: pool }) {
      await pool.query('DELETE FROM migrations WHERE name = $1', [name]);
    },
  },
  logger: console,
});

export type MigrationContext = typeof pool;

if (require.main === module) {
  umzug.runAsCLI().catch(err => {
    logger.error('Migration failed', 'Database', err);
    process.exit(1);
  });
}

export { umzug };
