#!/bin/bash
# ZION Production Deployment Script
# Deploy to SSH server with full blockchain and mining pool

SERVER="91.98.122.165"
USER="root"
SSH_KEY="$HOME/.ssh/zion_deployment_key"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10"

echo "🚀 ZION Production Deployment to $SERVER"
echo "========================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Test connection
echo "Testing SSH connection..."
if ! ssh $SSH_OPTS $USER@$SERVER "echo 'SSH OK'" > /dev/null 2>&1; then
    print_error "SSH connection failed. Checking key permissions..."
    chmod 600 "$SSH_KEY"
    if ! ssh $SSH_OPTS $USER@$SERVER "echo 'SSH OK'" > /dev/null 2>&1; then
        print_error "SSH connection still failed. Please check your key and server status."
        exit 1
    fi
fi
print_status "SSH connection OK"

# Stop existing processes
echo "Stopping existing processes..."
ssh $SSH_OPTS $USER@$SERVER "pkill -9 -f python; pkill -9 -f zion; sleep 3" 2>/dev/null || true
print_status "Processes stopped"

# Upload files
echo "Uploading ZION files..."
ssh $SSH_OPTS $USER@$SERVER "mkdir -p /root/zion/src/core /root/zion/logs /root/zion/data" > /dev/null 2>&1
scp -i "$SSH_KEY" -r src/core/* $USER@$SERVER:/root/zion/src/core/ > /dev/null 2>&1
scp -i "$SSH_KEY" requirements.txt $USER@$SERVER:/root/zion/ > /dev/null 2>&1
print_status "Files uploaded"

# Install dependencies
echo "Installing dependencies..."
ssh $SSH_OPTS $USER@$SERVER "cd /root/zion && pip3 install --break-system-packages -r requirements.txt" > /dev/null 2>&1
print_status "Dependencies installed"

# Clean old databases (Optional - maybe we want to keep data?)
# echo "Cleaning old data..."
# ssh $SSH_OPTS $USER@$SERVER "rm -f /root/zion/src/core/*.db /root/zion/src/core/*.log" > /dev/null 2>&1
# print_status "Data cleaned"

# Start blockchain
echo "Starting ZION blockchain..."
ssh $SSH_OPTS $USER@$SERVER "cd /root/zion/src/core && nohup python3 new_zion_blockchain.py > ../../logs/blockchain.log 2>&1 &"
sleep 5

# Check if blockchain started
if ssh $SSH_OPTS $USER@$SERVER "ps aux | grep new_zion_blockchain | grep -v grep" > /dev/null 2>&1; then
    print_status "Blockchain started successfully"
else
    print_error "Blockchain failed to start"
    ssh $SSH_OPTS $USER@$SERVER "cat /root/zion/logs/blockchain.log" 2>/dev/null || true
    exit 1
fi

# Start mining pool
echo "Starting ZION mining pool..."
ssh $SSH_OPTS $USER@$SERVER "cd /root/zion/src/core && nohup python3 zion_universal_pool_v2.py > ../../logs/pool.log 2>&1 &"
sleep 5

# Check if pool started
if ssh $SSH_OPTS $USER@$SERVER "ps aux | grep zion_universal_pool | grep -v grep" > /dev/null 2>&1; then
    print_status "Mining pool started successfully"
else
    print_error "Mining pool failed to start"
    ssh $SSH_OPTS $USER@$SERVER "cat /root/zion/logs/pool.log" 2>/dev/null || true
    exit 1
fi

# Get server info
echo ""
echo "🌐 Server Information:"
echo "======================"
ssh $SSH_OPTS $USER@$SERVER "echo 'Blockchain RPC: http://$SERVER:8333'; echo 'Pool Stratum: $SERVER:3335'; echo 'Pool API: http://$SERVER:3336/api/stats'"

echo ""
print_status "🎉 ZION Production Deployment Complete!"
print_status "Blockchain and mining pool are running on $SERVER"
echo ""
echo "📋 Next steps:"
echo "1. Test blockchain: curl http://$SERVER:8333/api/status"
echo "2. Test pool: curl http://$SERVER:3336/api/stats"
echo "3. Connect miner: xmrig -o $SERVER:3335 -u YOUR_ZION_ADDRESS -p x"