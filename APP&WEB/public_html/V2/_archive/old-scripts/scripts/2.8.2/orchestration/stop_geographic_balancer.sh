#!/bin/bash
# ZION Geographic Load Balancer Shutdown Script

echo "Stopping ZION Geographic Load Balancer..."

# Find and kill balancer processes
PIDS=$(pgrep -f "geographic_load_balancer.py")

if [ -z "$PIDS" ]; then
    echo "No geographic balancer processes found running."
else
    echo "Found balancer processes: $PIDS"
    echo "Terminating processes..."
    kill $PIDS

    # Wait for processes to terminate
    sleep 2

    # Force kill if still running
    if pgrep -f "geographic_load_balancer.py" > /dev/null; then
        echo "Force killing remaining processes..."
        pkill -9 -f "geographic_load_balancer.py"
    fi

    echo "Geographic balancer stopped."
fi