#!/bin/bash
set -e
LOG=/tmp/deploy-docs-history.log
exec > "$LOG" 2>&1

cd /root/zion-web-deploy

echo "[1/4] chmod docs..."
chmod -R 755 "APP&WEB/website-v2.9/public/docs/"

echo "[2/4] building image..."
docker compose -f docker/docker-compose.website.yml build website

echo "[3/4] restart container..."
docker rm -f zion-website || true
docker compose -f docker/docker-compose.website.yml up -d website

echo "[4/4] waiting 10s for health..."
sleep 10
docker ps --filter name=zion-website --format "{{.Names}} {{.Status}}"

echo "[verify] HTTP check..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/docs

echo ""
echo "DONE"
