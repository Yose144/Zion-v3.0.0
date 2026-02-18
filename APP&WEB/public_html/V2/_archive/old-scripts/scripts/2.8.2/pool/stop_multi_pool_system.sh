#!/bin/bash
# ZION Multi-Pool Orchestration System - Complete Shutdown Script

echo "=========================================="
echo "Stopping ZION Multi-Pool Orchestration System"
echo "=========================================="

# Function to stop component
stop_component() {
    local component_name=$1
    local stop_script=$2

    echo "Stopping $component_name..."
    if [ -f "$stop_script" ]; then
        bash "$stop_script"
        echo "✓ $component_name stopped"
    else
        echo "✗ Stop script $stop_script not found"
    fi
}

# Stop components in reverse order (master first, then workers)
echo "Stopping orchestration components..."

# 1. Stop Master Orchestrator first
stop_component "Multi-Pool Master Orchestrator" "stop_master_orchestrator.sh"

# 2. Stop AI Orchestrator
if [ -f "stop_ai_orchestrator.sh" ]; then
    stop_component "AI Orchestrator" "stop_ai_orchestrator.sh"
fi

# 3. Stop Geographic Load Balancer
stop_component "Geographic Load Balancer" "stop_geographic_balancer.sh"

# 4. Stop Intelligent Pool Switcher
stop_component "Intelligent Pool Switcher" "stop_pool_switcher.sh"

# 5. Stop Distributed Mining Orchestrator
stop_component "Distributed Mining Orchestrator" "stop_distributed_orchestrator.sh"

# Optional: Stop Redis (uncomment if you want to stop Redis too)
# echo "Stopping Redis server..."
# if pgrep -x "redis-server" > /dev/null; then
#     redis-cli shutdown
#     echo "✓ Redis server stopped"
# else
#     echo "Redis server was not running"
# fi

echo ""
echo "=========================================="
echo "Multi-Pool Orchestration System Shutdown Complete"
echo "=========================================="

# Final verification
echo "Verifying shutdown..."
sleep 2

remaining_processes=$(pgrep -f "orchestrator\|switcher\|balancer\|multi_pool" | wc -l)

if [ "$remaining_processes" -eq 0 ]; then
    echo "✓ All orchestration processes stopped successfully"
else
    echo "⚠ $remaining_processes orchestration processes still running"
    echo "Run 'pkill -f orchestrator' or 'pkill -f switcher' etc. to force stop"
fi

echo ""
echo "System shutdown complete."