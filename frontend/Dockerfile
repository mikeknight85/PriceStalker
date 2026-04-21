# Build stage — pinned to the runner's native arch via BUILDPLATFORM so that
# vite + tsc don't run under QEMU emulation when targeting arm64 (that turns a
# 2-min build into a 60-min one that eventually times out). The output is
# static HTML/JS/CSS — architecture-independent — so it's safe to build
# natively on amd64 and ship in both amd64 and arm64 final images.
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage - serve with nginx
FROM nginx:alpine AS production

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
