#!/bin/bash
# ZION Geographic Load Balancer Startup Script

echo "Starting ZION Geographic Load Balancer..."

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

echo "Starting Geographic Load Balancer..."
python3 geographic_load_balancer.py &

echo "Geographic Load Balancer started with PID $!"
echo "Use 'kill $!' to stop the balancer"