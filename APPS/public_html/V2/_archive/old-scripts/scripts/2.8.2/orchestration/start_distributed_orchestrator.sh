#!/bin/bash
# ZION Distributed Mining Orchestrator Startup Script

echo "Starting ZION Distributed Mining Orchestrator..."

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

echo "Starting Distributed Mining Orchestrator..."
python3 multi_pool_orchestrator.py &

echo "Distributed Mining Orchestrator started with PID $!"
echo "Use 'kill $!' to stop the orchestrator"