#!/usr/bin/env bash
# Deploy realtime služby `zion-nirvana-net` na EDGE.
#
# Postup (stejný princip jako scripts/ops/deploy-next-artifact.sh):
#   build → rsync do `<cíl>.stage-<release>` → záloha starého na `.before-<release>`
#   → mv stage na cíl → restart služby → health check na 127.0.0.1:3011/net/health
#   → při selhání health se strom vrátí ze zálohy a služba restartuje.
#
# Použití:
#   bash apps/nirvana-net/deploy/deploy-nirvana-net.sh              # build + deploy
#   bash apps/nirvana-net/deploy/deploy-nirvana-net.sh --install-unit   # první nasazení (unit + daemon-reload)
#   ZION_EDGE_HOST=zion-v6 bash apps/nirvana-net/deploy/deploy-nirvana-net.sh
#
# Co skript NEDĚLÁ: nesahá na nginx (location /net je jednorázová změna, viz
# infra/nginx/edge-current/nirvana.zionterranova.com.conf) a nemění Node
# v `zion-nirvana.service`.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
NET_DIR="$ROOT_DIR/apps/nirvana-net"
EDGE_HOST="${ZION_EDGE_HOST:-zion-new}"
REMOTE_DIR="/opt/zion/APP&WEB/nirvana-net"
SERVICE="zion-nirvana-net.service"
PORT="${NIRVANA_NET_PORT:-3011}"

# fail2ban na EDGE banuje rychlé sériové SSH → jedno master spojení na celý deploy
SSH_OPTS=(-o ControlMaster=auto -o "ControlPath=/tmp/zion-net-deploy-%h" -o ControlPersist=120 -o ConnectTimeout=15)
ssh_() { ssh "${SSH_OPTS[@]}" "$EDGE_HOST" "$@"; }

INSTALL_UNIT=0
ARTIFACT_DIR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --install-unit) INSTALL_UNIT=1; shift ;;
    --artifact-dir) ARTIFACT_DIR="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "neznámý argument: $1" >&2; exit 2 ;;
  esac
done

if [ -n "$ARTIFACT_DIR" ]; then
  APP_DIR="$(cd "$ARTIFACT_DIR" && pwd)"
else
  echo "[nirvana-net] build"
  ( cd "$NET_DIR" && npm run build ) || { echo "build selhal" >&2; exit 1; }
  APP_DIR="$NET_DIR"
fi

[ -f "$APP_DIR/dist/nirvana-net/src/index.js" ] || { echo "chybí $APP_DIR/dist/nirvana-net/src/index.js" >&2; exit 1; }
[ -f "$APP_DIR/package.json" ] || { echo "chybí $APP_DIR/package.json" >&2; exit 1; }
[ -d "$APP_DIR/node_modules/ws" ] || { echo "chybí ws v node_modules (npm install)" >&2; exit 1; }

RELEASE="${ZION_DEPLOY_RELEASE:-$(date -u +%Y%m%dT%H%M%SZ)}"
STAGE="${REMOTE_DIR}.stage-${RELEASE}"
BACKUP="${REMOTE_DIR}.before-${RELEASE}"

echo "[nirvana-net] release $RELEASE → $EDGE_HOST:$REMOTE_DIR"

if [ "$INSTALL_UNIT" = "1" ]; then
  echo "[nirvana-net] instaluji unit $SERVICE"
  scp -q "${SSH_OPTS[@]}" "$NET_DIR/deploy/$SERVICE" "$EDGE_HOST:/etc/systemd/system/$SERVICE"
  ssh_ "chmod 644 /etc/systemd/system/$SERVICE && systemctl daemon-reload"
fi

ssh_ "mkdir -p '$STAGE/node_modules'"
# zdroj + build; node_modules jen to, co služba potřebuje za běhu (ws nemá závislosti)
rsync -az --delete --exclude 'node_modules' -e "ssh ${SSH_OPTS[*]}" "$APP_DIR/" "$EDGE_HOST:$STAGE/"
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" "$APP_DIR/node_modules/ws/" "$EDGE_HOST:$STAGE/node_modules/ws/"

ssh_ "
set -e
install -d /etc/zion
printf 'ZION_DEPLOY_RELEASE=%s\n' '$RELEASE' > /etc/zion/nirvana-net.env
chmod 644 /etc/zion/nirvana-net.env
chown -R zion:zion '$STAGE'
if [ -d '$REMOTE_DIR' ]; then rm -rf '$BACKUP'; mv '$REMOTE_DIR' '$BACKUP'; fi
mv '$STAGE' '$REMOTE_DIR'
systemctl enable '$SERVICE' >/dev/null 2>&1 || true
systemctl restart '$SERVICE'
"

echo "[nirvana-net] čekám na health"
HEALTH=""
for _ in $(seq 1 20); do
  if HEALTH="$(ssh_ "curl -fsS --max-time 2 http://127.0.0.1:$PORT/net/health" 2>/dev/null)"; then
    break
  fi
  HEALTH=""
  sleep 1
done

if [ -z "$HEALTH" ]; then
  echo "[nirvana-net] health selhal — rollback" >&2
  ssh_ "systemctl status '$SERVICE' --no-pager -n 20 || true" >&2 || true
  ssh_ "
  set -e
  systemctl stop '$SERVICE' || true
  if [ -d '$BACKUP' ]; then
    rm -rf '${REMOTE_DIR}.failed-${RELEASE}'
    mv '$REMOTE_DIR' '${REMOTE_DIR}.failed-${RELEASE}'
    mv '$BACKUP' '$REMOTE_DIR'
    systemctl restart '$SERVICE'
  fi
  "
  exit 1
fi

echo "[nirvana-net] health: $HEALTH"
ssh_ "systemctl is-active '$SERVICE' && systemctl show -p ActiveEnterTimestamp --value '$SERVICE'"
echo "[nirvana-net] hotovo ($RELEASE); předchozí verze (pokud byla) v $BACKUP"
