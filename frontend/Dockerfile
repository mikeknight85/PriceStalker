# syntax=docker/dockerfile:1.7
# Frontend image. Build context is the REPOSITORY ROOT, not ./frontend, because
# this is a pnpm workspace: the root package.json, workspace definition, and
# lockfile are required to
# resolve dependencies.
#
#   docker build -f frontend/Dockerfile .
#
# Self-contained: Vite builds here rather than the dist/ being copied in from a
# developer's machine, so a clean checkout is all CI needs.

# --- build stage -----------------------------------------------------------
# Runs on the native build platform, not the target: tsc/vite/esbuild output is
# architecture-independent, so emulating this stage under QEMU only makes it slow
# (and has hung outright). Only the runtime stage below is built per-architecture.
ARG BUILDPLATFORM=linux/amd64
FROM --platform=$BUILDPLATFORM node:24.18.0-alpine AS builder
ARG BUILDPLATFORM

WORKDIR /app

# Manifests first so dependency installation caches independently of source.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/

# Dev dependencies are required here: vite and typescript do the building.
RUN --mount=type=cache,id=pnpm-store-${BUILDPLATFORM},target=/pnpm/store \
    corepack enable && PUPPETEER_SKIP_DOWNLOAD=true pnpm install --store-dir=/pnpm/store --frozen-lockfile --filter pricestalker-frontend...

COPY frontend/ ./frontend/

RUN pnpm --filter pricestalker-frontend run build

# --- runtime stage ---------------------------------------------------------
FROM nginx:alpine

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
