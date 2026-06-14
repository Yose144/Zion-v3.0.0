# Hiran v2.3 Recovery Plan

## What we have
- **Checkpoint-8000** (8.1GB LoRA adapter) — full 35h training saved
- Base model: `Qwen/Qwen3-32B` (public on HuggingFace)

## How to rebuild the model from checkpoint

### Step 1: Setup environment
```bash
python3 -m venv merge_env
source merge_env/bin/activate
pip install torch==2.5.1 --index-url https://download.pytorch.org/whl/cu121
pip install transformers==4.52.4 tokenizers==0.21.4 peft==0.12.0 accelerate
pip install sentencepiece protobuf numpy safetensors
```

### Step 2: Merge LoRA into base model
```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

BASE = "Qwen/Qwen3-32B"
CKPT = "./checkpoint-8000"
OUT = "./hiran-v2.3-merged"

model = AutoModelForCausalLM.from_pretrained(
    BASE, torch_dtype=torch.bfloat16, device_map="auto", trust_remote_code=True
)
tokenizer = AutoTokenizer.from_pretrained(BASE, trust_remote_code=True)

model = PeftModel.from_pretrained(model, CKPT)
model = model.merge_and_unload()

model.save_pretrained(OUT, safe_serialization=True)
tokenizer.save_pretrained(OUT)
```

### Step 3: Convert to GGUF
```bash
git clone https://github.com/ggerganov/llama.cpp --depth=1
cd llama.cpp
cmake -B build -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j$(nproc) --target llama-quantize

# f16 first
python3 convert_hf_to_gguf.py ../hiran-v2.3-merged --outfile hiran-v2.3-f16.gguf --outtype f16

# Then quantize
./build/bin/llama-quantize hiran-v2.3-f16.gguf hiran-v2.3-q5_k_m.gguf Q5_K_M
```

### Step 4: Run inference
```bash
./build/bin/llama-server --model hiran-v2.3-q5_k_m.gguf --host 0.0.0.0 --port 8080 --n-gpu-layers 99
```

## Instance info (for reference)
- **Vast AI account**: yosef
- **API key**: stored in `~/.zion/agent-cli.toml`
- **France instance** (inference): ssh7.vast.ai:17620 — $0.1116/hr
- **Quebec instance** (merge): ssh4.vast.ai:30126 — $0.1356/hr (temporary)

## Cost so far
- Training: ~35h on A100 (~$1.18/hr) = ~$41
- Merge attempts: ~3h RTX 3090 (~$0.16/hr) = ~$0.50
- **Total investment: ~$41.50**
