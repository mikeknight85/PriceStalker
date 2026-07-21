# PriceStalker v2 data migration

Working notes for moving existing PriceStalker installs onto the v2 codebase
(Steven's fork, `priceghost-stevene`). This directory is planning material for
the v2 port — nothing here runs as part of the current release.

## What's verified

`migrate.sql` was run end-to-end against a real production snapshot
(2 users / 21 products / 10,364 price_history / 145 stock_status_history /
29 notification_history) in a throwaway PostgreSQL 16 container.

| Check | Result |
|---|---|
| Row counts, all five tables | exact match |
| `sum(price)` over `price_history` | identical |
| md5 of all product URLs | identical |
| FK orphans after migration | 0 |
| OIDC user preserved | yes |
| Post-migration insert (sequence collision) | no collision |

The v1 → v2 table shapes are far closer than expected, because both forks
inherited them from the same upstream and neither drifted much:

- `stock_status_history` — **identical**, 4 columns
- `price_history` — v1's 5 columns are a **strict subset** of v2's 8
- `products` — v2 has 21 of v1's 24 columns, same names, compatible types
- `users` — the only genuinely divergent table

All type changes are safe widenings (`varchar` → `text`).

## Two hard requirements found only by testing against real data

1. **`users.password_hash` must be made nullable.** v2 declares it `NOT NULL`.
   v1 SSO users legitimately have `NULL` there — they never had a password. A
   straight `INSERT` aborts. Needs a real migration in the v2 port, not just a
   fix in this script.

2. **Sequences must be reset with `setval`.** Rows are copied with explicit IDs,
   leaving every sequence at 1. This does not fail loudly — the app works until
   the first newly-added row collides. `MAX(id)` also diverges sharply from
   `COUNT(*)` where rows were deleted (21 products, but `MAX(id) = 45`), so
   `setval` must use `MAX(id)`, never a count.

## The unsolved problem: in-place upgrades

`migrate.sql` is the **side-by-side** variant: v1 restored into schema `old`,
written into a fresh v2 schema. That is the right shape for a one-off instance
move. It is **not** what existing installs need — they upgrade a database in
place by pulling a new image.

That path is currently broken, and fails quietly:

- v2 tracks schema state with umzug against a `migrations` table
  (`backend/src/config/migrate.ts`). A v1 database has no such table, so umzug
  believes **nothing** has been applied and starts from `001_initial_schema`.
- `001_initial_schema.ts` is written as `CREATE TABLE IF NOT EXISTS`. On a v1
  database every one of those tables already exists, so 001 **no-ops entirely**
  and is then recorded as executed.
- Migrations 002–022 then `ALTER` a schema still in its v1 shape.

Of the 18 columns v2's `users` table has that v1's lacks, only **two**
(`disabled`, `notifications_cleared_at`) are added by migrations 002–022. The
remaining **16 are silently never created**:

```
categories                  currency                    locale
preferred_currency          webhook_payload_template    email_enabled
email_from                  email_to                    email_subject_template
email_body_template         smtp_host                   smtp_port
telegram_message_template   discord_message_template    pushover_message_template
ntfy_message_template       gotify_message_template
```

These back the notification templating and multi-currency systems. The instance
boots, reports a successful migration, and then errors on core features.

### Options

1. **Pre-flight migration `000`** that detects a v1 database (`users` exists,
   `migrations` does not), brings it up to the exact post-001 shape, then stamps
   001 as executed so 002–022 apply cleanly. Keeps a single upgrade path;
   requires 000 to reproduce 001 faithfully for every v1 version in the wild.
2. **Rewrite 001** to be genuinely idempotent — `ADD COLUMN IF NOT EXISTS` for
   every column rather than `CREATE TABLE IF NOT EXISTS`. Cleaner long-term,
   but diverges from upstream and complicates future merges.
3. **Export/import upgrade** — ship this script plus tooling and have operators
   do a side-by-side move. Safest, but it is a manual step for every install.

Option 1 is the most likely fit. Whichever is chosen, it needs testing against a
v1 snapshot the same way `migrate.sql` was.

## Decisions baked into `migrate.sql`

- **`webhook_method` is dropped.** v1 supports configurable HTTP methods; v2's
  webhook sender is POST-only. Anything other than POST is a feature port.
- **Per-user currency is derived, not defaulted.** v2 defaults to `AUD`/`en-AU`
  upstream. The script instead picks each user's most frequently recorded
  `price_history.currency`, falling back to `USD`, so the default suits whichever
  region an install is in. v2 performs live FX conversion against this value, so
  it directly affects how existing history is displayed.
- **Historical notifications are marked read.** Otherwise every user upgrades
  into a bell full of months-old alerts. The original payload is preserved
  in the `data` jsonb column.
- **Per-user AI credentials are not migrated.** v2 centralises AI config globally
  in `system_settings` (admin-only), so there is no per-user target. An admin
  re-enters them once after upgrading.
