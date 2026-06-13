# Hiran v2.3 — Kompletní Průvodce Full Training + Stažení Modelu

> **Vytvořeno:** 2026-06-13  
> **Base Model:** Qwen/Qwen3-32B (32.8B params, 128K context, Apache 2.0)  
> **Training:** DeepSpeed ZeRO-3 Full Fine-Tuning  
> **Hardware:** Vast.ai — 2x A100 SXM4 80GB  
> **Instance ID:** 40780492  
> **Estimated Cost:** ~$50 (36-48h @ $1.04/hr)

---

## Rychlý Přehled

| Krok | Příkaz | Status |
|---|---|---|
| 1. Deploy autostart | `bash HiranV2.3/scripts/deploy-and-train.sh` | ⏳ Čeká na instance |
| 2. Monitorovat logy | `ssh ... "tail -f /workspace/hiran-training.log"` | Po deploy |
| 3. Evaluace | `python scripts/evaluate.py --model_path checkpoints/stage1_factual/final` | Po tréninku |
| 4. Quantizace | `python scripts/quantize.py --checkpoint ... --formats gguf` | Po evaluaci |
| 5. Stáhnout model | `rsync -avz ...` nebo `scp -r ...` | Na jiný PC |

---

## 1. Připojení k Instanci

### SSH Klíč
```
~/.ssh/vast/hiran_v2.3_key          (private)
~/.ssh/vast/hiran_v2.3_key.pub      (public)
Fingerprint: SHA256:gO0g1mQJZoygHS3G99Dhg31FUrSs4pETbyJyDDQbNyU
```

### Jak zjistit SSH port (instance se mění při restartu)
```bash
API_KEY="4f86b4afa3f1219cc18708d6a6a2e6476793ae088d0e4e39d2a0baacacd592fd"
INSTANCE_ID="40780492"

curl -s "https://console.vast.ai/api/v0/instances/${INSTANCE_ID}/?api_key=${API_KEY}" | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print(f'ssh -p {d.get(\"ssh_port\")} -i ~/.ssh/vast/hiran_v2.3_key root@{d.get(\"ssh_host\")}')"
```

### Dashboard
https://cloud.vast.ai/ — instance **40780492**

### API Key (pro kontrolu stavu)
```
4f86b4afa3f1219cc18708d6a6a2e6476793ae088d0e4e39d2a0baacacd592fd
```

---

## 2. Autonomní Trénink — Deploy & Run

### Možnost A: Automatický deploy z lokálu
```bash
cd /Users/yeshuae/Projects/2.9.6/HiranV2.3/scripts
VASTAI_API_KEY="4f86b4afa3f1219cc18708d6a6a2e6476793ae088d0e4e39d2a0baacacd592fd" \
  ./deploy-and-train.sh
```

### Možnost B: Ruční připojení a spuštění
```bash
# Zjisti port (viz sekce 1)
ssh -p <PORT> -i ~/.ssh/vast/hiran_v2.3_key root@ssh5.vast.ai

# Na instanci:
bash /workspace/hiran-v2.3/scripts/autostart.sh
```

### Co autostart dělá (8 kroků)
1. Nainstaluje systémové závislosti (git, htop, nvtop)
2. Ověří disk (varuje pokud <400 GB)
3. Clone repo z GitHub
4. Vytvoří Python venv + nainstaluje transformers/accelerate/deepspeed/peft/trl
5. Validuje dataset (48,436 párů)
6. Před-stáhne tokenizer Qwen3-32B
7. Dry run pro ověření konfigurace
8. **Spustí DeepSpeed ZeRO-3 Full FT**

---

## 3. Monitoring — Jak sledovat průběh

### Reálný čas (z lokálu)
```bash
# Logy tréninku
ssh -p <PORT> -i ~/.ssh/vast/hiran_v2.3_key root@ssh5.vast.ai \
  "tail -f /workspace/hiran-training.log"

# GPU využití
ssh -p <PORT> -i ~/.ssh/vast/hiran_v2.3_key root@ssh5.vast.ai \
  "watch -n 2 nvidia-smi"

# Diskové místo
ssh -p <PORT> -i ~/.ssh/vast/hiran_v2.3_key root@ssh5.vast.ai \
  "df -h / && du -sh /workspace/hiran-v2.3/checkpoints/ 2>/dev/null"
```

