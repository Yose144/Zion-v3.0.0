# Vast.ai → Mining — rychlý návod

Jak najít nejlevnější GPU instanci na Vast.ai a pustit na ní SRBMiner (QTU/PRL/…).

## 0. Jednorázově: Vast.ai CLI

```bash
pip install vastai
vastai set api-key VASK_API_KLIC      # z https://vast.ai/console/cli/
vastai show instances               # kontrola
```

## 1. Najít nejlevnější RTX instanci

```bash
# RTX 3060 seřazené od nejlevnější (jen spolehlivé hosty, volné):
vastai search offers 'gpu_name=RTX_3060 reliability>0.95 num_gpus=1 rentable=true' -o 'dph+'

# jiná karta → změň gpu_name (RTX_3070, RTX_3060_Ti, RTX_3090, ...)
vastai search offers 'gpu_name=RTX_3070 reliability>0.95 num_gpus=1 rentable=true' -o 'dph+'
```

První sloupec = **offer ID**, cena je v sloupci **$/hr**. Typicky RTX 3060 ≈ $0.06–0.08/h.

> ⚠️ Pro ZION Pearl nativní tensor kernely je potřeba **SM80+** (RTX 30xx/40xx). RTX 20xx/2080 Ti (SM75) umí jen fallback — pro čistý SRBMiner je to jedno.

## 2. Pronajmout instanci

```bash
vastai create instance OFFER_ID --image nvidia/cuda:12.4.1-devel-ubuntu22.04 --disk 32 --ssh --direct
# vrátí: new_contract: <INSTANCE_ID>
```

Počkat ~1–3 minuty, pak zjistit SSH endpoint:

```bash
vastai show instance INSTANCE_ID
# → SSH Addr (např. ssh4.vast.ai) + SSH Port (např. 36594)
```

## 3. Připojit se přes SSH

```bash
ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519 root@ssh4.vast.ai -p 36594
# ověření GPU:
nvidia-smi
```

> SSH klíč musí být nahraný v https://vast.ai/console/ (Account → SSH keys) — `id_ed25519`/`id_rsa` podle toho, co máš přidané.

## 4. Nainstalovat a spustit SRBMiner (QTU)

```bash
mkdir -p ~/miners && cd ~/miners &&
wget https://github.com/doktor83/SRBMiner-Multi/releases/download/3.7.9/SRBMiner-Multi-3-7-9-Linux.tar.gz &&
tar xzf SRBMiner-Multi-3-7-9-Linux.tar.gz &&
cd SRBMiner-Multi-3-7-9 &&
chmod +x SRBMiner-MULTI &&
./SRBMiner-MULTI --algorithm quantus --pool eu.lproute.com:5660 --wallet qzjoHwaJ2GfiRSHyYkYcpoJFbHct9pb9EAbs7sE51Uhj8r2zb --worker rig1
```

### Pearl místo Quantus

```bash
./SRBMiner-MULTI --algorithm pearlhash --pool pearl-eu2.luckypool.io:3360 --wallet PRL_WALLET --worker rig1
```

### Těžba na pozadí (přežije odpojení SSH)

```bash
nohup ./SRBMiner-MULTI --algorithm quantus --pool eu.lproute.com:5660 --wallet qzjoHwaJ2GfiRSHyYkYcpoJFbHct9pb9EAbs7sE51Uhj8r2zb --worker rig1 > ~/mine.log 2>&1 &
tail -f ~/mine.log   # sledování logu
```

## 4b. DUAL mining přes náš pool — PRL + QTU v jednom `zion-miner`

Jeden proces, dva GPU streamy, **vše přes `pool.zionterranova.com:8444`**
(V3 Trinity — pool sám routuje PRL → `prlu:` LuckyPool a QTU → `qtun:`
upstream). Žádný SRBMiner sidecar. ZION stream je vypnutý
(`ZION_STREAM1_ENABLED=0`). Vyžaduje SM80+ GPU (RTX 30xx/40xx) pro tensor
kernely; na SM75 (RTX 20xx) PRL běží jen fallback kernelem.

### Referenční měření — SRBMiner dual (2 procesy na 1 kartě)

SRBMiner nemá integrovaný pearlhash+quantus dual mód — "dual" = dva
nezávislé procesy, které si kartu dělí **time-sharingem** (~50/50).
Nesrovnatelné 1:1 s in-process schedulerem `zion-miner`.

```bash
cd ~/miners/SRBMiner-Multi-3-7-9
nohup ./SRBMiner-MULTI --algorithm pearlhash --pool pearl-eu2.luckypool.io:3360 \
  --wallet prl1pwqx7esdehf58j4yqq68q0kts3zy5j2cf8c9gnn9tc3qaj6ptaq6qy35v6h+58CRHqNYCGcDZLUga3YB3NRJwH6Hri7d778aVo5DVifWNusb4Lnc2E7 --worker rig1-prl > ~/srb-prl.log 2>&1 &
nohup ./SRBMiner-MULTI --algorithm quantus --pool eu.lproute.com:5660 \
  --wallet qzjoHwaJ2GfiRSHyYkYcpoJFbHct9pb9EAbs7sE51Uhj8r2zb --worker rig1-qtu \
  > ~/srb-qtu.log 2>&1 &
```

#### Nockchain merge mining (PRL + NOCK)

LuckyPool Pearl běží jako **Nockchain merge pool**: k Pearl walletu se
připojí **nativní Nockchain adresa** oddělená `+` a stejný Pearl hash
pak kromě PRL vydělává i NOCK, vyplácený **na Nockchain** na připojenou
adresu.

| Pravidlo | Detail |
|---|---|
| Formát loginu | `PRL_ADDRESS+NOCK_ADDRESS` (worker jako `PRL_ADDRESS+NOCK_ADDRESS.WORKER`) |
| Nock adresa | **nativní Nockchain**, base58 (písmena/číslice, bez `0`, `O`, `I`, `l`) — **ne** `0x…` wrapped NOCK na Base |
| Payout | Pearl jde na PRL adresu beze změny, NOCK na Nockchain adresu |
| Solo | `solo:PRL_ADDRESS+NOCK_ADDRESS` |
| Staty | `https://nock.luckypool.io/miner-stats/<NOCK>` |
| Wire | Luckypool Pearl **vyžaduje `mining.authorize` s object params** (`type: "v2"`); array params → `params must be an object` |
| Job | Merged i plain login dostávají **identický 76B header, `cert_version: 3`** — SRBMiner merge podporuje bez speciálního kernelu |

