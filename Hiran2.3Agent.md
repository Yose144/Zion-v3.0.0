# Hiran v2.3 Agent — Master Plan

> Cíl: Po dokončení tréninku mít Hiran v2.3 jako lokální AI interface
> přes RTX 3090 z Vast AI — **bez zbytečného přenosu 20 GB.**

---

## Přehled architektury (doporučená varianta)

```
┌────────────────────────────────────────────────────────────┐
│  Tvůj Windows lokál                                        │
│                                                            │
│  zion-agent (CLI)  ──────────────── LM Studio / API       │
│       │                                   │                │
│       │                          localhost:8080            │
│       │                                   │                │
│       └── SSH local-forward tunnel ───────┘                │
│                    │                                       │
└────────────────────┼───────────────────────────────────────┘
                     │ SSH -L 8080:localhost:8080
                     │
┌────────────────────┼───────────────────────────────────────┐
│  Vast AI — RTX 3090 instance                               │
│                                                            │
│  llama-server / llama.cpp ◄── GGUF model (20 GB on disk)  │
│       (localhost:8080)                                     │
│                                                            │
│  GGUF se přenese A100 → RTX 3090 přímo (Vast síť)        │
│  Lokál se jen připojuje přes API — žádný download!        │
└────────────────────────────────────────────────────────────┘
```

**Klíčová myšlenka:** GGUF model (20 GB) se přenese **přímo mezi instancemi Vast AI**
(A100 tréninková → RTX 3090 inference) — rychlé, protože obě jsou ve stejné síti.
Lokální PC se pak připojuje jen přes SSH **local-forward** tunel (`-L`) na API
endpoint (`http://localhost:8080/v1`). Žádný 20 GB download/upload na lokál!

### Proč NE reverse tunel (čtení modelu z lokálu)

> **Nápad:** "Stáhnu GGUF lokálně, půjčím RTX 3090, ať si ho načte z mého PC přes tunel."

**Problém:** llama-server musí načíst celý 20 GB model do VRAM. Přes SSH tunel přes
internet by to trvalo **hodiny** (propustnost ~10-50 MB/s) a každý token by šel přes
síť s latencí 50-100 ms. Inference by byla pomalejší než na CPU lokálně.

**Reverse tunel (`-R`) je vhodný jen pro:**
- Exponování lokálního API na veřejný port (např. pro webhooky)
- Krátké přenosy dat, ne 20 GB soubory

**Správné řešení pro "bez přenosu 20 GB":**

| Varianta | GGUF umístění | Přenos 20 GB? | Jak se lokál připojí |
|----------|---------------|---------------|----------------------|
| **A (doporučená)** | RTX 3090 (Vast) | **Ne** — A100→RTX přímo | SSH `-L` tunel na API |
| **B (záloha)** | Lokál + lokální inference | Ano — jednou stáhnout | Přímo lokální port |
| **C (nevhodná)** | Lokál, inference na RTX | Ne, ale... | SSH `-R` + čtení 20 GB přes síť ❌ |

**Tento plán používá variantu A** — GGUF zůstává na cloudu, lokál mluví přes tunel.

---

## Fáze 1 — Dokončení tréninku a export

### 1.1 Monitoring zbývajících checkpointů

| Krok | Odhadovaný čas | Status |
|------|----------------|--------|
| 7000 | ~14:00 (dnes) | server ready, lokál chybí |
| 7500 | ~15:00 | čeká |
| 8000 | ~16:00 | čeká |
| 8500 | ~17:00 | čeká |
| 8901 | ~18:00 | **finální** |

Stahujeme každý checkpoint ihned po uložení pomocí:

```powershell
# Windows PowerShell
cmd /c "scp -P 31384 -i %USERPROFILE%\.ssh\vast\hiran_v2.4_key -o StrictHostKeyChecking=no root@ssh1.vast.ai:/workspace/hiran-v2.3/checkpoints/stage1_factual/checkpoint-7000/adapter-7000.part-aa %USERPROFILE%\HiranV2.3-Checkpoints\checkpoint-7000\"
# ... (nebo via zion-agent checkpoint-pull 7000)
```

### 1.2 Merge LoRA → merged HF model (na tréninkovém serveru)

**Nepřenášíme base model (~60 GB)** — vše se odehraje na Vast A100 instanci,
kde je disk 500 GB a RAM 1.4 TB.

