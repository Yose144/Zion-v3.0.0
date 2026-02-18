#!/bin/bash
# ZION Docker Deployment Script (Fix Supply)
# Deploys current local code to remote server and rebuilds Docker containers

SERVER="91.98.122.165"
USER="root"
SSH_KEY="$HOME/.ssh/zion_deployment_key"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10"
REMOTE_DIR="/opt/zion/Zion-2.9"

echo "🚀 ZION Docker Deployment (Supply Fix) to $SERVER"
echo "=================================================="

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

# Test connection
echo "Testing SSH connection..."
if ! ssh $SSH_OPTS $USER@$SERVER "echo 'SSH OK'" > /dev/null 2>&1; then
    print_error "SSH connection failed."
    exit 1
fi
print_status "SSH connection OK"

# Sync Core Files
echo "Syncing src directory..."
# Ensure src directory exists
ssh $SSH_OPTS $USER@$SERVER "mkdir -p $REMOTE_DIR/src"
# Sync all of src
scp $SSH_OPTS -r src/* $USER@$SERVER:$REMOTE_DIR/src/
print_status "src directory synced"

# Sync requirements
echo "Syncing requirements.txt..."
scp $SSH_OPTS requirements.txt $USER@$SERVER:$REMOTE_DIR/
print_status "requirements.txt synced"

# Sync Scripts (just in case)
echo "Syncing scripts..."
scp $SSH_OPTS -r scripts/* $USER@$SERVER:$REMOTE_DIR/scripts/
print_status "Scripts synced"

# Sync Docker Compose file
echo "Syncing docker-compose.yml..."
scp $SSH_OPTS docker-compose.yml $USER@$SERVER:$REMOTE_DIR/
print_status "Docker Compose file synced"

# Sync Dockerfiles
echo "Syncing Dockerfiles..."
scp $SSH_OPTS -r docker $USER@$SERVER:$REMOTE_DIR/
print_status "Dockerfiles synced"

# Rebuild and Restart Docker Container
echo "Rebuilding and restarting zion-blockchain container..."
ssh $SSH_OPTS $USER@$SERVER "cd $REMOTE_DIR && docker rm -f zion-blockchain || true && docker compose build blockchain && docker compose up -d --no-deps blockchain"

if [ $? -eq 0 ]; then
    print_status "Docker container rebuilt and restarted"
else
    print_error "Failed to rebuild/restart docker container"
    exit 1
fi

# Check Status
echo "Checking container status..."
sleep 5
ssh $SSH_OPTS $USER@$SERVER "docker ps | grep zion-blockchain"

echo ""
print_status "Deployment Complete!"
