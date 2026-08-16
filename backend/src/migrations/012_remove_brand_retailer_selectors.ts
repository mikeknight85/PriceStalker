import { MigrationContext } from '../config/migrate';

/**
 * The seeded generic retailer-name selectors included two product-BRAND
 * selectors ([itemprop="brand"]). On pages without an og:site_name they made
 * the retailer "learn" the first scraped product's brand as the shop name
 * (digitec.ch was displayed as "Lian-Li"). Remove them from the stored
 * setting; retailer names come from site identity signals only.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      UPDATE system_settings
      SET value = COALESCE(
            (SELECT jsonb_agg(elem)
             FROM jsonb_array_elements_text(value::jsonb) AS elem
             WHERE elem NOT LIKE '%itemprop="brand"%'),
            '[]'::jsonb
          )::text,
          updated_at = CURRENT_TIMESTAMP
      WHERE key = 'generic_retailer_name_selectors'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(value::jsonb) AS elem
          WHERE elem LIKE '%itemprop="brand"%'
        );
    `);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const down = async () => {
  // Intentionally a no-op: restoring known-bad selectors serves nothing.
};
