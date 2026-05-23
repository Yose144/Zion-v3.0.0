# Hiran v2.2 — Lokální spuštění (AMD RX 5600 XT, Windows)

Tento dokument popisuje jak spustit Hiran v2.2 inference server lokálně
na Windows s AMD GPU RX 5600 XT (8 GB VRAM) a propojit ho s mainnet dashboardem.

---

## ✅ STATUS (2026-05-23) — GGUF připraven, llama-server k dispozici

| Soubor | Cesta | Stav |
|--------|-------|------|
| Q4_K_M GGUF | `HiranV2.2\models\hiran-v2.2-merged\hiran-v2.2.q4_k_m.gguf` | ✅ 4.6 GB |
| F16 GGUF | `HiranV2.2\models\hiran-v2.2-merged\hiran-v2.2.f16.gguf` | ✅ 15 GB |
| llama-server.exe | `llama.cpp-bin\llama-server.exe` | ✅ build b4524 |
| start skript | `scripts\start-hiran-inference.ps1` | ✅ auto-detekce backendu |

---

## TL;DR — Nejrychlejší spuštění (2026)

```powershell
# Z ZION dashboardu (http://localhost:8766):
#   Záložka "🤖 Hiran AI" → karta "Hiran Inference" → ▶ Start

# Nebo ručně (PowerShell):
scripts\start-hiran-inference.ps1

# Ověření:
curl http://localhost:8002/health
```

Skript **automaticky** najde `llama-server.exe` + GGUF Q4_K_M a spustí je.

---

## Přehled

| Komponenta | Popis |
|------------|-------|
| Model | Hiran v2.2 (Meta-Llama-3.1-8B-Instruct + ZION QLoRA) |
| GGUF Q4_K_M | `HiranV2.2\models\hiran-v2.2-merged\hiran-v2.2.q4_k_m.gguf` (~4.6 GB) |
| GGUF F16 | `HiranV2.2\models\hiran-v2.2-merged\hiran-v2.2.f16.gguf` (~15 GB) |
| Inference server | `llama.cpp-bin\llama-server.exe` (build b4524, AVX2) |
| GPU | AMD RX 5600 XT, 8 GB VRAM (nebo CPU fallback) |
| Port | 8002 (OpenAI-compatible API) |
| Dashboard | http://localhost:8766 → záložka "🤖 Hiran AI" |
| Desktop Agent | Záložka "Hiran AI" → Status panel |
| Website | `HiranyagarbhaChat` widget → /api/ai-chat → port 8002 |

---

## Backend priorita (`start-hiran-inference.ps1`)

1. **llama-server.exe + Q4_K_M GGUF** — nejrychlejší, není třeba Python
2. **LM Studio** (port 1234) — pokud je spuštěn a načten model
3. **Ollama** (port 11434) — fallback
4. **serve.py + GGUF** (llama-cpp-python) — Python fallback

---

## GPU akcelerace (Vulkan / AMD)

```powershell
# Nastav počet vrstev na GPU (0 = CPU only, 33 = full GPU):
$env:HIRAN_GPU_LAYERS = "20"   # ~6 GB VRAM pro RX 5600 XT
scripts\start-hiran-inference.ps1
```

---

## Krok 1 — Konverze modelu do GGUF (pokud chybí)

> **GGUF soubory již existují** — tento krok přeskočíš.
> Postup níže je jen pro případ, že bys model znovu konvertoval.

Model je ve formátu FP16 safetensors (~15 GB).
Pro AMD GPU doporučujeme GGUF kvantizaci Q4_K_M (~4.6 GB).

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
