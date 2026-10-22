# AI-Native + Hiran inference — obnova produkční vrstvy (2026-10-22)

> **Rozsah:** `V31/L3/ai-native` (L3 Hiranyagarbha), `Hiran/` (modely), inference
> runtime na operátorském PC + EDGE2, veřejný endpoint `app.zionterranova.com/api/ai-chat`.
> **Výsledek:** veřejný AI chat byl **503** (do 21. 10. deaktivovaný) → po zásahu
> **200** za 20–30 s, s fakticky správnými odpověďmi.
> **Autor:** operátorská session 2026-10-22. Stav: **provozní, rollback připraven**.

---

## 1. Shrnutí (TL;DR)

| Oblast | Před | Po |
|---|---|---|
| Veřejný `/api/ai-chat` | **503** (degradovaný RAG echo) | **200**, 20–30 s, odpovědi fakticky správné |
| `zion-v31-ai-native` | běžel na **EDGE2** s binárkou **ze 29. 9.** | nová binárka (Maestro v2.4, BM25, fallback chain, konstytuční prompt) |
| Maestro `/v2/*` | **404** (ve vzoru nebylo) | `/v2/info`, `/v2/health-matrix` (26 sond), `/v2/plan` — live |
| RAG korpus | 27 docs / 96 chunků | **39 docs / 138 chunků** |
| Primární LLM | tunel na **SMOS rig 518837 (offline)** | **operátorský PC**, fine-tuned `hiran-v2.3mini` na RX Vega 64 |
| Záložní LLM | neexistovala | **EDGE2 CPU** (stejný GGUF, 2.4 tok/s) |
| GPU na PC | tři konkurenti (mining + inference + LM Studio) | **Vega = inference**, **RX 5600 XT = mining** (nový pin) |
| Testy `zion-ai-native` | — | 344/344 lib + 1 bin + 8 doc ✅ |

---

## 2. Symptom → root cause

Původní hlášení: *„AI chat nefunguje“*. Řetězec selhání měl tři nezávislá zlomová místa:

### 2.1 Zlom 1 — nasazená binárka byla 3 týdny stará

`zion-v31-ai-native` běží na **EDGE2** (`207.180.217.100`) — po splitu EDGE → EDGE2
(2026-10-21), ne na Edge. Binárka v `/opt/zion/V31/target/release/zion-ai-native-api`
měla timestamp **2026-09-29 06:09** → chyběly:

- Maestro v2.4 routy (`/v2/info`, `/v2/health-matrix`, `/v2/plan`) → **404**
- BM25 RAG (`lexical.rs` nebyl ve vzoru)
- camelCase tool/probe opravy z auditu 2026-10-10

Symptom: `/status` vracel `requests: 1` za 10 h → služba fakticky nepoužívaná.

### 2.2 Zlom 2 — LLM endpoint ukazoval na offline rig

```
EDGE2 ai-native :8001  →  LLM_BASE_URL=http://127.0.0.1:8003/v1
   └─ :8003 = ssh -L tunel (zion-edge-tunnel) → Edge :8003
        └─ Edge :8003 = NICHO NIC NEPOŠLOUCHÁ  ← SMOS rig 518837 je offline
```

Edge `:8003` i `:8322` = `Connection refused` (rig tunel padl). Výsledek: `/chat`
vracelo *„Hiranyagarbha bezi v degradovanem rezimu“* (RAG echo) a veřejná routa
web route.ts (kontroluje `source == null` + echo prefix) vracela **503**.

### 2.3 Zlom 3 — Vulkan TDR: `device lost` při každém requestu

Fine-tuned model (`hiran-v2.3mini-Q5_K_M.gguf`, Qwen3-8B + LoRA) byl na PC hostovaný
přes `hiran-core.service` a **padal** — dvě různé příčiny:

**(a) `GGML_VULKAN_DEVICE` se v llama.cpp b11065 ignoruje.**
Env proměnná nebyla respektovaná → Vulkan backend **enumeruje všechna zařízení
a rozdělí model mezi ně**. Výsledek: ~1 GB modelu skončilo na přetížené
RX 5600 XT, kde běžel miner.

