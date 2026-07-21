import { MigrationContext } from '../config/migrate';

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add default_referrer setting if it doesn't exist
    await client.query(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('default_referrer', 'https://www.google.com/', CURRENT_TIMESTAMP)
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

    // Remove default_referrer setting
    await client.query("DELETE FROM system_settings WHERE key = 'default_referrer'");

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
