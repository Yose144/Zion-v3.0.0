#!/usr/bin/env bash
# Spustí Hiran v2 fine-tune na Vast (RTX 4090): venv → vastai → vast_deploy.
# Vyžaduje: export VAST_API_KEY='…'  NEBO soubor .env v tomto adresáři (není v gitu).

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

if [[ -z "${VAST_API_KEY:-}" ]]; then
  echo "[ERR] Chybí VAST_API_KEY."
  echo "  export VAST_API_KEY='…'   # z https://cloud.vast.ai/"
  echo "  nebo: echo 'VAST_API_KEY=…' > $SCRIPT_DIR/.env && chmod 600 $SCRIPT_DIR/.env"
  exit 1
fi

# Prefer unified v2.1 curriculum (merged v1-shards + v2); override with ZION_TRAIN_DATASET.
if [[ -n "${ZION_TRAIN_DATASET:-}" ]]; then
  DATASET="$ZION_TRAIN_DATASET"
elif [[ -f "$SCRIPT_DIR/data/hiran_curriculum_v2.1.jsonl" ]]; then
  DATASET="$SCRIPT_DIR/data/hiran_curriculum_v2.1.jsonl"
elif [[ -f "$SCRIPT_DIR/data/zion_train_hiran_v2.jsonl" ]]; then
  DATASET="$SCRIPT_DIR/data/zion_train_hiran_v2.jsonl"
elif [[ -f "$SCRIPT_DIR/data/zion_train.jsonl" ]]; then
  DATASET="$SCRIPT_DIR/data/zion_train.jsonl"
else
  echo "[ERR] Dataset nenalezen (očekáváno ZION_TRAIN_DATASET nebo data/hiran_curriculum_v2.1.jsonl)."
  exit 1
fi

VENV="$SCRIPT_DIR/.venv-vast"
if [[ ! -d "$VENV" ]]; then
  echo "[ZION] Vytvářím venv: $VENV"
  python3 -m venv "$VENV"
fi
# shellcheck source=/dev/null
source "$VENV/bin/activate"
pip install -q vastai

GPU="${VAST_GPU:-RTX 4090}"
# Budget výchozí: 3 epochy; max kvalita déle: export VAST_EPOCHS=5
EPOCHS="${VAST_EPOCHS:-3}"
MAXSEQ="${VAST_MAX_SEQ_LENGTH:-1024}"
echo "[ZION] GPU=$GPU epochs=$EPOCHS max_seq=$MAXSEQ | dataset: $DATASET ($(wc -l < "$DATASET" | tr -d ' ') řádků)"

exec env ZION_TRAIN_DATASET="$DATASET" ZION_MAX_SEQ_LENGTH="$MAXSEQ" ./vast_deploy.sh --gpu "$GPU" --epochs "$EPOCHS" --yes "$@"