```bash
# Na A100 tréninkovém serveru (po konci tréninku)
cd /workspace/hiran-v2.3
python scripts/merge_and_export.py \
  --checkpoint checkpoints/stage1_factual/checkpoint-8901 \
  --base-model Qwen/Qwen3-32B \
  --output /workspace/hiran-v2.3-merged \
  --gguf-output /workspace/hiran-v2.3-final-q5.gguf \
  --quantization q5_k_m
```

**Skript je na serveru:** `/workspace/hiran-v2.3/scripts/merge_and_export.py`

**Časová náročnost na A100:**
- Download Qwen3-32B base model: ~15 min (2× A100, rychlé NVLink)
- Merge LoRA: ~3 min
- GGUF konverze q5_k_m: ~10 min
- Celkem: ~30 min

**Velikosti:**
```
Merged HF model:     ~65 GB  (na serveru, dočasně)
GGUF q5_k_m:         ~20 GB  (FINÁLNÍ soubor)
GGUF q4_k_m:         ~14 GB  (alternativa, menší)
```

### 1.3 Stažení GGUF na lokál

```powershell
# Stažení ~20 GB (odhadovaný čas: 20-40 min)
cmd /c "scp -P 31384 -i %USERPROFILE%\.ssh\vast\hiran_v2.4_key root@ssh1.vast.ai:/workspace/hiran-v2.3-final-q5.gguf %USERPROFILE%\HiranModels\"

# Ověření (MD5)
ssh -p 31384 root@ssh1.vast.ai "md5sum /workspace/hiran-v2.3-final-q5.gguf"
# vs.
Get-FileHash $env:USERPROFILE\HiranModels\hiran-v2.3-final-q5.gguf -Algorithm MD5
```

### 1.4 Bezpečné ukončení A100 instance

```bash
# Na A100 serveru — ověřit stav před ukončením
ls -lh /workspace/hiran-v2.3/checkpoints/stage1_factual/checkpoint-8901/
md5sum /workspace/hiran-v2.3-final-q5.gguf

# Lokálně ověřit MD5
# Pokud souhlasí → instance lze bezpečně ukončit z Vast dashboard
```

**NIKDY neukončovat instanci bez:**
1. ✅ GGUF stažen lokálně
2. ✅ MD5 souhlasí
3. ✅ Final checkpoint (adapter_model.safetensors) stažen
4. ✅ Trénink `DONE` v logu

---

## Fáze 2 — Přenos GGUF na RTX 3090 (server-to-server)

### 2.1 Proč ne stáhnout na lokál a pak uploadovat?

- **Download 20 GB na lokál** = 20-40 min (záleží na připojení)
- **Upload 20 GB z lokálu na RTX 3090** = dalších 20-40 min
- **Server-to-server** (A100 → RTX 3090 ve Vast síti) = **2-5 min** (1 Gbps+ backbone)

### 2.2 Spuštění RTX 3090 instance na Vast AI

1. Vast dashboard → "Create Instance"
2. Vyber RTX 3090 (24 GB VRAM)
3. SSH port si poznamenej (např. `12345`)
4. Spusť instanci, počkej na boot

### 2.3 Přenos GGUF z A100 na RTX 3090 (přímo)

**Metoda A: scp server-to-server (nejrychlejší)**

Na A100 tréninkové instanci:
```bash
# Nejdřív ověř že GGUF existuje
ls -lh /workspace/hiran-v2.3-final-q5.gguf

# Přenos přímo na RTX 3090
# Zjisti SSH host RTX 3090 z Vast dashboardu (např. ssh2.vast.ai:12345)
scp -P 12345 -o StrictHostKeyChecking=no \
  /workspace/hiran-v2.3-final-q5.gguf \
  root@ssh2.vast.ai:/workspace/hiran-v2.3-final-q5.gguf
```

**Metoda B: HTTP server na A100 + wget na RTX**
```bash
# Na A100:
cd /workspace && nohup python3 -m http.server 9999 &

# Na RTX 3090:
wget http://<a100-internal-ip>:9999/hiran-v2.3-final-q5.gguf
```

**Metoda C: rsync (pokud dostupné)**
```bash
rsync -avz --progress \
  /workspace/hiran-v2.3-final-q5.gguf \
  root@ssh2.vast.ai:/workspace/
```

