#!/usr/bin/env bash
# Deploy only the V3 zion-oasis API to the Edge server.
#
# Pulls latest main in /opt/zion, builds zion-oasis, and restarts
# zion-edge-oasis.service.

set -euo pipefail

EDGE_HOST="${ZION_EDGE_HOST:-62.171.141.136}"
EDGE_PORT="${ZION_EDGE_PORT:-2222}"
SSH_KEY="${ZION_EDGE_SSH_KEY:-$HOME/.ssh/zion-edge-post-wipe-2026-07-29}"
REMOTE_ROOT="/opt/zion"

SSH_OPTS="-i ${SSH_KEY} -p ${EDGE_PORT} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo "[deploy-oasis-api] Deploying zion-oasis to ${EDGE_HOST}:${EDGE_PORT}..."

ssh ${SSH_OPTS} "root@${EDGE_HOST}" "
  set -euo pipefail
  cd '${REMOTE_ROOT}'

  echo '[deploy-oasis-api] Pulling latest main...'
  git stash -u || true
  git pull origin main || true

  echo '[deploy-oasis-api] Building zion-oasis (release)...'
  cd '${REMOTE_ROOT}/V3'
  cargo build --release -p zion-oasis

  echo '[deploy-oasis-api] Restarting service...'
  systemctl restart zion-edge-oasis

  echo '[deploy-oasis-api] Waiting for health...'
  for i in {1..30}; do
    if curl -s http://127.0.0.1:8094/health >/dev/null 2>&1; then
      echo '[deploy-oasis-api] zion-oasis healthy'
      break
    fi
    sleep 0.5
  done
"

echo "[deploy-oasis-api] Done"
