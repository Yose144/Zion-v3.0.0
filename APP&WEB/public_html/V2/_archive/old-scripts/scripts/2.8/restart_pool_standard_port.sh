#!/bin/bash

# Restart mining pool with standard port 3333
# This script changes from non-standard 3335 to standard 3333

echo "🔄 Restarting ZION Mining Pool on standard port 3333..."

# SSH to production server
ssh root@91.98.122.165 << 'EOF'

# Kill existing pool processes
pkill -9 -f "run_pool_production.py"
pkill -9 -f "run_pool_simple.py"
sleep 2

# Verify blockchain is still running
netstat -tulpn | grep 18081 && echo "✅ Blockchain RPC running" || echo "❌ Blockchain RPC not running"

# Start pool on standard port 3333
echo "🚀 Starting pool on port 3333..."
cd /root

# Run in background
nohup python3 run_pool_production.py > pool_3333.log 2>&1 &
sleep 3

# Verify ports
echo "📊 Checking ports..."
netstat -tulpn | grep -E "3333|3334|18081"

# Show pool status
echo ""
echo "📝 Pool logs (last 20 lines):"
tail -20 pool_3333.log

EOF

echo ""
echo "✅ Pool restart complete! Using standard port 3333"