NOCK credit se zobrazí jako **samostatný worker** na Nockchain straně poolu
(`nock.luckypool.io/api/stats_address?address=<NOCK>`) a vyplácí se
při nalezení bloku. Pool pro NOCK PRL wallet používá `+NOCK` i ve
vlastním upstream legu (`ZION_POOL_PEARL_UPSTREAM_WALLET`).

**Změřeno (RTX 3060 @170 W, 4 min steady):** PRL **~24.9 TH/s** +
QTU **~107 MH/s** současně (každý ~47–49 % svého solo výkonu).

### Nativní dual — binárka

```bash
# Varianta A — prebuilt z Edge (nemusí obsahovat nejnovější kernely):
cd ~/miners && curl -fsSL -o zion-miner \
  http://62.171.141.136/zion-miner/zion-miner-v31-cuda && chmod +x zion-miner

# Varianta B — vlastní build (doporučeno, ~15 min na 6vCPU):
# na lokálním stroji (z repo root):
rsync -az -e "ssh -i ~/.ssh/id_ed25519 -p PORT" V31/ root@HOST:/root/zion-native/
# na instanci:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal &&
  export PATH=/root/.cargo/bin:$PATH &&
  cd /root/zion-native && cargo build --release -p zion-miner --features gpu-cuda &&
  ln -sf target/release/zion-miner /root/zion-miner
```

### Spuštění — dual PRL+QTU (ZION vypnutý)

```bash
export ZION_MINER_ID=vast-3060 ZION_GPU_BACKEND=cuda ZION_PROFILE=pool \
  ZION_VERBOSE=1 ZION_INTERACTIVE=0 ZION_NO_STICKY=1 ZION_LOG_INTERVAL=15 \
  ZION_STATS_FILE=/root/zion-miner-stats.json ZION_V3_TRINITY=1 \
  ZION_AUTOTUNE=1 ZION_IGNORE_GPU_SELF_TEST_FAIL=1 \
  ZION_STREAM1_ENABLED=0 \
  ZION_STREAM2_ENABLED=1 ZION_STREAM2_FORCE_COIN=PRL ZION_PEARL_K=2048 \
  ZION_STREAM3_ENABLED=0 \
  ZION_STREAM4_ENABLED=1 ZION_STREAM4_FORCE_COIN=QTU ZION_QPOW_BACKEND=cuda \
  ZION_MINER_THREADS=4

# ── max-perf knoby (A/B měřené, PEARL-OPTIMIZATION.md §16-20) ──
export ZION_PEARL_CUMULATIVE_MMA=1     # +1.5 % PRL
export ZION_PEARL_STREAMS=4            # default, explicit
export ZION_PEARL_BATCH=64             # +4.4 % PRL vs 16
# v13 packed-k kernel = default na SM80+; fallback: ZION_PEARL_MINE=v6

# duty split — vyber JEDEN profil:
# (a) PRL-first: PRL 100 / QTU 40 → nejvyšší PRL, QTU drží ~110 MH/s
export ZION_EXT_GPU_TIME_DUTY_PCT=100 ZION_EXT_GPU2_TIME_DUTY_PCT=40
# (b) QTU-focused: PRL 35 / QTU 60 → PRL ~6 TH/s, QTU ~129 MH/s
# export ZION_EXT_GPU_TIME_DUTY_PCT=35 ZION_EXT_GPU2_TIME_DUTY_PCT=60
# (c) free contention 100/100 → scheduler sám rozdělí (~25 % PRL / 75 % QTU)

nohup ./zion-miner --pool pool.zionterranova.com:8444 \
  --wallet ZION_WALLET --worker vast-3060 \
  --gpu cuda --threads 4 --log-interval 15 --v3-trinity \
  > /root/dual.log 2>&1 &
tail -f /root/dual.log
```

### Změřené výkony (RTX 3060 @170 W, 300 s okna, steady-state)

| Profil | PRL | QTU | Pozn. |
|---|---|---|---|
| SRB 2×proc (reference) | ~24.9 TH/s | ~107 MH/s | time-sharing, ne in-process dual |
| nativní 100/40 (PRL-first, v13) | **~24.8 TH/s** | **~110 MH/s** | ≈parita se SRB na obou mincích |
| nativní 100/40 (v6) | ~22.5 TH/s | ~106 MH/s | `ZION_PEARL_MINE=v6` |
| nativní 35/60 (v6) | ~5.9 TH/s | ~129 MH/s | QTU-focused |
| nativní 100/100 free (v13) | ~6.3 TH/s | ~119 MH/s | scheduler jede ~3× víc QTU |
| solo (v13 / v6) | ~27 / ~24 TH/s | ~156 MH/s | horní mez |

PRL se v metrikách zobrazuje v **GH/s** (24.8 TH/s = `24800 GH/s`).

### Kontrola

```bash
tail -f /root/dual.log | grep metrics    # PRL: xx GH/s | QTU: xx MH/s | zion: 0
curl -s 'https://pool.zionterranova.com/public/v1/miner/ZION_WALLET' | python3 -m json.tool
nvidia-smi                               # ~95-100 % util, ~135-170 W
```

### Známé chování / caveat

- **`zion: 0 H/s` v metrics = správně** — banner může říkat "Stream 1 enabled",
  metriky jsou autoritativní.
- **Pool-side fallback:** když je QTU upstream job dočasně stale, pool může
  na gpu2 slot poslat jinou coinu (ZANO). Nejnovější binárka ji s
  `ZION_STREAM4_FORCE_COIN` nastaveným **odmítne a stream počká** (idle)
  — starší buildy ji skutečně těžily. Ověř v `[metrics]`, že stream 4
  ukazuje `QTU`, ne `ZANO`.
