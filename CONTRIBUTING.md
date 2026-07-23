# Contributing to PriceStalker

We welcome contributions to PriceStalker. This document provides general guidelines for setting up your environment, running tests, and preparing pull requests.

---

## 1. Development & Setup Guide
For detailed instructions on setting up your local workspace, running tests natively or in containers, and understanding the codebase architecture, please refer to the:
* **[PriceStalker Developer Guide](docs/DEVELOPER_GUIDE.md)**

### Package manager
PriceStalker uses **pnpm** for faster, disk-efficient, strict workspace installs.
This is a package-manager change only — Node remains the production runtime and
the project does not use Bun as a runtime or build tool.

```bash
corepack enable                    # activate pnpm via Node's built-in corepack
pnpm install --frozen-lockfile     # install all workspaces
```

`pnpm-lock.yaml` is the sole committed lockfile. Do not commit `package-lock.json`
or `yarn.lock`. [Volta](https://volta.sh/) can automatically select the project's
pinned Node and pnpm versions if you prefer not to manage them manually.

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
