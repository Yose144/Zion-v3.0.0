#!/usr/bin/env bash
# Stop all ZION processes by process name matching

pkill -f 'V3/target/release/node' 2>/dev/null || true
pkill -f 'V3/target/release/server' 2>/dev/null || true
pkill -f 'V3/target/release/zion-miner' 2>/dev/null || true

echo "[stop] All ZION processes stopped."
