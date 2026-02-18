#!/bin/bash
# ZION Intelligent Pool Switcher Shutdown Script

echo "Stopping ZION Intelligent Pool Switcher..."

# Find and kill pool switcher processes
PIDS=$(pgrep -f "intelligent_pool_switcher.py")

if [ -z "$PIDS" ]; then
    echo "No pool switcher processes found running."
else
    echo "Found pool switcher processes: $PIDS"
    echo "Terminating processes..."
    kill $PIDS

    # Wait for processes to terminate
    sleep 2

    # Force kill if still running
    if pgrep -f "intelligent_pool_switcher.py" > /dev/null; then
        echo "Force killing remaining processes..."
        pkill -9 -f "intelligent_pool_switcher.py"
    fi

    echo "Pool switcher stopped."
fi