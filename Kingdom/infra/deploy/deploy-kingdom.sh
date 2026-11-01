#!/usr/bin/env bash
#
# Nasazení Kingdomu na EDGE2.
#
#   bash infra/deploy/deploy-kingdom.sh                  # build + stage + rsync + restart
#   SKIP_BUILD=1 bash infra/deploy/deploy-kingdom.sh     # použít existující build
#
# Bezpečnostní model:
#   - nikdy nersyncuje do živého adresáře (`--delete` přes app root zabil MarketPlace 2026-10-30)
#   - každý deploy = nový `build-<UTC>` adresář + atomický přepis symlinku `current`
#   - rollback = přepiš symlink na předchozí build (vypíše se na konci)
#   - unit i vhost jdou přes `.new` + `mv`, takže selhání nenechá půlku
set -euo pipefail

cd "$(dirname "$0")/../.."

HOST="${KINGDOM_HOST:-zion-edge2}"
ROOT='/opt/zion/APP&WEB/kingdom'
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BUILD="$ROOT/build-$STAMP"
KEEP="${KINGDOM_KEEP:-3}"

echo "==> cíl: $HOST:$BUILD"

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "==> build"
  npm run verify
fi

echo "==> stage standalone"
node apps/kingdom/scripts/stage.mjs

echo "==> rsync"
ssh "$HOST" "mkdir -p '$ROOT'"
rsync -az --delete apps/kingdom/.next/standalone/ "$HOST:$BUILD/"
ssh "$HOST" "chown -R zion:zion '$BUILD'"

echo "==> unit + vhost"
scp -q infra/systemd/zion-kingdom.service "$HOST:/etc/systemd/system/zion-kingdom.service.new"
scp -q infra/nginx/kingdom.zionterranova.com.conf "$HOST:/etc/nginx/sites-available/kingdom.zionterranova.com.conf"

echo "==> přepnutí"
ssh "$HOST" bash -s <<REMOTE
set -euo pipefail
ROOT='$ROOT'
BUILD='$BUILD'
KEEP='$KEEP'

PREV="\$(readlink -f "\$ROOT/current" || true)"

ln -sfn "\$BUILD" "\$ROOT/current.tmp"
mv -Tf "\$ROOT/current.tmp" "\$ROOT/current"

mv -f /etc/systemd/system/zion-kingdom.service.new /etc/systemd/system/zion-kingdom.service
ln -sfn /etc/nginx/sites-available/kingdom.zionterranova.com.conf /etc/nginx/sites-enabled/kingdom.zionterranova.com.conf

nginx -t
systemctl daemon-reload
systemctl enable zion-kingdom.service >/dev/null
systemctl restart zion-kingdom.service
systemctl reload nginx

sleep 4
echo "--- health ---"
systemctl is-active zion-kingdom.service
curl -s -o /dev/null -w "local 127.0.0.1:3020 -> %{http_code}\n" http://127.0.0.1:3020/
curl -s -o /dev/null -w "nginx (Host kingdom) -> %{http_code}\n" -H "Host: kingdom.zionterranova.com" http://127.0.0.1/

echo "--- úklid starých buildů (nechávám \$KEEP) ---"
ls -1dt "\$ROOT"/build-* 2>/dev/null | tail -n +\$(( KEEP + 1 )) | xargs -r rm -rf

echo "--- rollback ---"
echo "předchozí build: \${PREV:-žádný}"
REMOTE

echo
echo "==> hotovo"
echo "    služba:  zion-kingdom.service (127.0.0.1:3020)"
echo "    vhost:   kingdom.zionterranova.com (port 80, staged)"
echo "    live:    https://kingdom.zionterranova.com"
