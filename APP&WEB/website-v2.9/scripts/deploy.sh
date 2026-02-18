#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/out"
LOG_PREFIX="[deploy]"

REMOTE_HOST="${REMOTE_HOST:-77.42.31.72}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_PATH="${REMOTE_PATH:-/var/www/zionterranova.com}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/zion_deployment_key}"
SKIP_INSTALL=0
SKIP_BUILD=0
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: scripts/deploy.sh [options]

Options:
  --host <hostname>        Target SSH host (default: $REMOTE_HOST or 77.42.31.72)
  --user <user>            SSH user (default: $REMOTE_USER or root)
  --path <remote-path>     Remote deployment path (default: $REMOTE_PATH)
  --ssh-key <path>         SSH private key (default: $SSH_KEY)
  --skip-install           Skip npm install (assumes node_modules is ready)
  --skip-build             Skip npm run build (assumes fresh out/ exists)
  --dry-run                Build only; skip rsync + remote commands
  -h, --help               Show this help

Environment overrides:
  REMOTE_HOST, REMOTE_USER, REMOTE_PATH, SSH_KEY
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
    --host)
      shift
      REMOTE_HOST="${1:?Missing value for --host}"
      ;;
    --user)
      shift
      REMOTE_USER="${1:?Missing value for --user}"
      ;;
    --path)
      shift
      REMOTE_PATH="${1:?Missing value for --path}"
      ;;
    --ssh-key)
      shift
      SSH_KEY="${1:?Missing value for --ssh-key}"
      ;;
    --skip-install)
      SKIP_INSTALL=1
      ;;
    --skip-build)
      SKIP_BUILD=1
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

require_cmd npm
require_cmd rsync
require_cmd ssh

cd "$ROOT_DIR"

# Prefer reproducible installs when lockfile exists
if [[ -f package-lock.json ]]; then
  NPM_INSTALL_CMD=(npm ci --no-audit --prefer-offline)
else
  NPM_INSTALL_CMD=(npm install --no-audit --prefer-offline)
fi

if [[ $SKIP_INSTALL -ne 1 ]]; then
  log "Installing dependencies (${NPM_INSTALL_CMD[*]})"
  "${NPM_INSTALL_CMD[@]}" >/dev/null
else
  log "Skipping npm install"
fi

if [[ $SKIP_BUILD -ne 1 ]]; then
  log "Running npm run build"
  npm run build
else
  log "Skipping build step"
fi

if [[ ! -d "$OUT_DIR" ]]; then
  echo "Error: export directory '$OUT_DIR' not found" >&2
  exit 1
fi

# Sanity checks to avoid deploying a broken build (missing hashed assets)
if [[ ! -d "$OUT_DIR/_next/static/chunks" ]]; then
  echo "Error: missing directory '$OUT_DIR/_next/static/chunks' (Next export assets)" >&2
  exit 1
fi
if ! find "$OUT_DIR/_next/static/chunks" -maxdepth 1 -type f \( -name "*.js" -o -name "*.css" \) | grep -q .; then
  echo "Error: no chunk files (*.js/*.css) found in '_next/static/chunks' – build may have failed" >&2
  exit 1
fi

if [[ $DRY_RUN -eq 1 ]]; then
  log "Dry run enabled – build finished, skipping deploy"
  exit 0
fi

RSYNC_SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=accept-new"
REMOTE="$REMOTE_USER@$REMOTE_HOST"

TS="$(date -u +%Y%m%d%H%M%S)"
STAGING_DIR="$REMOTE_PATH.tmp-$TS"
BACKUP_DIR="$REMOTE_PATH.bak-$TS"

log "Preparing remote staging dir: $STAGING_DIR"
ssh $RSYNC_SSH_OPTS "$REMOTE" "set -euo pipefail; mkdir -p '$(dirname "$REMOTE_PATH")'; rm -rf '$STAGING_DIR'; mkdir -p '$STAGING_DIR'"

log "Uploading out/ -> $REMOTE_HOST:$STAGING_DIR (rsync --delete)"
rsync -avz --delete -e "ssh $RSYNC_SSH_OPTS" "$OUT_DIR/" "$REMOTE:$STAGING_DIR/"

log "Fixing permissions on staging and performing atomic swap"
ssh $RSYNC_SSH_OPTS "$REMOTE" "set -euo pipefail; \
  chown -R www-data:www-data '$STAGING_DIR'; \
  if [ -d '$REMOTE_PATH' ]; then mv '$REMOTE_PATH' '$BACKUP_DIR'; fi; \
  mv '$STAGING_DIR' '$REMOTE_PATH'; \
  nginx -t && systemctl reload nginx || { echo 'nginx reload failed, rolling back'; rm -rf '$REMOTE_PATH'; [ -d '$BACKUP_DIR' ] && mv '$BACKUP_DIR' '$REMOTE_PATH'; exit 1; }"

log "Cleanup old backup (optional)"
ssh $RSYNC_SSH_OPTS "$REMOTE" "[ -d '$BACKUP_DIR' ] && find '$(dirname "$BACKUP_DIR")' -maxdepth 1 -name '$(basename "$REMOTE_PATH").bak-*' -mtime +7 -print0 | xargs -0r rm -rf || true"

log "Deployment complete"