> ⚠️ **Důležité:** Nezapomeň na A100 instanci ukončit HTTP server po přenosu:
> `pkill -f "python3 -m http.server"`

### 2.4 Ověření přenosu

```bash
# Na RTX 3090 instanci:
ls -lh /workspace/hiran-v2.3-final-q5.gguf
md5sum /workspace/hiran-v2.3-final-q5.gguf

# Srovnej s A100:
# ssh root@ssh1.vast.ai -p 31384 "md5sum /workspace/hiran-v2.3-final-q5.gguf"
```

### 2.5 A100 instance může být nyní bezpečně ukončena

```bash
# Na A100 — ověř že máme vše:
# - Final checkpoint stažen lokálně ✅
# - GGUF přenesen na RTX 3090 ✅
# - MD5 souhlasí ✅

# Pak ukonči z Vast dashboardu (nebo: shutdown -h now)
```

### 2.6 Nastavení llama-server na RTX 3090

```bash
# Na RTX 3090 instanci (Vast AI)
cd /workspace/llama.cpp && make LLAMA_CUDA=1 -j$(nproc) || \
  (git clone --depth 1 https://github.com/ggerganov/llama.cpp && cd llama.cpp && make LLAMA_CUDA=1 -j$(nproc))

# Spuštění inference serveru
./llama-server \
  --model /workspace/hiran-v2.3-final-q5.gguf \
  --host 0.0.0.0 \
  --port 8080 \
  --n-gpu-layers 99 \
  --ctx-size 8192 \
  --n-predict 2048 \
  --threads 8
```

---

## Fáze 3 — SSH Local-Forward Tunel

### 3.1 Topologie

```
Lokál:8080 ←──SSH -L──→ RTX3090:8080 (llama-server)
     ↑
zion-agent (http://localhost:8080/v1)
```

Lokální port `8080` je přesměrován na `RTX3090:8080` díky SSH **local-forward** (`-L`).
Lokál mluví s `localhost:8080`, provoz jde šifrovaně SSH tunelem na server.

### 3.2 Spuštění tunelu (Windows PowerShell)

```powershell
# Jednorázově (local-forward: lokál:8080 → server:8080)
ssh -N -L 8080:localhost:8080 -p <vast-ssh-port> -i $env:USERPROFILE\.ssh\vast\hiran_v2.4_key root@<vast-rtx3090-host>

# Na pozadí (PowerShell job)
$tunnel = Start-Job -ScriptBlock {
    ssh -N -L 8080:localhost:8080 -p 12345 -i "$env:USERPROFILE\.ssh\vast\hiran_v2.4_key" root@ssh2.vast.ai
}

# Ověření — llama-server na RTX 3090 odpovídá přes tunel
Invoke-RestMethod http://localhost:8080/health
```

### 3.3 Automatizace v zion-agent

`zion-agent` má příkaz `tunnel start` (implementace níže):

```bash
zion-agent hiran tunnel start --instance rtx3090 --local-port 8080
# → spustí SSH tunnel na pozadí
# → zapíše PID do ~/.zion/tunnel.pid
# → testuje health endpoint každých 30s
# → při výpadku automaticky reconnect

zion-agent hiran tunnel status
# → Tunnel: ACTIVE  localhost:8080 → <rtx3090>:8080
# → Latency: 45ms
# → Model: hiran-v2.3-final-q5.gguf

zion-agent hiran tunnel stop
# → Ukončí SSH tunel
```

### 3.4 Konfigurace ~/.zion/agent-cli.toml

```toml
[llm]
api_url = "http://localhost:8080/v1"
model = "hiran-v2.3-final"
context_size = 8192
temperature = 0.7

[hiran]
remote_host = "ssh2.vast.ai"      # RTX 3090 instance
remote_port = 12345               # Vast SSH port
ssh_key = "~/.ssh/vast/hiran_v2.4_key"
ssh_user = "root"
remote_workspace = "/workspace"
gguf_path = "/workspace/hiran-v2.3-final-q5.gguf"
tunnel_local_port = 8080
tunnel_remote_port = 8080

[paths]
models_dir = "~/HiranModels"
checkpoints_dir = "~/HiranV2.3-Checkpoints"
```

---

## Fáze 4 — Integrace do zion-agent

### 4.1 Nové příkazy v zion-agent CLI