- **Výplaty:** PRL/QTU shares jdou přes pool → LuckyPool/upstream
  (`prlu:`/`qtun:` legy). PRL payout sweeper na poolu běží v dry-run —
  finální PRL výplatní cesta je ještě v dokončování (viz AGENTS.md
  2026-10-20 entry).

## 5. AI inference capacity dashboard (read-only pilot)

`/vast-rigs/` includes an AI status panel backed by
`tools/vast/vastctl.py` at `/vast-ops/api/ai/status`. The backend probes each
active instance over SSH for NVIDIA GPU memory, utilization, temperature and
power, then checks a loopback OpenAI-compatible `GET /v1/models` endpoint.
The probe does not install or start models and does not modify mining processes.

By default it checks `http://127.0.0.1:8000/v1/models` on each Vast host.
Override the port on the host running `vastctl-serve` with
`VASTCTL_AI_PORT=<port>` and restart that service. Keep inference bound to the
instance loopback; do not expose an unauthenticated model API to the public
internet. A reachable API with an empty model list means the server answered
but advertised no model.

The summed VRAM figure is an inventory across separate machines, **not pooled
memory**: it cannot by itself load one model across all rigs. The panel also
shows GPU utilization because free VRAM does not mean free compute; current
mining and inference can still contend for GPU time. There is no 80/20
scheduler, automatic miner pause, or automatic Vast rental; model deployment
is an explicit per-instance opt-in below.

### Opt-in vLLM on an existing instance

`tools/vast/vast_inference.py` can start a version-tagged vLLM Docker image on an
already-running Vast instance. It never searches/rents offers, installs a
public-facing service, or changes miner processes. Prerequisites on the rig are
Docker with NVIDIA Container Toolkit, a working `nvidia-smi`, SSH access, and
enough GPU memory for both the model and anything already using the GPU.

```bash
cd tools/vast

# Start a model only after reviewing the instance and model cost/VRAM needs.
python3 vast_inference.py deploy INSTANCE_ID \
  --model Qwen/Qwen2.5-Coder-3B-Instruct \
  --gpu-memory-utilization 0.6

# Check status; stop only the inference container when finished.
python3 vast_inference.py status INSTANCE_ID
python3 vast_inference.py stop INSTANCE_ID

# Print the SSH forwarding command; run it in a separate terminal.
python3 vast_inference.py tunnel INSTANCE_ID --local-port 18000
```

The deploy command prompts before using GPU resources; `--yes` is required for
non-interactive use. It defaults to a 60% vLLM GPU memory target, refuses to
replace an existing named container, binds the API on the remote host to
`127.0.0.1`, restricts the image to the version-tagged official
`vllm/vllm-openai` repository, and reports Docker/SSH failures. After starting
the printed SSH tunnel, configure the Hiran client with
`LLM_BASE_URL=http://127.0.0.1:18000/v1`. Keep the SSH tunnel private and do not
publish the inference port through a firewall or reverse proxy.

`--gpu-memory-utilization` limits vLLM's allocation target; it does **not**
guarantee a matching mining/inference compute split or prevent contention and
OOM if another process already occupies VRAM. Stop inference if mining becomes
unstable. This deploy helper runs one model server on one host; it does not
combine VRAM across separate Vast machines or implement distributed model
parallelism, model scheduling, or automatic rental. Private/gated model
downloads requiring a Hugging Face token are not configured by this helper.

### 5.1 Gemma na Vast instanci (llama.cpp + CUDA) — cesta bez Dockeru

Ověřeno 2026-10-22 na instanci **57054247** (RTX 3060 12 GB, `ssh1.vast.ai:23934`):

| Věc | Stav na instanci |
|---|---|
| Docker | **chybí** → `vast_inference.py deploy` (vLLM v kontejneru) nepoužitelný |
| CUDA | 12.4.131 (`/usr/local/cuda/bin/nvcc`) |
| Toolchain | cmake 3.22.1, gcc 11.4.0, git 2.34.1 |
| CPU / RAM / disk | 16 vCPU / 62 GB / 32 GB |
| GPU | RTX 3060, 12288 MiB, **compute capability 8.6** |
| Těžba | 2× SRBMiner (quantus → `eu.lproute.com:5660`, pearlhash → `pearl-eu2.luckypool.io:3360`) |

**Build — pozor na CUDA architektury.** llama.cpp defaultně kompiluje CUDA
backend pro `compute_50,61,70,75,80,86,89,90` → každý ze 71 `.cu` souborů se
kompiluje 8× (build trval > 2 h a byl na 23 %). RTX 3060 je **sm_86**, stačí
jediná architektura:

```bash
export PATH=/usr/local/cuda/bin:$PATH
cd /opt/llama.cpp
cmake -S . -B build -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release \
      -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_BUILD_SERVER=ON \
      -DCMAKE_CUDA_ARCHITECTURES=86
cmake --build build --config Release -j 16 --target llama-server
# -> /opt/llama.cpp/build/bin/llama-server
```

**Model — stahovat přímo na instanci, ne uploadem z PC.** Upload z PC šel
~1 MB/s (1,5 h pro 5 GB), stažení z HuggingFace přímo na instanci 3,8–30 MB/s
(~3 min):

```bash
B=https://huggingface.co/lmstudio-community/gemma-4-E4B-it-GGUF/resolve/main
curl -L -C - -o /opt/models/gemma-4-E4B-it-Q4_K_M.gguf   $B/gemma-4-E4B-it-Q4_K_M.gguf
curl -L -C - -o /opt/models/mmproj-gemma-4-E4B-it-BF16.gguf $B/mmproj-gemma-4-E4B-it-BF16.gguf
```

> **Model zůstává v LM Studio na PC jako primární (hub) + lokální inference.**
> Vast je *čistá výpočetní kapacita* — bez vlastní kopie vah by remote GPU
> inference nešla (llama.cpp potřebuje váhy vedle GPU). Kopie GGUF na instanci
> je tedy unavoidable, ale **catalog a primární obsluha zůstávají na PC**.

