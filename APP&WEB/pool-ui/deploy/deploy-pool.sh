#!/bin/bash
# Deploy ZION Pool NG UI to the Edge server (pool.zionterranova.com)
# Usage: ./deploy-pool.sh [--build-only] [--nginx]
#
#   --build-only  build the static export, skip rsync/nginx
#   --nginx       also install + reload the nginx vhost (needs sudo)
#
# Static export lands at /var/www/pool; the vhost proxies /public/v1/*
# to the zion-pool API on 127.0.0.1:8080 (ZION_POOL_API_BIND).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
UI_DIR="$REPO_ROOT/APP&WEB/pool-ui"
WEB_ROOT="/var/www/pool"
# IPv4 egress to edge is CGNAT-blocked; zion-v6 (IPv6 :2222) is the reliable alias.
SSH_HOST="${POOL_DEPLOY_HOST:-zion-v6}"
SSH_CMD="ssh $SSH_HOST"
NGINX_SRC="$REPO_ROOT/V31/deploy/nginx/pool.zionterranova.com.conf"
NGINX_DST="/etc/nginx/sites-available/pool.zionterranova.com.conf"
NGINX_LINK="/etc/nginx/sites-enabled/pool.zionterranova.com.conf"

echo "=== ZION Pool UI Deploy ==="

# 1. Build the static export locally (Next.js `output: export` -> dist/).
echo "[1/4] Building pool-ui..."
cd "$UI_DIR"
npm install --production=false
npm run build
test -f dist/index.html || { echo "FATAL: dist/index.html missing"; exit 1; }
echo "  Build complete."

if [[ " $* " == *" --build-only "* ]]; then
    echo "Build-only mode, skipping deploy."
    exit 0
fi

# 2. Sync the static export.
echo "[2/4] Syncing to $WEB_ROOT..."
$SSH_CMD "mkdir -p $WEB_ROOT"
rsync -avz --delete --rsync-path="rsync" -e "ssh" \
    "$UI_DIR/dist/" \
    "$SSH_HOST:$WEB_ROOT/"

# 3. Optionally install + enable the nginx vhost.
if [[ " $* " == *" --nginx "* ]]; then
    echo "[3/4] Installing nginx vhost..."
    rsync -avz --rsync-path="rsync" -e "ssh" \
        "$NGINX_SRC" "$SSH_HOST:$NGINX_DST"
    $SSH_CMD "ln -sfn $NGINX_DST $NGINX_LINK && nginx -t && systemctl reload nginx"
else
    echo "[3/4] Skipping nginx (pass --nginx to install the vhost)."
fi

# 4. First-deploy reminder: cert + DNS.
echo "[4/4] Done."
echo "  First deploy only: point pool.zionterranova.com A -> 62.171.141.136,"
echo "  then run on edge: certbot --nginx -d pool.zionterranova.com"
