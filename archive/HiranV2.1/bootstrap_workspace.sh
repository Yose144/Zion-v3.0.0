#!/usr/bin/env bash
# Hiran v2.1 — rychlý start pracovního stromu dat (ze kořene monorepa).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

HIRAN="$ROOT/HiranV2.1"
SHARDS="$HIRAN/data/shards"
META="$HIRAN/curriculum/meta"
CUR="$HIRAN/data/hiran_curriculum_v2.1.jsonl"

echo "== Hiran v2.1 workspace bootstrap =="
echo "ROOT=$ROOT"

mkdir -p "$SHARDS" "$META"

echo ""
echo "== Orchestrator shard (PLAN §5 Wave 1 — deterministic V3 corpus) =="
HIRAN_V2_SHARD="$SHARDS/zion_train_hiran_v2.jsonl"
if [[ ! -f "$HIRAN_V2_SHARD" ]] || [[ "${HIRAN_FORCE_REBUILD_V2_SHARD:-}" == "1" ]]; then
  echo "  Building $HIRAN_V2_SHARD (no external LLM)..."
  python3 HiranV2.1/finetune/build_v3_orchestrator_dataset.py --project "$ROOT"
else
  lines_v2=$(wc -l < "$HIRAN_V2_SHARD" | tr -d ' ')
  echo "  OK       zion_train_hiran_v2.jsonl ($lines_v2 lines) — set HIRAN_FORCE_REBUILD_V2_SHARD=1 to rebuild"
fi

echo ""
echo "== Shards (optional NIM / book refresh — not tracked in git) =="
missing_nim=0
if [[ ! -f "$SHARDS/zion_train.jsonl" ]]; then
  echo "  OPTIONAL missing  $SHARDS/zion_train.jsonl  (NIM: collect_dataset.py — see finetune/README.md)"
  missing_nim=1
else
  lines=$(wc -l < "$SHARDS/zion_train.jsonl" | tr -d ' ')
  echo "  OK       zion_train.jsonl ($lines lines)"
fi

echo ""
echo "== Merge curriculum → $CUR =="
if [[ $missing_nim -eq 1 ]]; then
  echo "[INFO] NIM shard absent — curriculum still merges from zion_train_hiran_v2 + Buddhism + any other shards present."
fi

python3 HiranV2.1/finetune/merge_hiran_curriculum_v2_1.py

if [[ -f "$CUR" ]]; then
  lines=$(wc -l < "$CUR" | tr -d ' ')
  sha=$(shasum -a 256 "$CUR" | awk '{print $1}')
  {
    echo "# Hiran v2.1 curriculum build stamp (auto-generated)"
    echo "generated_utc=$(date -u +%Y-%m-%dT%H:%MZ)"
    echo "lines=$lines"
    echo "sha256=$sha"
    echo "repo_root=$ROOT"
  } > "$META/BUILD.txt"
  echo "  Wrote $META/BUILD.txt"
else
  echo "[ERR] Expected output missing: $CUR"
  exit 1
fi

echo ""
echo "Optional SFT shards (merge if present — see PLAN_v2.1.md fáze A rozšíření):"
echo "  $SHARDS/zion_train_oer_sciences.jsonl"
echo "  $SHARDS/zion_train_vedic_guided.jsonl"
echo "  $SHARDS/zion_train_buddhism_guided.jsonl"

echo ""
echo "== Next steps =="
echo "  1. Read:  HiranV2.1/PLAN_v2.1.md"
echo "  2. Dry-run: python3 HiranV2.1/finetune/finetune_lora.py --dataset HiranV2.1/finetune/data/hiran_curriculum_v2.1.jsonl --dry-run"
echo "  3. Train:   cd HiranV2.1/finetune && ./start_hiran_v2_vast.sh   # needs VAST_API_KEY"
echo "  4. Runtime: export LLM_MODEL=<ollama-tag>  # see V3/L3/ai-native zion-ai-native-api"
echo ""
