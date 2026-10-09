#!/usr/bin/env bash
# Rebuild Hiran v2.3 dataset from surviving sources.
# Verified 2026-10-09: produces 1,558 unique pairs (deterministic, no LLM calls).
# To reach original scale (v2.2: 22,181 / v2.3: 48,436) a generator model is
# required — see README "Dataset gap".
set -euo pipefail
cd "$(dirname "$0")/../rebuild"

# Frozen source trees (archive is read-only reference — input symlinks only)
ln -sfn ../../../archive/V3 V3
ln -sfn ../../../archive/HiranV2.1 HiranV2.1
# HiranV2.2 is the OUTPUT dir (real, not symlink — keeps archive/ clean)
mkdir -p HiranV2.2/data/curriculum

python3 ../data/build_dataset.py          # scrapes V3/docs + NCL curriculum -> curriculum/*.jsonl
python3 ../data/boost_dataset.py          # + manual CLI/arch + synthetic RAG pairs
python3 ../v21-legacy/finetune/collect_dataset.py \
    --project /home/zionserver/2.9.6-main \
    --output collected_seed.jsonl --seed-only --max-docs 600
python3 ../scripts/merge_rebuilt.py       # -> merged_seed.jsonl (dedupe, messages format)

echo "Done. Validate: python3 ../data/validate_dataset.py (points at curriculum/ dir)"
