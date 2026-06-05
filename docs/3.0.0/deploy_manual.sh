#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="77.42.71.94"
REMOTE_USER="root"
REMOTE_SRC="/root/zion-2.9.6-main/APP&WEB/website-v2.9"
REMOTE_COMPOSE="/root/zion-2.9.6-main/docker"
SSH_KEY="/mnt/c/Users/yosef/.ssh/zion_hetzner_key"
LOCAL_DIR="/mnt/c/Users/yosef/Desktop/Zion/2.9.6-main/APP&WEB/website-v2.9"

echo "Creating remote directory..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$REMOTE_USER@$REMOTE_HOST" "mkdir -p '$REMOTE_SRC'"

echo "Syncing source files..."
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='out' \
  --exclude='*.tar.gz' \
  --exclude='.env.local' \
  -e "ssh -i '$SSH_KEY' -o StrictHostKeyChecking=accept-new" \
  "$LOCAL_DIR/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_SRC/"

echo "Syncing docker compose..."
rsync -avz \
  -e "ssh -i '$SSH_KEY' -o StrictHostKeyChecking=accept-new" \
  "/mnt/c/Users/yosef/Desktop/Zion/2.9.6-main/docker/docker-compose.website.yml" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_COMPOSE/"

echo "Building Docker image on server..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$REMOTE_USER@$REMOTE_HOST" "cd '$REMOTE_COMPOSE' && docker compose -f docker-compose.website.yml build --no-cache website"

echo "Recreating container..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$REMOTE_USER@$REMOTE_HOST" "cd '$REMOTE_COMPOSE' && docker compose -f docker-compose.website.yml up -d website"

echo "Checking health..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$REMOTE_USER@$REMOTE_HOST" '
  for i in $(seq 1 12); do
    STATUS=$(docker inspect --format="{{.State.Health.Status}}" zion-website 2>/dev/null || echo "missing")
    if [ "$STATUS" = "healthy" ]; then
      echo "Container healthy after ~$((i*5))s"
      exit 0
    fi
    sleep 5
  done
  echo "Warning: container not healthy after 60s (status: $STATUS)"
  docker logs --tail 20 zion-website
  exit 1
'

echo "Deployment complete!"
