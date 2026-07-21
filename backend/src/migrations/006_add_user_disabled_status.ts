import { MigrationContext } from '../config/migrate';

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT false');
};

export const down = async ({ context: pool }: { context: MigrationContext }) => {
  await pool.query('ALTER TABLE users DROP COLUMN disabled');
};
