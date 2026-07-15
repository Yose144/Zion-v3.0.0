#!/usr/bin/env bash
# ZION website deploy — Docker-based (standalone Next.js + nginx proxy)
# Rsync source to server, rebuild Docker image, recreate container.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
LOG_PREFIX="[deploy]"

REMOTE_HOST="${REMOTE_HOST:-zion-new}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_SRC="${REMOTE_SRC:-/opt/zion/website-v2.9}"
REMOTE_COMPOSE="${REMOTE_COMPOSE:-/opt/zion/website-v2.9}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/zion-new-server}"
COMPOSE_FILE="docker-compose.website.yml"
DOCKERFILE="Dockerfile.production"
IMAGE_TAG="${IMAGE_TAG:-zion-web:runtime}"
CONTAINER_NAME="${CONTAINER_NAME:-zion-web}"
SKIP_SYNC=0
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: scripts/deploy.sh [options]

Docker-based website deployment: rsync source -> rebuild image -> recreate container.

Options:
  --host <hostname>        Target SSH host (default: $REMOTE_HOST or mainnetedge)
  --user <user>            SSH user (default: $REMOTE_USER or deploy)
  --remote-src <path>      Remote source path (default: /opt/zion/web)
  --remote-compose <path>  Remote Docker compose directory (default: /opt/zion/docker)
  --ssh-key <path>         SSH private key (default: $SSH_KEY or ~/.ssh/id_ed25519)
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

  # Optional compose file — only sync if it exists in this repo layout
  compose_src="$REPO_ROOT/docker/$COMPOSE_FILE"
  if [[ -f "$compose_src" ]]; then
    log "Syncing compose file to $REMOTE_HOST:$REMOTE_COMPOSE"
    rsync -avz \
      -e "ssh $SSH_OPTS" \
      "$compose_src" "$REMOTE:${REMOTE_COMPOSE_RSYNC}/"
  else
    log "No local compose file found at $compose_src — skipping compose sync"
  fi
else
  log "Skipping rsync (--skip-sync)"
fi

if [[ $DRY_RUN -eq 1 ]]; then
  log "Dry run — source synced, skipping Docker rebuild"
  exit 0
fi

# --- Docker rebuild & recreate on server ---
log "Building Docker image on $REMOTE_HOST"
ssh $SSH_OPTS "$REMOTE" "cd $REMOTE_SRC_SH && docker build -f '$DOCKERFILE' -t '$IMAGE_TAG' ."

log "Recreating container"
ssh $SSH_OPTS "$REMOTE" "
  docker rm -f $CONTAINER_NAME 2>/dev/null || true
  docker run -d \\
    --name $CONTAINER_NAME \\
    --network host \\
    --restart unless-stopped \\
    --read-only \\
    --tmpfs /tmp \\
    --tmpfs /var/cache/nginx \\
    --tmpfs /var/run \\
    --shm-size 67108864 \\
    -e NODE_ENV=production \\
    -e NEXT_TELEMETRY_DISABLED=1 \\
    -e PORT=3000 \\
    -e HOSTNAME=127.0.0.1 \\
    '$IMAGE_TAG'
"

# --- Health check ---
log "Waiting for web server health check (up to 60s)"
ssh $SSH_OPTS "$REMOTE" '
  for i in $(seq 1 12); do
    if curl -fsS http://127.0.0.1:3000/ >/dev/null 2>&1; then
      echo "Website healthy after ~$((i*5))s"
      exit 0
    fi
    sleep 5
  done
  echo "Warning: website not healthy after 60s"
  docker logs --tail 30 "'"$CONTAINER_NAME"'"
  exit 1
'

log "Deployment complete — zion-website is healthy on $REMOTE_HOST"
