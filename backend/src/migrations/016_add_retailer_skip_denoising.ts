import { MigrationContext } from '../config/migrate';

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  await pool.query('ALTER TABLE retailer_configs ADD COLUMN IF NOT EXISTS skip_denoising BOOLEAN DEFAULT FALSE');
};

export const down = async ({ context: pool }: { context: MigrationContext }) => {
  await pool.query('ALTER TABLE retailer_configs DROP COLUMN IF EXISTS skip_denoising');
};
