# Backend image. Build context is the REPOSITORY ROOT, not ./backend, because
# this is an npm workspace: the root package.json and lockfile are required to
# resolve dependencies.
#
#   docker build -f backend/Dockerfile .
#
# Self-contained: TypeScript is compiled here rather than copied in from a
# developer's machine, so a clean checkout is all CI needs.

# --- build stage -----------------------------------------------------------
# Runs on the native build platform, not the target: tsc/vite/esbuild output is
# architecture-independent, so emulating this stage under QEMU only makes it slow
# (and has hung outright). Only the runtime stage below is built per-architecture.
ARG BUILDPLATFORM=linux/amd64
FROM --platform=$BUILDPLATFORM node:24.18.0-slim AS builder

WORKDIR /app

# Manifests first so dependency installation caches independently of source.
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/

# Dev dependencies are required here: typescript does the compiling.
RUN npm ci -w backend

COPY backend/tsconfig*.json ./backend/
COPY backend/src ./backend/src

# Compile with tsc, NOT build:bundle. The migration runner globs
# dist/migrations/*.js at runtime; bundling would collapse them into a single
# file and no migrations would ever be found.
RUN npm run build -w backend

# --- runtime stage ---------------------------------------------------------
FROM node:24.18.0-slim AS runtime

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/

# Production dependencies only; the toolchain stays in the build stage.
RUN npm ci -w backend --omit=dev && npm cache clean --force

COPY --from=builder /app/backend/dist ./backend/dist
COPY backend/docker-entrypoint.sh /usr/local/bin/pricestalker-backend-entrypoint

# The entrypoint repairs ownership of Docker volumes, then drops to this user.
RUN chmod 755 /usr/local/bin/pricestalker-backend-entrypoint \
    && chown -R node:node /app

WORKDIR /app/backend

EXPOSE 3001
ENV NODE_ENV=production \
    PORT=3001

ENTRYPOINT ["/usr/local/bin/pricestalker-backend-entrypoint"]
CMD ["node", "--max-old-space-size=256", "dist/index.js"]