### Prometheus/Grafana (volitelné)
Instance běží na Vast.ai — monitoring je přes jejich dashboard. Lokální Prometheus není nutný.

---

## 4. Post-Training — Evaluace & Quantizace

### Po úspěšném tréninku (na instanci)
```bash
ssh -p <PORT> -i ~/.ssh/vast/hiran_v2.3_key root@ssh5.vast.ai

cd /workspace/hiran-v2.3
source venv/bin/activate

# 1. Evaluace — 8 benchmark domains
echo "=== EVALUATION ==="
python scripts/evaluate.py \
  --model_path checkpoints/stage1_factual/final \
  --benchmarks all \
  --output_dir evaluation_results

# 2. Faktický benchmark
echo "=== FACTUAL BENCHMARK ==="
python scripts/benchmark_factual.py \
  --model_path checkpoints/stage1_factual/final

# 3. Quantizace → GGUF
echo "=== QUANTIZATION ==="
python scripts/quantize.py \
  --checkpoint checkpoints/stage1_factual/final \
  --formats gguf \
  --output_dir models

# Výstup: models/hiran-v2.3-q4_k_m.gguf (~16-20 GB)
```

### Výstupní soubory na instanci
```
/workspace/hiran-v2.3/
├── checkpoints/stage1_factual/
│   ├── final/              ← Full FT model (BF16, ~65 GB)
│   ├── checkpoint-500/
│   └── checkpoint-1000/
├── evaluation_results/
│   └── eval_report_*.json
├── benchmark_results/
│   ├── benchmark_results.json
│   └── benchmark_report.md
├── models/
│   └── hiran-v2.3-q4_k_m.gguf   ← Quantized model (pro inference)
└── logs/
    └── training_*.log
```

---

## 5. Stažení Modelu na Jiný PC

### Možnost A: rsync (doporučeno — resumable)
```bash
# 1. Zjisti aktuální SSH port
API_KEY="4f86b4afa3f1219cc18708d6a6a2e6476793ae088d0e4e39d2a0baacacd592fd"
PORT=$(curl -s "https://console.vast.ai/api/v0/instances/40780492/?api_key=${API_KEY}" | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('ssh_port',''))")

# 2. Stažení celého checkpointu (BF16, ~65 GB)
rsync -avz --progress \
  -e "ssh -p ${PORT} -i ~/.ssh/vast/hiran_v2.3_key -o StrictHostKeyChecking=no" \
  root@ssh5.vast.ai:/workspace/hiran-v2.3/checkpoints/stage1_factual/final/ \
  ~/HiranV2.3-Model/

# 3. NEBO — stažení jen kvantizovaného modelu (GGUF, ~16-20 GB)
rsync -avz --progress \
  -e "ssh -p ${PORT} -i ~/.ssh/vast/hiran_v2.3_key -o StrictHostKeyChecking=no" \
  root@ssh5.vast.ai:/workspace/hiran-v2.3/models/ \
  ~/HiranV2.3-Model/

# 4. NEBO — benchmark + eval results
rsync -avz \
  -e "ssh -p ${PORT} -i ~/.ssh/vast/hiran_v2.3_key -o StrictHostKeyChecking=no" \
  root@ssh5.vast.ai:/workspace/hiran-v2.3/evaluation_results/ \
  ~/HiranV2.3-Results/
```

### Možnost B: scp (pro menší soubory)
```bash
# Stažení eval reportů
scp -P ${PORT} -i ~/.ssh/vast/hiran_v2.3_key \
  -o StrictHostKeyChecking=no \
  root@ssh5.vast.ai:/workspace/hiran-v2.3/evaluation_results/*.json \
  ~/Downloads/
```

### Možnost C: HuggingFace Hub upload (pokud chceš sdílet)
```bash
# Na instanci, po tréninku:
ssh -p <PORT> -i ~/.ssh/vast/hiran_v2.3_key root@ssh5.vast.ai

pip install huggingface_hub
huggingface-cli login  # zadej svůj token

python -c "
from transformers import AutoModelForCausalLM, AutoTokenizer
import os

model_path = '/workspace/hiran-v2.3/checkpoints/stage1_factual/final'
model = AutoModelForCausalLM.from_pretrained(model_path, trust_remote_code=True)
tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)

# Push to your HF account
model.push_to_hub('yose144/hiran-v2.3-qwen3-32b')
tokenizer.push_to_hub('yose144/hiran-v2.3-qwen3-32b')
print('Uploaded to HuggingFace!')
"
```

