import { MigrationContext } from '../config/migrate';

const DEFAULT_CHALLENGE_PHRASES = JSON.stringify([
  'are you a robot',
  'just a moment',
  'access denied',
  'verify you are human',
  'pardon our interruption',
  'security check',
  'attention required',
  'access is temporarily restricted',
  'unusual activity',
  'captcha-delivery',
  'datadome',
]);

/**
 * Seeds `generic_challenge_phrases` into `system_settings` so challenge detection
 * phrases are configurable by administrators without container rebuilds.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `
      INSERT INTO system_settings (key, value)
      VALUES (
        'generic_challenge_phrases',
        $1
      )
      ON CONFLICT (key) DO NOTHING;
    `,
      [DEFAULT_CHALLENGE_PHRASES]
    );

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

    await client.query(`
      DELETE FROM system_settings
      WHERE key = 'generic_challenge_phrases';
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
