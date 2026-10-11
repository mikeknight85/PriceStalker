import { MigrationContext } from '../config/migrate';

/**
 * Gives system API tokens scopes, and a non-secret prefix to look them up by
 * (issue #217).
 *
 * Two problems, one table:
 *
 * 1. `system_api_tokens` carried no authorisation information. A token minted
 *    for one integration reached every `/api/admin` route, `run-migration`
 *    included. `scopes` fixes that; `requireScope` in
 *    `backend/src/middleware/scope.ts` enforces it.
 *
 * 2. Verification was an O(n) bcrypt scan -- every row compared on every
 *    request presenting a non-JWT bearer token. `token_prefix` holds the first
 *    11 characters of the token (`ps_` plus 8 hex), indexed, so verification
 *    selects one candidate row and bcrypt-compares that.
 *
 * Backfill, and the one thing that cannot be backfilled:
 *
 * - `scopes` is backfilled to `{'*'}` for rows that already exist. That keeps
 *   every token in the wild working exactly as it does today. The alternative
 *   -- silently reducing the privileges of a token someone's cron job depends
 *   on -- breaks installations on upgrade with a 403 that looks like a bug.
 *   Issue #217 settled on the grace period: the Admin UI flags these rows as
 *   deprecated and invites the operator to regenerate them, and a later
 *   release retires the legacy path.
 *
 * - `token_prefix` *cannot* be backfilled. Only the bcrypt hash was ever
 *   stored, and bcrypt is not reversible, so there is no way to recover the
 *   first 11 characters of a token issued before this migration. Those rows
 *   keep `token_prefix IS NULL`, and null is the signal that verification must
 *   fall back to the scan for that row. This is not an oversight; see
 *   `docs/developer/adr/001-mcp-server.md` §4.2.
 *
 * Idempotency: every statement is guarded. The `scopes` backfill is restricted
 * to rows that have no prefix *and* no scopes, which is exactly the set of
 * pre-migration rows -- so a second run matches nothing, and it can never
 * promote a token created after the migration to full access.
 *
 * The index is partial (`WHERE token_prefix IS NOT NULL`) because the lookup
 * only ever asks for a concrete prefix, and legacy rows would otherwise all
 * share a null entry for no benefit.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE system_api_tokens
      ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT '{}'::text[]
    `);

    await client.query(`
      ALTER TABLE system_api_tokens
      ADD COLUMN IF NOT EXISTS token_prefix character varying(16)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_system_api_tokens_token_prefix
      ON system_api_tokens (token_prefix)
      WHERE token_prefix IS NOT NULL
    `);

    const backfilled = await client.query(`
      UPDATE system_api_tokens
      SET scopes = ARRAY['*']::text[]
      WHERE token_prefix IS NULL
        AND cardinality(scopes) = 0
    `);

    if (backfilled.rowCount) {
      console.log(
        `[022] Backfilled ${backfilled.rowCount} existing system API token(s) with full access ('*'). ` +
          `These are deprecated -- regenerate them from Admin to apply scopes.`
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

/**
 * Drops both columns and the index.
 *
 * Rolling back loses the scope grants and the prefixes, which means every
 * token reverts to the unscoped full-access behaviour and to the linear scan.
 * Nothing else breaks: the token hashes, labels and expiries are untouched, so
 * tokens keep authenticating across a roll back and a re-apply (the re-apply
 * sees them as legacy rows and backfills them to `*` again).
 */
export const down = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DROP INDEX IF EXISTS idx_system_api_tokens_token_prefix');
    await client.query('ALTER TABLE system_api_tokens DROP COLUMN IF EXISTS token_prefix');
    await client.query('ALTER TABLE system_api_tokens DROP COLUMN IF EXISTS scopes');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