```
zion-agent hiran status          # Training/inference stav
zion-agent hiran checkpoint pull [step]
zion-agent hiran checkpoint list
zion-agent hiran merge [step]    # Spustí merge na serveru
zion-agent hiran export [step]   # Spustí GGUF export
zion-agent hiran download        # Stáhne GGUF lokálně
zion-agent hiran tunnel start    # SSH tunel → RTX 3090
zion-agent hiran tunnel stop
zion-agent hiran tunnel status
zion-agent hiran serve           # Spustí llama-server přes tunnel
zion-agent hiran shutdown        # Bezpečně ukončí Vast instanci
```

### 4.2 Autostart tunel a model (Windows service nebo startup skript)

```powershell
# %USERPROFILE%\.zion\start-hiran.ps1
# Spustí SSH tunel + ověří dostupnost modelu

Write-Host "Starting Hiran v2.3 tunnel..."
$tunnelJob = Start-Job {
    ssh -N -L 8080:localhost:8080 `
        -p 12345 `
        -i "$env:USERPROFILE\.ssh\vast\hiran_v2.4_key" `
        -o ServerAliveInterval=30 `
        -o ServerAliveCountMax=3 `
        root@ssh2.vast.ai
}

Start-Sleep 3
try {
    $health = Invoke-RestMethod http://localhost:8080/health
    Write-Host "Hiran v2.3 ONLINE — model: $($health.model)"
} catch {
    Write-Host "Tunnel not ready yet, retrying..."
}
```

### 4.3 LM Studio + tunel

Pokud chceš LM Studio jako GUI:
1. Zapni SSH tunel (viz výše)
2. V LM Studio → **"Local Server"** → External API URL: `http://localhost:8080/v1`
3. LM Studio zobrazí Hiran v2.3 jako aktivní model

---

## Fáze 5 — Fallback: lokální inference (bez Vast)

Pokud Vast instance není dostupná, zion-agent automaticky přepne na:

1. **LM Studio** (pokud nahrán lokálně) — `http://localhost:1234/v1`
2. **Ollama** — `http://localhost:11434/v1`
3. **llama-server.exe** (pokud GGUF stažen lokálně) — `http://localhost:8080/v1`

Priorita v `~/.zion/agent-cli.toml`:
```toml
[llm]
fallback_urls = [
  "http://localhost:8080/v1",   # SSH tunel (RTX 3090)
  "http://localhost:1234/v1",   # LM Studio lokál
  "http://localhost:11434/v1",  # Ollama
]
```

---

## Implementační plán (co zbývá udělat v kódu)

### model_ops.rs — doplnit:

| Funkce | Status | Popis |
|--------|--------|-------|
| `train_status()` | ✅ hotovo | Monitoruje trénink |
| `checkpoint_pull()` | ✅ hotovo | Stahuje checkpointy |
| `merge_and_convert()` | ⬜ TODO | Spustí Python merge skript na serveru |
| `export_gguf()` | ⬜ TODO | Spustí llama.cpp konverzi na serveru |
| `download_gguf()` | ⬜ TODO | Stáhne GGUF (scp s progress bar) |
| `shutdown_instance()` | ⬜ TODO | Bezpečně ukončí instanci |

### config.rs — doplnit:

| Pole | Typ | Popis |
|------|-----|-------|
| `hiran.gguf_path` | `String` | Remote cesta k GGUF souboru |
| `hiran.tunnel_local_port` | `u16` | Lokální port SSH tunelu (default: 8080) |
| `hiran.tunnel_remote_port` | `u16` | Remote port llama-server (default: 8080) |
| `hiran.llama_server_bin` | `String` | Remote cesta k llama-server binárce |
| `llm.fallback_urls` | `Vec<String>` | Fallback API endpointy |

### Nový modul tunnel.rs:

```rust
pub async fn start(cfg: &AgentConfig) -> Result<TunnelHandle>
pub async fn stop(handle: TunnelHandle) -> Result<()>
pub async fn status(cfg: &AgentConfig) -> Result<TunnelStatus>
pub async fn health_check(port: u16) -> Result<bool>
pub async fn watch(cfg: &AgentConfig, handle: TunnelHandle) -> Result<()>
```

---

## Checklist — kompletní průchod

