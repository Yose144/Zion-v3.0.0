#!/bin/bash
# edge-server-setup.sh — Run ON the remote edge server (via Hetzner Console or existing SSH)
# ==========================================================================================
# This script prepares a fresh VPS to become a ZION Edge Relay Node.
#
# Usage (on the server):
#   curl -fsSL <url> | sudo bash
#   OR manually copy-paste after SSH login

set -euo pipefail

ZION_PUB_KEY="${ZION_PUB_KEY:-}"  # Set via env var; do NOT hardcode keys in repo
CORE_TS_IP="${CORE_TS_IP:-}"

# ── 1. System packages ──
echo "=== Updating system ==="
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git build-essential pkg-config libssl-dev ufw

# ── 2. SSH hardening + key auth ──
echo "=== Configuring SSH ==="
mkdir -p /root/.ssh
chmod 700 /root/.ssh
echo "$ZION_PUB_KEY" >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

# Disable password auth (optional but recommended)
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart sshd

# ── 3. Firewall ──
echo "=== Configuring UFW ==="
ufw default deny incoming
ufw default allow outgoing
ufw allow 8333/tcp   # ZION P2P
ufw allow 41641/udp  # Tailscale
ufw allow 22/tcp     # SSH
ufw --force enable

# ── 4. Tailscale ──
echo "=== Installing Tailscale ==="
curl -fsSL https://tailscale.com/install.sh | sh
echo "=== Login to Tailscale ==="
tailscale up

echo ""
echo "Your Tailscale IP: $(tailscale ip -4)"

# ── 5. Rust ──
echo "=== Installing Rust ==="
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

# ── 6. Clone repo ──
echo "=== Cloning ZION repo ==="
if [ ! -d "zion-2.9.6-main" ]; then
    # If user provides repo URL, clone it; otherwise create dir for manual upload
    echo "Please clone your ZION repo into $(pwd)/zion-2.9.6-main/"
    echo "Or use: git clone <your-repo-url> zion-2.9.6-main"
fi

# ── 7. Summary ──
echo ""
echo "==================================="
echo "  Edge Server Ready"
echo "==================================="
echo "Tailscale IP: $(tailscale ip -4)"
echo "Public IP:    $(curl -s ifconfig.me)"
echo ""
if [ -z "$CORE_TS_IP" ]; then
    echo "NEXT STEPS:"
    echo "  1. Note your Tailscale IP above (for Core config)"
    echo "  2. Set CORE_TS_IP=<Core Tailscale IP>"
    echo "  3. Build node: cd zion-2.9.6-main/V3 && cargo build --release --bin node"
    echo "  4. Start edge: CORE_TS_IP=<ip> ./scripts/launch-edge-node.sh"
else
    echo "You can now start the edge node:"
    echo "  CORE_TS_IP=$CORE_TS_IP ./scripts/launch-edge-node.sh"
fi
