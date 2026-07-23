# Working on PriceStalker

Guidance for anyone — human or AI — changing this repository. Claude Code and
most AI coding tools read this file automatically. Read it before your first
change.

For a 60-second overview of the directory layout and key backend paths, see the **[AI Agent Quick-Start](docs/AGENT_QUICKSTART.md)**.

PriceStalker is a self-hosted price tracker: a TypeScript/Express backend, a
React/Vite frontend, an optional Puppeteer "remote scraper", and PostgreSQL.
It is a pnpm workspace (`backend`, `frontend`, `remotescraper`).

---

## The rules that matter most

These protect deliberate decisions. Breaking one silently undoes work that took
real effort to get right.

### 1. Do not reintroduce emoji into the UI

The interface uses a custom SVG icon set at
`frontend/src/components/Icon/Icon.tsx`. Emoji were deliberately removed from
every screen: they render differently per platform, ignore the theme, cannot
take a colour, and never align. **Do not add emoji to any `.tsx`/`.ts` file** —
not in JSX, not in strings, not as Unicode escapes (`'\u{1F514}'`), not in
`title`/`label`/placeholder text.

Need an icon? Use `<Icon name="..." />`. If none fits, add one to `Icon.tsx`
following the existing style (24×24 viewBox, stroke-based, `currentColor`) rather
than reaching for an emoji.

Typographic characters — `→ ← ↑ ↓ ↻` — are acceptable where they are genuine
text (a "Back" arrow, a sort indicator). Emoji are not.

This is enforced in CI: `pnpm run lint` (`scripts/check-no-emoji.mjs`) fails the
build on any emoji — literal or escaped — before anything is published. It runs
the same locally as in CI, so run it before committing frontend changes:

```bash
pnpm run lint
```

### 2. Locale and currency formatting must survive null

`users.locale` can be null. `Intl.NumberFormat(null, ...)` and
`Date#toLocaleDateString(null, ...)` **throw a TypeError**, and a throw during
render blanks the whole page. This exact bug shipped once.

Always format through `frontend/src/utils/format.ts` (`formatPrice`,
`formatDate`), which normalise null to undefined. Never call `Intl` or
`toLocale*` with a raw user-supplied locale.

### 3. Every route section stays inside an ErrorBoundary

`frontend/src/components/ErrorBoundary` exists because the app had none, so any
render error produced a blank white page with nothing to diagnose. New pages and
new tab sections must be wrapped in `<ErrorBoundary section="...">`. See the
product-detail page for the pattern.

### 4. Schema changes go through a migration — and migrations run at boot

Migrations live in `backend/src/migrations/NNN_name.ts` and are applied
automatically at startup by `backend/src/app/migrateOnBoot.ts`. There is no
manual "run the migrations" step in production.

- Number the next migration in sequence. Give it `up` and `down`.
- **Make it idempotent.** It may run against a fresh database, a database
  restored from `init.sql`, or one already partly migrated. Use
  `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, and existence guards.
- **Never edit a migration that has shipped.** Add a new one.
- Cast parameters when a placeholder is used both as an inserted value and in a
  `WHERE` — Postgres cannot always deduce the type, and it fails at runtime, not
  compile time (`inconsistent types deduced for parameter $N`).
- Test it against a throwaway Postgres before committing. `tsc` will not catch a
  bad query.

`001_baseline.ts` is **generated** by `database/v2-migration/generate-baseline.py`
— do not hand-edit it.

Reference data is not schema. Tables like `global_currencies` and
`regional_currency_mappings` are read by the app but written by nobody; their
rows must be seeded by a migration or a fresh install comes up with empty
dropdowns and broken currency inference. If you add a table the app reads from,
seed it.

---

## Architecture you should not fight

- **Backend is layered (DDD-ish).** Routes in `backend/src/routes/`, business
  logic in `backend/src/services/domain/<aggregate>/`, data access in
  `.../repositories/`. Keep SQL in repositories, not in routes or services.
- **Frontend is feature-sliced.** `frontend/src/features/<feature>/` holds its
  own `pages/`, `components/`, `services/`, `hooks/`. Shared UI lives in
  `frontend/src/components/`. Put new work in the right feature, not in a
  catch-all.
- **AI and auth config are instance-wide**, stored in the database and edited
  under **Admin**, not per user. `SSO` also requires the `ENABLE_SSO=true`
  environment variable in addition to the in-app toggle — both gates must be on.
- **Secrets are write-only over the API.** The auth-config endpoint returns
  `has_client_secret`, never the value. Preserve that pattern for any secret.
- **`axios` is pinned to exactly `1.14.0`** in every workspace. This is a hard
  upstream mandate — do not bump or use a range.

## Understanding the scraper

Before changing anything in `backend/src/services/scraper/`, read
[docs/SCRAPER_LIFECYCLE.md](docs/SCRAPER_LIFECYCLE.md) (the 6-phase pipeline) and
[docs/SELECTORS.md](docs/SELECTORS.md) (the selector DSL). The engine is subtle —
consensus weighting, out-of-stock price nullification, and AI auto-mapping all
interact. Guessing at it is how extraction bugs get introduced.

---

## Commands

```bash
pnpm install --frozen-lockfile    # install all workspaces

# backend
pnpm --filter pricestalker-backend run build  # tsc (NOT a bundler — see below)
pnpm --filter pricestalker-backend test       # vitest
pnpm --filter pricestalker-backend run db:migrate:dev  # run migrations against $DATABASE_URL

# frontend
pnpm --filter pricestalker-frontend run build  # vite build (also typechecks)
pnpm --filter pricestalker-frontend run dev    # dev server
```

The backend image compiles with `tsc`, **not** `build:bundle`. Migrations are
globbed as `dist/migrations/*.js` at runtime; a bundler collapses them into one
file and none are found. Do not change the backend build to bundle.

---

## Before you commit

- `pnpm --filter pricestalker-frontend run build` — passes, and typechecks.
- `pnpm --filter pricestalker-backend test` and `pnpm --filter pricestalker-backend run build` — pass.
- `pnpm run lint` (the emoji check, rule 1) passes.
- New migrations tested against a real Postgres, not just `tsc`.
- Verify against the **built bundle / running app**, not only the source. Three
  separate bugs here were invisible in source and only showed up in the compiled
  output or against real data (escaped emoji, null locale, unseeded reference
  tables).

## Deployment context

Images build in GitHub Actions and publish to GHCR. `main` publishes the `:beta`
tag, which production tracks. Production runs on Docker Swarm; the schema
migrates one-way on deploy, so **a database backup precedes any production
deploy**. See `deploy/swarm-stack.yml` and `CHANGELOG.md`.

## Things that are intentionally the way they are

- Emoji removed in favour of the icon set (rule 1).
- The database is named `priceghost`, not `pricestalker` — renaming it would
  orphan existing data. See `deploy/swarm-stack.yml`.
- `product_groups`, `site_configs`, `user_memberships` tables exist but are
  unused by current code. Leave them; do not build against them without checking
  first.
- OpenRouter, the daily update-check, per-product currency override and
  notify-on-any-change were dropped from 1.x. Do not "restore" them without
  asking — their absence is deliberate.
