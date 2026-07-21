import { MigrationContext } from '../config/migrate';

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS system_api_tokens (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        token_hash VARCHAR(255) NOT NULL,
        label VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        last_used_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_system_api_tokens_hash ON system_api_tokens(token_hash);
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
    await client.query('DROP TABLE IF EXISTS system_api_tokens');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
