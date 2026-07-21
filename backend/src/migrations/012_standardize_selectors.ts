import { MigrationContext } from '../config/migrate';

function normalizeSelector(selector: string): string {
  if (!selector) return selector;
  const trimmed = selector.trim();
  if (trimmed.startsWith('~') && trimmed.endsWith('~')) return trimmed; // regex
  if (trimmed.startsWith('!')) return trimmed; // html

  if (trimmed.includes('|')) {
    const parts = trimmed.split('|');
    const attr = parts.pop();
    const base = parts.join('|');
    return `${base}::attr(${attr})`;
  }
  return trimmed;
}

function denormalizeSelector(selector: string): string {
  if (!selector) return selector;
  const trimmed = selector.trim();
  if (trimmed.startsWith('~') && trimmed.endsWith('~')) return trimmed; // regex
  if (trimmed.startsWith('!')) return trimmed; // html

  const scrapyAttrMatch = trimmed.match(/^(.+?)::attr\((.+?)\)$/);
  if (scrapyAttrMatch) {
    return `${scrapyAttrMatch[1]}|${scrapyAttrMatch[2]}`;
  }
  return trimmed;
}

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Migrate retailer_configs
    const retailerRows = await client.query(`
      SELECT id, name_selectors, price_selectors, image_selectors, stock_selectors, 
             deal_price_selectors, member_price_selectors, pre_order_price_selectors, 
             retailer_name_selectors, original_price_selectors 
      FROM retailer_configs
    `);
    
    for (const row of retailerRows.rows) {
      const updateFields: string[] = [];
      const values: any[] = [];
      let valIdx = 1;

      const jsonbCols = [
        'name_selectors', 'price_selectors', 'image_selectors', 'stock_selectors',
        'deal_price_selectors', 'member_price_selectors', 'pre_order_price_selectors',
        'retailer_name_selectors'
      ];

      for (const col of jsonbCols) {
        const arr = row[col];
        if (Array.isArray(arr)) {
          const normalized = arr.map(normalizeSelector);
          updateFields.push(`${col} = $${valIdx++}`);
          values.push(JSON.stringify(normalized));
        }
      }

      const textArrCols = ['original_price_selectors'];
      for (const col of textArrCols) {
        const arr = row[col];
        if (Array.isArray(arr)) {
          const normalized = arr.map(normalizeSelector);
          updateFields.push(`${col} = $${valIdx++}`);
          values.push(normalized);
        }
      }

      if (updateFields.length > 0) {
        values.push(row.id);
        await client.query(`UPDATE retailer_configs SET ${updateFields.join(', ')} WHERE id = $${valIdx}`, values);
      }
    }

    // 2. Migrate site_configs
    const siteRows = await client.query(`
      SELECT domain, price_selectors, name_selectors, image_selectors, stock_selectors
      FROM site_configs
    `);

    for (const row of siteRows.rows) {
      const updateFields: string[] = [];
      const values: any[] = [];
      let valIdx = 1;

      const textArrCols = ['price_selectors', 'name_selectors', 'image_selectors', 'stock_selectors'];
      for (const col of textArrCols) {
        const arr = row[col];
        if (Array.isArray(arr)) {
          const normalized = arr.map(normalizeSelector);
          updateFields.push(`${col} = $${valIdx++}`);
          values.push(normalized);
        }
      }

      if (updateFields.length > 0) {
        values.push(row.domain);
        await client.query(`UPDATE site_configs SET ${updateFields.join(', ')} WHERE domain = $${valIdx}`, values);
      }
    }

    // 3. Migrate system_settings
    const settingsKeys = [
      'generic_name_selectors',
      'generic_image_selectors',
      'generic_retailer_name_selectors',
      'generic_price_selectors',
      'generic_deal_price_selectors',
      'generic_member_price_selectors',
      'generic_original_price_selectors',
      'generic_pre_order_price_selectors'
    ];

    for (const key of settingsKeys) {
      const res = await client.query('SELECT value FROM system_settings WHERE key = $1', [key]);
      if (res.rows.length > 0) {
        try {
          const arr = JSON.parse(res.rows[0].value);
          if (Array.isArray(arr)) {
            const normalized = arr.map(normalizeSelector);
            await client.query('UPDATE system_settings SET value = $1 WHERE key = $2', [JSON.stringify(normalized), key]);
          }
        } catch (e) {
          // Skip if not valid JSON
        }
      }
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

    // 1. Revert retailer_configs
    const retailerRows = await client.query(`
      SELECT id, name_selectors, price_selectors, image_selectors, stock_selectors, 
             deal_price_selectors, member_price_selectors, pre_order_price_selectors, 
             retailer_name_selectors, original_price_selectors 
      FROM retailer_configs
    `);
    
    for (const row of retailerRows.rows) {
      const updateFields: string[] = [];
      const values: any[] = [];
      let valIdx = 1;

      const jsonbCols = [
        'name_selectors', 'price_selectors', 'image_selectors', 'stock_selectors',
        'deal_price_selectors', 'member_price_selectors', 'pre_order_price_selectors',
        'retailer_name_selectors'
      ];

      for (const col of jsonbCols) {
        const arr = row[col];
        if (Array.isArray(arr)) {
          const denormalized = arr.map(denormalizeSelector);
          updateFields.push(`${col} = $${valIdx++}`);
          values.push(JSON.stringify(denormalized));
        }
      }

      const textArrCols = ['original_price_selectors'];
      for (const col of textArrCols) {
        const arr = row[col];
        if (Array.isArray(arr)) {
          const denormalized = arr.map(denormalizeSelector);
          updateFields.push(`${col} = $${valIdx++}`);
          values.push(denormalized);
        }
      }

      if (updateFields.length > 0) {
        values.push(row.id);
        await client.query(`UPDATE retailer_configs SET ${updateFields.join(', ')} WHERE id = $${valIdx}`, values);
      }
    }

    // 2. Revert site_configs
    const siteRows = await client.query(`
      SELECT domain, price_selectors, name_selectors, image_selectors, stock_selectors
      FROM site_configs
    `);

    for (const row of siteRows.rows) {
      const updateFields: string[] = [];
      const values: any[] = [];
      let valIdx = 1;

      const textArrCols = ['price_selectors', 'name_selectors', 'image_selectors', 'stock_selectors'];
      for (const col of textArrCols) {
        const arr = row[col];
        if (Array.isArray(arr)) {
          const denormalized = arr.map(denormalizeSelector);
          updateFields.push(`${col} = $${valIdx++}`);
          values.push(denormalized);
        }
      }

      if (updateFields.length > 0) {
        values.push(row.domain);
        await client.query(`UPDATE site_configs SET ${updateFields.join(', ')} WHERE domain = $${valIdx}`, values);
      }
    }

    // 3. Revert system_settings
    const settingsKeys = [
      'generic_name_selectors',
      'generic_image_selectors',
      'generic_retailer_name_selectors',
      'generic_price_selectors',
      'generic_deal_price_selectors',
      'generic_member_price_selectors',
      'generic_original_price_selectors',
      'generic_pre_order_price_selectors'
    ];

    for (const key of settingsKeys) {
      const res = await client.query('SELECT value FROM system_settings WHERE key = $1', [key]);
      if (res.rows.length > 0) {
        try {
          const arr = JSON.parse(res.rows[0].value);
          if (Array.isArray(arr)) {
            const denormalized = arr.map(denormalizeSelector);
            await client.query('UPDATE system_settings SET value = $1 WHERE key = $2', [JSON.stringify(denormalized), key]);
          }
        } catch (e) {
          // Skip if not valid JSON
        }
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
