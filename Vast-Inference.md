# Vast Inference — kompletní návod (2026-10-22)

> **Cíl:** mít na Vast.ai **placenou inference kapacitu** zapnutou na pár kliknutí
> a jednotně ji zpřístupnit: panelu **https://zionterranova.com/vast-rigs/**,
> VS Code **Continue**, L3 **ai-native** a game agentům **OASIS / Issobella**.
>
> **Rozhodující architektonická zásada (2026-10-22):**
> **PC = hub (LM Studio drží modely a je jediný lokální OpenAI-compatible
> endpoint), Vast = čistá výpočetní kapacita (GPU, bez hostingu služeb).**
> Váhy musí být na Vast instanci (remote GPU inference bez vah = nemožné), ale
> **catalog a primární obsluha zůstávají na PC**.
>
> Detail lokální části (LM Studio ↔ Continue, VRAM/TDR pravidla) →
> [`VASTAI-MINING.md`](VASTAI-MINING.md) §5.3–§5.5.
> Nouzová oprava produkční inference → [`AI-NATIVE-HIRAN-REPORT-2026-10-22.md`](AI-NATIVE-HIRAN-REPORT-2026-10-22.md).

---

## 1. Rychlá volba: jakou instanci objednat

Build na cudě **neobcházej** (viz §5) — rozhoduje **image (template)**.

| Varianta | Co dostaneme | Čas do funkčního LLM | Kdy zvolit |
|---|---|---|---|
| **A. Docker + vLLM** | image s `docker: true` → `tools/vast/vast_inference.py deploy` (HF model → vLLM → loopback `:8000`) | **~10 min** (žádný build, jen stahování modelu) | ✅ **výchozí volba** |
| **B. CUDA + llama.cpp** | image `nvidia/cuda_12.4.1-devel-ubuntu22.04/ssh` (bez Dockeru) → build llama.cpp → GGUF → llama-server | **~45–90 min** | když chceme lokální GGUF (fine-tuned ZION model) nebo image nemá Docker |
| **C. Docker instalovaný ručně** | `apt install docker.io` + NVIDIA container toolkit na existující instanci | ~20 min + vLLM image pull | nechceme přegenerovat instanci |

### 1.1 Jak vybrat offer s Dockerem

Vast API (`https://console.vast.ai/api/v0/bundles/`) vrací balíčky; u offeru
(`/api/v0/bundles/?q={"rentable":{"eq":true}}`) je v `bundled_results` /
`bundle_id` flag **`docker`**. V `vastctl.py` je to zatím nevyfiltrované
(`vastctl offers --gpu RTX_3060 --max-dph 0.08`).

Prakticky: při objednání na webu/CLI vyber **template s Dockerem**
(`.../docker` suffix) — pak jde rovnou `vast_inference.py deploy` a
`vast_inference.py` má vše (validace image tagu, loopback bind, health probe).

### 1.2 Cenová realita (57054247, ověřeno 2026-10-22)

```
dph_total        0.0729 $/h   (RTX 3060 12 GB, 16 vCPU, 62 GB RAM)
storage_cost     0.20 $
inet_up/down     0.0039 / 0.0026 $/GB
→ 24 h běhu = ~1.74 $
```

Inference **musí jít přes SSH tunel** (loopback bind) — nikdy nevystavovat
neautentizovaný model API na veřejný internet.

---

## 2. Architektura

