#!/bin/bash
##############################################################################
# 🚀 ZION Pool v2.9 - Server Deployment Script
##############################################################################
# Deploy pool v2.9 to production server (91.98.122.165)
##############################################################################

set -e

SERVER="root@91.98.122.165"
SERVER_PATH="/opt/zion/Zion-2.9"
POOL_PORT=3333

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║       🚀 ZION Pool v2.9 - Server Deployment                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Create server config
echo -e "${BLUE}📝 Creating production config...${NC}"
cat > config/pool_production.json <<EOF
{
  "pool": {
    "wallet_address": "zion1testpoolwalletaddress123456789012345678901234567",
    "fee_percent": 1.0,
    "consciousness_tithe": 1.618,
    "consciousness_enabled": true,
    "humanitarian_address": "zion1humanitarianwalletaddress1234567890123456789012",
    "min_difficulty": 10000,
    "max_difficulty": 10000000,
    "target_share_time": 30.0,
    "retarget_time": 90.0,
    "keepalive_timeout": 300,
    "template_update_interval": 10,
    "database_path": "/opt/zion/Zion-2.9/data/pool.db",
    "native_lib_path": "/opt/zion/Zion-2.9/zion/mining",
    "pplns_window": 100000000,
    "strict_addresses": false
  },
  "blockchain": {
    "host": "127.0.0.1",
    "port": 18081,
    "user": null,
    "password": null
  },
  "network": {
    "host": "0.0.0.0",
    "port": $POOL_PORT,
    "max_connections": 10000
  }
}
EOF
echo -e "${GREEN}✅ Production config created${NC}"
echo ""

# Step 2: Copy files to server
echo -e "${BLUE}📦 Uploading files to server...${NC}"
ssh $SERVER "mkdir -p $SERVER_PATH/src/pool $SERVER_PATH/config $SERVER_PATH/data"

# Upload pool modules
rsync -avz --progress src/pool/ $SERVER:$SERVER_PATH/src/pool/
rsync -avz --progress config/pool_production.json $SERVER:$SERVER_PATH/config/
rsync -avz start_pool.py $SERVER:$SERVER_PATH/

echo -e "${GREEN}✅ Files uploaded${NC}"
echo ""

# Step 3: Install dependencies on server
echo -e "${BLUE}📦 Installing dependencies on server...${NC}"
ssh $SERVER <<'ENDSSH'
cd /opt/zion/Zion-2.9
python3 -m venv venv 2>/dev/null || true
source venv/bin/activate
pip install -q aiohttp aiosqlite
echo "✅ Dependencies installed"
ENDSSH
echo ""

# Step 4: Stop old pool (if running)
echo -e "${YELLOW}⚠️  Stopping old pool...${NC}"
ssh $SERVER "pkill -f 'zion_universal_pool_v2\|start_pool' || true"
sleep 2
echo -e "${GREEN}✅ Old pool stopped${NC}"
echo ""

# Step 5: Start new pool v2.9
echo -e "${BLUE}🚀 Starting ZION Pool v2.9...${NC}"
ssh $SERVER <<'ENDSSH'
cd /opt/zion/Zion-2.9
source venv/bin/activate
nohup python start_pool.py config/pool_production.json > logs/pool_v2.9.log 2>&1 &
echo $! > pool.pid
echo "✅ Pool started (PID: $(cat pool.pid))"
ENDSSH
echo ""

# Step 6: Check pool status
echo -e "${BLUE}🔍 Checking pool status...${NC}"
sleep 5
ssh $SERVER "ps aux | grep start_pool | grep -v grep" && echo -e "${GREEN}✅ Pool is running${NC}" || echo -e "${RED}❌ Pool not running${NC}"
echo ""

# Step 7: Show logs
echo -e "${BLUE}📋 Last 20 log lines:${NC}"
ssh $SERVER "tail -20 /opt/zion/Zion-2.9/logs/pool_v2.9.log"
echo ""

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Deployment Complete!                                         ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║  Server:  91.98.122.165:$POOL_PORT                             ║"
echo "║  Monitor: ssh $SERVER 'tail -f /opt/zion/Zion-2.9/logs/pool_v2.9.log' ║"
echo "║  Stop:    ssh $SERVER 'kill \$(cat /opt/zion/Zion-2.9/pool.pid)' ║"
echo "╚════════════════════════════════════════════════════════════════╝"