---

## 6. Lokální Inference (po stažení)

### Option A: Transformers (přesný, pomalejší)
```bash
# Na tvém lokálním PC
pip install transformers torch

python -c "
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained(
    '~/HiranV2.3-Model/final',
    torch_dtype='bfloat16',
    device_map='auto',
    trust_remote_code=True,
)
tokenizer = AutoTokenizer.from_pretrained('~/HiranV2.3-Model/final', trust_remote_code=True)

messages = [
    {'role': 'system', 'content': 'You are the Zion DAO technical assistant.'},
    {'role': 'user', 'content': 'What is the Zion fee split?'},
]
prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
inputs = tokenizer(prompt, return_tensors='pt').to(model.device)
outputs = model.generate(**inputs, max_new_tokens=200, temperature=0.3)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))
"
```

### Option B: llama.cpp (rychlý, GGUF)
```bash
# Na tvém lokálním PC
pip install llama-cpp-python

python -c "
from llama_cpp import Llama

llm = Llama(
    model_path='~/HiranV2.3-Model/hiran-v2.3-q4_k_m.gguf',
    n_ctx=32768,
    n_gpu_layers=-1,  # offload all to GPU
    verbose=False,
)

output = llm(
    '<|im_start|>system\nYou are the Zion DAO technical assistant.\n<|im_end|>\n'
    '<|im_start|>user\nWhat is the Zion fee split?\n<|im_end|>\n'
    '<|im_start|>assistant\n',
    max_tokens=200,
    temperature=0.3,
    stop=['<|im_end|>'],
)
print(output['choices'][0]['text'])
"
```

---

## 7. Destrukování Instance (až bude hotovo)

```bash
# Zrušení instance ušetří peníze
API_KEY="4f86b4afa3f1219cc18708d6a6a2e6476793ae088d0e4e39d2a0baacacd592fd"
INSTANCE_ID="40780492"

curl -s -X DELETE \
  "https://console.vast.ai/api/v0/instances/${INSTANCE_ID}/?api_key=${API_KEY}"

# Nebo přes dashboard: https://cloud.vast.ai/
```

> **IMPORTANT:** Stáhni model PŘED zrušením instance! Po zrušení jsou data na disku navždy pryč.

---

## 8. Checklist — Post-Training

- [ ] Trénink dokončen (checkpoints/final existuje)
- [ ] Evaluace proběhla (evaluation_results/)
- [ ] Benchmark factual proběhl (benchmark_results/)
- [ ] Model zkvantován na GGUF (models/)
- [ ] Model stažen na lokální PC (rsync nebo HF Hub)
- [ ] Eval reporty staženy
- [ ] Instance zrušena (šetří peníze)

---

## 9. Troubleshooting

| Problém | Řešení |
|---|---|
| `OOM` při tréninku | Snížit `batch_size_per_gpu` na 1, zvýšit `grad_accum` na 64 |
| `Disk full` | Vyčistit staré checkpointy: `rm -rf checkpoints/stage1_factual/checkpoint-*` |
| `SSH refused` | Instance se restartuje, počkej 30s a zkus znovu |
| Training přerušen | DeepSpeed auto-resume z posledního checkpointu |
| Model nestahuje | Na lokálním PC použij `--trust_remote_code=True` |

---

## 10. Reference

| Soubor | Účel |
|---|---|
| `HiranV2.3/scripts/autostart.sh` | Autonomní setup + trénink |
| `HiranV2.3/scripts/deploy-and-train.sh` | Lokální deploy na Vast |
| `HiranV2.3/PRE_FLIGHT_CHECKLIST.md` | Před-tréninková kontrola |
| `HiranV2.3/HARDWARE_COST_ANALYSIS.md` | VRAM výpočty + ceny |
| `HiranV2.3/VAST_INSTANCE_INFO.md` | Instance connection info |
| `StatusV3.md` | Projektový status |

---

*Poslední update: 2026-06-13*  
*Instance: 40780492 | Cost: ~$1.04/hr | GPU: A100 SXM4 x2*