### Trénink (probíhá)
- [x] checkpoint-5500 stažen
- [x] checkpoint-6000 stažen
- [x] checkpoint-6500 stažen
- [ ] checkpoint-7000 stažen
- [ ] checkpoint-7500 stažen
- [ ] checkpoint-8000 stažen
- [ ] checkpoint-8500 stažen
- [ ] checkpoint-8901 stažen (final)

### Export (po tréninku)
- [ ] Merge LoRA → merged HF model (na A100 serveru)
- [ ] GGUF konverze q5_k_m (na A100 serveru)
- [ ] MD5 checksum ověřen na serveru
- [ ] GGUF stažen lokálně (~20 GB)
- [ ] MD5 lokálně ověřen
- [ ] A100 instance bezpečně ukončena

### RTX 3090 inference server
- [ ] Nová RTX 3090 instance na Vast AI spuštěna
- [ ] GGUF přenesen (server-to-server nebo ze serveru)
- [ ] llama.cpp / llama-server nainstalován a spuštěn
- [ ] SSH tunel otestován z lokálu
- [ ] `zion-agent hiran tunnel start` funguje
- [ ] `curl http://localhost:8080/health` vrací OK
- [ ] LM Studio připojeno na `localhost:8080`

### zion-agent integrace
- [ ] `merge_and_convert()` implementováno v model_ops.rs
- [ ] `download_gguf()` implementováno
- [ ] `tunnel.rs` modul vytvořen
- [ ] `hiran tunnel start/stop/status` příkazy přidány do main.rs
- [ ] Fallback URL logika v LLM klientovi
- [ ] Config schema rozšířeno o tunnel + gguf_path

---

## Cenový odhad (Vast AI)

| Fáze | Instance | Cena/h | Trvání | Celkem |
|------|----------|--------|--------|--------|
| Trénink (zbývá) | 2× A100 80GB | ~$2.80/h | ~3h | ~$8.40 |
| Merge + export | 2× A100 80GB | ~$2.80/h | ~1h | ~$2.80 |
| Inference (RTX 3090) | 1× RTX 3090 | ~$0.30/h | průběžně | ~$0.30/h |

**RTX 3090 24GB** vs **A100 80GB** pro inference:
- q5_k_m 32B potřebuje ~22 GB VRAM → RTX 3090 24GB = ideální
- Rychlost inference: ~15-25 tokens/s (RTX 3090) vs ~40-60 tokens/s (A100)
- Pro interaktivní chat: 15-25 t/s je naprosto dostatečné

---

## Bezpečnostní pravidla

1. **Nikdy nevypnout Vast instanci dokud:**
   - Není stažen final checkpoint (adapter_model.safetensors)
   - Není stažen a ověřen GGUF soubor

2. **Tunel management:**
   - SSH tunel má `ServerAliveInterval=30` + `ServerAliveCountMax=3`
   - zion-agent ho monitoruje a reconnectuje automaticky
   - Vastpod se platí do konce hodiny — nemusíš spěchat

3. **VRAM management na RTX 3090:**
   - `--n-gpu-layers 99` = max offload
   - `--ctx-size 8192` = dostatečný kontext, nevypln VRAM
   - Pokud OOM: snížit na `--n-gpu-layers 80` a zbytek CPU

---

## Soubory v repo

| Soubor | Stav | Účel |
|--------|------|------|
| `Hiran2.3Agent.md` | ✅ tento soubor | Master plan |
| `HiranV2.3/scripts/merge_and_export_server.py` | ✅ hotovo | Merge + GGUF export |
| `HiranV2.3/scripts/setup-lmstudio.ps1` | ✅ hotovo | Download + LM Studio |
| `HiranV2.3/HIRAN_V23_LMSTUDIO_GUIDE.md` | ✅ hotovo | Detailní návod |
| `HIRAN_CLI_PLAN.md` | ✅ hotovo | CLI design doc |
| `ZION_OS/agent-cli/src/model_ops.rs` | 🔧 partial | Rust model operations |
| `ZION_OS/agent-cli/src/config.rs` | 🔧 partial | Agent konfigurace |
| `ZION_OS/agent-cli/src/tunnel.rs` | ⬜ TODO | SSH tunel management |

---

*Vytvořeno: 2026-06-14*
*Trénink: Hiran v2.3 Qwen3-32B LoRA BF16 — krok 6999/8901 (78,6 %)*
