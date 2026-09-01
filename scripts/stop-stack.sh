#!/usr/bin/env bash
# Stop all ZION L2/L3/L4-L6 + AI services (V3 and V31).
# Node and miner are managed by their own systemd units.

# V3 legacy services
pkill -f 'V3/target/release/zion-' 2>/dev/null || true
pkill -f 'V3/target/release/node' 2>/dev/null || true
pkill -f 'V3/target/release/server' 2>/dev/null || true

# V31 services
pkill -f 'V31/target/release/zion-dao' 2>/dev/null || true
pkill -f 'V31/target/release/warpd' 2>/dev/null || true
pkill -f 'V31/target/release/zion-ai-native-api' 2>/dev/null || true
pkill -f 'V31/target/release/zion-oasis' 2>/dev/null || true
pkill -f 'V31/target/release/zion-free-world' 2>/dev/null || true
pkill -f 'V31/target/release/zion-issobella' 2>/dev/null || true

# Hiran / Ollama (optional)
pkill -f 'ollama-bin/bin/ollama' 2>/dev/null || true

echo "[stop] All ZION stack services stopped."
