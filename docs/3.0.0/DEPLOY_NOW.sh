#!/usr/bin/env bash
# Manual deploy commands — run this ON THE SERVER (Edge VPS)
# Copy this file to the server and execute, or run commands one by one

set -e

echo "=== ZION Website Deploy ==="
echo "Run these commands on the Edge server (77.42.71.94):"
echo ""

cat <<'COMMANDS'

# 1. Go to repo and pull latest changes
cd ~/zion-2.9.6-main/APP&WEB/website-v2.9 || cd ~/zion-web/APP&WEB/website-v2.9 || cd ~/zion-web
git pull origin main

# 2. Install dependencies
npm install

# 3. Build (on server, Linux path handles APP&WEB correctly)
npm run build

# 4. Build Docker image
cd ~/zion-2.9.6-main/docker || cd ~/zion-web/docker
docker compose -f docker-compose.website.yml build --no-cache website

# 5. Restart container
docker compose -f docker-compose.website.yml up -d website

# 6. Check health
sleep 5
docker ps | grep zion-website
docker logs --tail 20 zion-website

echo "=== Deploy complete ==="

COMMANDS
