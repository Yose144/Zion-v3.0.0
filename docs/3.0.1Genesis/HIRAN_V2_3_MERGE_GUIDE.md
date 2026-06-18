# Hiran v2.3 - Kompletni pruvodce merge a GGUF konverzi

> Dokumentace procesu vytvoreni Q5_K_M GGUF modelu pro Hiran v2.3
> Datum: 2025-08-22
> Autor: Devin AI + Yosef

## Prehled

Tento dokument popisuje kompletni proces vytvoreni merged Q5_K_M GGUF modelu pro **Hiran v2.3** zalozeneho na **Qwen3-32B** s aplikovanym **LoRA adapterem** (checkpoint-8000).

### Vysledny model
- **Soubor**: `D:\Hiran\HiranV2.3\models\hiran-v2.3-8000-q5_k_m.gguf`
- **Velikost**: 21.62 GB
- **Format**: GGUF v3 (Q5_K_M kvantizace)
- **VRAM pozadavky**: 22-24GB (vhodne pro RTX 3090/4090)

---

## 1. Pozadavky a prostredi

### Hardware
- **RAM**: Min. 32GB (pro layer-by-layer merge)
- **Disk**: Min. 300GB volneho mista (pro mezisoubory)
- **GPU**: Nepovinne (merge se provadi na CPU)

### Software
- Python 3.10+
- PyTorch (CPU verze)
- transformers, safetensors
- llama.cpp (convert_hf_to_gguf.py + llama-quantize.exe)

### Dulezite cesty
```
D:\Hiran\HiranV2.3\                                    # Hlavni pracovni adresar
D:\Hiran\HiranV2.3\models\qwen\Qwen3-32B\             # Base model (62GB HF)
D:\Hiran\HiranV2.3\HiranV2.3-Checkpoints\             # LoRA checkpointy
D:\Hiran\HiranV2.3\HiranV2.3-Checkpoints\checkpoint-8000   # Pouzity LoRA
D:\Hiran\HiranV2.3\llama-cpp\                        # llama.cpp source
D:\Hiran\HiranV2.3\scripts\                          # Skripty
```

---

## 2. Krok 1: Layer-by-layer Merge

### Problem
Standardni merge (`PeftModel.from_pretrained + merge_and_unload`) vyzaduje 64GB+ RAM pro 32B model. S 32GB RAM selhava OutOfMemory.

### Reseni
Vlastni skript pro layer-by-layer merge pomoci safetensors - nacita a zpracovava modely po vrstvach.

### Skript: merge_layer_by_layer.py

