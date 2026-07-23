# Contributing to PriceStalker

## Prerequisites

- **Node 24.x** (at least 24.18) and **pnpm 11.x** (at least 11.4). The root
  `package.json` pins the development versions through Volta and declares the
  supported package-manager range.
- [Volta](https://volta.sh/) is recommended. From the repository root, it
  automatically selects Node 24.18.0 and pnpm 11.4.0.
- Docker with the Compose v2 plugin and `make` for the local container stack.

The Makefile uses a POSIX shell. It is supported on macOS, Linux, and Windows
through WSL2 or Git Bash. On Windows, use Docker Desktop with WSL2 integration;
PowerShell and Command Prompt are not supported for `make` commands.

## First-time setup

```bash
git clone https://github.com/mikeknight85/PriceStalker.git
cd PriceStalker
pnpm install --frozen-lockfile
make check-tools
```

Run `pnpm install --frozen-lockfile` from the repository root so the workspace
lockfile is used. Do not edit `pnpm-lock.yaml` by hand.

## Run the local stack

The local stack builds this checkout into local images, starts PostgreSQL, the
API, and the frontend, and publishes the UI on port 8080 by default.

```bash
cp .env.example .env
# Set non-placeholder POSTGRES_PASSWORD and JWT_SECRET in .env.
make up
```

Useful commands:

```bash
make status
make logs
make logs-backend
make down                 # stops containers; preserves volumes
make up-remotescraper     # includes the optional Chromium scraper
```

For a fork, organization, or private registry, use the same registry and
namespace for build and Compose:

```bash
make IMAGE_REGISTRY=ghcr.io IMAGE_NAMESPACE=your-github-owner up
```

Buildx is preferred for faster multi-platform builds. If it is not installed,
the Makefile falls back to the legacy Docker builder for the native host
architecture; `make check-tools` reports which path will be used.

## Run and verify changes

Run the complete validation suite before opening a pull request:

```bash
make verify
```

This performs a clean install, builds every workspace, and runs the backend
Vitest suite. To iterate on one backend test file:

```bash
pnpm --filter pricestalker-backend exec vitest run tests/unit/price-extraction.test.ts
```

## Manual hot-reload workflow

Use this only when you have a PostgreSQL instance available from your host.
Set `DATABASE_URL` and `JWT_SECRET` in your environment or in a local `.env`
file, then run:

```bash
pnpm install --frozen-lockfile
pnpm --filter pricestalker-backend run db:migrate:dev
pnpm --filter pricestalker-backend run dev
```

In a second terminal:

```bash
pnpm --filter pricestalker-frontend run dev
```

Vite serves the frontend at <http://localhost:5173> and proxies `/api` to the
backend at `http://localhost:3001`.

## Contribution hygiene

- Keep secrets in `.env`; never commit `.env` or generated credentials.
- Include relevant tests with behavior changes and run `make verify`.
- Keep generated build output and `node_modules` out of commits.
- Update `pnpm-lock.yaml` through pnpm whenever dependencies change.