```
        ┌─────────────────── PC (dest-zion, dest-zion.local) ───────────────────┐
        │  LM Studio API   127.0.0.1:1234   ← HUB (Gemma 4 E4B, lokální GPU)    │
        │  hiran-core      127.0.0.1:8070   ← ZION fine-tuned 8B (Vulkan)      │
        │  ollama          127.0.0.1:11434  ← malý model pro autocomplete      │
        │                                                                      │
        │  VS Code / Continue ──> LM Studio :1234                               │
        └──────────────┬───────────────────────────────────────────────────────┘
                       │  ssh -L 18000:127.0.0.1:8000  (nebo přes Edge)
                       ▼
        ┌─────────────────── Vast instance (RTX 3060 12 GB) ──────────────────┐
        │  llama-server / vLLM  127.0.0.1:8000   ← loopback jen!              │
        │  + těžba (SRBMiner quantus + pearlhash) pokud se vejde do VRAM      │
        └──────────────────────────────────────────────────────────────────────┘

        ┌─────────────────── EDGE2 (produkce) ────────────────────────────────┐
        │  zion-v31-ai-native :8001  (LLM_BASE_URL=:8004, LLM_FALLBACK=:8002) │
        │  OASIS :8094 / Issobella :8097  (Hiran bridge → OpenAI-compatible)  │
        │  zion-hiran-inference :8002  (CPU záloha, vždy dostupná)            │
        └──────────────────────────────────────────────────────────────────────┘
```

**Port 8000 na instanci je kontrakt** — `vastctl.py` panel ho probeuje defaultně
(`VASTCTL_AI_PORT`, default 8000). Jinak panel ukáže `inference_reachable: false`.

---

## 2.1 Ověřený stav (2026-10-22, instance 57054247)

| Věc | Výsledek |
|---|---|
| Build llama.cpp CUDA | `rust:1.97`-style CUDA build **hotov** (`-DCMAKE_CUDA_ARCHITECTURES=86 -DGGML_CUDA_FA_ALL_QUANTS=OFF`); 120 FA template instancí → 13 |
| Model | `gemma-4-E4B-it-Q4_K_M.gguf` (5.3 GB) + `mmproj-…-BF16.gguf` (991 MB) staženy z HF na instanci (~3 min) |
| Server | `llama-server` běží, **5.0 tok/s** generování / 40.8 tok/s prefill (CUDA, sm_86) |
| VRAM | 5 057 MiB / 12 288 (Gemma ~4.7 GB + 2× SRBMiner ~0.35 GB) |
| Panel `vast-rigs` | `models: ["gemma-4-e4b"]`, **`inference_reachable: true`** ✅ |
| Tunel z PC | `vast-inference-tunnel.service` (user unit) → `http://127.0.0.1:18000/v1` ✅ |
| Rychlost s těžbou | 5.0 tok/s; **bez těžby lze očekávat ~2× víc** (těžba bere 100 % GPU) |
| Odpověď | `ZION je Proof-of-Work (PoW) L1 blockchain vyvinutý v Rustu … (89/5/5/1)` ✅ |

**Start příkaz (kompletní, ověřený):**

```bash
cd /opt/llama.cpp/build/bin
setsid nohup ./llama-server \
  -m /opt/models/gemma-4-E4B-it-Q4_K_M.gguf \
  --mmproj /opt/models/mmproj-gemma-4-E4B-it-BF16.gguf \
  --host 127.0.0.1 --port 8000 --alias gemma-4-e4b \
  -c 32768 --parallel 1 -ngl 999 --flash-attn on \
  --cache-type-k q8_0 --cache-type-v q8_0 -t 8 \
  --reasoning off --chat-template-kwargs '{"enable_thinking":false}' \
  > /tmp/llama-server.log 2>&1 < /dev/null &
echo $! > /tmp/llama-server.pid
```

### 2.2 Gemma 4 E4B je reasoning model — `maxTokens` musí být velký

`--reasoning off` i `enable_thinking:false` **nepomáhají** (šablona modelu si myslí
vždy). Místo toho se celý budget spotřebuje na `reasoning_content` a `content`
zůstane **prázdný**:

| `max_tokens` | reasoning | content | poznámka |
|---|---|---|---|
| 200 | ~620 znaků | **prázdný** | agent/Continue by dostal prázdnou odpověď |
| 300 | ~1 100 znaků | **prázdný** | stejně |
| 800 | 1 623 znaků | ✅ **plná odpověď** (553 tokenů) | bezpečná hodnota |