**Start — pouze loopback** (panel i tunel k němu přistupují přes SSH):

```bash
/opt/llama.cpp/build/bin/llama-server \
  -m /opt/models/gemma-4-E4B-it-Q4_K_M.gguf \
  --mmproj /opt/models/mmproj-gemma-4-E4B-it-BF16.gguf \
  --host 127.0.0.1 --port 8000 --alias gemma-4-e4b \
  -c 32768 --parallel 1 -ngl 999 --flash-attn on \
  --cache-type-k q8_0 --cache-type-v q8_0 -t 8
```

`vastctl.py` panel probeuje defaultně `http://127.0.0.1:8000/v1/models`
(přepínač `VASTCTL_AI_PORT`), takže **port 8000 na instanci je kontrakt** —
jinak panel ukáže `inference_reachable: false` a `models: []`.

### 5.2 Přístup k Vast inferenci z PC (SSH tunel)

```bash
cd tools/vast
python3 vast_inference.py tunnel 57054247 --local-port 18000
# -> ssh -N -L 18000:127.0.0.1:8000 -p 23934 root@ssh1.vast.ai
curl -s http://127.0.0.1:18000/v1/models
```

Tunel dává lokální OpenAI-compatible endpoint — stejný tvar jako LM Studio,
takže se do něj dá nasměrovat Continue, ai-native i game agenti.

### 5.3 LM Studio = lokální hub + Continue (VS Code)

**LM Studio** na PC: OpenAI-compatible API na `127.0.0.1:1234`, model
`google/gemma-4-e4b` (VLM, Q4_K_M, 4.97 GB), VRAM ~2.4 GB.

Klíčové konfigy (2026-10-22 ověřeno a opraveno):

| Soubor | Klíč | Hodnota | Proč |
|---|---|---|---|
| `~/.lmstudio/.internal/http-server-config.json` | `justInTimeModelLoading` | `false` | JIT při požadavku spustil **novou** instanci s default ctx 8192 → kontext se resetoval |
| `~/.lmstudio/settings.json` | `defaultContextLength` | `65536` | default kontext pro nově načtené modely |
| `~/.lmstudio/apps/bionic/settings.json` | `defaultContextLength` | `65536` | druhý profil (bionic) — jinak fallback na 8192 |

**Past: Gemma 4 je reasoning model.** Bez správného bugetu je odpověď
**prázdná** — celý `max_tokens` spadne do `reasoning_content`:

| `max_tokens` | reasoning | content |
|---|---|---|
| 120 | 117 | **0 (prázdná odpověď)** |
| 800 | 0 | 56 (správná odpověď) |

**Continue** (`~/.continue/config.yaml`, schema `v1`, extension
`continue.continue-2.0.0`): model `provider: lmstudio` + `apiBase:
http://127.0.0.1:1234/v1` + `apiKey: lm-studio`. Důležitá pole (z
`config-yaml-schema.json`): `maxTokens`, `contextLength`, `capabilities`,
`defaultCompletionOptions.{reasoning, reasoningBudgetTokens, temperature}`.

```yaml
- name: Gemma 4 E4B (LM Studio)
  provider: lmstudio
  model: google/gemma-4-e4b
  apiBase: http://127.0.0.1:1234/v1
  apiKey: lm-studio
  contextLength: 65536
  maxTokens: 4096
  defaultCompletionOptions:
    reasoning: true
    reasoningBudgetTokens: 2048
    temperature: 0.2
  roles: [chat, edit, apply]
  capabilities: [tool_use]
```

`reasoning: true` + `reasoningBudgetTokens` je to, co oddělí reasoning od
odpovědi — bez toho Continue dostane prázdný `content`.

### 5.4 Cílová architektura: PC = hub, Vast = inference kapacita

```
VS Code / Continue ──┐
marketplace agenti ──┼──> LM Studio  127.0.0.1:1234   (Gemma 4 E4B, lokální GPU)
ai-native (EDGE2) ───┘         │
                              ├──> PC GPU: hiran-core :8070 (ZION fine-tuned 8B)
                              └──> ssh -L tunel -> Vast RTX 3060 :8000 (Gemma, CUDA)
```

Každý konzument mluví na **jednom** OpenAI-compatible endpointu (LM Studio),
a provider se přepíná podle potřeby (lokální GPU / Vast burst / CPU záloha).

### 5.5 VRAM a TDR pravidla na PC

Vega 64 (8.1 GB) je sdílená třemi věcmi — rozpočet je těsný:

| Proces | VRAM |
|---|---|
| `hiran-core` (8B Q5_K_M, `-ngl 30`, ctx 4096) | ~4.25 GB |
| LM Studio Gemma 4 E4B (ctx 65536) | ~2.4 GB |
| Firefox + Electron GPU | ~0.5 GB |
| **rezerva** | **~0.6 GB** |

Pravidla (odvozená z TDR incidentů — viz `AGENTS.md` 2026-10-22):

- **`-ngl` držet pod volnou VRAM.** `-ngl 34` s Gemma naloženým dávalo jen
  379 MiB rezervy → riziko `amdgpu ring comp timeout` → `device lost` → core dump.
  `-ngl 30` = 638 MiB rezervy, dlouhý RAG prompt (2620 tok) projde bez TDR.
- **`GGML_VULKAN_DEVICE` se v llama.cpp ignoruje** → vždy `--device Vulkan0`
  (RX Vega) / `Vulkan1` (RX 5600 XT), jinak se model rozdělí mezi obě karty.
- **`-ub 256`** — logits buffer `[ubatch × vocab] f32` je jinak 311 MB @512
  a při dlouhém promptu přeteče do GTT host paměti.
- **Nedouhat dvě instance téhož modelu.** Osiřelý LM Studio backend
  (`llama-server` bez rodice) držel 2107 MiB VRAM → ukončit.
  Kontrola: `ps -eo pid,ppid,args | grep llama-server` — backend s `ppid=1`
  je sirotek.

### 5.6 Game agenti (OASIS L4 / Issobella L6) jako „marketplace AI agents“

Oba servisy mají v repu **Hiran bridge** (OpenAI-compatible `/v1/chat/completions`),
ale v produkci jsou **vypnuté**:

