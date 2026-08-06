#!/usr/bin/env bash
# Spustí oba Buddhism RAG ingesty z kořene repozitáře.
# Výstup: HiranV2.1/data/rag/buddhism-classical/generated/*.md
#         HiranV2.1/data/rag/buddhism-tibetan/generated/*.md
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "== Buddhism RAG autopilot (repo: $REPO_ROOT) =="

python3 HiranV2.1/scripts/rag/ingest_buddhism_classical.py \
  --manifest HiranV2.1/data/rag/manifest_buddhism_classical.json \
  --out-dir HiranV2.1/data/rag/buddhism-classical/generated

python3 HiranV2.1/scripts/rag/ingest_buddhism_tibetan_wiki.py \
  --manifest HiranV2.1/data/rag/manifest_buddhism_tibetan_wiki.json \
  --out-dir HiranV2.1/data/rag/buddhism-tibetan/generated

python3 HiranV2.1/scripts/rag/write_ingest_manifest.py

echo ""
echo "Classical md count:" "$(find HiranV2.1/data/rag/buddhism-classical/generated -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
echo "Tibetan (wiki seed) md count:" "$(find HiranV2.1/data/rag/buddhism-tibetan/generated -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
echo ""
echo 'Rust + API: Hiranyagarbha zion-ai-native-api načte chunky při ZION_RAG_BUDDHISM=all|classical|tibetan — viz PLAN_v2.1.md oddíl D.2.'
