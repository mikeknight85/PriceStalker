# Use a full Node image because we need to install Puppeteer dependencies
FROM node:20-slim

# Install chromium and fonts for arm64 compatibility
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

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (ignoring workspace)
RUN npm install --omit=dev

# Copy built bundle (already bundled locally via esbuild)
COPY dist ./dist

# Set Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=5100

EXPOSE 5100

# Run the bundled CJS file
CMD ["node", "dist/remotescraper.cjs"]