**(b) `-ngl 26` (z 36 vrstev) při plné VRAM.**
Kernel log:
```
amdgpu 0000:06:00.0: ring comp_1.1.0 timeout, signaled seq=101, emitted seq=103
radv/amdgpu: The CS has been cancelled because the context is lost. This context is innocent.
ggml_vulkan: device lost on Vulkan1
→ llama-server: decode() failed: vk::Queue::submit: ErrorDeviceLost → core dump
```
Preemptovaný compute ring (TDR) zabil i kontext llama. Po restartu se to opakovalo
deterministicky (3× během 30 min).

---

## 3. Cílová architektura

```
┌───────────────────────── EDGE2 (207.180.217.100) ─────────────────────────┐
│  zion-v31-ai-native :8001  (Maestro v2.4, BM25 RAG 39 docs)               │
│      LLM_BASE_URL   = http://127.0.0.1:8004/v1   ← primární                 │
│      LLM_FALLBACK_URL = http://127.0.0.1:8002/v1 ← záloha                   │
│                                                                            │
│  :8004 ──(zion-edge-tunnel -L 127.0.0.1:8004:127.0.0.1:8002)──┐            │
│  :8002 = zion-hiran-inference.service (llama.cpp CPU, týž GGUF)  fallback  │
└──────────────────────────────────────────────────────────┬──────────────────┘
                                                           │
┌───────────────────────── EDGE (62.171.141.136) ──────────┼──────────────────┐
│  :8002 ← reverse tunnel (zion-hiran-tunnel, user `hirantunnel`)             │
└──────────────────────────────────────────────────────────┬──────────────────┘
                                                           │
┌────────────────── operátorský PC (dest-zion) ────────────┴──────────────────┐
│  hiran-core.service :8070  (llama.cpp b11065, Vulkan)                      │
│      model : hiran-v2.3mini-Q5_K_M.gguf  (Qwen3-8B + LoRA r32/α64)         │
│      --device Vulkan0  (RX Vega 64)   -ngl 34  -c 4096  -b 1024 -ub 256   │
│      alias: hiran-core                                                    │
│                                                                            │
│  RX Vega 64  (8.1 GB)  → INFERENCE (weights ~4.5 GB, ~1.2 GB volno)        │
│  RX 5600 XT (6.1 GB)  → MINING  (ZION + QTU/SRB, pin `gpuDevice=gfx1010`)   │
└────────────────────────────────────────────────────────────────────────────┘
```

**Proč takto:** primární inference musí být rychlá (GPU) a záloha musí přežít
smrt hostitele (CPU, jiný stroj). Veřejný chat tak **nikdy nespadne** — jen
zpomalí (2.4 tok/s místo 6–21).

---

## 4. Provedené změny

### 4.1 Kód — `V31/L3/ai-native`

**`src/llm_backend.rs`**
- nové `RemoteHttpBackend::new_with_timeout(base, model, key, timeout_secs)`
  + `connect_timeout(10 s)`;
- `new()` ponechán jako wrapper s timeoutem 300 s (kompatibilita).

**`src/bin/zion-ai-native-api.rs`**
- **fallback chain** v `generate_answer()`: primární → `LLM_FALLBACK_URL` →
  RAG echo. Bez timeoutu visel mrtvý SSH tunel 300 s a fallback se nikdy nespustil.
- **konstituční systémový prompt** (`DEFAULT_SYSTEM_PROMPT`): fee split
  89/5/5/1, 1 ZION = 1e6 flowerů, PoW/L1/L2–L6, „ZION ≠ biblický Sion“.
  Zdroj faktů: `V31/L1/core/src/emission.rs` (rozdělení odměny).
- `LLM_TIMEOUT_SECS` (default 90 s) a `LLM_FALLBACK_TIMEOUT_SECS` (default 180 s).

**Proč konstytuční prompt:** 8B model bez něj odpovídal
*„0,5 % na výdavky a 0,5 % na zisk“* na dotaz na fee split a na
*„co je ZION?“* začal popisovat **biblickou horu Sion**. S promptem odpovídá
*„89 % horník, 5 % humanitární fond, 5 % fond Issobella, 1 % odměna za uzel“*.

### 4.2 RAG korpus — 27 → 39 docs

`V31/L3/ai-native/rag-docs/README.md` (postup + `SCOPE.md` beze změny):
přidáno `architecture/{README,consensus,mining,overview}`, `consciousness-levels`,
`api` (cs + en). Korpus žije v `/opt/zion/data/l3-rag-docs` **na EDGE2**.

### 4.3 Runtime

