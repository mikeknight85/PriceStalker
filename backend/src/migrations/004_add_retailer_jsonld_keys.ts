import { MigrationContext } from '../config/migrate';

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  await pool.query(`
    ALTER TABLE retailer_configs 
    ADD COLUMN IF NOT EXISTS jsonld_image_key TEXT,
    ADD COLUMN IF NOT EXISTS jsonld_price_key TEXT,
    ADD COLUMN IF NOT EXISTS jsonld_name_key TEXT
  `);
};

export const down = async ({ context: pool }: { context: MigrationContext }) => {
  // Not dropping columns in down migration for safety
};
