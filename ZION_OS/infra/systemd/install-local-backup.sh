#!/usr/bin/env bash
# Install systemd user units for local backup node + dashboard beacon.
# Usage:
#   bash ZION_OS/infra/systemd/install-local-backup.sh [REPO_ROOT]
# Default REPO_ROOT: $HOME/Zion-v3.0.0-main

set -euo pipefail

REPO_ROOT="${1:-$HOME/Zion-v3.0.0-main}"
if [[ ! -d "$REPO_ROOT" ]]; then
    echo "[ERROR] Repo not found: $REPO_ROOT"
    echo "        Pass the correct path, e.g.:"
    echo "        bash ZION_OS/infra/systemd/install-local-backup.sh $HOME/2.9.6-main"
    exit 1
fi

UNIT_DIR="$HOME/.config/systemd/user"
mkdir -p "$UNIT_DIR"

REPO_ESC=$(printf '%s\n' "$REPO_ROOT" | sed -e 's/[\/&]/\\&/g')

for unit in zion-backup-node.service zion-backup-beacon.service zion-backup-beacon.timer; do
    src="$REPO_ROOT/ZION_OS/infra/systemd/$unit"
    if [[ ! -f "$src" ]]; then
        echo "[ERROR] Unit file missing: $src"
        exit 1
    fi
    sed "s|%h/Zion-v3.0.0-main|$REPO_ESC|g" "$src" > "$UNIT_DIR/$unit"
    echo "[OK] Installed $unit -> $UNIT_DIR/$unit"
done

systemctl --user daemon-reload
systemctl --user enable --now zion-backup-node.service
systemctl --user enable --now zion-backup-beacon.timer

echo ""
echo "[OK] Local backup node + beacon installed."
echo "     Status:  systemctl --user status zion-backup-node.service"
echo "     Logs:    journalctl --user -u zion-backup-node.service -f"
echo "     Timer:   systemctl --user list-timers zion-backup-beacon.timer"