| Služba | Zapnutí | Endpoint |
|---|---|---|
| OASIS (EDGE2 `:8094`) | `hiran_enabled = true` v config TOML | `hiran_endpoint` (default `http://localhost:8002`) |
| Issobella (EDGE2 `:8097`) | `ISSOBELLA_HIRAN_ENABLED=true` | `ISSOBELLA_HIRAN_URL` |

Endpointy ověřené z EDGE2 (2026-10-22):

- `http://127.0.0.1:8002/v1/models` → `zion-l3` (lokální CPU, fine-tuned
  Hiran v2.3mini) — **záloha, nikdy nedostupná**
- `http://127.0.0.1:8004/v1/models` → `hiran-core` (PC GPU přes tunel) — **primární**

> **Pozor na zastaralé defaulty** v `V31/L4/oasis/src/config.rs`:
> `ai_native_endpoint = "http://localhost:8091"` a `ncl_endpoint =
> "http://localhost:8090"` — reálné porty na EDGE2 jsou **8094** (OASIS) a
> **8098** (NCL). Před zapnutím mostů je přepsat.

Mosty nepotřebují změnu kódu — stačí endpoint + enable flag. Bridge volá
`{base_url}/v1/chat/completions` s `max_tokens: 400`, takže fungují s jakýmkoli
OpenAI-compatible serverem (LM Studio, Vast, ai-native záloha).

**Timeout mostu byl zvednut z 30 s na 150 s** (2026-10-22) — 400 tokenů na
3–6 tok/s endpointu = 70–130 s, pevných 30 s odpověď vždy odřízlo:

| Služba | Proměnná | Default |
|---|---|---|
| Issobella | `ISSOBELLA_HIRAN_TIMEOUT_SECS` | 150 |
| OASIS | `OASIS_HIRAN_TIMEOUT_SECS` | 150 |

