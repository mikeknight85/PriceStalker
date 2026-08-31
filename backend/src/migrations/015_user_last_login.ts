import { MigrationContext } from '../config/migrate';

/**
 * Records when each account last signed in (issue #85).
 *
 * The admin user table could show that an account existed but not whether
 * anyone had ever used it, which is the question an administrator is usually
 * asking before deleting or auditing one.
 *
 * Nullable with no backfill: NULL means "has not signed in since this shipped",
 * which the UI shows as "Never". Backfilling from created_at would invent a
 * sign-in that never happened and make a dormant account look active.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  await pool.query(`
    ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS last_login_at timestamp with time zone;
  `);
};

export const down = async ({ context: pool }: { context: MigrationContext }) => {
  await pool.query(`
    ALTER TABLE public.users
    DROP COLUMN IF EXISTS last_login_at;
  `);
};
