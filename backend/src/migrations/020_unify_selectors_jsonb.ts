import { MigrationContext } from '../config/migrate';

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Convert original_price_selectors to JSONB (only if it is not already JSONB)
    const colCheck = await client.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'retailer_configs' AND column_name = 'original_price_selectors'
    `);
    const isJsonb = colCheck.rows[0]?.data_type?.toLowerCase() === 'jsonb';

    if (!isJsonb) {
      await client.query(`
        ALTER TABLE retailer_configs 
        ALTER COLUMN original_price_selectors TYPE JSONB 
        USING array_to_json(original_price_selectors)::jsonb
      `);
    }
    await client.query(`ALTER TABLE retailer_configs ALTER COLUMN original_price_selectors SET DEFAULT '[]'::jsonb`);

    // 2. Merge price_regex into price_selectors (if column exists)
    const priceRegexCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'retailer_configs' AND column_name = 'price_regex'
    `);
    if (priceRegexCheck.rows.length > 0) {
      await client.query(`
        UPDATE retailer_configs 
        SET price_selectors = price_selectors || (
          SELECT COALESCE(jsonb_agg('regex:/' || r.val || '/'), '[]'::jsonb)
          FROM jsonb_array_elements_text(price_regex) AS r(val)
        )
        WHERE price_regex IS NOT NULL AND jsonb_array_length(price_regex) > 0
      `);
    }

    // 3. Merge name_regex into name_selectors (if column exists)
    const nameRegexCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'retailer_configs' AND column_name = 'name_regex'
    `);
    if (nameRegexCheck.rows.length > 0) {
      await client.query(`
        UPDATE retailer_configs 
        SET name_selectors = name_selectors || (
          SELECT COALESCE(jsonb_agg('regex:/' || r.val || '/'), '[]'::jsonb)
          FROM jsonb_array_elements_text(name_regex) AS r(val)
        )
        WHERE name_regex IS NOT NULL AND jsonb_array_length(name_regex) > 0
      `);
    }

    // 4. Merge image_regex into image_selectors (if column exists)
    const imageRegexCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'retailer_configs' AND column_name = 'image_regex'
    `);
    if (imageRegexCheck.rows.length > 0) {
      await client.query(`
        UPDATE retailer_configs 
        SET image_selectors = image_selectors || (
          SELECT COALESCE(jsonb_agg('regex:/' || r.val || '/'), '[]'::jsonb)
          FROM jsonb_array_elements_text(image_regex) AS r(val)
        )
        WHERE image_regex IS NOT NULL AND jsonb_array_length(image_regex) > 0
      `);
    }

    // 5. Drop the old regex columns
    await client.query('ALTER TABLE retailer_configs DROP COLUMN IF EXISTS price_regex');
    await client.query('ALTER TABLE retailer_configs DROP COLUMN IF EXISTS name_regex');
    await client.query('ALTER TABLE retailer_configs DROP COLUMN IF EXISTS image_regex');

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

    // Restoration is difficult because we lost the distinction between CSS and Regex 
    // unless we parse the 'regex:/.../' prefix.
    // For now, just recreate columns.
    await client.query('ALTER TABLE retailer_configs ADD COLUMN IF NOT EXISTS price_regex JSONB DEFAULT \'[]\'::jsonb');
    await client.query('ALTER TABLE retailer_configs ADD COLUMN IF NOT EXISTS name_regex JSONB DEFAULT \'[]\'::jsonb');
    await client.query('ALTER TABLE retailer_configs ADD COLUMN IF NOT EXISTS image_regex JSONB DEFAULT \'[]\'::jsonb');
    
    // Revert original_price_selectors to text[]
    await client.query(`
      ALTER TABLE retailer_configs 
      ALTER COLUMN original_price_selectors TYPE text[] 
      USING ARRAY(SELECT jsonb_array_elements_text(original_price_selectors))
    `);
    await client.query(`ALTER TABLE retailer_configs ALTER COLUMN original_price_selectors SET DEFAULT '{}'::text[]`);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
