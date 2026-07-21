# Frontend image. Build context is the REPOSITORY ROOT, not ./frontend, because
# this is an npm workspace: the root package.json and lockfile are required to
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
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

WORKDIR /app

# Manifests first so dependency installation caches independently of source.
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/

# Dev dependencies are required here: vite and typescript do the building.
RUN npm ci -w frontend

COPY frontend/ ./frontend/

RUN npm run build -w frontend

# --- runtime stage ---------------------------------------------------------
FROM nginx:alpine

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