**Pravidlo:** pro Gemma 4 E4B vždy `maxTokens ≥ 800` (Continue: 2048 ✅).

---

## 2.3 Kde běží co (stav po incidentu 2026-10-22 18:00)

| Role | Kde | Detail |
|---|---|---|
| **primární LLM** | **1070 Ti na PC** (`zion-hiran-cuda.service`) | CUDA sm_61, `hiran-v2.3mini` 8B Q5_K_M, `-ngl 37` (celý model na GPU) → **28 tok/s** |
| **záložní LLM** | Vast 57054247 | CUDA sm_86, `gemma-4-e4b`, 5 tok/s (sdílená GPU s těžbou) |
| **3. úroveň** | EDGE2 CPU (`zion-hiran-inference.service`) | týž GGUF, 2.4 tok/s, vždy dostupná |
| **lokální hub** | LM Studio na PC (`:1234`) | CUDA backend; Gemma 4 E4B se na 8 GB kartu nevejde současně s produkčním modelem → viz `VASTAI-MINING.md` §5.8–5.9 |

> **Proč Vast není primární:** 1070 Ti je na stejném stroji jako LM Studio,
> Continue a desktop agent — plná GPU obsluha bez WAN závislosti a 5× rychlejší.
> Vast je **záloha** (a druhý chat model pro Continue, když 1070 Ti drží
> produkční model).



Předpoklad: instance s Dockerem + NVIDIA container toolkitem.

```bash
cd tools/vast

# 1) najdi a pronájmi instanci (RTX 3060 / 12 GB)
python3 vastctl.py offers --gpu RTX_3060 --max-dph 0.09
python3 vastctl.py rent <OFFER_ID>            # vrátí id instance

# 2) nasaď model (HF ID, ne GGUF) — image je defaultně vllm/vllm-openai:v0.8.5
python3 vast_inference.py deploy <INSTANCE_ID> \
  --model google/gemma-4-e4b \
  --gpu-memory-utilization 0.6 --max-model-len 32768 --yes

# 3) ověř
python3 vast_inference.py status <INSTANCE_ID>

# 4) tunel z PC
python3 vast_inference.py tunnel <INSTANCE_ID> --local-port 18000
curl -s http://127.0.0.1:18000/v1/models
```

`vast_inference.py` už obsahuje bezpečnostní pojistky: jen oficiální
`vllm/vllm-openai` tag (ne `:latest`), **loopback bind** `127.0.0.1:8000`,
odmítnutí přepsat existující kontejner, health probe `/v1/models`,
`--yes` pro neinteraktivní režim.

> **Pozor:** helper umí **jen** HF model ID (`org/model`), neumí GGUF z disku.
> Pro GGUF (fine-tuned ZION) jít varianta B.

---

## 4. Varianta B — CUDA + llama.cpp (bez Dockeru, ~45–90 min)

Ověřeno 2026-10-22 na instanci **57054247** (`ssh1.vast.ai:23934`,
image `nvidia/cuda_12.4.1-devel-ubuntu22.04/ssh`).

### 4.1 Toolchain na instanci (stačí z image, nic nedinstalovat)

```
CUDA 12.4.131 (/usr/local/cuda/bin/nvcc) · cmake 3.22.1 · gcc 11.4 · git 2.34
16 vCPU · 62 GB RAM · 32 GB disk · RTX 3060 (compute capability 8.6)
Docker: NEEXISTUJE  ← proto varianta A není možná bez přepnutí image
```

### 4.2 Build — pozor na dvě pasti

```bash
export PATH=/usr/local/cuda/bin:$PATH
cd /opt/llama.cpp            # git clone --depth 1 https://github.com/ggml-org/llama.cpp.git

cmake -S . -B build \
  -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release \
  -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_BUILD_SERVER=ON \
  -DCMAKE_CUDA_ARCHITECTURES=86 \        # (1) jen SM 8.6 — jinak 8 architektur
  -DGGML_CUDA_FA_ALL_QUANTS=OFF          # (2) jinak 120 FA template instancí

cmake --build build --config Release -j 16 --target llama-server
# -> /opt/llama.cpp/build/bin/llama-server
```

