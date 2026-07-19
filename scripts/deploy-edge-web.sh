#!/bin/bash
# ZION Website Edge Deployment Script
# Run this ON the Edge server (62.171.141.136) as root.
#
# Two modes:
#   ./deploy-edge-web.sh              # local build on Edge (default)
#   ./deploy-edge-web.sh --rsync      # use pre-built artifacts at /root/zion-web-build
#                                     (populated by rsync from dev machine — see below)
#
# Prerequisites:
#   - Docker + docker compose installed
#   - nginx reverse proxy (not Caddy — Edge uses nginx)
#   - Repo cloned at /root/zion/2.9.6  (matches edge-deploy/setup-edge.sh)
#   - For --rsync mode: dev machine has already run:
#       npm run build           # in APP&WEB/website-v2.9
#       rsync -az .next/standalone/  zion-new:/root/zion-web-build/
#       rsync -az .next/static/      zion-new:/root/zion-web-build/.next/static/
#       rsync -az public/            zion-new:/root/zion-web-build/public/
#
# Stash handling:
#   If the repo has uncommitted changes (e.g. miner WIP), they are stashed
#   before `git pull` and the stash name is printed at the end. Restore with
#   `git stash pop` after the deploy.
#
# Container config (matches live Edge as of 2026-07-19):
#   - image: zion-web:latest (+ version tag zion-web:<VERSION>)
#   - network_mode: host  (so 127.0.0.1 inside container = host; needed for
#     RPC access to 127.0.0.1:8443/8448/8455)
#   - HOSTNAME=127.0.0.1  (Next.js binds to 127.0.0.1:3000 only; nginx proxies)
#   - read_only: true with tmpfs /tmp /var/cache

set -euo pipefail

REPO_DIR="/root/zion/2.9.6"
WEB_DIR="$REPO_DIR/APP&WEB/website-v2.9"
COMPOSE_DIR="/root/zion-web"
BUILD_DIR="/root/zion-web-build"
VERSION="${1:-}"
RSYNC_MODE=0

if [ "${1:-}" = "--rsync" ]; then
  RSYNC_MODE=1
  VERSION="${2:-v$(date +%Y%m%d-%H%M)}"
elif [ -z "$VERSION" ]; then
  VERSION="v$(date +%Y%m%d-%H%M)"
fi

IMAGE_TAG="zion-web:${VERSION}"
IMAGE_LATEST="zion-web:latest"

echo "=== ZION Website Edge Deployment $VERSION (mode: $([ $RSYNC_MODE = 1 ] && echo rsync || echo local-build)) ==="

cd "$REPO_DIR"

# Stash uncommitted changes before pull
STASH_NAME=""
if [ -n "$(git status --porcelain)" ]; then
  STASH_NAME="web-deploy-$(date +%Y%m%d-%H%M%S)"
  echo "[0/7] Stashing uncommitted changes as '$STASH_NAME'..."
  git stash push -u -m "$STASH_NAME"
fi

# Pull latest changes
echo "[1/7] Pulling latest changes..."
git pull origin main

if [ $RSYNC_MODE = 1 ]; then
  # Verify rsync artifacts exist
  if [ ! -f "$BUILD_DIR/server.js" ]; then
    echo "ERROR: --rsync mode requires pre-built artifacts at $BUILD_DIR/server.js"
    echo "       Run on dev machine:"
    echo "         cd APP&WEB/website-v2.9 && npm run build"
    echo "         rsync -az .next/standalone/  zion-new:$BUILD_DIR/"
    echo "         rsync -az .next/static/      zion-new:$BUILD_DIR/.next/static/"
    echo "         rsync -az public/            zion-new:$BUILD_DIR/public/"
    exit 1
  fi
  echo "[2/7] Skipping local build (using rsync artifacts at $BUILD_DIR)"
  echo "[3/7] Skipping npm install (using rsync artifacts)"
  BUILD_CONTEXT="$BUILD_DIR"
else
  # Install deps & build on Edge
  echo "[2/7] Installing dependencies..."
  cd "$WEB_DIR"
  npm install --legacy-peer-deps

  echo "[3/7] Building Next.js app..."
  npm run build

  # Stage standalone artifacts into a clean build dir for Docker context
  BUILD_CONTEXT="/tmp/zion-web-build-$$"
  rm -rf "$BUILD_CONTEXT"
  mkdir -p "$BUILD_CONTEXT"
  cp -a "$WEB_DIR/.next/standalone/." "$BUILD_CONTEXT/"
  mkdir -p "$BUILD_CONTEXT/.next"
  cp -a "$WEB_DIR/.next/static" "$BUILD_CONTEXT/.next/"
  cp -a "$WEB_DIR/public" "$BUILD_CONTEXT/"
fi

# Build Docker image from standalone artifacts
echo "[4/7] Building Docker image $IMAGE_TAG (+ $IMAGE_LATEST)..."
cat > "$BUILD_CONTEXT/Dockerfile" <<'DOCKERFILE'
FROM node:20-alpine
WORKDIR /app
COPY . .
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
CMD ["node", "server.js"]
DOCKERFILE

docker build -t "$IMAGE_TAG" -t "$IMAGE_LATEST" "$BUILD_CONTEXT"

# Clean up temp build context (only if we created it locally)
if [ $RSYNC_MODE = 0 ]; then
  rm -rf "$BUILD_CONTEXT"
fi

# Restart container
echo "[5/7] Restarting container..."
mkdir -p "$COMPOSE_DIR"
cat > "$COMPOSE_DIR/docker-compose.yml" <<EOF
services:
  zion-web:
    image: $IMAGE_LATEST
    container_name: zion-web
    restart: unless-stopped
    network_mode: host
    environment:
      - HOSTNAME=127.0.0.1
      - NODE_ENV=production
      - NEXT_TELEMETRY_DISABLED=1
    read_only: true
    tmpfs:
      - /tmp
      - /var/cache
EOF

# Stop + remove old container (avoid name conflict on rebuild)
docker stop zion-web 2>/dev/null || true
docker rm zion-web 2>/dev/null || true
docker compose -f "$COMPOSE_DIR/docker-compose.yml" up -d

# Wait for health
echo "[6/7] Waiting for health..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "  Healthy after ${i}s"
    curl -s http://127.0.0.1:3000/api/health
    echo
    break
  fi
  sleep 1
done

# Reload nginx (Edge uses nginx, not Caddy)
echo "[7/7] Reloading nginx..."
if command -v nginx >/dev/null 2>&1; then
  nginx -t && systemctl reload nginx || true
elif command -v caddy >/dev/null 2>&1; then
  caddy reload --config /etc/caddy/Caddyfile || true
fi

echo "=== Deployment complete ==="
echo "Website:  https://zionterranova.com"
echo "Health:   curl http://127.0.0.1:3000/api/health"
echo "Image:    $IMAGE_TAG (+ $IMAGE_LATEST)"
echo "Compose:  $COMPOSE_DIR/docker-compose.yml"
if [ -n "$STASH_NAME" ]; then
  echo "Stash:    $STASH_NAME  (restore with: cd $REPO_DIR && git stash pop)"
fi