| Kde | Jednotka | Klíčové parametry |
|---|---|---|
| PC | `hiran-core.service` (user) | `--device Vulkan0 -ngl 34 -c 4096 -b 1024 -ub 256`, model `hiran-v2.3mini-Q5_K_M.gguf` |
| EDGE2 | `zion-hiran-inference.service` | `-ngl 0 -t 5 -c 2048`, CPU, `MemoryMax=7G` |
| EDGE2 | `zion-v31-ai-native.service` | `LLM_BASE_URL=…:8004/v1`, `LLM_FALLBACK_URL=…:8002/v1` |
| EDGE2 | `zion-edge-tunnel.service` | `+ -L 127.0.0.1:8004:127.0.0.1:8002` |
| Edge | `/home/edgetunnel/.ssh/authorized_keys` | `+ permitopen="127.0.0.1:8002"` |

Šablony v repu: `V31/deploy/local/hiran-core.service`,
`V31/deploy/systemd/zion-hiran-inference.service`.

### 4.4 Mining na PC (konkurence s inference)

- **nový config key `gpuDevice`** v `APP&WEB/desktop-agent/src/main.js`
  → exportuje `ZION_GPU_DEVICES` + `ZION_QPOW_OCL_DEVICES` (index nebo name
  substring: `gfx1010`, `5600xt`, `vega`);
- `srbminerGpuId: "0"` (SRB/QTU jen 1 zařízení), `srbminerExtraArgs: "--gpu-intensity 30 --no-watchdog"`;
- `threads: 5` — `lm_head` modelu běží na CPU; 11 vláken minima CPU žralo
  generování (0.25 → 6+ tok/s).

### 4.5 Build

`rust:1.97-bullseye` (glibc 2.30) → běží na EDGE2 (2.39) i Edge (2.39).
Nasazení atomicky: `cp .new` → `chown/chmod --reference` → `mv` (běžící proces
drží starý inode).

---

## 5. Ověření

| Test | Výsledek |
|---|---|
| `cargo test -p zion-ai-native --lib` | **344 passed, 0 failed**, 2 ignored |
| bin test + doc testy | 1 + 8 passed, 3 ignored |
| Veřejný `POST /api/ai-chat` | **200**, 28 s — fee split 89/5/5/1 správně |
| Veřejný `GET /api/ai-chat` (probe) | `{"available":true,…}` |
| EDGE2 `/chat` (přes GPU cestu) | 200, source=`null` (reálná generace) |
| EDGE2 `/chat` (primární down) | 200 po 90 s → fallback na EDGE2 CPU |
| `/v2/info` | 200, 5 endpointů, `mutations_enabled=false` |
| `/v2/health-matrix` | 200, 26 sond (node1-metrics 200, …) |
| `/v2/plan` | 200, intent → DAG, `requires_approval` na mutujícím kroku |
| TDR po restartu | žádný `device lost` v logu od restartu |
| RAG | 39 docs / 138 chunků, `seeding_rag_complete` OK |

**Latence:** 20–30 s na odpověď (primární), ~90–120 s při fallbacku na CPU.

---

## 6. Runbook

### 6.1 Health check

```bash
# EDGE2
curl -s 127.0.0.1:8001/health
curl -s 127.0.0.1:8001/v2/info
journalctl -u zion-v31-ai-native --since "-10 min" | grep -iE 'fallback|degraded|error'
systemctl is-active zion-hiran-inference zion-edge-tunnel

# Edge
curl -s 127.0.0.1:8002/v1/models     # musí vracet hiran-core

# PC
systemctl --user status hiran-core
curl -s 127.0.0.1:8070/health
grep -c "device lost" ~/zion-hiran/logs/llm-8070.log   # po restartu má být 0
```

### 6.2 Když chat vrací 503

1. `curl 127.0.0.1:8001/chat` na EDGE2 → je odpověď `source: null`?
2. Ne → degradovaný echo: primární i fallback nedostupné → zkontrolovat PC
   (`hiran-core`) a EDGE2 `:8002`.
3. `curl 127.0.0.1:8004/v1/models` na EDGE2 → tunel OK?
4. `curl 127.0.0.1:8002/v1/models` na Edge → reverse tunnel OK?

### 6.3 `device lost` (TDR) na PC

Příznaky v `~/zion-hiran/logs/llm-8070.log`:
`amdgpu: ring comp_*.timeout` + `ggml_vulkan: device lost`.

