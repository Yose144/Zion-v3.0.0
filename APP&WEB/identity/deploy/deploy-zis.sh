#!/bin/bash
# Deploy ZIS (ZION Identity Service) to the Edge server
# Usage: ./deploy-zis.sh [--build-only]

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ZIS_DIR="/opt/zion/identity"
SSH_CMD="ssh zion-new"

echo "=== ZIS Deploy ==="

# 1. Build locally
echo "[1/5] Building ZIS..."
cd "$REPO_ROOT/APP&WEB/identity"
npm install --production=false
npm run build
echo "  Build complete."

if [[ "${1:-}" == "--build-only" ]]; then
    echo "Build-only mode, skipping deploy."
    exit 0
fi

# 2. Sync files to server
echo "[2/5] Syncing to server..."
$SSH_CMD "mkdir -p $ZIS_DIR/src $ZIS_DIR/deploy"
rsync -avz --delete \
    --exclude node_modules \
    --exclude .env \
    -e "ssh" \
    "$REPO_ROOT/APP&WEB/identity/package.json" \
    "$REPO_ROOT/APP&WEB/identity/tsconfig.json" \
    "$REPO_ROOT/APP&WEB/identity/dist/" \
    "$REPO_ROOT/APP&WEB/identity/.env.example" \
    "zion-new:$ZIS_DIR/"

# 3. Install production deps on server
echo "[3/5] Installing production dependencies..."
$SSH_CMD "cd $ZIS_DIR && npm install --production"

# 4. Setup systemd service
echo "[4/5] Installing systemd service..."
scp "$REPO_ROOT/APP&WEB/identity/deploy/zion-zis.service" \
    "zion-new:/etc/systemd/system/zion-zis.service"
$SSH_CMD "systemctl daemon-reload"

# 5. Setup nginx
echo "[5/5] Installing nginx config..."
scp "$REPO_ROOT/APP&WEB/identity/deploy/nginx-zis.conf" \
    "zion-new:/etc/nginx/sites-available/auth.zionterranova.com"
$SSH_CMD "ln -sf /etc/nginx/sites-available/auth.zionterranova.com /etc/nginx/sites-enabled/auth.zionterranova.com"
$SSH_CMD "nginx -t && systemctl reload nginx"

# Start service
echo "Starting ZIS service..."
$SSH_CMD "systemctl enable zion-zis"
$SSH_CMD "systemctl restart zion-zis"
sleep 2
$SSH_CMD "systemctl is-active zion-zis"

echo ""
echo "=== ZIS Deploy Complete ==="
echo "  Service:  zion-zis.service"
echo "  URL:      https://auth.zionterranova.com"
echo "  Health:   https://auth.zionterranova.com/health"
echo ""
echo "  Next steps:"
echo "    1. Create .env on server: cp $ZIS_DIR/.env.example $ZIS_DIR/.env"
echo "    2. Set DATABASE_URL to PostgreSQL connection string"
echo "    3. Set JWT_SECRET to a random 32+ char string"
echo "    4. Run: cd $ZIS_DIR && npx prisma db push --schema ../shared/prisma/schema.prisma"
echo "    5. Restart: systemctl restart zion-zis"
