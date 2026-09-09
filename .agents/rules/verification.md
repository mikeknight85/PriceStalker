# Verification, Testing & Release Guidelines

## 1. Verification Sequence
Run these verification commands before marking tasks complete or submitting changes:

```bash
# 1. Typecheck and build frontend
pnpm --filter pricestalker-frontend run build

# 2. Run backend vitest and build backend via tsc
pnpm --filter pricestalker-backend test
pnpm --filter pricestalker-backend run build

# 3. Run frontend unit tests
pnpm --filter pricestalker-frontend test

# 4. Run Playwright route tests (requires prebuilt frontend dist)
pnpm --filter pricestalker-frontend run test:routes

# 5. Enforce emoji absence across frontend
pnpm run lint

# 6. Full clean verification suite
make verify
```

## 2. Changelog & Documentation
* For user-facing changes, add an entry to [`CHANGELOG.md`](file:///home/steven/projects/pricestalker/CHANGELOG.md) under `## [Unreleased]` using `### Added`, `### Fixed`, or `### Changed` (Keep a Changelog standard).
* Verify against real built bundles and real data when applicable.
