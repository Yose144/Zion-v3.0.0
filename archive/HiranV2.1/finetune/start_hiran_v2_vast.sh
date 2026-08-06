#!/usr/bin/env bash
# Spustí Hiran v2 fine-tune na Vast: venv → vastai → vast_deploy.
# Vyžaduje: export VAST_API_KEY='…'  NEBO soubor .env v tomto adresáři (není v gitu).
# Levné GPU bez typu karty: VAST_ANY_GPU=1 VAST_MAX_PRICE=0.35 ./start_hiran_v2_vast.sh ...

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

# Prefer unified v2.1 curriculum (merge); override with ZION_TRAIN_DATASET.
# Poznámka: pokud »finetune/data« je v repu textový pointer »../data«, použije se fallback na ../data/…
if [[ -n "${ZION_TRAIN_DATASET:-}" ]]; then
  DATASET="$ZION_TRAIN_DATASET"
elif [[ -f "$SCRIPT_DIR/data/hiran_curriculum_v2.1.jsonl" ]]; then
  DATASET="$SCRIPT_DIR/data/hiran_curriculum_v2.1.jsonl"
elif [[ -f "$SCRIPT_DIR/../data/hiran_curriculum_v2.1.jsonl" ]]; then
  DATASET="$SCRIPT_DIR/../data/hiran_curriculum_v2.1.jsonl"
elif [[ -f "$SCRIPT_DIR/../data/shards/zion_train_hiran_v2.jsonl" ]]; then
  DATASET="$SCRIPT_DIR/../data/shards/zion_train_hiran_v2.jsonl"
elif [[ -f "$SCRIPT_DIR/data/zion_train_hiran_v2.jsonl" ]]; then
  DATASET="$SCRIPT_DIR/data/zion_train_hiran_v2.jsonl"
elif [[ -f "$SCRIPT_DIR/data/zion_train.jsonl" ]]; then
  DATASET="$SCRIPT_DIR/data/zion_train.jsonl"
else
  echo "[ERR] Dataset nenalezen."
  echo "  Spusť z kořene: ./HiranV2.1/bootstrap_workspace.sh"
  echo "  nebo nastav ZION_TRAIN_DATASET=/cesta/k/hiran_curriculum_v2.1.jsonl"
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
EPOCHS="${VAST_EPOCHS:-3}"
MAXSEQ="${VAST_MAX_SEQ_LENGTH:-1024}"
echo "[ZION] GPU=$GPU epochs=$EPOCHS max_seq=$MAXSEQ | dataset: $DATASET ($(wc -l < "$DATASET" | tr -d ' ') řádků)"

# Pouze při úplné pipeline (--yes) automaticky nepřihlásit read u vast_deploy — u --find-only / stažení atd. nezasahovat.
VAST_TAIL=(--yes)
for a in "$@"; do
  case "$a" in --find-only|--download|--destroy|--status|--resume|--help|-h) VAST_TAIL=(); break ;; esac
done

exec env ZION_TRAIN_DATASET="$DATASET" ZION_MAX_SEQ_LENGTH="$MAXSEQ" ./vast_deploy.sh --gpu "$GPU" --epochs "$EPOCHS" "${VAST_TAIL[@]}" "$@"
