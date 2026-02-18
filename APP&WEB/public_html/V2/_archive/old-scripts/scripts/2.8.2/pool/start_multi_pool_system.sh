#!/bin/bash
# ZION Multi-Pool Orchestration System - Complete Startup Script

echo "=========================================="
echo "Starting ZION Multi-Pool Orchestration System"
echo "=========================================="

# Function to check if process is running
check_process() {
    local process_name=$1
    local script_name=$2

    if pgrep -f "$script_name" > /dev/null; then
        echo "✓ $process_name is already running"
        return 0
    else
        echo "✗ $process_name is not running"
        return 1
    fi
}

# Function to start component
start_component() {
    local component_name=$1
    local start_script=$2
    local check_pattern=$3

    echo "Starting $component_name..."
    if [ -f "$start_script" ]; then
        bash "$start_script"
        sleep 3

        if check_process "$component_name" "$check_pattern"; then
            echo "✓ $component_name started successfully"
        else
            echo "✗ Failed to start $component_name"
        fi
    else
        echo "✗ Start script $start_script not found"
    fi
}

# Check and start Redis
echo "Checking Redis server..."
if ! docker ps | grep -q zion-redis; then
    echo "Starting Redis container..."
    docker run -d --name zion-redis -p 6379:6379 redis:alpine
    sleep 3

    if docker ps | grep -q zion-redis; then
        echo "✓ Redis container started"
    else
        echo "✗ Failed to start Redis container"
        exit 1
    fi
else
    echo "✓ Redis container already running"
fi

# Create virtual environment if needed
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements-pool-switcher.txt

# Start components in order
echo ""
echo "Starting orchestration components..."

# 1. Start Distributed Mining Orchestrator
start_component "Distributed Mining Orchestrator" "start_distributed_orchestrator.sh" "multi_pool_orchestrator.py"

# 2. Start Intelligent Pool Switcher
start_component "Intelligent Pool Switcher" "start_pool_switcher.sh" "intelligent_pool_switcher.py"

# 3. Start Geographic Load Balancer
start_component "Geographic Load Balancer" "start_geographic_balancer.sh" "geographic_load_balancer.py"

# 4. Start AI Orchestrator (if available)
if [ -f "start_ai_orchestrator.sh" ]; then
    start_component "AI Orchestrator" "start_ai_orchestrator.sh" "ai_orchestrator.py"
fi

# 5. Start Master Orchestrator (last, as it coordinates others)
start_component "Multi-Pool Master Orchestrator" "start_master_orchestrator.sh" "multi_pool_master_orchestrator.py"

echo ""
echo "=========================================="
echo "Multi-Pool Orchestration System Status"
echo "=========================================="

# Final status check
echo "Component Status:"
check_process "Distributed Orchestrator" "multi_pool_orchestrator.py"
check_process "Pool Switcher" "intelligent_pool_switcher.py"
check_process "Geographic Balancer" "geographic_load_balancer.py"
check_process "AI Orchestrator" "ai_orchestrator.py"
check_process "Master Orchestrator" "multi_pool_master_orchestrator.py"

echo ""
echo "✓ ZION Multi-Pool Orchestration System startup complete!"
echo ""
echo "To monitor the system:"
echo "  - Check Redis keys with: redis-cli keys '*'"
echo "  - View master status: redis-cli get master:system_status | jq"
echo "  - Monitor components: redis-cli get master:component_status | jq"
echo ""
echo "To stop the system, run: ./stop_multi_pool_system.sh"