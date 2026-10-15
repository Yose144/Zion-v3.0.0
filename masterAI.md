# masterAI.md — Hiran AI Layer: Master Plan & Realizace

> **Vytvořeno:** 2026-10-16 · **Status:** ACTIVE PLAN
> **Scope:** Kompletní plán realizace AI vrstvy (Hiran 2.3 rebuild → 2.4 Maestro → 2.5 Amṛtabhoja) na dostupném HW: **lokální backup-node PC (Vega 8G + RX 5600 XT 6G + 32G RAM)** + Edge (CPU only) + vast.ai credit pro training bursty.
> **Kanonické zdroje:** `HiranInterface.md`, `Hiran/2.4/service-map.json`, `Hiran/2.4/AUDIT_2026-10-10.md`, `docs/3.0.5/archive-root-md/HIRAN_EVOLUTION_2.3_TO_2.5_AMATHABOJ.md`, `docs/3.0.6/HIRAN_{OVERVIEW,V2.4_DEV_PLAN,HARDWARE_ROADMAP}.md`.

---

## 0. Truth snapshot — kde skutečně jsme

| Substrát | Stav | Poznámka |
|---|---|---|
| Maestro kód (`V31/L3/ai-native`, 29 modulů ~15.6k ř.) | ✅ implementováno (345 testů) | CLI funguje; **nemountnuté do API** |
| Tool registry (55 tools) | ⚠️ napsané, ale stale | volá `getblockcount` vs real `getChainInfo`; staré porty/REST cesty — viz service-map |
| Health poller (26 sond) | ⚠️ stejný drift | legacy V3 sondy míří na mrtvé služby |
| `zion-ai-native-api` na Edge :8001 | ✅ běží | 28-modul checkout (chybí `lexical.rs`), bez Maestro mountu |
| Inference | ⚠️ degradováno | SMOS rig 1070 Ti → `rigtunnel` → Edge :8003 (`zion-l3`, Qwen3-4B-Q4_K_M); :8002 = `hirantunnel` standby — POSTy timeoutují |
| v2.3 weights (Qwen3-32B Q5_K_M 21.6G) | ❌ ztraceny | disk sdc2 dead; přežilo: 3 056 curriculum párů + `merged_seed.jsonl` 7 059 párů |
| NCL crate (`V31/L3/ncl`, 2.2k ř.) | ✅ `/ncl/*` mountnuté na :8001 | scheduler/reputation/pricing; backends onnx/wasm/tflite/custom |
| L4/L5/L6 bridges | ✅ kód ready | `OASIS_HIRAN_*`, `ISSOBELLA_HIRAN_*` env — stačí zapnout |
| PoC spec (`/poc/*` endpoints) | 📋 spec only | `docs/3.0.4/POC_HIRAN_INTEGRATION_SPEC.md` — CareProof vstupní brána |

---

## 1. Hardware inventář & role

| Box | CPU/RAM | GPU | Role v AI layer |
|---|---|---|---|
| **Backup-node PC** (lokální node, "viz edge") | Ryzen, **32G RAM** | **Vega 8G (gfx900)** + **RX 5600 XT 6G (gfx1010)** = ~14G VRAM | ⭐ **primární AI inference node** — Vulkan llama.cpp, 2 servery; běží vedle node |
| Edge 62.171.141.136 | 4C, 7.8G RAM | — | orchestrace: `:8001` ai-native API + Maestro mount, RAG store, service probes; **žádná lokální inference** |
| SMOS rig 518837 | G4560 (bez AVX!) | GTX 1070 Ti 8G | současný inference → Edge :8003; po přechodu na AMD nodu = **hot-standby** |
| vast.ai | — | A100 rental | **jen training bursty** (v2.3-mini LoRA rebuild), ne 24/7 inference |

### Proč Vulkan (ne ROCm) na AMD nodu
- `gfx900` (Vega) = z ROCm 6+ venku; `gfx1010` (RDNA1) = neoficiální. **Vulkan/RADV podporuje obě** karty, `llama.cpp -DGGML_VULKAN=ON`, multi-GPU přes `GGML_VULKAN_DEVICE`.
- ⚠️ Na SMOS rigu Vulkan SIGILLil kvůli G4560 (no AVX) — **na backup PC s Ryzenem tohle nehrozí**.
- Mining kolize: eq192 potřebuje ~2.8G tabulek na 6G kartě; prod miner ~2.2G. **Pravidlo: max 1 těžký GPU proces na kartu** — inference servery nesmí sdílet kartu s eq192/QPoW během.