```python
import torch
from safetensors import safe_open
from safetensors.torch import save_file
import json
import os
import shutil

BASE_DIR = r'D:\Hiran\HiranV2.3\models\qwen\Qwen3-32B'
CKPT = r'D:\Hiran\HiranV2.3\HiranV2.3-Checkpoints\checkpoint-8000'
OUT_DIR = r'D:\Hiran\HiranV2.3\models\hiran-v2.3-merged-FIXED'
os.makedirs(OUT_DIR, exist_ok=True)

# 1. Nacti LoRA
lora_weights = {}
with safe_open(os.path.join(CKPT, 'adapter_model.safetensors'), 
               framework='pt', device='cpu') as f:
    for key in f.keys():
        lora_weights[key] = f.get_tensor(key)

print(f'LoRA nactena: {len(lora_weights)} tensoru')

# 2. Ziskej konfiguraci
with open(os.path.join(BASE_DIR, 'config.json')) as f:
    config = json.load(f)
with open(os.path.join(CKPT, 'adapter_config.json')) as f:
    lora_config = json.load(f)

alpha = lora_config['lora_alpha']
r = lora_config['r']
scale = alpha / r
print(f'LoRA scale: {scale}')

# 3. Zkopiruj config a tokenizer
shutil.copy(os.path.join(BASE_DIR, 'config.json'), OUT_DIR)
shutil.copy(os.path.join(BASE_DIR, 'tokenizer.json'), OUT_DIR)
shutil.copy(os.path.join(BASE_DIR, 'tokenizer_config.json'), OUT_DIR)

# 4. Zpracuj kazdy safetensors soubor zvlast
with open(os.path.join(BASE_DIR, 'model.safetensors.index.json')) as f:
    index = json.load(f)

weight_map = index['weight_map']
unique_files = sorted(set(weight_map.values()))

print(f'Zpracovavam {len(unique_files)} souboru...')

for file_name in unique_files:
    print(f'  {file_name}...', flush=True)
    tensors = {}
    
    with safe_open(os.path.join(BASE_DIR, file_name), 
                   framework='pt', device='cpu') as f:
        for key in f.keys():
            tensor = f.get_tensor(key)
            
            # Hledej LoRA pro tento tensor
            lora_a_key = f'base_model.model.model.{key}.lora_A.weight'
            lora_b_key = f'base_model.model.model.{key}.lora_B.weight'
            
            if lora_a_key in lora_weights and lora_b_key in lora_weights:
                A = lora_weights[lora_a_key]
                B = lora_weights[lora_b_key]
                # W_merged = W + scale * B @ A
                delta = scale * (B @ A)
                tensor = tensor + delta.to(tensor.dtype)
                print(f'    Aplikovano LoRA: {key}')
            
            tensors[key] = tensor
    
    # Uloz vysledek
    out_path = os.path.join(OUT_DIR, file_name)
    save_file(tensors, out_path)
    print(f'    Ulozeno: {out_path}')

# 5. Uloz novy index
new_index = {
    'metadata': index.get('metadata', {}), 
    'weight_map': weight_map
}
with open(os.path.join(OUT_DIR, 'model.safetensors.index.json'), 'w') as f:
    json.dump(new_index, f, indent=2)

print('MERGE DOKONCEN!')
```

### Vysledek merge
- 17 safetensors souboru (3.63GB kazdy, posledni 2.85GB)
- Celkem: ~61GB
- Vsechny LoRA adaptace aplikovany (896 tensoru)

---

## 3. Krok 2: Konverze na F16 GGUF

### Priprava llama.cpp
```bash
# Stahni llama.cpp (nebo pouzij existujici)
git clone https://github.com/ggerganov/llama.cpp.git

# Instaluj Python zavislosti
pip install -r llama.cpp/requirements/requirements-convert_hf_to_gguf.txt
```

### Konverze
```bash
python llama.cpp/convert_hf_to_gguf.py \
  --outfile hiran-v2.3-8000-f16.gguf \
  --outtype f16 \
  hiran-v2.3-merged-FIXED/
```

### Vysledek
- F16 GGUF: ~61GB
- 707 tensoru
- Architektura: Qwen3ForCausalLM
- 64 vrstev, 5120 embedding dim, 25600 FFN dim

---

## 4. Krok 3: Kvantizace na Q5_K_M

### Stazeni llama-quantize
```bash
# Stahni pre-build binarky z GitHub Releases
curl -L -o llama-bin.zip \
  "https://github.com/ggerganov/llama.cpp/releases/download/b9562/llama-b9562-bin-win-cpu-x64.zip"

# Rozbal
unzip llama-bin.zip -d llama-cpp-bin/
```

### Kvantizace
```bash
llama-quantize.exe \
  hiran-v2.3-8000-f16.gguf \
  hiran-v2.3-8000-q5_k_m.gguf \
  q5_k_m
```

### Parametry kvantizace
| Tensor | Puvodni typ | Cilovy typ | Uspora |
|--------|-------------|------------|--------|
| Vahy (mimo norm) | F16 | Q5_K / Q6_K | ~66% |
| Normalizacni vahy | F32 | F32 | 0% |
| Token embeddings | F16 | Q5_K | ~66% |

### Vysledek
- Q5_K_M GGUF: **21.62 GB**
- Kompresni pomer: 3.5:1 (z 61GB na 22GB)

---

## 5. Krok 4: Uklid

