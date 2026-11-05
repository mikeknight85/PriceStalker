import { MigrationContext } from '../config/migrate';

/**
 * Migration 026:
 * 1. Add `re_auto_map` boolean column to `retailer_configs` (defaults to false) for issue #265.
 * 2. Update `default_user_agent` in `system_settings` to current Chrome 154 if empty or outdated (Chrome 121/146).
 * 3. Clean and normalize `system_settings` and `retailer_configs` selector arrays:
 *    - Repair Scrapy-style `@attr` to Cheerio `::attr(attr)`.
 *    - Auto-append `::attr(content)` to bare `<meta>` selectors (preventing empty string extraction).
 *    - Remove `.productthumbnail` and noisy modal/brand selectors.
 *    - Normalize empty retailer user-agents (`""`) to NULL without touching valid custom UAs.
 * 4. Clean corrupted product and item image URLs (e.g. `/c_fill`, `hn-logo.svg`, placeholder icons, directories).
 * 5. Backfill `items.image_url` from valid product images where item image is missing.
 */

const CANONICAL_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36';

const NOISE_SELECTORS = [
  'h2.explore-modal-title',
  '.toc-menu-toggle',
  '.cross-sell-cell .product-price',
];

function normalizeMigrationSelector(selector: string, fieldName: string): string | null {
  let s = selector.trim();
  if (!s) return null;

  // Filter known noise selectors
  for (const noise of NOISE_SELECTORS) {
    if (s.toLowerCase().includes(noise.toLowerCase())) return null;
  }

  // Filter brand selectors from retailer names (issue #12)
  if (fieldName === 'retailer_name_selectors' && s.includes('itemprop="brand"')) {
    return null;
  }

  // Filter unwanted thumbnail class
  if (fieldName === 'image_selectors' && s.includes('.productthumbnail')) {
    return null;
  }

  // Convert legacy ~pattern~ regex selectors
  if (s.startsWith('~') && s.endsWith('~') && s.length > 2) {
    const rawPattern = s.slice(1, -1);
    s = `:matches(/${rawPattern}/i)`;
  }

  // Convert Scrapy-style `@attr` outside brackets to `::attr(attr)`
  let bracketDepth = 0;
  let atPos = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (ch === '@' && bracketDepth === 0) {
      atPos = i;
      break;
    }
  }

  if (atPos !== -1) {
    const base = s.slice(0, atPos).trim();
    const attr = s.slice(atPos + 1).trim();
    if (base && attr) {
      s = `${base}::attr(${attr})`;
    }
  }

  // Auto-append ::attr(content) to meta selectors if not already extracting an attribute
  const lower = s.toLowerCase();
  if (lower.startsWith('meta[') && !lower.includes('::attr(') && !lower.includes('@')) {
    s = `${s}::attr(content)`;
  }

  return s;
}

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Add re_auto_map column to retailer_configs
    await client.query(`
      ALTER TABLE public.retailer_configs
      ADD COLUMN IF NOT EXISTS re_auto_map boolean DEFAULT false;
    `);

    // 2. Update default_user_agent in system_settings if null, empty, or outdated
    await client.query(
      `
      UPDATE system_settings
      SET value = $1, updated_at = CURRENT_TIMESTAMP
      WHERE key = 'default_user_agent'
        AND (value IS NULL OR TRIM(value) = '' OR value LIKE '%Chrome/121%' OR value LIKE '%Chrome/146%');
    `,
      [CANONICAL_USER_AGENT]
    );

    // 3. Normalize empty retailer user-agents to NULL
    await client.query(`
      UPDATE retailer_configs
      SET user_agent = NULL
      WHERE user_agent IS NOT NULL AND TRIM(user_agent) = '';
    `);

    // 4. Update system_settings generic selector arrays
    const genericImageRes = await client.query<{ value: string | null }>(
      `SELECT value FROM system_settings WHERE key = 'generic_image_selectors';`
    );
    if (genericImageRes.rows.length > 0 && genericImageRes.rows[0].value) {
      try {
        const arr = JSON.parse(genericImageRes.rows[0].value);
        if (Array.isArray(arr)) {
          const cleaned = arr
            .filter((sel: string) => !sel.includes('.productthumbnail'))
            .map((sel: string) => normalizeMigrationSelector(sel, 'generic_image_selectors'))
            .filter((sel): sel is string => !!sel);

          // Ensure canonical meta image selectors are included
          const toAdd = [
            'meta[property="og:image"]::attr(content)',
            'meta[name="twitter:image"]::attr(content)',
            'meta[itemprop="image"]::attr(content)',
          ];
          for (const item of toAdd) {
            if (!cleaned.includes(item)) cleaned.unshift(item);
          }

          await client.query(
            `UPDATE system_settings SET value = $1::text, updated_at = CURRENT_TIMESTAMP WHERE key = 'generic_image_selectors';`,
            [JSON.stringify(Array.from(new Set(cleaned)))]
          );
        }
      } catch {
        // Leave unparseable settings as-is
      }
    }

    // 5. Repair retailer_configs selector columns
    const selectorFields = [
      'name_selectors',
      'price_selectors',
      'image_selectors',
      'stock_selectors',
      'original_price_selectors',
      'deal_price_selectors',
      'member_price_selectors',
      'pre_order_price_selectors',
      'retailer_name_selectors',
    ];

    const retailersRes = await client.query<Record<string, any>>(
      `SELECT id, ${selectorFields.join(', ')} FROM retailer_configs;`
    );

    for (const row of retailersRes.rows) {
      const updates: Record<string, string> = {};
      for (const field of selectorFields) {
        const val = row[field];
        if (!val) continue;

        let parsed: unknown = val;
        if (typeof val === 'string') {
          try {
            parsed = JSON.parse(val);
          } catch {
            continue;
          }
        }

        if (Array.isArray(parsed)) {
          const original = [...parsed];
          const normalized = parsed
            .map((s: any) => (typeof s === 'string' ? normalizeMigrationSelector(s, field) : null))
            .filter((s): s is string => !!s);
          const deduped = Array.from(new Set(normalized));

          if (JSON.stringify(original) !== JSON.stringify(deduped)) {
            updates[field] = JSON.stringify(deduped);
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        const setClauses: string[] = [];
        const params: any[] = [row.id];
        let idx = 2;
        for (const [col, jsonVal] of Object.entries(updates)) {
          setClauses.push(`${col} = $${idx}::jsonb`);
          params.push(jsonVal);
          idx++;
        }
        await client.query(
          `UPDATE retailer_configs SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1;`,
          params
        );
      }
    }

    // 6. Clean corrupted image URLs on products and items
    await client.query(`
      UPDATE products
      SET image_url = NULL
      WHERE image_url LIKE '%/c_fill%'
         OR image_url LIKE '%hn-logo.svg%'
         OR image_url LIKE '%fafloading.png%'
         OR image_url LIKE '%assistant-avatar-%.svg%'
         OR image_url LIKE '%/';
    `);

    await client.query(`
      UPDATE items
      SET image_url = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE image_url LIKE '%/c_fill%'
         OR image_url LIKE '%hn-logo.svg%'
         OR image_url LIKE '%fafloading.png%'
         OR image_url LIKE '%assistant-avatar-%.svg%'
         OR image_url LIKE '%/';
    `);

    // 7. Backfill items.image_url from valid products.image_url where item image is missing
    await client.query(`
      UPDATE items i
      SET image_url = sub.image_url, updated_at = CURRENT_TIMESTAMP
      FROM (
        SELECT DISTINCT ON (item_id) item_id, image_url
        FROM products
        WHERE image_url IS NOT NULL AND TRIM(image_url) != ''
        ORDER BY item_id, created_at DESC
      ) sub
      WHERE i.id = sub.item_id
        AND (i.image_url IS NULL OR TRIM(i.image_url) = '');
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
      ALTER TABLE public.retailer_configs
      DROP COLUMN IF EXISTS re_auto_map;
    `);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