---

## 2. Cílová architektura (fits-in-local-node)

```
backup-node PC (32G RAM / Vega 8G / 5600XT 6G)
├── llama-server A  :8080  → Vega      HIRAN-CORE  Qwen3-8B Q5_K_M (~5.7G)   Maestro reasoning + compose + chat
├── llama-server B  :8081  → 5600XT    HIRAN-FAST  Qwen3-4B Q5_K_M (~2.9G)   intent classify, synth, dataset gen
├── zion-node (existující backup node)                                     RPC pro Maestro L1 tools
└── reverse tunnel → Edge :8002 (+ :8003 zůstává SMOS standby)

Edge (62.171.141.136)
├── :8001 zion-ai-native-api ── mount /v2 → Maestro (intent→plan→DAG→tools)
│      LLM_BASE_URL=http://127.0.0.1:8002/v1   (primární = AMD node přes tunnel)
│      LLM_BASE_URL_FAST=…/v1 (router alias, stejný tunnel, jiný model alias)
├── :8002 → llama-server A  alias zion-l3 / hiran-core
├── :8003 → SMOS rig (standby)
└── service-map.json → jediný zdroj pravdy pro tools/probes
```

**Aliasy (stabilní kontrakt):** `zion-l3` = veřejný/front-end alias (zachovat), `hiran-v2.2` = desktop IPC alias, `hiran-core` = Maestro reasoning, `hiran-fast` = router. Všechny přes OpenAI-compat `/v1/chat/completions`.

### VRAM budget

| Karta | Model | Quant | ~VRAM | Rezerva |
|---|---|---|---|---|
| Vega 8G | Qwen3-8B | Q5_K_M | 5.7G + ~0.8G KV (ctx 8k) | ~1.5G volno |
| 5600XT 6G | Qwen3-4B | Q5_K_M | 2.9G + ~0.4G KV | ~2.5G (může krátkodobě sdílet s minerem — NE eq192) |

Fallback CPU: Qwen3-8B Q4_K_M na 32G RAM ~2 t/s — dev/test fallback když GPU down.

---

## 3. Fáze realizace

### F0 — Inference node up (lokální PC)  → cíl: `zion-l3` odpovídá z AMD nodu

1. Build `llama.cpp` s `-DGGML_VULKAN=ON` (RADV driver, `vulkaninfo` verify obou karet).
2. Modely: `Qwen3-8B-Q5_K_M.gguf`, `Qwen3-4B-Q5_K_M.gguf` (huggingface → `/opt/llm/models/`).
3. `run-hiran-core.sh`: `llama-server -m 8B --port 8080 --alias zion-l3 --alias hiran-core -ngl 99 -c 8192` + env `GGML_VULKAN_DEVICE=<vega>`.
4. `run-hiran-fast.sh`: `llama-server -m 4B --port 8081 --alias hiran-fast -ngl 99 -c 4096` na 5600XT.
5. systemd units `hiran-core.service`, `hiran-fast.service` + watcher (pattern z `run-cuda.sh` na SMOS rigu — chown miner/oprávnění podle rigu).
6. Reverse tunnel do Edge (reuse `hirantunnel` user → :8002; nebo nový port :8004 → :8080 a :8005 → :8081 pro dual-server).
7. **E2E:** `curl edge:8002/v1/chat/completions` → reálná generace; `/etc/zion/edge-environment.sh` `LLM_BASE_URL` → :8002, restart `zion-v31-ai-native`, health = non-degraded.

### F1 — Maestro zapojení (repo kód)  → cíl: `POST :8001/v2/orchestrate` funguje read-only

1. **`endpoints.rs`** — single-source env config: všechny base URL pro L1–L6 služby z env s defaulty ze `service-map.json` (konec hardcoded portů).
2. **Tool/probe rewrite** — RPC metody `getblockcount`→`getChainInfo` atd., REST cesty `/proposals`→`/api/dao/*`, `:8096`→`:8097` issobella; probes podle service-map `kind/health`.
3. **Mount Maestro** do `zion-ai-native-api.rs`: `POST /v2/orchestrate`, `GET /v2/plan`, `GET /v2/health-matrix`, `GET /v2/intents`, `GET /v2/tools`.
4. **Mutation gate:** `HIRAN_MAESTRO_MUTATIONS=0` default → mutační tools vrací `approval_required`; `X-Maestro-Approve` + `MAESTRO_APPROVAL_TOKEN` (TIMING_SAFE compare).
5. **Audit:** append-only JSONL do `ZION_L3_AUDIT_DIR` — každý intent/plan/step/výsledek.
6. Testy: unit na planner/intent už jsou; přidat `tools` contract testy proti service-map mock.

