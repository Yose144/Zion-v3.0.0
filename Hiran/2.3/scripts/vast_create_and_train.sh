#!/usr/bin/env bash
# Hiran v2.2 — one-shot Vast.ai RTX 4090 deploy + training
# Usage:
#   export VAST_API_KEY='...'
#   export HF_TOKEN='...'              # optional (gated models)
#   bash HiranV2.2/scripts/vast_create_and_train.sh
#
# Env overrides:
#   VAST_GPU_NAME     default: RTX 4090
#   VAST_MAX_PRICE    default: 0.45 ($/hr)
#   VAST_MIN_DISK     default: 120 (GB)
#   VAST_MIN_RELIABILITY default: 0.96

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HIRAN22="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$HIRAN22"

# ── API key ──────────────────────────────────────────────────────────────────
VAST_API_KEY="${VAST_API_KEY:-}"
if [[ -z "$VAST_API_KEY" && -f "${HOME}/.config/vastai/vast_api_key" ]]; then
    VAST_API_KEY="$(tr -d ' \t\r\n' < "${HOME}/.config/vastai/vast_api_key")"
fi
if [[ -z "$VAST_API_KEY" ]]; then
    echo "ERROR: Set VAST_API_KEY env var or save key to ~/.config/vastai/vast_api_key" >&2
    exit 1
fi

# ── vastai CLI ─────────────────────────────────────────────────────────────
if ! command -v vastai &>/dev/null; then
    echo "Installing vastai CLI..."
    pip3 install --quiet vastai
fi
vastai set api-key "$VAST_API_KEY" >/dev/null 2>&1

# ── Config ──────────────────────────────────────────────────────────────────
GPU_NAME="${VAST_GPU_NAME:-RTX 4090}"
MAX_PRICE="${VAST_MAX_PRICE:-0.45}"
MIN_DISK="${VAST_MIN_DISK:-120}"
MIN_REL="${VAST_MIN_RELIABILITY:-0.96}"
MIN_VRAM="${VAST_MIN_VRAM:-24}"

# ── 1. Find cheapest RTX 4090 ────────────────────────────────────────────────
echo "=== Searching for cheapest $GPU_NAME (<= \$${MAX_PRICE}/hr, disk>=${MIN_DISK}GB, rel>=${MIN_REL}) ==="

# Use direct API for precise filtering (no API key needed for search, but we have it)
OFFERS_JSON=$(curl -sS -X POST "https://console.vast.ai/api/v0/bundles/" \
    -H "Content-Type: application/json" \
    -d "{
        \"gpu_name\": {\"in\": [\"${GPU_NAME}\"]},
        \"num_gpus\": {\"gte\": 1},
        \"gpu_ram\": {\"gte\": ${MIN_VRAM}000},
        \"disk_space\": {\"gte\": ${MIN_DISK}},
        \"reliability\": {\"gte\": ${MIN_REL}},
        \"verified\": {\"eq\": true},
        \"rentable\": {\"eq\": true},
        \"type\": \"ondemand\",
        \"dph_total\": {\"lte\": ${MAX_PRICE}},
        \"order\": [[\"dph_total\", \"asc\"]],
        \"limit\": 10
    }")

