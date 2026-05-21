#!/bin/bash
# ZION Tailscale VPN Setup — Linux
# ==================================
# Jednorázová inštalácia a overenie Tailscale VPN tunela.
#
# Použitie:
#   chmod +x scripts/setup-tailscale.sh
#   sudo ./scripts/setup-tailscale.sh

set -euo pipefail

echo "=== Tailscale Setup (Linux) ==="

if command -v tailscale &>/dev/null; then
    echo "Tailscale už je nainštalovaný: $(tailscale version)"
else
    echo "Tailscale nie je nainštalovaný. Inštalujem..."
    curl -fsSL https://tailscale.com/install.sh | sh
fi

echo ""
echo "Prihlasovanie do Tailscale..."
sudo tailscale up --accept-routes

echo ""
echo "Vaša Tailscale IP:"
tailscale ip -4

echo ""
echo "=== Tailscale je aktívny ==="
echo "Teraz nastavte CORE_TS_IP alebo EDGE_TS_IP podľa dokumentácie."
echo "docs/ZION_NETWORK_TOPOLOGY.md"