| Příčina | Řešení |
|---|---|
| Model se rozdělil mezi obě karty | `--device Vulkan0` (ne `GGML_VULKAN_DEVICE`!) |
| `-ngl` moc vysoko pro volnou VRAM | snížit `-ngl` (34 → 30) a `-ub 256` |
| Mining na téže kartě jako inference | `gpuDevice` pin na druhou kartu |
| Dlouhý prompt → obrovský logits buffer | `-ub 256` (jinak `[ubatch × vocab] f32` ≈ 311 MB) |

### 6.4 Obnovení po restartu PC

`linger` je zapnutý → `hiran-core` i `zion-hiran-tunnel` startují po bootu.
Desktop agent běží jako `zion-desktop-agent.service` (user unit) →
`systemctl --user restart zion-desktop-agent.service` restartuje i mining.

### 6.5 Rollback

- ai-native binárka: `…/zion-ai-native-api.bak-<ts>-oldbinary` / `.bak-<ts>-timeout`
- jednotky: `zion-v31-ai-native.service.bak-<ts>-llm8002`,
  `zion-edge-tunnel.service.bak-<ts>-hiran8004`,
  `/home/edgetunnel/.ssh/authorized_keys.bak-<ts>-permit8002`
- mining config: `~/.config/zion-desktop-agent/miner_config.json.bak-*`
- RAG docs: `/opt/zion/data/l3-rag-docs` (před nasazením 27 docs lze obnovit
  z `git show` repo verze `rag-docs/README.md` postupu)

---

## 7. Známé problémy a follow-up

1. **SMOS rig 518837 je offline** (Edge `:8003`/`:8322` = refused). Produkční
   inference už na něm nezávisí, ale rig je potřeba obnovit nebo převzít —
   jinak ztrácíme těžbu QTU/ZION/VRSC z toho stroje.
2. **Latence 20–30 s.** Hlavně CPU `lm_head` (1.24 GB projekce). `-ngl 37` by
   ho dostal na GPU, ale na 8 GB Vegě se do VRAM nevejde (weights 4.5 GB +
   lm_head 1.24 GB + KV). Alternativa: 4B model (~2.4 GB) → 2× rychlejší, ale
   netrénovaný.
3. **8B model občas popírá vlastní roli** („Hiranyagarbha není entita v ZION“),
   i když RAG kontext i system prompt jsou správné → artefakt velikosti modelu.
4. **RAG korpus je stále úzký** (39 public docs). Rozšíření = kurátorování
   `APP&WEB/website-v2.9/public/docs/**` (ne interní lore ze `docs/3.2/`).
5. `ZION_OS/dashboard/dashboard.{html,js}.gz` v gitu byly **zastaralé** (před
   splitem EDGE → EDGE2); regenerace je zahrnuta v tomto commitu.
6. `LLM_MODEL=zion-l3` v jednotce je kosmetický alias — reálně běží
   `hiran-v2.3mini`; kód `hiran_inference.rs` navíc tvrdí model `"hiran-v2.2"`,
   což v repu neexistuje (k harmonizovat při příštím refaktoru).

---

## 8. Změněné soubory

```
AGENTS.md                                                   (+ architektura + open items)
V31/AGENTS.md                                               (+ provozní záznam 2026-10-22)
docs/3.2/StatusV3.md                                        (služby 8001/8002)
V31/L3/ai-native/src/llm_backend.rs                        (timeouty)
V31/L3/ai-native/src/bin/zion-ai-native-api.rs             (fallback chain + konst. prompt)
V31/L3/ai-native/rag-docs/README.md                        (rozšířený korpus)
V31/deploy/local/hiran-core.service                        (NOVÝ)
V31/deploy/systemd/zion-hiran-inference.service            (NOVÝ)
APP&WEB/desktop-agent/src/main.js                          (gpuDevice pin)
APP&WEB/desktop-agent/GPU_REVENUE_MINING_README.md         (dokumentace pinu)
ZION_OS/dashboard/dashboard.{html,js}.gz                    (regenerace, sync se zdrojem)
.gitignore                                                  (+ .continue/)
```

---

## 9. Reference

- `V31/L1/core/src/emission.rs` — rozdělení odměny 89/5/5/1
- `V31/L3/ai-native/rag-docs/SCOPE.md` — pravidla kurace RAG korpusu
- `V31/deploy/systemd/zion-v31-ai-native.service` — jednotka ai-native
- `docs/3.2/StatusV3.md` — kanonický živý stav
- root `AGENTS.md` — globální topologie a historie incidentů
