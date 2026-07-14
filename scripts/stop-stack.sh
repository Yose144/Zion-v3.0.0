#!/usr/bin/env bash
# Stop all ZION processes by process name matching

# L1 core
pkill -f 'V3/target/release/node' 2>/dev/null || true
pkill -f 'V3/target/release/server' 2>/dev/null || true
pkill -f 'V3/target/release/zion-miner' 2>/dev/null || true

# L2 / L3 / AI services
pkill -f 'V3/target/release/zion-' 2>/dev/null || true

# Hiran / Ollama (optional)
pkill -f 'ollama-bin/bin/ollama' 2>/dev/null || true

echo "[stop] All ZION processes stopped."
