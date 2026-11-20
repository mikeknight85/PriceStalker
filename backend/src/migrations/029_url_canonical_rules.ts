import { MigrationContext } from '../config/migrate';

/**
 * Migration 029: URL Canonicalization Rules
 *
 * Adds system_settings key 'url_canonical_rules' containing a JSON array of
 * data-driven URL path rewrite rules for retailers (such as Amazon, eBay,
 * AliExpress, and Shopify).
 *
 * This normalizes product URLs to their canonical forms (stripping localized
 * title slugs, dynamic session paths, and category breadcrumbs from the pathname),
 * preventing duplicate listings and keeping URLs clean without hardcoding
 * retailer-specific logic in core engine code.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const defaultRules = JSON.stringify([
      {
        domain_pattern: 'amazon\\..*',
        path_match: '(?:^|.*\\/)(?:dp|gp\\/product)\\/([A-Z0-9]{10})(?:\\/.*)?$',
        path_replacement: '/dp/$1',
        description: 'Amazon ASIN canonicalizer'
      },
      {
        domain_pattern: 'ebay\\..*',
        path_match: '^/itm/(?:.+/)?([0-9]{10,14})(?:/.*)?$',
        path_replacement: '/itm/$1',
        description: 'eBay Item ID canonicalizer'
      },
      {
        domain_pattern: 'aliexpress\\..*',
        path_match: '^/item/(?:.+/)?([0-9]+)\\.html(?:/.*)?$',
        path_replacement: '/item/$1.html',
        description: 'AliExpress Item ID canonicalizer'
      },
      {
        domain_pattern: '.*',
        path_match: '^/collections/[^/]+/products/([^/?#]+)$',
        path_replacement: '/products/$1',
        description: 'Shopify collection path canonicalizer'
      }
    ]);

    await client.query(
      `
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('url_canonical_rules', $1, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO NOTHING;
      `,
      [defaultRules]
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
      WHERE key = 'url_canonical_rules';
    `);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
