#!/bin/bash

# ZION Pool Health Check - Verify all systems operational
# Run this to diagnose any issues with overnight mining

echo "🏥 ZION POOL HEALTH CHECK"
echo "=========================="
echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 1. Check processes
echo "1️⃣  PROCESSES CHECK"
echo "   Blockchain RPC:"
ssh root@91.98.122.165 'pgrep -f "run_blockchain_simple.py" > /dev/null && echo "   ✅ Running" || echo "   ❌ NOT RUNNING"' 2>/dev/null

echo "   Pool Server:"
ssh root@91.98.122.165 'pgrep -f "run_pool_production.py" > /dev/null && echo "   ✅ Running" || echo "   ❌ NOT RUNNING"' 2>/dev/null

# 2. Check ports
echo ""
echo "2️⃣  NETWORK PORTS"
ssh root@91.98.122.165 'netstat -tulpn 2>/dev/null | grep -E "3333|3334|18081" | awk "{print \"   \" \$4 \" \" \$(NF)}"' 2>/dev/null || echo "   ❌ Cannot check ports"

# 3. Check share count
echo ""
echo "3️⃣  DATABASE STATS"
SHARES=$(ssh root@91.98.122.165 'python3 -c "
import sqlite3
try:
    conn = sqlite3.connect(\"/root/zion_pool.db\")
    cursor = conn.cursor()
    cursor.execute(\"SELECT COUNT(*) FROM shares\")
    count = cursor.fetchone()[0]
    cursor.execute(\"SELECT DISTINCT address FROM shares\")
    miners = len(cursor.fetchall())
    print(f\"{count} shares from {miners} miners\")
    conn.close()
except Exception as e:
    print(f\"DB Error: {e}\")
" 2>/dev/null' || echo "   ❌ Database error")

echo "   Shares: $SHARES"

# 4. Check blockchain height
echo ""
echo "4️⃣  BLOCKCHAIN STATE"
HEIGHT=$(curl -s -X POST http://91.98.122.165:18081/json_rpc \
    -d '{"jsonrpc":"2.0","id":"health","method":"getblockcount"}' \
    2>/dev/null | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('result',{}).get('count',0))" 2>/dev/null || echo "0")

echo "   Block Height: $HEIGHT"

# 5. Check pool logs for errors
echo ""
echo "5️⃣  RECENT LOG ERRORS"
ERRORS=$(ssh root@91.98.122.165 'tail -100 /root/pool.log 2>/dev/null | grep -i "error\|exception\|failed" | tail -5' 2>/dev/null)

if [ -z "$ERRORS" ]; then
    echo "   ✅ No recent errors"
else
    echo "   ⚠️  Recent errors found:"
    ssh root@91.98.122.165 'tail -100 /root/pool.log 2>/dev/null | grep -i "error\|exception\|failed" | tail -5' | sed 's/^/      /'
fi

# 6. Check disk space
echo ""
echo "6️⃣  DISK SPACE"
ssh root@91.98.122.165 'df -h /root | tail -1 | awk "{print \"   Used: \" \$3 \" / \" \$2 \" (\" \$5 \")\"}' 2>/dev/null || echo "   ❌ Cannot check disk"

# 7. Check memory usage
echo ""
echo "7️⃣  MEMORY USAGE"
ssh root@91.98.122.165 'free -h | grep "^Mem:" | awk "{print \"   Used: \" \$3 \" / \" \$2}' 2>/dev/null || echo "   ❌ Cannot check memory"

# 8. Test pool connectivity
echo ""
echo "8️⃣  POOL CONNECTIVITY TEST"
TEST_RESPONSE=$(timeout 5 python3 -c "
import socket
import json
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    sock.connect(('91.98.122.165', 3333))
    msg = json.dumps({'id': 1, 'method': 'mining.subscribe', 'params': ['health_check']})
    sock.send((msg + '\n').encode())
    response = sock.recv(1024).decode()
    if 'result' in response:
        print('✅ Pool responds correctly')
    else:
        print('⚠️  Pool response odd')
except Exception as e:
    print(f'❌ Connection failed: {e}')
finally:
    sock.close()
" 2>/dev/null || echo "   ⚠️  Connection test failed")

echo "   $TEST_RESPONSE"

# Summary
echo ""
echo "=========================="
echo "✅ Health check complete!"
echo ""
echo "📊 Summary:"
echo "   • Check processes running"
echo "   • Check all ports listening"
echo "   • Database has shares"
echo "   • No recent errors"
echo "   • Pool responds to connections"
echo ""
echo "🌙 Overnight mining continues..."
