#!/bin/bash
# ZION Multi-Pool Master Orchestrator Startup Script

echo "Starting ZION Multi-Pool Master Orchestrator..."

# Check if Redis is running
if ! pgrep -x "redis-server" > /dev/null; then
    echo "Redis server not running. Starting Redis..."
    redis-server --daemonize yes
    sleep 2
fi

# Install dependencies if needed
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing dependencies..."
pip install -r requirements-pool-switcher.txt

echo "Starting Multi-Pool Master Orchestrator..."
python3 multi_pool_master_orchestrator.py &

echo "Multi-Pool Master Orchestrator started with PID $!"
echo "Use 'kill $!' to stop the orchestrator"