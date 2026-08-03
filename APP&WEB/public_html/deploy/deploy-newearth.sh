#!/usr/bin/env bash
# ZION newearth.cz / www.newearth.cz — legacy V2 archive deploy
#
# - Syncs APP&WEB/public_html to /var/www/newearth on Edge
# - Installs /etc/nginx/sites-available/newearth.cz.conf
# - Obtains or renews Let's Encrypt certificate
# - Reloads nginx
#
# Usage:
#   bash APP&WEB/public_html/deploy/deploy-newearth.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_USER="${ZION_EDGE_USER:-root}"
SSH_KEY="${ZION_SSH_KEY:-$HOME/.ssh/zion-edge-post-wipe-2026-07-29}"
REMOTE_HOST="${ZION_EDGE_HOST:-vmi3425821.contaboserver.net}"
ADMIN_EMAIL="${ZION_ADMIN_EMAIL:-admin@newearth.cz}"
REMOTE_DIR="/var/www/newearth"
NGINX_AVAILABLE="/etc/nginx/sites-available/newearth.cz.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/newearth.cz.conf"
NGINX_SRC="${ROOT_DIR}/deploy/nginx-newearth.conf"

SSH_OPTS="-i ${SSH_KEY} -6 -p 2222 -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"
SCP_OPTS="-i ${SSH_KEY} -6 -P 2222 -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"
RSYNC_SSH="ssh -i ${SSH_KEY} -6 -p 2222 -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"
REMOTE="${EDGE_USER}@${REMOTE_HOST}"

log() { echo "[deploy-newearth] $*"; }

# 1. Sync static archive to server
log "Syncing legacy public_html to ${REMOTE_DIR}..."
ssh ${SSH_OPTS} "${REMOTE}" "mkdir -p ${REMOTE_DIR}"
rsync -avz --delete \
  --exclude='.DS_Store' \
  --exclude='*.secret' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='/deploy/' \
  -e "${RSYNC_SSH}" \
  "${ROOT_DIR}/" \
  "${REMOTE}:${REMOTE_DIR}/"

# 2. Fix ownership
ssh ${SSH_OPTS} "${REMOTE}" "chown -R zion:zion ${REMOTE_DIR}"

# 3. Install full nginx config in sites-available
log "Installing full nginx config to ${NGINX_AVAILABLE}..."
scp ${SCP_OPTS} "${NGINX_SRC}" "${REMOTE}:${NGINX_AVAILABLE}"

# 4. For a fresh server (no cert yet), start with a temporary HTTP-only
#    config so certbot's webroot authentication can reach the files.
log "Ensuring a runnable nginx config for certbot..."
ssh ${SSH_OPTS} "${REMOTE}" "test -d /etc/letsencrypt/live/newearth.cz" || {
    ssh ${SSH_OPTS} "${REMOTE}" "cat > '${NGINX_ENABLED}'" <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name newearth.cz www.newearth.cz;
    root /var/www/newearth;

    location /.well-known/acme-challenge/ {
        try_files $uri =404;
    }

    location / {
        return 301 https://zionterranova.com/;
    }
}
EOF
    ssh ${SSH_OPTS} "${REMOTE}" "nginx -t && nginx -s reload"
}

# 5. Obtain / renew certificate (webroot via /var/www/newearth)
log "Requesting Let's Encrypt certificate..."
ssh ${SSH_OPTS} "${REMOTE}" "
    certbot certonly --webroot -w ${REMOTE_DIR} -d newearth.cz -d www.newearth.cz --non-interactive --agree-tos -m ${ADMIN_EMAIL} || true
"

# 6. Enable the full config and reload
log "Enabling full nginx config..."
ssh ${SSH_OPTS} "${REMOTE}" "
    ln -sfn ${NGINX_AVAILABLE} ${NGINX_ENABLED}
    nginx -t && nginx -s reload
"

log "Done."
log "Health checks:"
ssh ${SSH_OPTS} "${REMOTE}" "
    echo -n 'HTTP root redirect: '; curl -s -o /dev/null -w '%{http_code}' http://www.newearth.cz/
    echo
    echo -n 'HTTPS root redirect: '; curl -s -o /dev/null -w '%{http_code}' https://www.newearth.cz/
    echo
    echo -n 'V2 archive: '; curl -s -o /dev/null -w '%{http_code}' https://www.newearth.cz/V2/main.html
    echo
"
