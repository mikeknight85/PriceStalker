# Remote scraper image. Build context is the REPOSITORY ROOT, not
# ./remotescraper, because this is an npm workspace (package name:
# stealth-scraper) and the root lockfile is required to resolve dependencies.
#
#   docker build -f remotescraper/Dockerfile .
#
# Self-contained: esbuild bundles here rather than the dist/ being copied in
# from a developer's machine, so a clean checkout is all CI needs.

# --- build stage -----------------------------------------------------------
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY remotescraper/package.json ./remotescraper/

# Chromium is installed via apt in the runtime stage, so Puppeteer must not
# also download its own copy -- that would add several hundred MB per arch.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN npm ci -w stealth-scraper

COPY remotescraper/src ./remotescraper/src

RUN npm run build -w stealth-scraper

# --- runtime stage ---------------------------------------------------------
FROM node:20-slim AS runtime

# Chromium plus the font packages Puppeteer needs to render non-Latin pages.
RUN apt-get update \
    && apt-get install -y \
      chromium \
      fonts-ipafont-gothic \
      fonts-wqy-zenhei \
      fonts-thai-tlwg \
      fonts-kacst \
      fonts-freefont-ttf \
      libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY remotescraper/package.json ./remotescraper/

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN npm ci -w stealth-scraper --omit=dev && npm cache clean --force

COPY --from=builder /app/remotescraper/dist ./remotescraper/dist

RUN chown -R node:node /app
USER node

WORKDIR /app/remotescraper

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=5100

EXPOSE 5100

CMD ["node", "dist/remotescraper.cjs"]
