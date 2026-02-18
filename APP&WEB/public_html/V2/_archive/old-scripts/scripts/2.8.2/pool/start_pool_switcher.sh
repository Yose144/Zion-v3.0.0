#!/bin/bash
# ZION Intelligent Pool Switcher Startup Script

echo "Starting ZION Intelligent Pool Switcher..."

# Check if Redis is running
if ! docker ps | grep -q zion-redis; then
    echo "Redis container not running. Starting Redis..."
    docker run -d --name zion-redis -p 6379:6379 redis:alpine
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

echo "Starting Intelligent Pool Switcher..."
python3 intelligent_pool_switcher.py &

echo "Intelligent Pool Switcher started with PID $!"
echo "Use 'kill $!' to stop the switcher"