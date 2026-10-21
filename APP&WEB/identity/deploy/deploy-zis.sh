#!/bin/bash
# Deploy ZIS (ZION Identity Service) to the Edge server
# Usage: ./deploy-zis.sh [--build-only]
#
# Target host: zion-v6 by default (zion-new is CGNAT/unreliable — see
# AGENTS.md). Override with ZIS_DEPLOY_HOST=<alias>.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ZIS_DIR="/opt/zion/identity"
DEPLOY_HOST="${ZIS_DEPLOY_HOST:-zion-v6}"
SSH_CMD="ssh $DEPLOY_HOST"

echo "=== ZIS Deploy → $DEPLOY_HOST ==="

# 1. Build locally
echo "[1/6] Building ZIS..."
cd "$REPO_ROOT/APP&WEB/identity"
npm ci
npm run build
echo "  Build complete."

if [[ "${1:-}" == "--build-only" ]]; then
    echo "Build-only mode, skipping deploy."
    exit 0
fi

# 2. Sync files to server
echo "[2/6] Syncing to server..."
$SSH_CMD "mkdir -p $ZIS_DIR/deploy"
rsync -avz --delete \
    --exclude node_modules \
    --exclude .env \
    -e "ssh" \
    "$REPO_ROOT/APP&WEB/identity/package.json" \
    "$REPO_ROOT/APP&WEB/identity/package-lock.json" \
    "$REPO_ROOT/APP&WEB/identity/tsconfig.json" \
    "$REPO_ROOT/APP&WEB/identity/dist/" \
    "$REPO_ROOT/APP&WEB/identity/.env.example" \
    "$DEPLOY_HOST:$ZIS_DIR/"

# 2a. Sync the shared schema to the server-wide shared location.
$SSH_CMD "mkdir -p /opt/zion/shared/prisma"
rsync -avz -e "ssh" \
    "$REPO_ROOT/APP&WEB/shared/prisma/schema.prisma" \
    "$DEPLOY_HOST:/opt/zion/shared/prisma/"

# 3. Install production deps on server (lockfile-pinned)
echo "[3/6] Installing production dependencies..."
$SSH_CMD "cd $ZIS_DIR && npm ci --omit=dev"

# 3a. Apply the shared schema (additive tables only) + generate the client.
#     prisma CLI is a devDependency — fetch it pinned via npx on the server.
echo "[3a/6] Prisma db push + generate..."
$SSH_CMD "cd $ZIS_DIR && npx -y prisma@5.22.0 db push --schema /opt/zion/shared/prisma/schema.prisma --skip-generate"
$SSH_CMD "cd $ZIS_DIR && npx -y prisma@5.22.0 generate --schema /opt/zion/shared/prisma/schema.prisma"

# 4. Setup systemd service
echo "[4/6] Installing systemd service..."
scp "$REPO_ROOT/APP&WEB/identity/deploy/zion-zis.service" \
    "$DEPLOY_HOST:/etc/systemd/system/zion-zis.service"
$SSH_CMD "systemctl daemon-reload"

# 5. Setup nginx
echo "[5/6] Installing nginx config..."
scp "$REPO_ROOT/APP&WEB/identity/deploy/nginx-zis.conf" \
    "$DEPLOY_HOST:/etc/nginx/sites-available/auth.zionterranova.com"
$SSH_CMD "ln -sf /etc/nginx/sites-available/auth.zionterranova.com /etc/nginx/sites-enabled/auth.zionterranova.com"
$SSH_CMD "nginx -t && systemctl reload nginx"

# 6. Restart + smoke check
echo "[6/6] Restarting ZIS service..."
$SSH_CMD "systemctl enable zion-zis"
$SSH_CMD "systemctl restart zion-zis"
sleep 3
$SSH_CMD "systemctl is-active zion-zis"
$SSH_CMD "curl -sf http://127.0.0.1:8096/health && echo"

echo ""
echo "=== ZIS Deploy Complete ==="
echo "  Service:  zion-zis.service"
echo "  URL:      https://auth.zionterranova.com"
echo "  Health:   https://auth.zionterranova.com/health"
echo ""
echo "  Post-deploy checklist:"
echo "    1. .env must set DATABASE_URL, COOKIE_DOMAIN, ZIS_SERVICE_KEY"
echo "    2. EdDSA JWT: generate a key once and add JWT_PRIVATE_KEY to .env:"
echo "       node -e \"const{generateKeyPairSync}=require('crypto');console.log(generateKeyPairSync('ed25519').privateKey.export({format:'pem',type:'pkcs8'}))\""
echo "    3. Keep JWT_SECRET set — it verifies pre-migration HS256 sessions"
echo "    4. Optional: ZIS_EMAIL_ENABLED=1 after postfix is confirmed"
echo "    5. Verify: curl https://auth.zionterranova.com/.well-known/jwks.json"
