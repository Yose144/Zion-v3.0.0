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

DATASET="${ZION_TRAIN_DATASET:-$SCRIPT_DIR/data/zion_train_hiran_v2.jsonl}"
if [[ ! -f "$DATASET" ]]; then
  DATASET="$SCRIPT_DIR/data/zion_train.jsonl"
fi

if [[ ! -f "$DATASET" ]]; then
  echo "[ERR] Dataset nenalezen: $DATASET"
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
EPOCHS="${VAST_EPOCHS:-5}"
echo "[ZION] GPU=$GPU epochs=$EPOCHS | dataset: $DATASET ($(wc -l < "$DATASET" | tr -d ' ') řádků)"

exec env ZION_TRAIN_DATASET="$DATASET" ./vast_deploy.sh --gpu "$GPU" --epochs "$EPOCHS" --yes "$@"
