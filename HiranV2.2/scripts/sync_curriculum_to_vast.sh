#!/usr/bin/env bash
# Sync Hiran v2.2 curriculum + training code to a fresh Vast GPU instance.
#
# Usage (from repo root):
#   export VAST_SSH="root@ssh5.vast.ai"
#   export VAST_PORT="31284"
#   export SSH_IDENTITY="$HOME/.ssh/vast_hiran_key"
#   export VAST_REMOTE_DIR="/workspace/hiran-v2.2"
#   bash HiranV2.2/scripts/sync_curriculum_to_vast.sh
#
# Then on the instance: pip install -r requirements-train.txt && python3 scripts/train_v2.2.py ...

set -euo pipefail

HIRAN22="$(cd "$(dirname "$0")/.." && pwd)"

VAST_SSH="${VAST_SSH:?Set VAST_SSH e.g. root@ssh5.vast.ai}"
VAST_PORT="${VAST_PORT:-22}"
SSH_IDENTITY="${SSH_IDENTITY:-$HOME/.ssh/id_ed25519}"
REMOTE="${VAST_REMOTE_DIR:-/workspace/hiran-v2.2}"

SSH=(ssh -i "$SSH_IDENTITY" -p "$VAST_PORT" -o StrictHostKeyChecking=accept-new)
RSYNC=(rsync -az -e "ssh -i $SSH_IDENTITY -p $VAST_PORT -o StrictHostKeyChecking=accept-new")

echo "Remote: ${VAST_SSH}:${REMOTE}"
"${SSH[@]}" "$VAST_SSH" "mkdir -p '$REMOTE/data/curriculum' '$REMOTE/scripts' '$REMOTE/config' '$REMOTE/evaluate' '$REMOTE/quantization' '$REMOTE/inference'"

"${RSYNC[@]}" "$HIRAN22/data/curriculum/"*.jsonl "$VAST_SSH:$REMOTE/data/curriculum/"
"${RSYNC[@]}" "$HIRAN22/scripts/"*.py "$VAST_SSH:$REMOTE/scripts/"
"${RSYNC[@]}" "$HIRAN22/scripts/"*.sh "$VAST_SSH:$REMOTE/scripts/"
"${RSYNC[@]}" "$HIRAN22/config/" "$VAST_SSH:$REMOTE/config/"
"${RSYNC[@]}" "$HIRAN22/evaluate/"*.py "$VAST_SSH:$REMOTE/evaluate/"
"${RSYNC[@]}" "$HIRAN22/quantization/"*.py "$VAST_SSH:$REMOTE/quantization/"
"${RSYNC[@]}" "$HIRAN22/inference/"*.py "$VAST_SSH:$REMOTE/inference/"
"${RSYNC[@]}" "$HIRAN22/requirements-train.txt" "$VAST_SSH:$REMOTE/"

echo "Synced. On instance:"
echo "  cd $REMOTE && pip install -r requirements-train.txt"
echo "  python3 scripts/train_v2.2.py --data_dir data/curriculum --output_dir checkpoints --tensorboard"