| Past | Co se stane | Řešení |
|---|---|---|
| **(1) výchozí CUDA architektury** | build kompiluje `compute_50,61,70,75,80,86,89,90` → každý ze 71 `.cu` 8× → **> 2 h, skončil na 23 %** | `-DCMAKE_CUDA_ARCHITECTURES=86` (RTX 3060 = sm_86) |
| **(2) FA all-quants** | navíc **120** `template-instances/*.cu` (flash attention pro každý kvant) → hodiny | `-DGGML_CUDA_FA_ALL_QUANTS=OFF` (FA pro hlavní kvanty zůstane, ostatní jdou standardním attention pathem) |

Build běží **na pozadí** (přes `nohup`), log do `/tmp/llama-build.log`:
`nohup bash -c "cmake … && cmake --build …" > /tmp/llama-build.log 2>&1 &`

> ⚠️ **`pkill -f "cmake --build"` zabil i vlastní skript** (matchuje jeho vlastní
> cmdline). Ukončovat build **přes PID** (`pgrep -f "[c]make --build"`) nebo
> bracket-trick (`pkill -f "[n]vcc"`).

### 4.3 Model — stahovat přímo na instanci

| Způsob | Rychlost | Doba pro 5,3 GB |
|---|---|---|
| upload z PC (rsync/scp) | ~1 MB/s | **~1,5 h** ❌ |
| `curl` z HuggingFace **na instanci** | 3,8–30 MB/s | **~3–20 min** ✅ |

```bash
B=https://huggingface.co/lmstudio-community/gemma-4-E4B-it-GGUF/resolve/main
curl -L -C - -o /opt/models/gemma-4-E4B-it-Q4_K_M.gguf      $B/gemma-4-E4B-it-Q4_K_M.gguf
curl -L -C - -o /opt/models/mmproj-gemma-4-E4B-it-BF16.gguf  $B/mmproj-gemma-4-E4B-it-BF16.gguf
```

`-C -` = resumovat pokračovaný download.

### 4.4 Start — loopback, port 8000

```bash
/opt/llama.cpp/build/bin/llama-server \
  -m /opt/models/gemma-4-E4B-it-Q4_K_M.gguf \
  --mmproj /opt/models/mmproj-gemma-4-E4B-it-BF16.gguf \
  --host 127.0.0.1 --port 8000 --alias gemma-4-e4b \
  -c 32768 --parallel 1 -ngl 999 --flash-attn on \
  --cache-type-k q8_0 --cache-type-v q8_0 -t 8
```

`-ngl 999` = vše na GPU (12 GB karta, mining si vezme ~0,4 GB).
`--alias` = jméno modelu, pod kterým ho uvidí Continue i panel.

---

## 5. Panel `https://zionterranova.com/vast-rigs/`

Panel běží jako `APP&WEB/IntroPage/src/app/vast-rigs/page.tsx` (+ `Dashboard.tsx`),
data zajišťuje `tools/vast/vastctl.py` na `127.0.0.1:8088`
(`zion-desktop-agent`-prostředí: user unit `vastctl-serve.service`),
přes nginx `location /vast-ops/` → **basic auth** (`/etc/nginx/.htpasswd-vast`).

```bash
# lokální probe (bez hesla)
curl -s http://127.0.0.1:8088/api/ai/status | python3 -m json.tool
```

```json
{
  "ai_api_port": 8000,
  "rigs": [{
    "id": 57054247, "gpu_name": "RTX 3060",
    "gpus": [{ "memory_total_mib": 12288, "memory_used_mib": 346,
               "utilization_pct": 100, "temperature_c": 76, "power_w": 169.5 }],
    "models": [],                 "<-- po startu serveru: [{ "name": "gemma-4-e4b" }]
    "inference_reachable": false  "<-- po startu serveru: true
  }],
  "totals": { "inference_rigs": 0 }
}
```

