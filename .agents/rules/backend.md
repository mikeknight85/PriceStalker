# Backend Architecture & Database Guidelines

## 1. Architectural Layers & Separation of Concerns
Follow the established three-layer architecture:
1. **CRUD / Domain Logic**: Place in `backend/src/services/domain/<aggregate>/`.
2. **Data Access (SQL)**: Place strictly within `backend/src/repositories/`. **No raw SQL queries in routes or domain services.**
3. **HTTP Routes**: Thin Express controllers in `backend/src/routes/`. **No business logic in routes.**
4. **Scraper Pipeline**: Scraper logic belongs solely in `backend/src/services/scraper/`.
5. **Scheduled / Background Tasks**: Register jobs in `backend/src/services/scheduler/`. Never invoke heavy background tasks synchronously inside route handlers.

## 2. Database Migrations & Schema Rules
* Migrations are located in `backend/src/migrations/NNN_name.ts` and executed automatically at boot by [`backend/src/app/migrateOnBoot.ts`](file:///home/steven/projects/pricestalker/backend/src/app/migrateOnBoot.ts).
* **Idempotency is mandatory**: Always use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, and existence checks.
* **Never edit shipped migrations**: Never modify existing migrations or [`001_baseline.ts`](file:///home/steven/projects/pricestalker/backend/src/migrations/001_baseline.ts). Always add a new sequential migration file.
* **Parameter Type Casting**: When a query placeholder is used in both an inserted value and a `WHERE` clause, explicitly cast it (e.g. `$1::uuid`) to avoid PostgreSQL type deduction errors.
* **Seed Reference Data**: Reference tables (e.g., `global_currencies`, `regional_currency_mappings`) must be seeded in migrations.

## 3. Extensibility & Providers
* **AI Providers**: Implement `AIProvider` ([`backend/src/services/ai/providers/types.ts`](file:///home/steven/projects/pricestalker/backend/src/services/ai/providers/types.ts)) and register in [`backend/src/services/ai/client.ts`](file:///home/steven/projects/pricestalker/backend/src/services/ai/client.ts).
* **Notification Providers**: Register in [`backend/src/services/notifications/registry.ts`](file:///home/steven/projects/pricestalker/backend/src/services/notifications/registry.ts).
* Do not modify existing providers to add a new one; add a new provider file and register it.

## 4. Caching & Configuration State
* `SettingsCache` has a **30-minute TTL**. Updates to `system_settings` in the database will not immediately reflect in running code unless the backend restarts or cache expires.
* AI and Auth configs are instance-wide (stored in DB and managed via Admin panel).
* SSO requires **both** `ENABLE_SSO=true` in environment variables AND the in-app Admin toggle.

## 5. Build Requirements
* The backend is compiled using `tsc` (`pnpm --filter pricestalker-backend run build`), **not** bundled. Migrations are globbed at runtime from `dist/migrations/*.js`.
