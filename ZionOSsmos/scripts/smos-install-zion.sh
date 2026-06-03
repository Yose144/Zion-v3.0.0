#!/usr/bin/env bash
# Zion Miner Installer for SimpleMining OS rigs
# Run directly on the SMOS rig via SSH or console
#
# Usage:
#   curl -fsSL https://zionterranova.com/zion-miner/smos-install.sh | bash
#   # or after downloading:
#   bash smos-install-zion.sh

set -euo pipefail

ZION_POOL="${ZION_POOL:-77.42.71.94:8444}"
ZION_WALLET="${ZION_WALLET:-}"
ZION_WORKER="${ZION_WORKER:-$(hostname)}"
ZION_THREADS="${ZION_THREADS:-0}"

MINER_URL="${MINER_URL:-https://zionterranova.com/zion-miner/zion-miner-linux-amd64}"
INSTALL_DIR="/home/miner/zion-miner"
SERVICE_NAME="zion-miner"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Zion Miner Installer — SimpleMining OS                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo

if [[ -z "$ZION_WALLET" ]]; then
    echo "ERROR: ZION_WALLET is not set."
    echo "Set it before running this script:"
    echo "  export ZION_WALLET=zion1..."
    exit 1
fi

if ! [[ "$ZION_WALLET" =~ ^zion1 ]]; then
    echo "WARNING: Wallet does not start with 'zion1': $ZION_WALLET"
fi

echo "Pool:   $ZION_POOL"
echo "Wallet: $ZION_WALLET"
echo "Worker: $ZION_WORKER"
echo "Threads: $ZION_THREADS"
echo

# Create install directory
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Download miner binary
echo "[1/5] Downloading zion-miner..."
if command -v curl &>/dev/null; then
    curl -fsSL -o zion-miner "$MINER_URL" || {
        echo "ERROR: Failed to download from $MINER_URL"
        echo "Alternative: build manually on Edge server and scp binary here."
        exit 1
    }
elif command -v wget &>/dev/null; then
    wget -q -O zion-miner "$MINER_URL" || {
        echo "ERROR: Failed to download from $MINER_URL"
        exit 1
    }
else
    echo "ERROR: curl or wget required."
    exit 1
fi

chmod +x zion-miner
echo "      OK — $(du -h zion-miner | cut -f1)"

# Create wrapper script that sets env vars
echo "[2/5] Creating wrapper script..."
cat > "$INSTALL_DIR/start-miner.sh" <<EOF
#!/usr/bin/env bash
export ZION_POOL_ADDR="$ZION_POOL"
export ZION_MINER_ID="$ZION_WALLET"
export ZION_WORKER_NAME="$ZION_WORKER"
export ZION_THREADS="$ZION_THREADS"
export ZION_LOOP_COUNT=1000000
export ZION_GPU_BACKEND=auto
export ZION_NONCE_AUTOTUNE=true
export ZION_METRICS_REPORT_SECS=30

cd "$INSTALL_DIR"
exec ./zion-miner --pool "$ZION_POOL" --wallet "$ZION_WALLET" --worker "$ZION_WORKER" \\
    $(if [[ "$ZION_THREADS" != "0" ]]; then echo "--threads $ZION_THREADS"; fi)
EOF
chmod +x "$INSTALL_DIR/start-miner.sh"

# Create systemd user service (fallback to cron if systemd unavailable)
echo "[3/5] Setting up auto-start..."
if command -v systemctl &>/dev/null && systemctl --user &>/dev/null; then
    mkdir -p ~/.config/systemd/user/
    cat > ~/.config/systemd/user/${SERVICE_NAME}.service <<EOF
[Unit]
Description=ZION Miner
After=network.target

[Service]
Type=simple
ExecStart=$INSTALL_DIR/start-miner.sh
Restart=always
RestartSec=10
WorkingDirectory=$INSTALL_DIR

[Install]
WantedBy=default.target
EOF
    systemctl --user daemon-reload
    systemctl --user enable ${SERVICE_NAME}.service
    echo "      systemd user service created"
else
    # Fallback: use cron @reboot
    (crontab -l 2>/dev/null || true) | grep -v zion-miner | {
        cat
        echo "@reboot $INSTALL_DIR/start-miner.sh >> /tmp/zion-miner.log 2>&1"
    } | crontab -
    echo "      cron @reboot entry created"
fi

# Create stop script
cat > "$INSTALL_DIR/stop-miner.sh" <<'EOF'
#!/usr/bin/env bash
pkill -f "zion-miner" || true
if command -v systemctl &>/dev/null; then
    systemctl --user stop zion-miner 2>/dev/null || true
fi
echo "Zion miner stopped."
EOF
chmod +x "$INSTALL_DIR/stop-miner.sh"

# Pause SMOS default miner (optional)
echo "[4/5] Pausing SMOS default miner..."
if command -v smos &>/dev/null; then
    smos pause 2>/dev/null || true
fi

# Start miner
echo "[5/5] Starting zion-miner..."
if command -v systemctl &>/dev/null; then
    systemctl --user start ${SERVICE_NAME}.service
else
    nohup "$INSTALL_DIR/start-miner.sh" >> /tmp/zion-miner.log 2>&1 &
fi

echo
echo "═══════════════════════════════════════════════════════════════"
echo "  Zion miner installed and started!"
echo "═══════════════════════════════════════════════════════════════"
echo
echo "Install dir: $INSTALL_DIR"
echo "Log:         tail -f /tmp/zion-miner.log"
echo "Stop:        $INSTALL_DIR/stop-miner.sh"
echo "Restart:     systemctl --user restart zion-miner"
echo
echo "Verify on pool:"
echo "  http://$ZION_POOL/api/v1/miner/$ZION_WALLET/stats"
echo
echo "Wallet: $ZION_WALLET"
echo "Pool:   $ZION_POOL"