**Panel umí jen číst** — nestartuje, nezastavuje a neinstaluje modely
(„read-only pilot“, viz `VASTAI-MINING.md` §5). Deploy je vždy explicitní
akce na konkrétní instanci.

> ⚠️ `utilization_pct: 100` a `power_w: 169` jsou **těžba**, ne inference.
> Panel to neodlišuje — volná VRAM neznamená volný compute (viz poznámka
> v `VASTAI-MINING.md` §5).

---

## 6. Kdo consumeuje Vast inferenci

| Spotřebitel | Cesta | Konfigurace |
|---|---|---|
| **Continue** (VS Code) | `http://127.0.0.1:18000/v1` (tunel) | `~/.continue/config.yaml` → model `provider: lmstudio`, `apiBase: …:18000/v1`, `maxTokens: 4096`, `defaultCompletionOptions.reasoning: true` |
| **ai-native** (EDGE2 `:8001`) | EDGE2 `:8004` → Edge `:8002` → PC `:8070` (dnes) | `LLM_BASE_URL` / `LLM_FALLBACK_URL` v `/etc/systemd/system/zion-v31-ai-native.service` |
| **OASIS / Issobella** | `http://127.0.0.1:8004` na EDGE2 (nebo přímý Vast přes tunel) | `OASIS_HIRAN_ENABLED` / `ISSOBELLA_HIRAN_ENABLED=true` + `*_HIRAN_URL` |

**Jak přidat Vast jako třetího poskytovatele do ai-native:** jednotka má dnes
jen 2 úrovně (primár + fallback). Buď nasadit Vast jako primár přes
`zion-edge-tunnel` + `permitopen` (obdobně jako u `:8004`), nebo doplnit třetí
vrstvu do `generate_answer()` ve `V31/L3/ai-native/src/bin/zion-ai-native-api.rs`
(primár → fallback → echo).

**Bridge timeout 30 s:** `hiran_bridge.rs` (OASIS i Issobella) má
`Duration::from_secs(30)` na HTTP klientovi a `max_tokens: 400`.
→ **Na pomalém endpointu spadne.** Buď rychlá GPU cesta (Vast/CUDA ~30–60 tok/s
→ 400 tokenů za 7–13 s), nebo zvýšit timeout v kódu a znovu nasadit službu.

---

## 7. Checklist pro další session

```bash
# 0) stav panelu a API
curl -s http://127.0.0.1:8088/api/ai/status | python3 -m json.tool | head -30

# 1) je instance zaplacená a běží?
cd tools/vast && python3 vastctl.py status

# 2) ssh na instanci
python3 -c "import sys; sys.path.insert(0,'.'); import vast_inference as v; \
i=v.get_running_instance('57054247'); print(i['ssh_host'], i['ssh_port'])"

# 3) model + server na instanci
ls -la /opt/models/*.gguf
pgrep -af llama-server
curl -s http://127.0.0.1:8000/v1/models        # na instanci

# 4) tunel z PC a test
python3 vast_inference.py tunnel 57054247 --local-port 18000
curl -s http://127.0.0.1:18000/v1/models
curl -s http://127.0.0.1:18000/v1/chat/completions -H 'Content-Type: application/json' \
  -d '{"model":"gemma-4-e4b","messages":[{"role":"user","content":"ahoj"}],"max_tokens":32}'

# 5) panel už to vidí?
curl -s http://127.0.0.1:8088/api/ai/status | grep -E 'inference_reachable|"name"'
```

**Start/stop inference na instanci** (server jako proces — po restartu hosta
znovu spustit; Vast billing běží dál, i když server spadne):

