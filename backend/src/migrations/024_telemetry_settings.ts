import { MigrationContext } from '../config/migrate';

/**
 * Migration 024: Telemetry Settings
 *
 * Adds system_settings keys for anonymous instance telemetry:
 * - telemetry_enabled: whether anonymous telemetry reporting is enabled (default: 'true')
 * - telemetry_instance_id: unique anonymous UUID identifying this self-hosted instance
 * - telemetry_last_ping_at: timestamp of the most recent telemetry ping
 *
 * Strict Privacy:
 * No IP addresses, URLs, credentials, or store names are transmitted.
 * Can be fully disabled via system settings or environment variable DISABLE_TELEMETRY=true.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES 
        ('telemetry_enabled', 'true', CURRENT_TIMESTAMP),
        ('telemetry_instance_id', gen_random_uuid()::text, CURRENT_TIMESTAMP),
        ('telemetry_last_ping_at', '', CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO NOTHING;
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
    await client.query(`
      DELETE FROM system_settings 
      WHERE key IN ('telemetry_enabled', 'telemetry_instance_id', 'telemetry_last_ping_at');
    `);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
