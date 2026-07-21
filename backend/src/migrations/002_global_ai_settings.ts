import { MigrationContext } from '../config/migrate';

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get AI settings from the first admin user (if columns exist)
    const { rows: columns } = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'ai_enabled'
    `);

    if (columns.length > 0) {
      const { rows } = await client.query(`
        SELECT ai_enabled, ai_verification_enabled, ai_provider, 
               anthropic_api_key, anthropic_model, 
               openai_api_key, openai_model, 
               ollama_base_url, ollama_model, 
               gemini_api_key, gemini_model
        FROM users 
        WHERE is_admin = true 
        ORDER BY id ASC 
        LIMIT 1
      `);

      if (rows.length > 0) {
        const settings = rows[0];
        const aiKeys = [
          ['ai_enabled', settings.ai_enabled],
          ['ai_verification_enabled', settings.ai_verification_enabled],
          ['ai_provider', settings.ai_provider],
          ['anthropic_api_key', settings.anthropic_api_key],
          ['anthropic_model', settings.anthropic_model],
          ['openai_api_key', settings.openai_api_key],
          ['openai_model', settings.openai_model],
          ['ollama_base_url', settings.ollama_base_url],
          ['ollama_model', settings.ollama_model],
          ['gemini_api_key', settings.gemini_api_key],
          ['gemini_model', settings.gemini_model]
        ];

        for (const [key, value] of aiKeys) {
          if (value !== null && value !== undefined) {
            await client.query(
              'INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
              [key, String(value)]
            );
          }
        }
      }
    }

    // 2. Drop the AI columns from users table
    await client.query(`
      ALTER TABLE users 
      DROP COLUMN IF EXISTS ai_enabled,
      DROP COLUMN IF EXISTS ai_verification_enabled,
      DROP COLUMN IF EXISTS ai_provider,
      DROP COLUMN IF EXISTS anthropic_api_key,
      DROP COLUMN IF EXISTS anthropic_model,
      DROP COLUMN IF EXISTS openai_api_key,
      DROP COLUMN IF EXISTS openai_model,
      DROP COLUMN IF EXISTS ollama_base_url,
      DROP COLUMN IF EXISTS ollama_model,
      DROP COLUMN IF EXISTS gemini_api_key,
      DROP COLUMN IF EXISTS gemini_model
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

    // Restore columns to users table
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN ai_enabled BOOLEAN DEFAULT false,
      ADD COLUMN ai_verification_enabled BOOLEAN DEFAULT false,
      ADD COLUMN ai_provider VARCHAR(20),
      ADD COLUMN anthropic_api_key TEXT,
      ADD COLUMN anthropic_model TEXT,
      ADD COLUMN openai_api_key TEXT,
      ADD COLUMN openai_model TEXT,
      ADD COLUMN ollama_base_url TEXT,
      ADD COLUMN ollama_model TEXT,
      ADD COLUMN gemini_api_key TEXT,
      ADD COLUMN gemini_model TEXT
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
