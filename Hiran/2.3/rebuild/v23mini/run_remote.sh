#!/usr/bin/env bash
# Runs ON the vast.ai instance: deps → train → merge → GGUF → out/
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out logs

echo "=== [1/4] deps ==="
pip install -q --upgrade pip
pip install -q -r requirements-v23mini.txt
python3 -c 'import torch; print("gpu:", torch.cuda.get_device_name(0), torch.cuda.get_device_properties(0).total_memory//2**30, "GB")'

echo "=== [2/4] train ==="
DATA_FILE="$(ls ./*.jsonl 2>/dev/null | head -1)"
[[ -n "$DATA_FILE" ]] || { echo "ERROR: no .jsonl dataset in $PWD"; exit 1; }
echo "dataset: $DATA_FILE ($(wc -l < "$DATA_FILE") rows)"
python3 train_v23mini.py \
  --data "$DATA_FILE" \
  --output_dir checkpoints/v23mini \
  --drop_echo --epochs 2 --seq_len 4096 --batch_size 4 --grad_accum 8 \
  2>&1 | tee logs/train.log

echo "=== [3/4] merge ==="
python3 merge_v23mini.py \
  --base Qwen/Qwen3-8B \
  --adapter checkpoints/v23mini/final \
  --out merged/v23mini-hf 2>&1 | tee logs/merge.log

echo "=== [4/4] gguf ==="
if [[ ! -d llama.cpp ]]; then
  git clone --depth 1 https://github.com/ggml-org/llama.cpp llama.cpp
fi
pip install -q -r llama.cpp/requirements.txt
python3 llama.cpp/convert_hf_to_gguf.py merged/v23mini-hf \
  --outfile out/hiran-v2.3mini-f16.gguf 2>&1 | tail -3
cd llama.cpp && cmake -B build -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release >/dev/null \
  && cmake --build build --target llama-quantize -j"$(nproc)" >/dev/null && cd ..
./llama.cpp/build/bin/llama-quantize \
  out/hiran-v2.3mini-f16.gguf out/hiran-v2.3mini-Q5_K_M.gguf Q5_K_M

cp -r checkpoints/v23mini/final out/adapter-final
cp merged/v23mini-hf/config.json out/ 2>/dev/null || true
echo "=== done ==="; ls -la out/
