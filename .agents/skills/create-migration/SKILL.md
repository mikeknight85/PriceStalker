---
name: create-migration
description: >-
  Use this skill when creating or updating database schema migrations in PriceStalker.
  Provides the required template, idempotency guards, numbering conventions, and verification steps.
---

# Database Migration Runbook

## Overview
PriceStalker migrations run automatically on boot via `backend/src/app/migrateOnBoot.ts`. There is no separate manual migration step in production. All migrations must be strictly idempotent and follow the sequence convention.

## Procedures

### 1. Identify the Next Migration Number
Find the highest-numbered migration in `backend/src/migrations/`:
```bash
find backend/src/migrations/ -name "*.ts" | sort | tail -n 5
```
Name the new migration `backend/src/migrations/NNN_<descriptive_name>.ts` (e.g. `025_add_custom_field.ts`).

### 2. Migration Template
Write the migration using this standard structure:

```typescript
import { Migration } from '../types/migration';

export const up: Migration['up'] = async (client) => {
  await client.query(`
    -- Use IF NOT EXISTS or existence guards
    ALTER TABLE example_table
      ADD COLUMN IF NOT EXISTS new_column TEXT;
  `);
};

export const down: Migration['down'] = async (client) => {
  await client.query(`
    ALTER TABLE example_table
      DROP COLUMN IF EXISTS new_column;
  `);
};
```

### 3. Migration Invariants & Rules
- **Idempotency**: Use `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP ... IF EXISTS`, or `ON CONFLICT DO NOTHING`.
- **Parameter Casting**: If passing parameters `$1` used both in inserts and `WHERE` clauses, explicitly cast types: `$1::uuid` or `$1::text`.
- **Reference Data**: If adding tables intended for lookup (currencies, stores, regions), include the seeding query directly in the migration.
- **Never edit baseline or shipped migrations**: `001_baseline.ts` is auto-generated. Do not modify previous numbered migrations.

### 4. Verification
Test migration compilation and execution:
```bash
# Typecheck backend
pnpm --filter pricestalker-backend run build

# Run migration against dev database if configured
pnpm --filter pricestalker-backend run db:migrate:dev
```
