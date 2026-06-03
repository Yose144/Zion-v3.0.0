#!/bin/bash
# ZION V3 — Stop Local Node (macOS)

echo "Stopping ZION V3 Local Node on macOS..."

# Stop processes
pkill -f zion-node
pkill -f zion-miner

# Wait for processes to stop
sleep 2

# Check if any processes are still running
if pgrep -f zion-node > /dev/null || pgrep -f zion-miner > /dev/null; then
    echo "Force stopping remaining processes..."
    pkill -9 -f zion-node
    pkill -9 -f zion-miner
fi

echo "✅ Local node stopped"
