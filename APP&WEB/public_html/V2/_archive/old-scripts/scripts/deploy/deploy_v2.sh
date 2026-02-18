#!/usr/bin/env bash
set -euo pipefail

# Deploy V2 to Webglobe via SFTP/SCP (port 222)
# - Backs up remote V2 directory (optional)
# - Uploads local public_html/V2 contents
# - Optionally deploys API if REMOTE_API_PATH is set

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/scripts/deploy/.env.deploy"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  echo "INFO: $ENV_FILE not found. Using environment variables or defaults."
fi

# Required config
SFTP_HOST=${SFTP_HOST:-}
SFTP_PORT=${SFTP_PORT:-222}
SFTP_USER=${SFTP_USER:-}
REMOTE_V2_PATH=${REMOTE_V2_PATH:-public_html/V2}
REMOTE_API_PATH=${REMOTE_API_PATH:-}
BACKUP_BEFORE_DEPLOY=${BACKUP_BEFORE_DEPLOY:-true}

if [ -z "$SFTP_HOST" ] || [ -z "$SFTP_USER" ]; then
  echo "ERROR: SFTP_HOST and SFTP_USER must be set. Create $ENV_FILE based on .env.deploy.example."
  exit 1
fi

LOCAL_V2_DIR="$ROOT_DIR/public_html/V2"
if [ ! -d "$LOCAL_V2_DIR" ]; then
  echo "ERROR: Local V2 directory not found: $LOCAL_V2_DIR"
  exit 1
fi

timestamp() { date +%Y%m%d-%H%M%S; }

echo "Deploying V2 to $SFTP_USER@$SFTP_HOST:$REMOTE_V2_PATH (port $SFTP_PORT)"

# Create remote backup of V2 if exists
if [ "$BACKUP_BEFORE_DEPLOY" = "true" ]; then
  echo "Creating remote backup (if V2 exists)..."
  ssh -p "$SFTP_PORT" "$SFTP_USER@$SFTP_HOST" "\
    if [ -d '$REMOTE_V2_PATH' ]; then \
      mv '$REMOTE_V2_PATH' '${REMOTE_V2_PATH}-backup-$(timestamp)'; \
    fi; \
    mkdir -p '$REMOTE_V2_PATH'\
  "
else
  echo "Skipping remote backup. Ensuring target folder exists..."
  ssh -p "$SFTP_PORT" "$SFTP_USER@$SFTP_HOST" "mkdir -p '$REMOTE_V2_PATH'"
fi

echo "Uploading V2 contents..."
scp -P "$SFTP_PORT" -r "$LOCAL_V2_DIR"/* "$SFTP_USER@$SFTP_HOST:$REMOTE_V2_PATH/"

if [ -n "$REMOTE_API_PATH" ]; then
  echo "Uploading API (presale) to $REMOTE_API_PATH ..."
  ssh -p "$SFTP_PORT" "$SFTP_USER@$SFTP_HOST" "mkdir -p '$REMOTE_API_PATH'"
  scp -P "$SFTP_PORT" -r "$ROOT_DIR/api/presale"/* "$SFTP_USER@$SFTP_HOST:$REMOTE_API_PATH/"
else
  echo "Skipping API deploy (REMOTE_API_PATH not set)."
fi

echo "Deployment completed successfully."