# PriceStalker v2 data migration

Notes on moving existing PriceStalker installs onto the v2 codebase (Steven's
fork, `priceghost-stevene`).

**The migrations themselves now live in `backend/src/migrations/`** and run at
startup. This directory keeps the analysis, the generator, and its inputs:

| File | Purpose |
|---|---|
| `generate-baseline.py` | Regenerates `001_baseline.ts` from a schema dump |
| `seeds.sql` | Captured `system_settings` seed data (generator input) |
| `migrate.sql` | Side-by-side migration, for one-off instance moves |
| `000_v1_compat.ts`, `001_baseline.ts`, `002_v1_notifications.ts` | Reference copies of the installed chain |

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

### Solution: `000_v1_compat.ts`

`000_v1_compat.ts` is the proposed fix. umzug orders migrations
lexicographically, so it runs before 001 and adds exactly the columns 001 would
have created but cannot, because the tables already exist.

It deliberately does **not** stamp 001 as executed. 001 still needs to run, to
create the six tables v1 lacks (`retailer_configs`, `system_logs`,
`exchange_rates`, `global_currencies`, `regional_currency_mappings`,
`user_memberships`) and to seed `system_settings`. Every statement in 001 is
`IF NOT EXISTS` or `ON CONFLICT DO NOTHING`, so running it after 000 is safe.

On a fresh install `users` does not exist yet, so 000 is a no-op.

The column list was derived empirically rather than by reading the schemas: a
reference database built by running only 001 was diffed against a real v1
production database. The gap is 21 columns:

| Table | Columns 001 cannot add |
|---|---|
| `users` | 17 (all `*_message_template`, all email/SMTP, `currency`, `locale`, `preferred_currency`, `categories`) |
| `products` | `ai_status`, `category`, `price_type` |
| `price_history` | `price_type` |

Two behaviours worth noting:

- **`webhook_body_template` is renamed, not re-added.** v2 calls the same field
  `webhook_payload_template`. Renaming preserves any custom webhook body the
  user configured; adding a fresh column would silently discard it.
- **`currency` is back-filled from observed data, not defaulted.** Upstream
  defaults to `AUD`/`en-AU`. Applying that to an existing install would
  reinterpret stored prices, since v2 converts against this value. 000 instead
  picks each user's most frequently recorded `price_history.currency`, falling
  back to `USD`.

### Verification status

Verified: **000 → 001 against a real v1 production database.** Afterwards, all
six shared tables contain every column a fresh install has after 001, with data
intact (21 products / 10,364 price_history), the webhook template preserved, and
currency correctly derived (`CHF` for the user with CHF history, `USD` fallback).

The full umzug chain was then run for real (`tsx src/config/migrate.ts up`)
against three databases. The result is that **000 is not the blocker — v2's
migration chain does not replay on any path.**

| Starting point | Result |
|---|---|
| v1 production DB, after 000 | 001–011 apply, **fails at 012** |
| Fresh empty DB (control, no v1 data, no 000) | 001–011 apply, **fails at 012** — identical |
| DB bootstrapped from `init.sql` (a real fresh v2 install) | **fails at 010** |

000 carries a v1 database exactly as far as a clean database gets, so it is
doing its job. The chain itself is broken:

- **012 fails on `retailer_configs.original_price_selectors does not exist`.**
  Migrations 012 and 020 both reference that column, but nothing in 001–011
  creates it. It exists only in `database/init.sql`, which is a `pg_dump` of
  Steven's live database rather than a replay of the migrations.
- **010 fails on an `init.sql` database** with `u.notifications_cleared_at does
  not exist`. The dump was taken *after* 010 had already run upstream, so the
  column it needs was already dropped and `notification_history` already
  converted. Re-running 010 cannot work.

The migrations have drifted from the dump. `init.sql` is the only working
bootstrap, and it stamps **zero** rows into the `migrations` table — so umzug
believes nothing has run and starts from 001 against a schema already at 022.

This is masked in normal operation because **the backend never runs migrations
at startup**: there is no umzug call in the boot path, no `command:` in
`docker-compose.yaml`, and the Dockerfile is just `node dist/index.js`.
Migrations are a manual developer tool (`npm run db:migrate`). Steven's live
database is correct because migrations were applied by hand as they were
written; the checked-in chain no longer reproduces it.

