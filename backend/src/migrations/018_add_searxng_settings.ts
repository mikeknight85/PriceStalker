import { MigrationContext } from '../config/migrate';

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const settings = [
      ['searxng_url', ''],
      ['searxng_enabled', 'false']
    ];

    for (const [key, value] of settings) {
      await client.query(
        'INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
        [key, value]
      );
    }

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

    await client.query(
      "DELETE FROM system_settings WHERE key IN ('searxng_url', 'searxng_enabled')"
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
