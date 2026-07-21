import { MigrationContext } from '../config/migrate';

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      UPDATE retailer_configs 
      SET stock_selectors = '["form#form1::attr(data-productpreorder)::equals(true)->pre_order", "form#form1::attr(data-isactive)::equals(False)->out_of_stock", "form#form1::attr(data-isactive)::equals(True)->in_stock"]'::jsonb,
          in_stock_phrases = '[]'::jsonb,
          out_of_stock_phrases = '[]'::jsonb,
          pre_order_phrases = '[]'::jsonb
      WHERE domain = 'giantcannington.com.au';
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
      UPDATE retailer_configs 
      SET stock_selectors = '["form#form1::attr(data-productpreorder)", "form#form1::attr(data-isactive)"]'::jsonb,
          in_stock_phrases = '["true"]'::jsonb,
          out_of_stock_phrases = '["false"]'::jsonb,
          pre_order_phrases = '["true"]'::jsonb
      WHERE domain = 'giantcannington.com.au';
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