# Parse best offer
BEST=$(echo "$OFFERS_JSON" | python3 -c '
import sys, json
data = json.load(sys.stdin)
offers = data.get("offers", [])
if not offers:
    sys.exit(1)
best = offers[0]
print(json.dumps({
    "id": best.get("id"),
    "dph": round(float(best.get("dph_total") or 0), 4),
    "gpu": best.get("gpu_name"),
    "vram": best.get("gpu_ram"),
    "cuda": best.get("cuda_max_good"),
    "rel": round(float(best.get("reliability") or 0), 4),
    "loc": best.get("geolocation", "")[:50],
    "disk": best.get("disk_space"),
}))
')

OFFER_ID=$(echo "$BEST" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
OFFER_DPH=$(echo "$BEST" | python3 -c 'import json,sys; print(json.load(sys.stdin)["dph"])')
OFFER_GPU=$(echo "$BEST" | python3 -c 'import json,sys; print(json.load(sys.stdin)["gpu"])')
OFFER_LOC=$(echo "$BEST" | python3 -c 'import json,sys; print(json.load(sys.stdin)["loc"])')

echo "Best offer: ID=$OFFER_ID  GPU=$OFFER_GPU  \$${OFFER_DPH}/hr  Location=$OFFER_LOC"

# ── 2. Confirm ───────────────────────────────────────────────────────────────
read -rp "Create instance from offer $OFFER_ID? (y/N) " CONFIRM
if [[ "${CONFIRM,,}" != "y" ]]; then
    echo "Cancelled."
    exit 0
fi

# ── 3. Create instance ──────────────────────────────────────────────────────
echo "=== Creating instance ==="
RESULT=$(vastai create instance "$OFFER_ID" \
    --image "pytorch/pytorch:2.5.1-cuda12.1-cudnn9-devel" \
    --disk "$MIN_DISK" \
    --ssh \
    --direct \
    --cancel-unavail \
    --onstart-cmd "apt-get update && apt-get install -y git wget rsync" \
    2>&1)

INSTANCE_ID=$(echo "$RESULT" | grep -oE '[0-9]+' | head -1)
if [[ -z "$INSTANCE_ID" ]]; then
    echo "ERROR: Failed to create instance. Output:" >&2
    echo "$RESULT" >&2
    exit 1
fi

echo "Instance created: ID=$INSTANCE_ID"

# ── 4. Wait for SSH ─────────────────────────────────────────────────────────
echo "=== Waiting for SSH (up to 10 min) ==="
RETRIES=60
while [[ $RETRIES -gt 0 ]]; do
    STATUS=$(vastai show instance "$INSTANCE_ID" --raw 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
a = d.get('actual_status')
host = d.get('ssh_host')
port = d.get('ssh_port')
print('running' if a == 'running' and host and port else (a or 'waiting'))
" || echo "waiting")

    if [[ "$STATUS" == "running" ]]; then
        echo "Instance running!"
        break
    fi
    echo -n "."
    sleep 10
    RETRIES=$((RETRIES - 1))
done

if [[ $RETRIES -eq 0 ]]; then
    echo "ERROR: Timeout waiting for instance. Check: vastai show instance $INSTANCE_ID" >&2
    exit 1
fi

# Get SSH info
SSH_URL=$(vastai ssh-url "$INSTANCE_ID" 2>/dev/null || true)
echo "SSH: $SSH_URL"

# ── 5. Prepare remote ──────────────────────────────────────────────────────
VAST_SSH="root@$(echo "$SSH_URL" | sed 's|ssh://||; s|:.*||')"
VAST_PORT=$(echo "$SSH_URL" | grep -oP '(?<=:)\d+' || echo "22")
SSH_IDENTITY="${SSH_IDENTITY:-$HOME/.ssh/id_ed25519}"
REMOTE="/workspace/hiran-v2.2"

echo "=== Syncing curriculum + scripts to $VAST_SSH:$VAST_PORT ==="

ssh -i "$SSH_IDENTITY" -p "$VAST_PORT" -o StrictHostKeyChecking=accept-new \
    "$VAST_SSH" "mkdir -p '$REMOTE/data/curriculum' '$REMOTE/scripts' '$REMOTE/config' '$REMOTE/evaluate'"

rsync -az -e "ssh -i $SSH_IDENTITY -p $VAST_PORT -o StrictHostKeyChecking=accept-new" \
    "$HIRAN22/data/curriculum/"*.jsonl "$VAST_SSH:$REMOTE/data/curriculum/"

rsync -az -e "ssh -i $SSH_IDENTITY -p $VAST_PORT -o StrictHostKeyChecking=accept-new" \
    "$HIRAN22/scripts/"*.py "$HIRAN22/scripts/"*.sh "$VAST_SSH:$REMOTE/scripts/"

rsync -az -e "ssh -i $SSH_IDENTITY -p $VAST_PORT -o StrictHostKeyChecking=accept-new" \
    "$HIRAN22/config/" "$VAST_SSH:$REMOTE/config/"

rsync -az -e "ssh -i $SSH_IDENTITY -p $VAST_PORT -o StrictHostKeyChecking=accept-new" \
    "$HIRAN22/evaluate/"*.py "$VAST_SSH:$REMOTE/evaluate/"

rsync -az -e "ssh -i $SSH_IDENTITY -p $VAST_PORT -o StrictHostKeyChecking=accept-new" \
    "$HIRAN22/requirements-train.txt" "$VAST_SSH:$REMOTE/"

# ── 6. Launch training ───────────────────────────────────────────────────────
echo "=== Starting training ==="
ssh -i "$SSH_IDENTITY" -p "$VAST_PORT" -o StrictHostKeyChecking=accept-new "$VAST_SSH" << REMOTE_EOF
    set -euo pipefail
    cd $REMOTE
    echo "Installing deps..."
    pip install -q -r requirements-train.txt
    echo "GPU check:"
    python3 -c "import torch; print('CUDA:', torch.cuda.is_available(), torch.cuda.get_device_name(0))"
    echo "Dataset check:"
    wc -l data/curriculum/*.jsonl
    echo "Starting curriculum training..."
    bash scripts/run_training.sh
REMOTE_EOF

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Training launched on instance $INSTANCE_ID"
echo "  Monitor: vastai logs $INSTANCE_ID"
echo "  SSH:     $SSH_URL"
echo "═══════════════════════════════════════════════════════"
