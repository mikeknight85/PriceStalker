import { MigrationContext } from '../config/migrate';

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add exclusion_selectors to retailer_configs
    await client.query('ALTER TABLE retailer_configs ADD COLUMN IF NOT EXISTS exclusion_selectors JSONB NOT NULL DEFAULT \'[]\'::jsonb');

    // Add generic_exclusion_selectors to system_settings
    await client.query(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('generic_exclusion_selectors', '[]', CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO NOTHING
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const down = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('ALTER TABLE retailer_configs DROP COLUMN IF EXISTS exclusion_selectors');
    await client.query("DELETE FROM system_settings WHERE key = 'generic_exclusion_selectors'");

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
