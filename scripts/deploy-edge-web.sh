#!/bin/bash
# ZION Website Edge Deployment Script
# Run this ON the Edge server (77.42.71.94) as root
#
# Prerequisites:
#   - Docker + docker compose installed
#   - Caddy installed (reverse proxy)
#   - Repo cloned at /root/zion-2.9.6-main
#   - .env.production configured

set -euo pipefail

REPO_DIR="/root/zion-2.9.6-main"
WEB_DIR="$REPO_DIR/APP&WEB/website-v2.9"
VERSION="${1:-3.1.0}"

echo "=== ZION Website Edge Deployment v$VERSION ==="

cd "$REPO_DIR"

# Pull latest changes
echo "[1/6] Pulling latest changes..."
git pull origin main

# Install deps & build
echo "[2/6] Installing dependencies..."
cd "$WEB_DIR"
npm install

echo "[3/6] Building Next.js app..."
npm run build

# Build Docker image from host artifacts
# NOTE: .dockerignore excludes .next and node_modules (for CI builds that
# install fresh inside Docker). Our deploy copies host-built artifacts, so
# we temporarily move .dockerignore aside during the build.
echo "[4/6] Building Docker image..."
cd "$REPO_DIR"
if [ -f "$WEB_DIR/.dockerignore" ]; then
  mv "$WEB_DIR/.dockerignore" "$WEB_DIR/.dockerignore.bak"
  trap 'mv "$WEB_DIR/.dockerignore.bak" "$WEB_DIR/.dockerignore" 2>/dev/null || true' EXIT
fi
docker build -t "zion-website:$VERSION" -f - "$WEB_DIR" <<'DOCKERFILE'
FROM node:20-alpine
WORKDIR /app
COPY .next .next
COPY node_modules node_modules
COPY package.json package.json
COPY public public
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "node_modules/.bin/next", "start"]
DOCKERFILE
# Restore .dockerignore
if [ -f "$WEB_DIR/.dockerignore.bak" ]; then
  mv "$WEB_DIR/.dockerignore.bak" "$WEB_DIR/.dockerignore"
fi

# Restart container
echo "[5/6] Restarting container..."
cd /root/zion-web || mkdir -p /root/zion-web
cat > /root/zion-web/docker-compose.yml <<EOF
services:
  zion-website:
    image: zion-website:$VERSION
    container_name: zion-website
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
EOF

docker compose -f /root/zion-web/docker-compose.yml up -d

# Reload Caddy
echo "[6/6] Reloading Caddy..."
caddy reload --config /etc/caddy/Caddyfile || true

echo "=== Deployment complete ==="
echo "Website: https://zion.cz"
echo "Health:  curl http://127.0.0.1:3000/api/health"
echo "Version: $VERSION"
