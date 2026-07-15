#!/usr/bin/env bash
# Migrate Edge deployment from /root/zion-* to a dedicated `zion` user under /opt/zion.
# Run as root on the Edge server after pulling the updated repo.
set -euo pipefail

NEW_USER="zion"
NEW_GROUP="zion"
NEW_HOME="/opt/zion"
DATA_DIR="${NEW_HOME}/data"
LOGS_DIR="/var/log/zion"
BACKUP_DIR="${NEW_HOME}/backups"

echo "[migrate] Creating system user/group ${NEW_USER}..."
if ! id -u "${NEW_USER}" >/dev/null 2>&1; then
    useradd --system --home-dir "${NEW_HOME}" --create-home "${NEW_USER}"
fi

# Add zion to docker group if it exists (needed for LND service)
if getent group docker >/dev/null 2>&1; then
    usermod -aG docker "${NEW_USER}"
fi

echo "[migrate] Preparing directories..."
mkdir -p "${DATA_DIR}" "${LOGS_DIR}" "${BACKUP_DIR}"
chown -R "${NEW_USER}:${NEW_GROUP}" "${NEW_HOME}"
chmod 750 "${NEW_HOME}"

# Legacy repo locations that may still be in use
LEGACY_PATHS=(
    "/root/zion-2.9.6-main"
    "/root/zion/2.9.6"
)

for legacy in "${LEGACY_PATHS[@]}"; do
    if [[ -d "$legacy" ]]; then
        echo "[migrate] Found legacy repo at ${legacy}. Copying to ${NEW_HOME} (excluding build artifacts)..."
        rsync -a --exclude=target --exclude=.git "${legacy}/" "${NEW_HOME}/"
        break
    fi
done

# Re-create the symlink /data/zion -> /opt/zion/data for compatibility
if [[ -L /data/zion ]]; then
    rm /data/zion
fi
ln -sfn "${DATA_DIR}" /data/zion || echo "[migrate] Could not create /data/zion symlink (may be intentional)"

echo "[migrate] Fixing ownership of migrated content..."
chown -R "${NEW_USER}:${NEW_GROUP}" "${NEW_HOME}"
chown -R "${NEW_USER}:${NEW_GROUP}" "${LOGS_DIR}"
chown -R "${NEW_USER}:${NEW_GROUP}" "${BACKUP_DIR}"

echo "[migrate] Reloading systemd..."
systemctl daemon-reload

cat <<EOF

Migration complete.
Next steps:
1. Review the updated service files in ${NEW_HOME}/edge-deploy/systemd/.
2. Build or copy release binaries to ${NEW_HOME}/V3/target/release/.
3. Enable and start services: systemctl enable --now zion-edge-node1 zion-edge-pool ...
4. Verify: journalctl -u zion-edge-node1 -f
EOF