```bash
# stop
pkill -f "llama-server -m /opt/models" ; nvidia-smi   # uvolnit VRAM pro těžbu
# start
nohup /opt/llama.cpp/build/bin/llama-server -m /opt/models/gemma-4-E4B-it-Q4_K_M.gguf \
  --mmproj /opt/models/mmproj-gemma-4-E4B-it-BF16.gguf --host 127.0.0.1 --port 8000 \
  --alias gemma-4-e4b -c 32768 --parallel 1 -ngl 999 --flash-attn on \
  --cache-type-k q8_0 --cache-type-v q8_0 -t 8 > /tmp/llama-server.log 2>&1 &
```

**Zastavit instanci (šetří peníze, panel ukáže offline):**
`python3 vastctl.py stop <INSTANCE_ID>` — pozor, `stop` v tomto helperu
zastavuje **minery**, ne instanci; zrušení pronájmu = Vast UI/API
(`vastai stop instance`).

---

## 8. Pasti (shrnutí)

| Oblast | Past | Řešení |
|---|---|---|
| Build | 8 CUDA architektur defaultně | `-DCMAKE_CUDA_ARCHITECTURES=86` |
| Build | 120 FA template instancí | `-DGGML_CUDA_FA_ALL_QUANTS=OFF` |
| Build | `pkill -f "cmake --build"` zabije vlastní skript | ukončovat přes PID / `[n]vcc` |
| Model | upload z PC = 1 MB/s (1,5 h) | stahovat z HF přímo na instanci |
| Model | 5,3 GB model + 1 GB mmproj = 2× disk | instance 32 GB OK, ale plné disky = smrt |
| Server | `--host 0.0.0.0` = veřejný neautentizovaný LLM | vždy `127.0.0.1` + SSH tunel |
| Panel | `utilization 100 %` = těžba, ne inference | rozlišovat v UI (doplnit) |
| Agent | bridge timeout 30 s vs 400 tokenů | rychlá GPU cesta nebo zvýšit timeout v kódu |
| Model | Gemma 4 E4B = reasoning model | `maxTokens ≥ 800`; `--reasoning off` **nepomáhá** |
| VRAM (PC) | dvě instance téhož modelu | `ps -eo pid,ppid,args \| grep llama-server` → sirotek s `ppid=1` zabít |
| VRAM (PC) | TDR `amdgpu ring comp timeout` | `-ngl` pod volnou VRAM, `--device VulkanN`, `-ub 256` |

---

## 9. Reference

| Cesta | Obsah |
|---|---|
| [`VASTAI-MINING.md`](VASTAI-MINING.md) §5 | Panel, vLLM helper, **LM Studio + Continue**, VRAM/TDR, game agenti |
| [`AI-NATIVE-HIRAN-REPORT-2026-10-22.md`](AI-NATIVE-HIRAN-REPORT-2026-10-22.md) | Produkční LLM řetězec PC ↔ EDGE2, fallback chain, konstytuční prompt |
| `tools/vast/vastctl.py` | Panel backend + `serve` (`:8088`), `offers`, `rent`, `launch`, `stop`, `daemon` |
| `tools/vast/vast_inference.py` | Docker/vLLM deploy helper (validace, loopback, health) |
| `tools/vast/vastctl-serve.service` | user unit pro panelové API |
| `APP&WEB/IntroPage/src/app/vast-rigs/` | UI panelu (`page.tsx`, `Dashboard.tsx`) |
| `~/.continue/config.yaml` | Continue (VS Code) — modely, reasoning budget |
| `~/.lmstudio/.internal/http-server-config.json` | LM Studio API (port, JIT on/off) |
| `~/.lmstudio/settings.json`, `~/.lmstudio/apps/bionic/settings.json` | default kontext modelů (65536) |
| `/etc/systemd/system/zion-v31-ai-native.service` (EDGE2) | `LLM_BASE_URL`, `LLM_FALLBACK_URL` |
| `/etc/zion/edge-environment.sh` (EDGE2) | `ISSOBELLA_HIRAN_*`, `HIRAN_API_URL` (web) |
