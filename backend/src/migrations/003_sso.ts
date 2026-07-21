import { MigrationContext } from '../config/migrate';

/**
 * OIDC / SSO support.
 *
 * v2 has no SSO; v1 does, and production authenticates against Authentik. This
 * restores the schema half: the `auth_config` singleton and the three columns
 * that bind a local user to an external identity.
 *
 * Idempotent on purpose. A migrated v1 database already has all of this, since
 * v1 created it at every boot -- so this is a no-op there and a real create on
 * a fresh install.
 *
 * password_hash is dropped to nullable because SSO users never have one. This
 * is the constraint that aborts a naive v1 import, and it is required for JIT
 * provisioning to work at all.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        policy VARCHAR(20) NOT NULL DEFAULT 'local',
        oidc_enabled BOOLEAN NOT NULL DEFAULT false,
        oidc_provider_name TEXT,
        oidc_issuer_url TEXT,
        oidc_client_id TEXT,
        oidc_client_secret TEXT,
        oidc_scopes TEXT NOT NULL DEFAULT 'openid profile email',
        oidc_jit_enabled BOOLEAN NOT NULL DEFAULT true,
        oidc_require_email_verified BOOLEAN NOT NULL DEFAULT true,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // The singleton row is assumed to exist by every read path.
    await client.query(`INSERT INTO auth_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`);

    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'local',
        ADD COLUMN IF NOT EXISTS oidc_subject  TEXT,
        ADD COLUMN IF NOT EXISTS oidc_issuer   TEXT;
    `);

    // SSO users have no password. Without this, JIT provisioning fails on the
    // NOT NULL constraint and a v1 import aborts on its existing SSO users.
    await client.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;`);

    // Identity lookups happen on every SSO login. Guard on the indexed columns
    // rather than the index name: v1 databases already carry an equivalent index
    // under a different name (users_oidc_sub_idx), and IF NOT EXISTS only checks
    // the name, so it would create a redundant duplicate on every v1 upgrade.
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
            FROM pg_index i
            JOIN pg_class c ON c.oid = i.indrelid
           WHERE c.relname = 'users'
             AND i.indisunique
             AND (
               SELECT array_agg(a.attname::text ORDER BY a.attname::text)
                 FROM unnest(i.indkey) AS k(attnum)
                 JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
             ) = ARRAY['oidc_issuer', 'oidc_subject']
        ) THEN
          CREATE UNIQUE INDEX idx_users_oidc_identity
            ON users (oidc_issuer, oidc_subject)
            WHERE oidc_issuer IS NOT NULL AND oidc_subject IS NOT NULL;
        END IF;
      END $$;
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
    await client.query('DROP INDEX IF EXISTS idx_users_oidc_identity');
    await client.query('DROP TABLE IF EXISTS auth_config');
    // The user columns are deliberately left in place: dropping them would
    // destroy the link between local accounts and their external identities.
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
