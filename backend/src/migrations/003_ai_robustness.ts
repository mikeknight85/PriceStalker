import { MigrationContext } from '../config/migrate';

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const settings = [
      ['ai_timeout', '30000'],
      ['ai_max_retries', '2'],
      ['prefer_jsonld_image', 'true'],
      ['jsonld_image_key', 'image'],
      ['jsonld_price_key', 'price'],
      ['jsonld_name_key', 'name'],
      ['deepseek_model', 'deepseek-chat'],
      ['groq_model', 'llama-3.3-70b-versatile'],
      ['mistral_model', 'mistral-large-latest']
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
    
    const keys = [
      'ai_timeout', 
      'ai_max_retries', 
      'external_api_token',
      'deepseek_api_key', 
      'deepseek_model',
      'groq_api_key', 
      'groq_model',
      'mistral_api_key', 
      'mistral_model'
    ];

    await client.query(
      'DELETE FROM system_settings WHERE key = ANY($1)',
      [keys]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
