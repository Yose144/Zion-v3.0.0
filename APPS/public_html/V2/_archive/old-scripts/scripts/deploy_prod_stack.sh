#!/usr/bin/env bash
#
# Automated deployment helper for the ZION production stack
# This script expects passwordless SSH access (e.g. via SSH key) to the
# production server defined in SERVER_HOST/SERVER_USER below.
#
# It performs the following steps:
#   1. Synchronises the repository to /root/zion on the remote host
#   2. Ensures Docker + docker compose are installed
#   3. Builds/starts the docker-compose production stack
#   4. Deploys/updates XMRig miner configuration and optional systemd unit
#   5. Runs post-deploy smoke tests
#
# Usage:
#   ./scripts/deploy_prod_stack.sh [ssh_host] [ssh_user]
# Defaults: host=91.98.122.165 user=root
set -euo pipefail

SERVER_HOST="${1:-91.98.122.165}"
SERVER_USER="${2:-root}"
REPO_NAME="Zion-TestNet-2.7.5"
REMOTE_BASE="/root/zion"
REMOTE_XMRIG="/root/xmrig-6.21.3"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
info() { printf '\n%s\n' "$1"; }

bold "🚀 ZION production deployment helper"
bold "Target: ${SERVER_USER}@${SERVER_HOST}"

if ! command -v rsync >/dev/null 2>&1; then
  echo "❌ Missing rsync on local machine." >&2
  echo "➡️  Install: sudo apt install rsync    (Linux)" >&2
  exit 1
fi

info "🔑 Testing SSH connectivity"
if ! ssh -o ConnectTimeout=5 "${SERVER_USER}@${SERVER_HOST}" "echo SSH_OK" >/dev/null 2>&1; then
  echo "❌ SSH connection failed. Configure SSH keys or provide VPN/IP access." >&2
  exit 1
fi

info "📂 Syncing repository to remote"
ssh "${SERVER_USER}@${SERVER_HOST}" "mkdir -p ${REMOTE_BASE}"
rsync -az --delete --exclude='.git' --exclude='__pycache__' \
  "$(pwd)/" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_BASE}/"

info "🐳 Ensuring Docker + compose on remote"
ssh "${SERVER_USER}@${SERVER_HOST}" <<'REMOTE'
set -e
if ! command -v docker >/dev/null 2>&1; then
  apt update
  apt install -y docker.io
fi
if ! docker compose version >/dev/null 2>&1; then
  apt install -y docker-compose-plugin
fi
systemctl enable --now docker
REMOTE

info "📦 Building & starting docker stack"
ssh "${SERVER_USER}@${SERVER_HOST}" <<REMOTE
set -e
cd ${REMOTE_BASE}
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d legacy-daemon zion-go-bridge zion-production
REMOTE

info "🛠 Setting up XMRig miner"
ssh "${SERVER_USER}@${SERVER_HOST}" <<REMOTE
set -e
mkdir -p ${REMOTE_XMRIG}
cd ${REMOTE_XMRIG}
if [ ! -x xmrig ]; then
  if [ ! -f xmrig-6.21.3-linux-x64.tar.gz ]; then
    curl -L -o xmrig-6.21.3-linux-x64.tar.gz https://github.com/xmrig/xmrig/releases/download/v6.21.3/xmrig-6.21.3-linux-x64.tar.gz
  fi
  tar xf xmrig-6.21.3-linux-x64.tar.gz --strip-components=1
fi
cat > config.json <<'CFG'
{
  "autosave": true,
  "cpu": {
    "enabled": true,
    "priority": null,
    "max-threads-hint": 75,
    "yield": true
  },
  "pools": [
    {
      "url": "127.0.0.1:3333",
      "user": "ZION_TEST_MINER",
      "pass": "x",
      "algo": "rx/0",
      "rig-id": "prod-cpu",
      "keepalive": true
    }
  ],
  "randomx": {
    "1gb-pages": false,
    "rdmsr": true,
    "wrmsr": true
  }
}
CFG
cat > /etc/systemd/system/xmrig.service <<'UNIT'
[Unit]
Description=ZION XMRig Miner
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=/root/xmrig-6.21.3
ExecStart=/root/xmrig-6.21.3/xmrig --config=/root/xmrig-6.21.3/config.json
Restart=always
Nice=10

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now xmrig.service
REMOTE

info "🧪 Smoke tests"
ssh "${SERVER_USER}@${SERVER_HOST}" <<REMOTE
set -e
cd ${REMOTE_BASE}
for endpoint in \
  "http://127.0.0.1:8090/api/v1/health" \
  "http://127.0.0.1:8090/api/v1/daemon/get_info" \
  "http://127.0.0.1:8888/api/bridge/daemon/get_info"; do
  echo "Testing: $endpoint"
  curl -sf "$endpoint" | head -n 5
  echo
end
nc -zv 127.0.0.1 3333
nc -zv 127.0.0.1 3334 || true
REMOTE

info "✅ Deployment finished"
info "  • Dashboard: http://${SERVER_HOST}:8888"
info "  • RPC: http://${SERVER_HOST}:18081"
info "  • Mining (RandomX): stratum+tcp://${SERVER_HOST}:3333"
info "  • Logs: docker logs -f zion-go-bridge"

exit 0
