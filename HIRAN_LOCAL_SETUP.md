# Hiran v2.2 — Lokální spuštění (AMD RX 5600 XT, Windows)

Tento dokument popisuje jak spustit Hiran v2.2 inference server lokálně
na Windows s AMD GPU RX 5600 XT (8 GB VRAM) a propojit ho s mainnet dashboardem.

---

## TL;DR — Nejrychlejší cesta (Ollama)

```
1. Stáhni Ollama:   https://ollama.com/download
2. Nainstaluj
3. Spusť:           HiranV2.2\inference\start_hiran_ollama.bat
4. Otevři dashboard: http://localhost:8766  → záložka "🤖 Hiran AI"
```

Ale nejprve potřebuješ GGUF soubor — viz Krok 1 níže.

---

## Přehled

| Komponenta | Popis |
|------------|-------|
| Model | Hiran v2.2 (Meta-Llama-3.1-8B-Instruct + ZION QLoRA) |
| Formát | FP16 safetensors → GGUF Q4_K_M (konverze nutná) |
| Velikost GGUF | ~4.5 GB (Q4_K_M) |
| GPU | AMD RX 5600 XT, 8 GB VRAM |
| Port | 8002 (OpenAI-compatible API) |
| Dashboard | http://localhost:8766 → záložka "🤖 Hiran AI" |

---

## Krok 1 — Konverze modelu do GGUF

Model je aktuálně ve formátu FP16 safetensors (~15 GB).
Pro AMD GPU potřebujeme GGUF kvantizaci Q4_K_M (~4.5 GB).

### Prerekvizity

**llama.cpp** musí být nainstalovaný. Máš dvě možnosti:

#### Možnost A: Pre-built binaries (doporučeno)

1. Jdi na https://github.com/ggerganov/llama.cpp/releases
2. Stáhni: `llama-<verze>-bin-win-vulkan-x64.zip`  
   (Vulkan build funguje na AMD GPU bez ROCm)
3. Rozbal do `C:\llama.cpp\`
4. Přidej `C:\llama.cpp\` do PATH nebo nech v `C:\llama.cpp\`

#### Možnost B: Build z kódu

```powershell
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
cmake -B build -DGGML_VULKAN=ON   # AMD GPU přes Vulkan
cmake --build build --config Release -j
```

### Spuštění konverze

```powershell
uv run HiranV2.2\quantization\convert_to_gguf.py
```

Výsledek: `HiranV2.2\models\gguf\hiran-v2.2-q4_k_m.gguf` (~4.5 GB)

---

## Krok 2 — Spuštění inference serveru

### Option A: Ollama (nejjednodušší, doporučeno)

1. Nainstaluj Ollama: https://ollama.com/download
2. Ollama na Windows automaticky detekuje AMD GPU přes DirectML
3. Spusť:

```
HiranV2.2\inference\start_hiran_ollama.bat
```

Server poběží na `http://localhost:8002` (proxy přes Ollama na portu 11434).

**Poznámka k AMD GPU a Ollama:**
- Ollama na Windows podporuje AMD GPU přes ROCm nebo DirectML
- Pokud nemáš ROCm, Ollama automaticky použije CPU fallback
- Pro GPU akceleraci bez ROCm: nainstaluj DirectML backend (viz níže)

### Option B: llama.cpp server (přímý, lepší GPU kontrola)

```
HiranV2.2\inference\start_hiran_llamacpp.bat
```

Server poběží přímo na `http://localhost:8002` s OpenAI-compatible API.

- `GPU_LAYERS=33` — dá všechny vrstvy na GPU (Q4_K_M = ~4.5 GB, vejde se do 8 GB VRAM)
- `GPU_LAYERS=0` — CPU only fallback

**AMD GPU s Vulkan:**
llama.cpp Vulkan build (`llama-*-bin-win-vulkan-x64.zip`) funguje na AMD GPU
bez ROCm. Výkon: ~15-25 tok/s na RX 5600 XT s Q4_K_M.

### Option C: Přímý Python server (bez GPU)

```powershell
pip install flask llama-cpp-python
python HiranV2.2\inference\serve.py `
  --model_path HiranV2.2\models\gguf\hiran-v2.2-q4_k_m.gguf `
  --port 8002
```