### F2 — Dataset + v2.3-mini rebuild  → cíl: Hiran model ≤8B, Vega-ready

- Seed: `merged_seed.jsonl` (7 059 párů) → expandovat syntetikou přes `hiran-core`/`hiran-fast` (self-instruct z V31 kódu + docs) — cíl **12–15k párů**.
- Train: **Qwen3-8B QLoRA** (r=32/α=64, seq 4k) na **vast.ai A100** — ~4–8h, pár $. Reprodukovat layer-by-layer merge know-how z `scripts/merge_final.py` (scale=α/r).
- Output: `hiran-v2.3mini-Q5_K_M.gguf` (~5.7G) → nasadit jako `hiran-core` alias. 32B zůstává pouze pro cloud (nevleze se lokálně).
- Eval: fixed otázka-set (Zion RPC, mining, bridge, vow) — porovnat base vs tuned.

### F3 — Maestro production  → cíl: orchestrace L1–L6 live

- LLM-assisted intent (hiran-fast classify, fallback rule-based), `compose_response` přes hiran-core.
- Circuit breakers per service, 30s health cache, last-good fallback.
- Auto-remediation rules (YAML) — jen read + restart akce, stále za gatem.
- Dashboard orchestrator tab (:8766), desktop `ai-chat` → :8001.

### F4 — v2.5 Amṛtabhoja vstup  → cíl: první CareProof pilot

- `/poc/validate` + `/poc/anomaly` dle `POC_HIRAN_INTEGRATION_SPEC.md` → CareProof struct (proof_type, input/output/model hash, dharma+care score, signature).
- `NetworkHealth` + `BridgeAudit` jako pilotní proof typy (read-only, deterministické).
- Epoch renewal skeleton (2016 bloků): dharma re-eval + vow re-read + report.
- HW target: DGX Spark 128G (fall 2026+); do té doby běží na backup PC.

---

## 4. Interface kontrakty (shrnutí — detail v `HiranInterface.md`)

| Cesta | Kontrakt |
|---|---|
| `:8002/v1/chat/completions` | OpenAI-compat, aliasy `zion-l3`,`hiran-core`; → Vega 8B |
| `:8002/v1/completions`, `/embeddings` | llama.cpp std |
| `:8001/v2/orchestrate` | `{text}` → `{intent, plan, steps[], result}`; mutace vyžadují `X-Maestro-Approve` |
| `:8001/v2/health-matrix` | 26+ služeb live stav |
| `OASIS_HIRAN_URL`, `ISSOBELLA_HIRAN_URL` | L4/L6 bridges → `:8001` |
| env | `LLM_BASE_URL`, `LLM_MODEL=zion-l3`, `LLM_FAST_MODEL=hiran-fast`, `HIRAN_MAESTRO_MUTATIONS`, `MAESTRO_APPROVAL_TOKEN`, `ZION_L3_AUDIT_DIR` |

---

## 5. Bezpečnost & otevřené flags (z auditu)

1. **`:8899` python receiver na 0.0.0.0** bez auth → `/root/rig-exfil/` — ověřit/zabít před dalším rozšiřováním.
2. **`/dev/sdb` (1.8T backup disk) mimo systém** — backup pipeline nemá cíl; v2.3 weights lekce: **žádný model jen na jednom disku** → každý GGUF hned na Edge `/opt/zion/hiran-models/` + lokálně.
3. Mutace defaultně OFF; audit před první mutační akcí.
4. Vast.ai API key je v `docs/3.0.1Genesis/HIRAN_V23_V24_MASTER_GUIDE.md` — přesunout do env/1Password, necommitovat nově.

---

## 6. Okamžité kroky (realizace teď)

| # | Krok | Kde | Blokuje |
|---|---|---|---|
| 1 | `endpoints.rs` + tool/probe rewrite vs service-map | repo `V31/L3/ai-native` | F1 |
| 2 | `/v2` Maestro mount + mutation gate + audit | repo | F1 |
| 3 | Vulkan llama.cpp build + 2 servery + tunnel | backup-node PC | F0 |
| 4 | Edge env update + E2E verify | Edge | F0→F1 |

**Začínám krokem 1–2 (repo kód, umím ověřit buildem). Kroky 3–4 potřebují SSH na backup PC — dát alias do `~/.ssh/config` jako `hiran-node`.**