Ověřeno: `POST /api/v1/ai/evaluate-mission` na Issobella (EDGE2 `:8097`) →
**plná odpověď za 2 min 10 s** (dřív „Hiran nedosažitelný" po 30 s).

**Jak zapnout na OASIS:** `zion-v31-oasis` načítá konfiguraci z TOML, ale
`main.rs` umí i env (`OASIS_HIRAN_ENABLED`, `OASIS_HIRAN_ENDPOINT`) — stačí
přidat do `/etc/zion/edge-environment.sh` a restartovat službu.

```bash
# /etc/zion/edge-environment.sh
ISSOBELLA_HIRAN_ENABLED=true
ISSOBELLA_HIRAN_URL=http://127.0.0.1:8004     # primární: PC GPU přes tunel
ISSOBELLA_HIRAN_TIMEOUT_SECS=150
OASIS_HIRAN_ENABLED=true
OASIS_HIRAN_ENDPOINT=http://127.0.0.1:8004
OASIS_HIRAN_TIMEOUT_SECS=150
```

> **Pozor na zastaralé defaulty** v `V31/L4/oasis/src/config.rs`:
> `ai_native_endpoint = "http://localhost:8091"` a `ncl_endpoint =
> "http://localhost:8090"` — reálné porty na EDGE2 jsou **8094** (OASIS) a
> **8098** (NCL). Před zapnutím mostů je přepsat.

### 5.7 Vast instance jako inference zdroj (stav 2026-10-22)

Instance **57054247** běží s `llama-server` (CUDA, sm_86) + `gemma-4-e4b`
na `127.0.0.1:8000`; panel `vast-rigs` to vidí jako
`models: ["gemma-4-e4b"], inference_reachable: true`.
Z PC je dostupný přes user unit `vast-inference-tunnel.service`
→ `http://127.0.0.1:18000/v1`.

Výkon: **5.0 tok/s** generování / 40.8 tok/s prefill (sdílená GPU s 2× SRBMiner,
100 % util, 76 °C). Bez těžby lze očekávat ~2× víc.

> ⚠️ **Gemma 4 E4B je reasoning model** — `--reasoning off` ani
> `enable_thinking:false` ho nezastaví. Při `max_tokens` 200–300 se celý
> budget spotřebuje na `reasoning_content` a `content` je **prázdný**.
> Vždy `maxTokens ≥ 800` (Continue: 4096).

Kompletní runbook (výběr image, build, deploy, panel, pasti) →
[`Vast-Inference.md`](Vast-Inference.md).

### 5.8 LLM řetězec produkce (2026-10-22 večer) — 1070 Ti primární, Vast záloha

**Incident:** v 06:12 **AMD karta (RADV „Vega 64") zmizela z PCI busu** —
kernel přeregistroval `amdgpu` pro Navi (minor 1) a karta se už neobjevila
v `lspci`. Vulkan backend `llama-server` se tak přesunul na NVIDIA
(nvidia_icd) a **LM Studio backend i hiran-core spadly** → veřejný chat = 503.
Lesson: **GPU nesmí být jediná věc v řetězci** → třívrstvý LLM řetězec.

| Vrstva | Kdo | Rychlost | Dostupnost |
|---|---|---|---|
| **primární** | **1070 Ti na tomhle PC** (`zion-hiran-cuda.service`, CUDA sm_61, `-ngl 37`) → EDGE2 `:8004` | **28 tok/s** (prefill 490) | PC musí běžet |
| **záloha** | **Vast RTX 3060** (57054247) → PC `:18000` → Edge `:8006` → EDGE2 `:8006` | 5 tok/s | placený rig |
| 3. | EDGE2 CPU (`zion-hiran-inference.service`, `:8002`) | 2.4 tok/s | vždy |

```
web /api/ai-chat → EDGE2 ai-native :8001
   LLM_BASE_URL   = http://127.0.0.1:8004/v1   ← 1070 Ti (primární)
   LLM_FALLBACK_URL = http://127.0.0.1:8006/v1 ← Vast (záloha)
   (3. úroveň: http://127.0.0.1:8002/v1 = EDGE2 CPU, kdyby záloha selhala)
```

Veřejný chat po přepojení: **200 za ~7 s** (před incidentem 503 / 120 s timeout).

**CUDA build pro 1070 Ti** (`~/llama-cpp-cuda/`) — na PC není CUDA toolkit
(a gcc 15 = nekompatibilní s CUDA 12.4), proto se binárka **zkompilovala na
Vast instanci** (má CUDA 12.4 + gcc 11) a přenesla se:

```bash
# na Vast instanci
cmake -S . -B build-sm61 -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_CUDA_ARCHITECTURES=61 -DGGML_CUDA_FA_ALL_QUANTS=OFF \
  -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_BUILD_SERVER=ON
cmake --build build-sm61 --config Release -j 16 --target llama-server

# na PC (Vast -> PC ~6 MB/s, ~2 min pro 690 MB knihoven)
rsync -a -e "ssh -p 23934" root@ssh1.vast.ai:/opt/llama.cpp/build-sm61/bin/ ~/llama-cpp-cuda/
rsync -a -e "ssh -p 23934" root@ssh1.vast.ai:/usr/local/cuda/lib64/libcudart.so.12.4.127 \
                             root@ssh1.vast.ai:/usr/local/cuda/lib64/libcublas.so.12.4.5.8 \
                             root@ssh1.vast.ai:/usr/local/cuda/lib64/libcublasLt.so.12.4.5.8 \
                             root@ssh1.vast.ai:/usr/lib/x86_64-linux-gnu/libnccl.so.2.21.5 \
                             ~/llama-cpp-cuda/
```

> ⚠️ **`-ngl 37` je zásadní.** Při `-ngl 30` zůstalo 6 vrstev + `lm_head`
> (1.24 GB) na CPU → **0.9 tok/s** (CPU vytížený miningem). `-ngl 37`
> (vše na GPU) → **28.5 tok/s**. Stejné pravidlo platí pro LM Studio: model,
> který se na GPU nevejde, se rozdělí a CPU-side vrstvy šlápou.

### 5.9 LM Studio na 1070 Ti — tři pasti (2026-10-22)

LM Studio běží jako user unit `lm-studio.service` (automaticky po startu
session). Aby se rozjel a používal CUDA, bylo nutné opravit tři věci:

| Pasta | Příznak | Řešení |
|---|---|---|
| **Electron singleton lock** po hard-killu | app tiše odchází (exit 0, žádný log) | smazat `~/.config/LM Studio/Singleton{Lock,Cookie,Socket}` + `~/.lmstudio/.internal/llmster-pid.lock` |
| **chybějící temp adresář** | `ENOENT: mkdtemp '.../.internal/temp/lmstudio-chat-template-XXX'` | `mkdir -p ~/.lmstudio/.internal/temp` |
| **zastaralý device pin** | `error while handling environment variable "LLAMA_ARG_DEVICE": invalid device: Vulkan0` → engine exit 1 | smazat Vulkan blok z `~/.lmstudio/.internal/hardware-config.json` (nebo restart procesu, ať přezrál hardware) |

Výběr backendu: `~/.lmstudio/.internal/backend-preferences-v1.json`
→ `llama.cpp-linux-x86_64-nvidia-cuda-avx2` (verze 2.62.1).
Runtime jsou v `~/.lmstudio/extensions/backends/` — CUDA i Vulkan varianta
jsou nainstalované, takže přepnutí je jen volba v configu.

**KV cache mimo GPU:** `hardware-config.json` →
`llm.load.offloadKVCacheToGpu = false` → KV cache v systémové RAM (62 GB),
na GPU zůstane místo pro váhy. Bez toho se Gemma na 8 GB kartu nevejde.

**Kapacita 1070 Ti (8 GB, ~1.5 GB si bere desktop):**

| Model | Kontext | Kde běží | Výsledek |
|---|---|---|---|
| **Qwen3-4B** (Q4_K_M, 2.33 GB) | 16384 | GPU celý (`-ngl 37`) | **44 tok/s** ✅ hlavní kodovací model |
| hiran-v2.3mini (8B Q5_K_M, 5.45 GB) | 4096 | GPU celý (`-ngl 37`) | **28 tok/s** ✅ produkce (ZION odpovědi) |
| Gemma 4 E4B (Q4_K_M, 5.3 GB) | 16384 | ~12/24 vrstev GPU | 10 tok/s ⚠️ |
| Gemma 4 E4B | 32768 | 12/24 vrstev GPU | 10 tok/s ⚠️ |
| Gemma 4 E4B | 65536 | — | **nejde** (compute buffery) |

> **Qwen3-4B a hiran-core se na 8 GB kartu nevejdou současně**
> (2.33 + 5.45 > 8 GB) → přepíná se mezi nimi:
> `zion-qwen-cuda.service` (Qwen3-4B, :8070) ⇄ `zion-hiran-cuda.service`
> (hiran-core, :8070). Oba používají port 8070, takže **tunelová konfigurace
> zůstává stejná** a stačí `systemctl --user stop/start` druhé jednotky.
>
> *Režim „kódování“: Qwen3-4B (Continue, 44 tok/s) + produkce na Vastu/EDGE2 CPU.*
> *Režim „produkce“: hiran-core (28 tok/s) + Continue chat přes Vast.*

**Continue (`~/.continue/config.yaml`)** — finální podoba (schema v1):

| Model | Provider / apiBase | Role | ctx | maxTokens | Rychlost |
|---|---|---|---|---|---|
| **Qwen3-4B (local CUDA)** | `lmstudio` → `127.0.0.1:8070/v1` | chat, edit, apply | 16384 | 2048 | **44 tok/s** ✅ hlavní |
| Qwen3.8-27B (Vast RTX 3060) | `lmstudio` → `127.0.0.1:18002/v1` | chat, edit, apply | 16384 | 2048 | těžké úlohy |
| Qwen3.8-27B (LM Studio) | `lmstudio` → `127.0.0.1:1234/v1` | chat, edit, apply | 8192 | 2048 | ~1.3 tok/s ⚠️ |
| Gemma 4 E4B (Vast RTX 3060) | `lmstudio` → `127.0.0.1:18000/v1` | chat, edit, apply | 32768 | 2048 | ~5 tok/s |
| Qwen2.5-Coder 1.5B | `ollama` → `127.0.0.1:11434` | autocomplete | — | — | ~2 tok/s (CPU) |
| Nomic Embed | `lmstudio` → `127.0.0.1:1234/v1` | embed | — | — | 0.03 s |

Všechny role ověřeny reálnými požadavky: chat/edit 200 (2.9 s, korektní
přepis kódu), autocomplete 200 (doplnění kódu), embed 200 (768 dimenzí).
Qwen3-4B běží s `--reasoning-budget 0` → odpověď jde rovnou do `content`
(u reasoning modelu by jinak obsah skončil v `reasoning_content`).

### 5.10 Qwen3.8-27B (16.8 GB) — na naše karty se nevejde

Model `Qwen3.8-27B-Q4_K_M.gguf` = **16.8 GB**. Existují jen kvanty
**Q4_K_M / Q6_K / Q8_0** (žádný menší) → na 8 GB (1070 Ti) ani 12 GB
(RTX 3060) se **nevejde** s použitelnou rychlostí:

| Kde | Rozdělení | Rychlost |
|---|---|---|
| 1070 Ti (8 GB) | 6.3 GB GPU + 9.4 GB RAM | **1.3 tok/s** (a prázdný content) |
| Vast RTX 3060 (12 GB, auto-fit) | 10.6 GB GPU + ~5 GB RAM | **<1 tok/s** (CPU vrstvy + těžba sdílená) |

Pro plný výkon je potřeba **A100 40/80 GB nebo H100** (vast.ai ~1 $/h) —
tam se model vejde celý na GPU.

Drobnosti k tomuto modelu:
- **text-only load**: s `mmproj` (vision projektor, BF16) engine padá na
  `mtmd_init_from_file → ggml_abort` (BF16 není podporovaný na sm_61) →
  soubor `mmproj-Qwen3.8-27B-BF16.gguf` odsunout/odpojit.
- Je to reasoning model → bez dostatečného `maxTokens` je `content` prázdný.

Do té doby je pracovní model pro kódování **Qwen3-4B lokálně (47 tok/s)** a
na Vastu **Gemma 4 E4B** (32k kontext).

### 5.10b Jaký model pro lokální kódování (benchmark 2026-10-22, RTX 1070 Ti)

Všech 8 modelů z LM Studia bylo změřeno na 1070 Ti (CUDA, 8 GB) na dvou
reálných kódovacích úlohách (TypeScript `chunkArray` + React hook
`useFetchWithRetry` s AbortController/retry/backoff/loading):

| Model | KVant | VRAM | tok/s | wall (React hook) | Kvalita kódu |
|---|---|---|---|---|---|
| **Qwen3-4B** | Q4_K_M 2.4 GB | celý na GPU | **48** | **6.7 s** | ✅ všechno (retry + backoff + AbortController), typy `any` |
| Gemma 4 E4B | Q4_K_M 5.0 GB | celý na GPU | 7.0 | 72 s | ✅✅ typované `FetchState<T>` + dokumentace |
| Qwen3-14B | Q4_K_M 8.4 GB | ~6.5 GB GPU + 2 GB RAM | 2.1 | 178 s | ✅ ale **chybí backoff** |
| Qwen3.8-27B | Q4_K_M 16.8 GB | 6.3 GB GPU + 9.4 GB RAM | 1.3 | >260 s | ❌ nepraktický (viz §5.10) |
| Bonsai-27B | Q1_0 3.6 GB | — | — | — | 1 bit/param → pro kód slabý |
| GLM-4.7-Flash / flint | 17–23 GB | — | — | — | nevejdou se |

**Rozhodnutí — rozdělení rolí:**

| Role | Model | Proč |
|---|---|---|
| **chat / edit / apply** | **Qwen3-4B (lokálně, CUDA, :8070)** | 48 tok/s → interaktivní smyčka; kód je kompletní, jen méně typovaný |
| **těžké one-shot refaktory** | Qwen3-14B (:8073) | nejlepší kvalita, ale ~2 tok/s → jen na složité úlohy |
| **autocomplete (inline)** | ollama `qwen2.5-coder:1.5b-base` | **0.09–0.16 s** warm (117 tok/s), první request 6 s (cold start) |
| **embed** | nomic (LM Studio) | 768 dim, 0.03 s |
| alternativa | Gemma 4 E4B (Vast :18000) | 32k kontext, 7 tok/s, nejlepší typy |

> **Autocomplete musí jít přes ollama** — malý model na CPU (ollama 1.5B) je po
> cold startu rychlejší než GPU model (0.09 s vs 0.6 s) a nezabírá VRAM těžbě.
> GPU varianta (Qwen3-1.7B na Navi přes Vulkan, 29 tok/s) byla zkoumána jako
> alternativa, ale 0.6 s na inline completion je horší než 0.09 s z ollama.

**Přepínání těžkého modelu** (Qwen3-4B ↔ Qwen3-14B sdílejí VRAM):

```bash
systemctl --user stop  zion-qwen-cuda.service      # uvolní 1070 Ti
systemctl --user start zion-qwen14-cuda.service    # 14B na :8073 (auto-fit)
# ...a zpět:
systemctl --user stop  zion-qwen14-cuda.service
systemctl --user start zion-qwen-cuda.service
```

### 5.12 „Message exceeds context limit" — příčina a fix

Chybu hází **sám Continue** (`gui/assets/index.js` → `inlineErrorMessage ===
"out-of-context"`): porovná délku promptu s `contextLength` modelu v configu
a odmítne to, aniž by požadavek odeslal.

Dva limity musí sedět:

```
Continue contextLength  +  maxTokens   ≤   server -c
        28672           +    2048      ≤    32768   ✅
```

Původně bylo `contextLength: 16384` a server `-c 16384` → prompt nad 16k
tokenů (system prompt + historie chatu + @-mentionované soubory) spadl.
Fix: server `-c 32768` (KV q8_0 = 2.4 GB, na 8 GB kartě se vešlo) a
`contextLength: 28672` v `~/.continue/config.yaml` (aby prompt + výstup
nepřekročil serverový limit).

> **Tip:** pokud to padá i teď, je to historie chatu — `~/.continue/config.yaml`
> má `disableIndexing: true` (repo se neindexuje), ale @-mentionované soubory
> a předchozí zprávy se sčítají. Nový chat to vyřeší; pro dlouhé kontexty
> přepni na Gemma na Vastu (32k).


### 5.13 OpenSSH `permitlisten` nebere čárku

`authorized_keys` pro tunelový účet **nesmí** mít
`permitlisten="a:1,b:2"` — OpenSSH to neumí parsovat a **celý klíč se odmítne**
(„Permission denied (publickey)"). Musí být dvě samostatné volby:

```
restrict,port-forwarding,permitlisten="127.0.0.1:8002",permitlisten="127.0.0.1:8006",permitopen="127.0.0.1:9",command="/usr/sbin/nologin" ssh-ed25519 AAAA... 
```

Navíc `ssh` musí nabídnout jen jeden klíč jinak spadne na `MaxAuthTries`:
`-o IdentitiesOnly=yes` + `-i <klíč>`.

## 6. CPU mining — XMRig (Monero `rx/0`) vedle GPU minerů

GPU dělá SRBMiner/zion-miner, **CPU na vast instancích jinak idluje** — XMRig
ho vytěží navíc (~300–500 H/s na vCPU → ~2–5 kH/s na 8–12 vCPU).

Reference config: **`xmrig-vast-cpu.json`** (root repa) — laděný pro vast
kontejnery: `rdmsr/wrmsr:false` (kontejner nemá MSR), `rx:null` (auto-vlákna
podle L3), `log-file:/root/xmrig.log`, HTTP API `127.0.0.1:16000` (read-only),
failover `xmr-eu1` pool.

```bash
mkdir -p ~/miners && cd ~/miners &&
wget https://github.com/xmrig/xmrig/releases/download/v6.25.0/xmrig-6.25.0-linux-static-x64.tar.gz &&
tar xzf xmrig-6.25.0-linux-static-x64.tar.gz &&
cd xmrig-6.25.0 && nano config.json          # vlož xmrig-vast-cpu.json obsah
setsid nohup ./xmrig > /dev/null 2>&1 &

tail -f /root/xmrig.log                      # hashrate + accepted
curl -s localhost:16000/2/summary | python3 -m json.tool   # JSON staty
```

## 7. vastctl — správa multi-mining rigů + web UI

`tools/vast/vastctl.py` — jednosouborový Python (stdlib only, jen `vastai` CLI
+ ssh). Inventarizace instancí + probe minerů přes jeden SSH round-trip.

```bash
cd tools/vast
python3 vastctl.py status                # tabulka: ID, GPU, $/h, util, minery, hashraty
python3 vastctl.py logs 57025771         # tail miner logů na rigu
python3 vastctl.py exec 57025771 -- nvidia-smi
python3 vastctl.py deploy-xmrig 57025771 # config+binárka+start (rig-id=vast-<id>-cpu)
python3 vastctl.py serve --port 8088     # web UI http://127.0.0.1:8088 (auto-refresh 30 s)
```

Web UI: karty per instance (GPU util/power/temp, minery + hashrate + A/R,
$/den součet), per-rig exec box + **deploy xmrig** tlačítko.
Hashrate se čte ze SRBMiner logů (`/root/srb-*.log`) a XMRig API —
minery bez log redirectu ukážou `—` (spusť s `> /root/srb-qtu.log 2>&1 &`).
`VASTCTL_READONLY=1` vypne exec/deploy endpointy (veřejný serve mód).

The deployed `vastctl-serve.service` runs a committed release snapshot from
`~/.local/share/vastctl-release/tools/vast`, not directly from the working
checkout. This keeps service restarts isolated from unrelated uncommitted
changes. The Edge reverse tunnel remains loopback-only; `/vast-ops/` is
protected by nginx Basic Auth.

### Daemon — autonomní fleet loop (DEPLOYED)

`vastctl daemon` každých 60 s: probe všech instancí → `status.json`
(s 90bodovou hashrate historií pro sparklines) → `scp` push do edge
webrootu + `--autodeploy-xmrig` (rig bez xmrig → automaticky config+
binárka+launch, fail backoff 10 min).

Live setup (systemd **user** unit `vastctl-daemon.service`, copy v
`tools/vast/`): běží na zionserveru, pushne JSON do
`/var/www/zion-maintenance/vast-rigs/status.json` na edge.

```bash
systemctl --user enable --now vastctl-daemon   # + loginctl enable-linger (už je)
journalctl --user -u vastctl-daemon -f
```

### Skrytá veřejná stránka

`https://zionterranova.com/vast-rigs/` — unlisted ops dashboard
(noindex, nikde nelinkovaná): IntroPage `src/app/vast-rigs/` — client-side
fetch `/vast-rigs/status.json` každých 30 s → karty per rig (GPU metriky,
minery s hashrate + A/R + **sparkline** historie, $/den součet).
Placeholder `public/vast-rigs/status.json` drží adresář v static exportu
(`rsync --delete` by ho jinak smazal). Deploy: `npm run build` +
`ZION_EDGE_HOST=zion-v6 bash deploy/deploy-intro.sh`.

## 8. Vypnutí instance (důležité — jinak utíkají peníze!)

```bash
vastai destroy instance INSTANCE_ID
```

Instance se účtuje za hodinu včetně doby, kdy je "stopped" — data na disku stojí i po zničení... ne, jen běží-li/stopped. **Destroy = konec účtování GPU; neuložená data zmizí.**

## Poznámky

- **SSH endpoint se může měnit** po restartu instance → vždy `vastai show instance ID`.
- Výkon stejné karty se liší podle hostitele (power limit, PCI, "silicon lottery") — SRB pearlhash na RTX 3060 ~21–49 TH/s, quantus ~200–225 MH/s.
- Pro vlastní nativní `zion-miner` build je potřeba Rust + rsync workspace (viz `V31/scripts/vast-triple-mine.sh`).