CPU only, pomalé (~3-8 tok/s), vhodné pro testování.

---

## AMD GPU — DirectML setup (volitelný, pro Ollama GPU akceleraci)

Pokud chceš GPU akceleraci v Ollama bez ROCm:

1. Nainstaluj DirectML provider:
   ```
   pip install onnxruntime-directml
   ```
2. Nastav proměnnou prostředí:
   ```
   set OLLAMA_GPU_OVERHEAD=0
   ```

> **Poznámka:** ROCm 5.x/6.x je lepší volba pro AMD GPU ale vyžaduje Linux
> nebo WSL2. Pro čistý Windows bez ROCm je Vulkan (llama.cpp) nejspolehlivější.

---

## Krok 3 — Ověření

Hiran běží na portu 8002. Ověř:

```powershell
# Health check
curl http://localhost:8002/health

# Testovací dotaz
curl -X POST http://localhost:8002/v1/chat/completions `
  -H "Content-Type: application/json" `
  -d '{"model":"hiran-v2.2","messages":[{"role":"user","content":"Co je ZION blockchain?"}]}'
```

---

## Krok 4 — Dashboard

Dashboard automaticky detekuje Hiran na portu 8002.

1. Spusť dashboard: `python dashboard\app.py`
2. Otevři: http://localhost:8766
3. Klikni na záložku **🤖 Hiran AI**

Uvidíš:
- Status badge: LIVE / OFFLINE
- Backend info (ollama / llama_cpp / transformers)
- Chat interface s Hiranem
- Rychlé dotazy (fee split, OASIS, Issobella, atd.)

---

## Troubleshooting

### "GGUF model nenalezen"
Spusť nejprve konverzi: `uv run HiranV2.2\quantization\convert_to_gguf.py`

### "Ollama neni nainstalována"
Stáhni z https://ollama.com/download a nainstaluj.

### "llama-server nenalezen"
Stáhni pre-built: https://github.com/ggerganov/llama.cpp/releases  
Hledej: `llama-*-bin-win-vulkan-x64.zip`

### GPU se nepoužívá (CPU fallback)
- Zkontroluj `GPU_LAYERS` v start skriptu (musí být > 0)
- Pro llama.cpp Vulkan: stáhni Vulkan build (ne CUDA build)
- Pro Ollama: nainstaluj AMD ROCm nebo použij llama.cpp přímo

### Pomalé odpovědi (< 5 tok/s)
- Model běží na CPU — aktivuj GPU (viz výše)
- Použij Q4_K_M nebo Q4_0 (menší = rychlejší)
- Sniž `--ctx-size` na 2048

### Port 8002 obsazený
```powershell
netstat -ano | findstr :8002
taskkill /PID <PID> /F
```

---

## Env proměnné pro ZION stack

Aby ZION vrstvy (L4/L5/L6) používaly lokální Hiran:

```bash
# L4 OASIS
set OASIS_HIRAN_URL=http://localhost:8002
set OASIS_HIRAN_ENABLED=true

# L5 Free World
set FREE_WORLD_HIRAN_URL=http://localhost:8002
set FREE_WORLD_HIRAN_ENABLED=true

# L6 Issobella
set ISSOBELLA_HIRAN_URL=http://localhost:8002
set ISSOBELLA_HIRAN_ENABLED=true
```

---

## Výkon — očekávané hodnoty (AMD RX 5600 XT)

| Kvantizace | VRAM | Rychlost (tok/s) | Doporučení |
|-----------|------|------------------|-----------|
| Q4_K_M | ~4.5 GB | 15-25 | **Doporučeno** |
| Q5_K_M | ~5.4 GB | 12-18 | Lepší kvalita |
| Q8_0 | ~8.0 GB | 8-12 | Hranice VRAM! |
| F16 | ~15 GB | — | Nevejde se |

Použij **Q4_K_M** — optimální kompromis kvality a rychlosti pro 8 GB VRAM.

---

*Hiran v2.2 — ZION TerraNova AI Engine*  
*Fine-tuned na Meta-Llama-3.1-8B-Instruct s ZION QLoRA*
