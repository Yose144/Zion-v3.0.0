#!/usr/bin/env bash
# Spuštěno na Vast instanci v /workspace — Hiran v2.1 curriculum jako data/zion_train.jsonl
set -euo pipefail
cd /workspace
export PYTHONUNBUFFERED=1
# Méně deadlock varování z tokenizers + DataLoader; na Vast typicky rychlejší než workers=2.
export TOKENIZERS_PARALLELISM="${TOKENIZERS_PARALLELISM:-false}"
export ZION_DATALOADER_WORKERS="${ZION_DATALOADER_WORKERS:-0}"
# Budget výchozí: kratší kontext = výrazně rychlejší kroky; max kvalita = export ZION_MAX_SEQ_LENGTH=2048
export ZION_MAX_SEQ_LENGTH="${ZION_MAX_SEQ_LENGTH:-1024}"

echo "[1/4] pip install..."
pip install -q -r requirements.txt
# flash-attn se na Vast často dlouho kompiluje — QLoRA funguje bez něj (SDPA v PyTorch).
if [[ -n "${HF_TOKEN:-}" ]]; then
  huggingface-cli login --token "$HF_TOKEN" 2>/dev/null || true
fi
PAIRS=$(wc -l < data/zion_train.jsonl)
echo "[2/4] Dataset: $PAIRS řádků"
EPOCHS="${ZION_EPOCHS:-3}"
echo "[3/4] QLoRA fine-tune (epoch: ${EPOCHS}, max_seq: ${ZION_MAX_SEQ_LENGTH})..."
python finetune_lora.py \
  --dataset data/zion_train.jsonl \
  --output outputs/zion-llama-lora \
  --epochs "${EPOCHS}" \
  --max-seq-length "${ZION_MAX_SEQ_LENGTH}"
echo "[4/4] Merge + GGUF..."
if [[ "${ZION_SKIP_GGUF:-0}" == "1" ]]; then
  echo "ZION_SKIP_GGUF=1 — přeskakuji merge/GGUF na serveru (ušetří čas i peníze). Stáhni LoRA a merge udělej lokálně."
  exit 0
fi
if [[ ! -d /opt/llama.cpp ]]; then
  git clone --depth 1 https://github.com/ggerganov/llama.cpp /opt/llama.cpp
  (cd /opt/llama.cpp && pip install -q -r requirements.txt)
fi
pip install -q sentencepiece
python merge_export.py \
  --adapter outputs/zion-llama-lora \
  --output outputs/zion-llama-merged \
  --to-gguf \
  --gguf-quant Q5_K_M \
  --llamacpp /opt/llama.cpp
echo "DONE — LoRA: outputs/zion-llama-lora  GGUF: outputs/zion-llama-merged"
