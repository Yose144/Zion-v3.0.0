#!/usr/bin/env bash
# Sync Hiran v2.2 curriculum + training code to the CURRENT Vast GPU instance.
# Instance: ssh7.vast.ai:28568 (contract 37028568)
#
# Usage (from repo root):
#   bash HiranV2.2/scripts/sync_to_current_vast.sh

set -euo pipefail

HIRAN22="$(cd "$(dirname "$0")/.." && pwd)"

VAST_SSH="root@ssh7.vast.ai"
VAST_PORT="28568"
SSH_IDENTITY="$HOME/.ssh/vast_hiran_key"
REMOTE="/workspace/hiran-v2.2"

SSH=(ssh -i "$SSH_IDENTITY" -p "$VAST_PORT" -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null)
RSYNC=(rsync -az --mkpath -e "ssh -i $SSH_IDENTITY -p $VAST_PORT -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null")

echo "========================================"
echo "Syncing Hiran v2.2 to Vast.ai instance"
echo "Remote: ${VAST_SSH}:${REMOTE}"
echo "========================================"

# Create remote directory structure
"${SSH[@]}" "$VAST_SSH" "mkdir -p '$REMOTE/data/curriculum' '$REMOTE/scripts' '$REMOTE/config' '$REMOTE/evaluate' '$REMOTE/quantization' '$REMOTE/inference'"

# Sync curriculum data (JSONL files)
echo "[1/6] Syncing curriculum data..."
"${RSYNC[@]}" "$HIRAN22/data/curriculum/"*.jsonl "$VAST_SSH:$REMOTE/data/curriculum/"

# Sync training scripts
echo "[2/6] Syncing training scripts..."
"${RSYNC[@]}" "$HIRAN22/scripts/"*.py "$VAST_SSH:$REMOTE/scripts/"
"${RSYNC[@]}" "$HIRAN22/scripts/"*.sh "$VAST_SSH:$REMOTE/scripts/"

# Sync configs
echo "[3/6] Syncing configs..."
"${RSYNC[@]}" "$HIRAN22/config/"*.py "$VAST_SSH:$REMOTE/config/"
"${RSYNC[@]}" "$HIRAN22/config/"*.json "$VAST_SSH:$REMOTE/config/"

# Sync evaluation
echo "[4/6] Syncing evaluation..."
"${RSYNC[@]}" "$HIRAN22/evaluate/"*.py "$VAST_SSH:$REMOTE/evaluate/"

# Sync quantization
echo "[5/6] Syncing quantization..."
"${RSYNC[@]}" "$HIRAN22/quantization/"*.py "$VAST_SSH:$REMOTE/quantization/"

# Sync inference
echo "[6/6] Syncing inference..."
"${RSYNC[@]}" "$HIRAN22/inference/"*.py "$VAST_SSH:$REMOTE/inference/"

# Sync requirements
echo "[EXTRA] Syncing requirements..."
"${RSYNC[@]}" "$HIRAN22/requirements-train.txt" "$VAST_SSH:$REMOTE/"
"${RSYNC[@]}" "$HIRAN22/requirements-train-only.txt" "$VAST_SSH:$REMOTE/"

echo ""
echo "========================================"
echo "Sync complete!"
echo "========================================"
echo "Next steps on the instance:"
echo "  ssh -i ~/.ssh/vast_hiran_key -p 28568 root@ssh7.vast.ai"
echo "  cd /workspace/hiran-v2.2"
echo "  pip install -r requirements-train.txt"
echo "  python3 scripts/train_v2.2.py --dry_run"
echo "  bash scripts/run_training.sh"
echo "========================================"
