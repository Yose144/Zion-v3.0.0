#!/usr/bin/env bash
# Deploy only the V3 zion-oasis API to the Edge server.
#
# Stashes local changes in /opt/zion, pulls latest main, builds zion-oasis,
# chowns the binary to zion, and restarts zion-edge-oasis.service.

set -euo pipefail

EDGE_HOST="${ZION_EDGE_HOST:-62.171.141.136}"
EDGE_PORT="${ZION_EDGE_PORT:-2222}"
SSH_KEY="${ZION_EDGE_SSH_KEY:-$HOME/.ssh/zion-edge-post-wipe-2026-07-29}"
REMOTE_ROOT="/opt/zion"

SSH_OPTS="-i ${SSH_KEY} -p ${EDGE_PORT} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo "[deploy-oasis-api] Deploying zion-oasis to ${EDGE_HOST}:${EDGE_PORT}..."

ssh ${SSH_OPTS} "root@${EDGE_HOST}" "
  set -euo pipefail

  git config --global --add safe.directory '${REMOTE_ROOT}' || true

  cd '${REMOTE_ROOT}'

  if [ -n \"\$(git status --porcelain)\" ]; then
    echo '[deploy-oasis-api] Stashing local changes...'
    git stash push -u -m \"oasis-api-deploy-\$(date +%Y%m%d-%H%M%S)\"
  fi

  echo '[deploy-oasis-api] Pulling latest main...'
  git pull origin main

  echo '[deploy-oasis-api] Building zion-oasis (release)...'
  export PATH=\"/root/.cargo/bin:\${PATH}\"
  cd '${REMOTE_ROOT}/V3'
  cargo build --release -p zion-oasis

  echo '[deploy-oasis-api] Setting binary ownership to zion...'
  chown zion:zion '${REMOTE_ROOT}/V3/target/release/zion-oasis'

  echo '[deploy-oasis-api] Restarting service...'
  systemctl restart zion-edge-oasis

  echo '[deploy-oasis-api] Waiting for health...'
  for i in \$(seq 1 60); do
    if curl -s http://127.0.0.1:8094/health >/dev/null 2>&1; then
      echo '[deploy-oasis-api] zion-oasis healthy'
      break
    fi
    sleep 1
  done
"

echo "[deploy-oasis-api] Done"
