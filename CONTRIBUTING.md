# Contributing to PriceStalker

We welcome contributions to PriceStalker. This document provides general guidelines for setting up your environment, running tests, and preparing pull requests.

---

## 1. Development & Setup Guide
For detailed instructions on setting up your local workspace, running tests natively or in containers, and understanding the codebase architecture, please refer to the:
* **[PriceStalker Developer Guide](docs/DEVELOPER_GUIDE.md)**

---

## 2. Preparing and Submitting Changes

### Verification
Run the complete validation suite before submitting a pull request to ensure that TypeScript types, test suites, and formatting checks pass cleanly:

```bash
# Performs a clean install, builds all workspaces, and runs backend tests
make verify
```

To run individual validation steps:
```bash
# Verify the frontend compiles and typechecks
pnpm --filter pricestalker-frontend run build

# Verify backend tests and typechecks pass
pnpm --filter pricestalker-backend test
pnpm --filter pricestalker-backend run build

# Run the project linting and emoji checks
pnpm run lint
```

---

## 3. Contribution Hygiene

* **No Emojis in Code**: The codebase has a strict linting rule against emojis. Running `pnpm run lint` will verify this before commits are pushed. Use SVGs via `<Icon name="..." />` instead.
* **Keep Secrets Local**: Never commit `.env` files, API keys, or private credential strings to the repository.
* **Write Idempotent Migrations**: Any schema updates must go through a new numbered database migration under `backend/src/migrations/`.
* **Include Unit Tests**: If your pull request introduces a new feature or corrects a bug, please write or update a corresponding unit test inside `backend/tests/unit/` using Vitest.
