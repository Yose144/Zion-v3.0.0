#!/bin/bash
# Deploy autostart script to Vast.ai instance and launch training
# Run locally after instance is running

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

SSH_KEY="${HOME}/.ssh/vast/hiran_v2.3_key"
REMOTE_HOST="root@ssh5.vast.ai"
REMOTE_DIR="/workspace/hiran-v2.3"
INSTANCE_ID="40780492"
API_KEY="${VASTAI_API_KEY:-}"

# Get SSH port from API if not set
if [ -z "${SSH_PORT:-}" ]; then
    echo -e "${YELLOW}Fetching SSH port from Vast.ai API...${NC}"
    SSH_PORT=$(curl -s "https://console.vast.ai/api/v0/instances/${INSTANCE_ID}/?api_key=${API_KEY}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('ssh_port', ''))")
    if [ -z "$SSH_PORT" ]; then
        echo "ERROR: Instance not ready yet. SSH port unavailable."
        echo "Check status at: https://cloud.vast.ai/"
        exit 1
    fi
    echo "SSH port: $SSH_PORT"
fi

echo -e "${GREEN}Deploying to ${REMOTE_HOST}:${SSH_PORT}...${NC}"

# Wait for SSH to be ready
echo -e "${YELLOW}Waiting for SSH...${NC}"
for i in {1..30}; do
    if ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 -p "$SSH_PORT" -i "$SSH_KEY" "$REMOTE_HOST" "echo 'OK'" 2>/dev/null; then
        break
    fi
    echo "  Attempt $i/30..."
    sleep 10
done

# Create remote directory
echo -e "${YELLOW}Creating remote workspace...${NC}"
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p "$SSH_PORT" -i "$SSH_KEY" "$REMOTE_HOST" "mkdir -p ${REMOTE_DIR}"

# Copy autostart script
echo -e "${YELLOW}Copying autostart script...${NC}"
scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P "$SSH_PORT" -i "$SSH_KEY" \
    "$(dirname "$0")/autostart.sh" \
    "${REMOTE_HOST}:${REMOTE_DIR}/"

# Run it
echo -e "${GREEN}Launching training!${NC}"
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p "$SSH_PORT" -i "$SSH_KEY" "$REMOTE_HOST" \
    "bash ${REMOTE_DIR}/autostart.sh"

echo -e "${GREEN}Done!${NC}"
echo "Monitor logs:"
echo "  ssh -p ${SSH_PORT} -i ${SSH_KEY} ${REMOTE_HOST} 'tail -f /workspace/hiran-training.log'"
