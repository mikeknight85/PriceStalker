import { MigrationContext } from '../config/migrate';

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('generic_stock_selectors', '["[itemprop=\\"availability\\"]",".stock-status",".availability","[class*=\\"stock-status\\" i]","[class*=\\"availability\\" i]"]', CURRENT_TIMESTAMP)
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

    await client.query("DELETE FROM system_settings WHERE key = 'generic_stock_selectors'");

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
