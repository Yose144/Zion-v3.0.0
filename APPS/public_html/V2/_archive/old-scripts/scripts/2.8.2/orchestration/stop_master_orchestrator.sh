#!/bin/bash
# ZION Multi-Pool Master Orchestrator Shutdown Script

echo "Stopping ZION Multi-Pool Master Orchestrator..."

# Find and kill master orchestrator processes
PIDS=$(pgrep -f "multi_pool_master_orchestrator.py")

if [ -z "$PIDS" ]; then
    echo "No master orchestrator processes found running."
else
    echo "Found master orchestrator processes: $PIDS"
    echo "Terminating processes..."
    kill $PIDS

    # Wait for processes to terminate
    sleep 2

    # Force kill if still running
    if pgrep -f "multi_pool_master_orchestrator.py" > /dev/null; then
        echo "Force killing remaining processes..."
        pkill -9 -f "multi_pool_master_orchestrator.py"
    fi

    echo "Master orchestrator stopped."
fi