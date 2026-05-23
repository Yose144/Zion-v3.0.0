#!/usr/bin/env bash
# ZION website deploy — Docker-based (standalone Next.js + nginx proxy)
# Rsync source to server, rebuild Docker image, recreate container.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
LOG_PREFIX="[deploy]"

REMOTE_HOST="${REMOTE_HOST:-77.42.71.94}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_SRC="${REMOTE_SRC:-/root/zion-2.9.6-main/APP&WEB/website-v2.9}"
REMOTE_COMPOSE="${REMOTE_COMPOSE:-/root/zion-2.9.6-main/docker}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ssh-key-zion-edge}"
COMPOSE_FILE="docker-compose.website.yml"
SKIP_SYNC=0
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: scripts/deploy.sh [options]

Docker-based website deployment: rsync source -> rebuild image -> recreate container.

Options:
  --host <hostname>        Target SSH host (default: $REMOTE_HOST or 77.42.71.94)
  --user <user>            SSH user (default: $REMOTE_USER or root)
  --remote-src <path>      Remote source path (default: /root/zion-2.9.6-main/APP&WEB/website-v2.9)
  --remote-compose <path>  Remote Docker compose directory (default: /root/zion-2.9.6-main/docker)
  --ssh-key <path>         SSH private key (default: $SSH_KEY or ~/.ssh/ssh-key-zion-edge)
  --skip-sync              Skip rsync (rebuild from existing remote source)
  --dry-run                Sync only; skip Docker rebuild
  -h, --help               Show this help

Environment overrides:
  REMOTE_HOST, REMOTE_USER, REMOTE_SRC, REMOTE_COMPOSE, SSH_KEY
EOF
}

log() { printf "%s %s %s\n" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$LOG_PREFIX" "$*"; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command '$1' not found" >&2
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)       shift; REMOTE_HOST="${1:?Missing value for --host}" ;;
    --user)       shift; REMOTE_USER="${1:?Missing value for --user}" ;;
    --remote-src) shift; REMOTE_SRC="${1:?Missing value for --remote-src}" ;;
    --remote-compose) shift; REMOTE_COMPOSE="${1:?Missing value for --remote-compose}" ;;
    --ssh-key)    shift; SSH_KEY="${1:?Missing value for --ssh-key}" ;;
    --skip-sync)  SKIP_SYNC=1 ;;
    --dry-run)    DRY_RUN=1 ;;
    -h|--help)    usage; exit 0 ;;
    *)            echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
  shift
done

require_cmd rsync
require_cmd ssh

SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=accept-new"
REMOTE="$REMOTE_USER@$REMOTE_HOST"
# shell-quote remote paths for safe expansion on the remote shell (paths may contain '&', spaces, etc.)
REMOTE_SRC_SH=$(printf '%q' "$REMOTE_SRC")
REMOTE_COMPOSE_SH=$(printf '%q' "$REMOTE_COMPOSE")
# rsync remote destinations are parsed by a remote shell; '&' must be escaped or it will split the path.
REMOTE_SRC_RSYNC="${REMOTE_SRC//&/\\&}"
REMOTE_COMPOSE_RSYNC="${REMOTE_COMPOSE//&/\\&}"

cd "$ROOT_DIR"

# --- Local dependency bootstrap + build preflight ---
if [[ ! -d node_modules ]]; then
  log "node_modules missing; installing local dependencies"
  if command -v npm >/dev/null 2>&1; then
    npm ci || { echo "Error: npm ci failed" >&2; exit 1; }
  else
    echo "Error: npm is required to bootstrap website dependencies" >&2
    exit 1
  fi
fi

log "Running local build preflight"
if command -v npm >/dev/null 2>&1; then
  npm run build || { echo "Error: local build preflight failed" >&2; exit 1; }
fi

# --- Rsync source to server ---
if [[ $SKIP_SYNC -ne 1 ]]; then
  log "Syncing source to $REMOTE_HOST:$REMOTE_SRC"
  ssh $SSH_OPTS "$REMOTE" "mkdir -p $REMOTE_SRC_SH"
  rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='out' \
    --exclude='*.tar.gz' \
    --exclude='.env.local' \
    -e "ssh $SSH_OPTS" \
    ./ "${REMOTE}:${REMOTE_SRC_RSYNC}/"

  log "Syncing compose file to $REMOTE_HOST:$REMOTE_COMPOSE"
  rsync -avz \
    -e "ssh $SSH_OPTS" \
    "$REPO_ROOT/docker/$COMPOSE_FILE" "$REMOTE:${REMOTE_COMPOSE_RSYNC}/"
else
  log "Skipping rsync (--skip-sync)"
fi

if [[ $DRY_RUN -eq 1 ]]; then
  log "Dry run — source synced, skipping Docker rebuild"
  exit 0
fi

# --- Docker rebuild & recreate on server ---
log "Building Docker image on $REMOTE_HOST"
ssh $SSH_OPTS "$REMOTE" "cd $REMOTE_COMPOSE_SH && docker compose -f '$COMPOSE_FILE' build --no-cache website"

log "Recreating container"
ssh $SSH_OPTS "$REMOTE" "cd $REMOTE_COMPOSE_SH && docker compose -f '$COMPOSE_FILE' up -d website"

# --- Health check ---
log "Waiting for container health check (up to 60s)"
ssh $SSH_OPTS "$REMOTE" '
  for i in $(seq 1 12); do
    STATUS=$(docker inspect --format="{{.State.Health.Status}}" zion-website 2>/dev/null || echo "missing")
    if [ "$STATUS" = "healthy" ]; then
      echo "Container healthy after ~$((i*5))s"
      exit 0
    fi
    sleep 5
  done
  echo "Warning: container not healthy after 60s (status: $STATUS)"
  docker logs --tail 20 zion-website
  exit 1
'

log "Deployment complete — zion-website is healthy on $REMOTE_HOST"
