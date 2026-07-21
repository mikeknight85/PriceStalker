import { MigrationContext } from '../config/migrate';

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  await pool.query('ALTER TABLE price_history ADD COLUMN IF NOT EXISTS details JSONB');
};

export const down = async ({ context: pool }: { context: MigrationContext }) => {
  await pool.query('ALTER TABLE price_history DROP COLUMN IF EXISTS details');
};