### Smaz mezisoubory
```powershell
Remove-Item hiran-v2.3-8000-f16.gguf   # 61 GB
Remove-Item hiran-v2.3-8000-q8_0.gguf  # 32 GB (pokud existuje)
```

Celkem uvolneno: **93 GB**

---

## 6. Inference

### Spusteni serveru
```batch
@echo off
echo Spoustim Hiran v2.3 Q5_K_M server...

set MODEL=D:\Hiran\HiranV2.3\models\hiran-v2.3-8000-q5_k_m.gguf

python -c "
from llama_cpp import Llama
from llama_cpp.server.app import create_app
import uvicorn

llm = Llama(
    model_path=r'%MODEL%',
    n_ctx=32768,
    n_threads=8,
    verbose=False
)
app = create_app(llm=llm)
uvicorn.run(app, host='0.0.0.0', port=8080)
"
```

### API Endpoint
- URL: `http://localhost:8080/v1/chat/completions`
- Format: OpenAI-compatible

### Priklad dotazu
```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "hiran-v2.3",
    "messages": [{"role": "user", "content": "What is Zion blockchain?"}],
    "temperature": 0.7,
    "max_tokens": 512
  }'
```

---

## 7. Hardware doporuceni

### Optimalni GPU
| GPU | VRAM | Odhadovana rychlost | Poznamka |
|-----|------|---------------------|----------|
| RTX 4090 | 24GB | ~30-40 tok/s | Nejlepsi pomer cena/vykon |
| RTX 3090 | 24GB | ~25-35 tok/s | Dobra alternativa |
| A100 40GB | 40GB | ~40-50 tok/s | Profesionalni reseni |

### Poznamky k vykonu
- n_ctx=32768 vyuziva plnou kontextovou delku
- n_threads=8 optimalizovano pro moderni CPU
- Pri pouziti GPU pridat: `n_gpu_layers=-1` (vsechny vrstvy na GPU)

---

## 8. Reseni problemu

### Problem: "OutOfMemory" pri merge
**Reseni**: Pouzij layer-by-layer merge skript misto standardniho `PeftModel.merge_and_unload()`.

### Problem: "requantizing from type q8_0 is disabled"
**Reseni**: llama-quantize neumi prevadet q8_0 -> q5_k_m. Musis nejprve vytvorit f16 GGUF.

### Problem: SSH na Vast AI nefunguje
**Reseni**: Pouzij lokalni merge s layer-by-layer pristupem (funguje s 32GB RAM).

### Problem: "torch_dtype is deprecated"
**Reseni**: Jen varovani, neni to chyba. Muzes ignorovat nebo pouzit `dtype` misto `torch_dtype`.

---

## 9. Archivace

### Dulezite zalohy
1. **LoRA checkpoint-8000**: `D:\Hiran\HiranV2.3\HiranV2.3-Checkpoints\checkpoint-8000`
2. **Base model**: `D:\Hiran\HiranV2.3\models\qwen\Qwen3-32B`
3. **Merged HF model**: `D:\Hiran\HiranV2.3\models\hiran-v2.3-merged-FIXED`
4. **Finalni GGUF**: `D:\Hiran\HiranV2.3\models\hiran-v2.3-8000-q5_k_m.gguf`

### Mazatelne mezisoubory
- `hiran-v2.3-8000-f16.gguf` (61GB)
- `hiran-v2.3-8000-q8_0.gguf` (32GB)
- `llama-cpp-win.zip` (16MB)

---

## 10. Zdroje a odkazy

- **llama.cpp**: https://github.com/ggerganov/llama.cpp
- **Qwen3-32B**: https://huggingface.co/Qwen/Qwen3-32B
- **Hiran v2.3 dokumentace**: HIRAN_V2_3_CONTEXT.md
- **Spousteci skript**: `D:\Hiran\HiranV2.3\start-q5_k_m.bat`

---

*Generovano s pomoci Devin AI (https://cli.devin.ai/docs)*
*Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>*