### Consequence for the port

v2 had **no working automated schema-upgrade path at all** — not for v1 users,
and not for existing v2 users either. Repairing the chain was therefore a
prerequisite of the transplant, independent of anything v1-specific.

## The replacement chain

Three migrations replace 001–022:

| File | Role |
|---|---|
| `000_v1_compat.ts` | Adds the 21 columns 001 cannot add to a v1 database. No-op on fresh installs. |
| `001_baseline.ts` | Squashed schema baseline. **Generated** — do not hand-edit. |
| `002_v1_notifications.ts` | Carries v1 `notification_history` into v2 `notifications`. No-op where there is no history. |

`001_baseline.ts` is produced by `generate-baseline.py` from a canonical
`pg_dump --schema-only`, so it tracks reality rather than an aspirational
hand-written schema. Every statement it emits is idempotent:

```
CREATE SEQUENCE IF NOT EXISTS        CREATE INDEX IF NOT EXISTS
CREATE TABLE IF NOT EXISTS           CREATE OR REPLACE FUNCTION
ADD COLUMN IF NOT EXISTS             DROP TRIGGER IF EXISTS + CREATE TRIGGER
ALTER COLUMN SET DEFAULT             ADD CONSTRAINT guarded by pg_constraint
```

The `ADD COLUMN` pass is what makes partially-migrated databases converge:
`CREATE TABLE IF NOT EXISTS` alone would leave a v1 `users` table short of
`locale`, silently.

Seed data is captured by **executing** the seed-bearing migrations (001, 002,
003, 007, 014, 017, 018, 019) against a canonical database and dumping the
resulting `system_settings`, rather than parsing their source. Several build
their values in JavaScript and bind them as query parameters, so static
extraction silently missed them — `searxng_url` and `searxng_enabled` among
them.

`002_v1_notifications` reuses 010's mapping, including its use of
`users.notifications_cleared_at` to set read state: anything the user had
already cleared in v1 arrives read, the rest arrives unread. It then drops
`notification_history` and `notifications_cleared_at`, as 010 did.

### Verification

Ran end-to-end with the real umzug runner against three starting points, then
re-ran the whole chain a second time to check idempotency.

| Starting point | Result |
|---|---|
| Empty database | 181 columns / 16 tables — **identical to canonical**, 24 settings seeded |
| `init.sql`-bootstrapped (existing v2 install) | identical to canonical, no drift |
| v1 production snapshot | **zero** canonical columns missing; 21 products, 10,364 price rows, 29 notifications carried over |
| Full chain re-run on an already-migrated database | no change, no duplicate rows, no duplicate constraints |

The v1 database keeps 33 extra columns beyond canonical. These are deliberate:
the SSO columns and `auth_config` table (feature ported forward), the v1-only
product columns, and the per-user AI credentials that v2 has no home for. Extra
columns are unread by v2 and harmless.

### Still open

- **Only the current v1 schema was tested.** v1 re-runs its DO-block migrations
  at every boot, so instances on a current image should converge — but that is
  untested against an older snapshot.
- **Migrations still are not run at startup.** The chain now works, but nothing
  invokes it: no umzug call in the boot path, no `command:` in
  `docker-compose.yaml`. Wiring that up is part of the port.
- **`002_global_ai_settings` is not represented in the baseline.** It moved
  per-user AI credentials into global `system_settings` and dropped the user
  columns. The baseline does not drop them, so a migrated v1 database keeps its
  per-user AI columns — unused, and retaining the keys rather than destroying
  them.

Also still untested: v1 databases from **older** PriceStalker releases. v1 runs
its DO-block migrations at every boot, so any instance on a current image should
converge to the same schema — but that assumption is worth checking against an
older snapshot.

### Alternatives considered

- **Rewrite 001** to be genuinely idempotent (`ADD COLUMN IF NOT EXISTS`
  throughout). Cleaner long-term, but diverges from upstream and complicates
  future merges from Steven.
- **Export/import upgrade** using `migrate.sql` side-by-side. Safest, but a
  manual step for every install.

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
