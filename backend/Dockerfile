FROM node:20-slim

WORKDIR /app

# Copy root package files for workspace support
COPY package.json package-lock.json ./
# Copy backend package file
COPY backend/package.json ./backend/

# Install only backend dependencies using workspaces
RUN npm ci -w backend --only=production

# Copy pre-compiled JS from local build
COPY backend/dist ./backend/dist

WORKDIR /app/backend
EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001

# Run the app
CMD ["node", "--max-old-space-size=256", "dist/index.js"]
