#!/bin/bash
# Deploy autostart script to Vast.ai instance and launch training autonomously
# Run locally: ./deploy-and-train.sh

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH_KEY="${HOME}/.ssh/vast/hiran_v2.4_key"
SSH_HOST="ssh1.vast.ai"
INSTANCE_ID="40791384"
API_KEY="${VASTAI_API_KEY:-}"
MAX_WAIT=300  # 5 minutes

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Hiran v2.3 Deploy & Launch${NC}"
echo -e "${GREEN}========================================${NC}"

# Check SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}ERROR: SSH key not found: $SSH_KEY${NC}"
    echo "Generate first or check VAST_INSTANCE_INFO.md"
    exit 1
fi

# Get API key if not set
if [ -z "$API_KEY" ]; then
    read -p "Enter Vast.ai API key: " API_KEY
fi

# Get SSH port
echo -e "${YELLOW}Fetching SSH port from Vast.ai API...${NC}"
SSH_PORT=""
for i in $(seq 1 $MAX_WAIT); do
    SSH_PORT=$(curl -s "https://console.vast.ai/api/v0/instances/${INSTANCE_ID}/?api_key=${API_KEY}" | \
        python3 -c "import json,sys; d=json.load(sys.stdin); p=d.get('ssh_port'); print(p if p else '')")
    if [ -n "$SSH_PORT" ] && [ "$SSH_PORT" != "None" ]; then
        break
    fi
    if [ $((i % 10)) -eq 0 ]; then
        echo "  Waiting for SSH... ($i/${MAX_WAIT}s)"
    fi
    sleep 1
done

if [ -z "$SSH_PORT" ] || [ "$SSH_PORT" = "None" ]; then
    echo -e "${RED}ERROR: Instance not ready after ${MAX_WAIT}s${NC}"
    echo "Check status at: https://cloud.vast.ai/"
    exit 1
fi

echo -e "${GREEN}SSH port: $SSH_PORT${NC}"

# Wait for SSH to actually respond
echo -e "${YELLOW}Waiting for SSH daemon...${NC}"
for i in $(seq 1 60); do
    if ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=3 -p "$SSH_PORT" -i "$SSH_KEY" root@${SSH_HOST} "echo 'SSH_OK'" 2>/dev/null | grep -q "SSH_OK"; then
        echo -e "${GREEN}SSH ready!${NC}"
        break
    fi
    if [ $i -eq 60 ]; then
        echo -e "${RED}ERROR: SSH not responding${NC}"
        exit 1
    fi
    sleep 2
done

# Create remote workspace
echo -e "${YELLOW}Creating remote workspace...${NC}"
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p "$SSH_PORT" -i "$SSH_KEY" root@${SSH_HOST} \
    "mkdir -p /workspace/hiran-v2.3/scripts"

# Copy autostart script
echo -e "${YELLOW}Copying autostart script...${NC}"
scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P "$SSH_PORT" -i "$SSH_KEY" \
    "$SCRIPT_DIR/autostart.sh" \
    "root@${SSH_HOST}:/workspace/hiran-v2.3/scripts/"

# Make executable and add to .bashrc for auto-run on reconnect
echo -e "${YELLOW}Setting up auto-run...${NC}"
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p "$SSH_PORT" -i "$SSH_KEY" root@${SSH_HOST} \
    "chmod +x /workspace/hiran-v2.3/scripts/autostart.sh && \
     grep -q 'autostart.sh' ~/.bashrc || echo 'bash /workspace/hiran-v2.3/scripts/autostart.sh' >> ~/.bashrc && \
     echo 'Auto-run configured. Will start on SSH login or now.'"

# Launch training NOW
echo -e "${GREEN}Launching autonomous training!${NC}"
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p "$SSH_PORT" -i "$SSH_KEY" root@${SSH_HOST} \
    "nohup bash /workspace/hiran-v2.3/scripts/autostart.sh > /workspace/hiran-training.log 2>&1 &"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Training launched autonomously!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Monitor logs:"
echo "  ssh -p ${SSH_PORT} -i ${SSH_KEY} root@${SSH_HOST} 'tail -f /workspace/hiran-training.log'"
echo ""
echo "Check GPU:"
echo "  ssh -p ${SSH_PORT} -i ${SSH_KEY} root@${SSH_HOST} 'nvidia-smi'"
echo ""
echo "Dashboard: https://cloud.vast.ai/"
echo "Instance ID: ${INSTANCE_ID}"
echo ""
echo "Download model when ready:"
echo "  rsync -avz -e 'ssh -p ${SSH_PORT} -i ${SSH_KEY}' root@${SSH_HOST}:/workspace/hiran-v2.3-release/ ~/HiranV2.3-Release/"
