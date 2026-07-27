# HIRAN — AI Layer Overview

> **Created:** 2026-07-20
> **Scope:** Přehled všech verzí Hiran (Hiranyagarbha) AI modelů, se zaměřením na **Hiran v2.3** (aktuální natrénovaný model).
> **Source locations:**
> - **Trained model + checkpoints:** vedlejší disk `sdc2` (Seagate 2TB, NTFS) → `/run/media/zionserver/60283A33283A0914/HIRAN/`
> - **Design docs / curriculum / training scripts:** tento repo (`HiranV2.1/`, `HiranV2.2/`, `HiranV2.4/`, `docs/3.0.1Genesis/HIRAN_*`, `PoC-lab/poc-hiran/`)
> - **Edge server (`62.171.141.136`):** pouze web assety (ikony, `/l3-hiran` stránka, kniha UCEBNICE-09-HIRANYAGARBHA). **Žádný GGUF model, žádná inference služba nenasazena.**

---

## 1. Co je Hiran

Hiran (zkratka z **Hiranyagarbha** — „zlaté zárodkové kosmické vědomí" z Rgvédu) je **AI vrstva (L3) ZION ekosystému**. Jde o vlastní fine-tuned LLM nad open-source base modely (Qwen3), specializované na:
- Zion blockchain / L1 core / Cosmic Harmony mining
- L2 DeFi (bridge, DAO, atomic-swap, pool)
- L3 orchestration & RAG
- Filozofii, etiku, Bodhisattva Vow codex, TerraNova učebnice

IP ochrana: designové dokumenty a tréninkové skripty jsou v **privátním** repu (nikdy ne do `public/`).

---

## 2. Verze — přehled

| Verze | Base model | Metoda | Dataset | Stav | Umístění |
|-------|-----------|-------|---------|------|----------|
| **v2.1** | (AI-native concept) | Single-domain LoRA | ~3056 párů (`hiran_curriculum_v2.1.jsonl`, 10.7 MB) | Dokumentováno, koncept | `HiranV2.1/` (repo + disk) |
| **v2.2** | Multi-domain | Dynamic QLoRA (rank 16–64) | 5001 párů cílově, 5 curriculum fází (22 181 řádků JSONL) | Trénovací pipeline hotová, model + interview report | `HiranV2.2/` (repo + disk) |
| **v2.3** ⭐ | **Qwen3-32B** | **QLoRA + LoRA r=64/α=128 (rslora)** | **20 517 párů** | **✅ NATRÉNOVÁNO + zmergováno + Q5_K_M GGUF** | `HiranV2.3/` (jen disk `sdc2`) |
| **v2.4** | (n/a — orchestrator) | — | — | **✅ MVP COMPLETE** (Maestro orchestrator, 6 komponent, 345 tests) | `V3/L3/ai-native/src/` (repo) + `HiranV2.4/` (design docs) |

---

## 3. Hiran v2.3 — detail (current focus)

### 3.1 Architektura a trénink

- **Base model:** `Qwen/Qwen3-32B` (62 GB HF format, stažen lokálně)
- **Metoda:** QLoRA (4-bit base + LoRA adapter), `peft 0.19.1`
- **LoRA config** (z `checkpoint-8000/adapter_config.json`):
  - `r = 64`, `lora_alpha = 128` → scale = 2.0
  - `lora_dropout = 0.05`, `bias = none`, `use_rslora = true` (rank-stabilized LoRA)
  - `target_modules`: `q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj` (7/7 attention + MLP projekce)
  - `task_type = CAUSAL_LM`
- **Hardware:** 2× NVIDIA A100-SXM4-80GB, AMD EPYC 7513, 1.4 TB RAM, 500 GB disk
- **Cloud:** Vast.ai instance **40791384** (`ssh1.vast.ai:31384`, key `~/.ssh/vast/hiran_v2.4_key`)
- **Cena:** ~$1.18/hr (~$50 za 36–48h plný trénink)
- **Tréninkový log:** `HiranV2.3-Checkpoints/hiran-training.log` (243 KB)
  - Start: 2026-06-13 07:24:48 UTC
  - Framework: PyTorch 2.4.1+cu121, Transformers 5.12.0, DeepSpeed 0.19.1
  - Dataset: **20 517 párů** z curriculum souborů
  - Loss po 1000 krocích: ~0.22, eval_loss ~0.24, klesá
  - Rychlost: ~12.9 s/iter, ~2.14 it/s při eval
- **Checkpointy:** `checkpoint-{500,1000,2000,2500,3000,3500,4000,5500,6000,6500,7000,7500,8000}` + `checkpoint-8000-france` (zaloha z FR instance)
- **Použitý checkpoint:** **`checkpoint-8000`** (adapter 2.0 GB, `adapter_model.safetensors`)

### 3.2 Výstupní artefakty (na disku `sdc2`)

```
/run/media/zionserver/60283A33283A0914/HIRAN/HiranV2.3/
├── hiran-v2.3-8000-q5_k_m.gguf          22 GB  ← finální merged Q5_K_M GGUF (root)
├── models/
│   ├── hiran-v2.3-FINAL-q5_k_m.gguf     22 GB  ← kopie finálního modelu
│   ├── hiran-v2.3-lora.gguf             2.1 GB ← LoRA adapter v GGUF (pro runtime apply)
│   ├── hiran-v2.3-merged-8000/          partial HF merge (jen 1 shard, incomplete)
│   └── offload/                         partial offload dir
├── HiranV2.3-Checkpoints/
│   ├── checkpoint-8000/                 ✅ použitý LoRA (adapter_config.json + 2.0 GB safetensors)
│   ├── checkpoint-8000-france/          záloha (526 MB, jiný encoding)
│   ├── checkpoint-{500..7500}/          historické checkpointy
│   ├── hiran-training.log               tréninkový log
│   ├── backup.log / backup-stderr.log   log autonomního backup skriptu
│   └── hiran_project_scripts_data.tar.gz 5.4 MB — balík skriptů+dat
├── scripts/                             17 merge_* skriptů (iterativní vývoj)
│   ├── merge_final.py                   ✅ finální funkční merge (layer-by-layer, alpha/r scale)
│   ├── merge_fixed2.py                  předchozí pokus
│   ├── merge_layer_by_layer.py          low-RAM merge (32 GB RAM workaround)
│   ├── merge_cpu_swap.py, merge_disk*.py ... různé strategie
│   └── merge-scripts/                   prázdné
├── llama-cpp/                           llama.cpp source (clone, 2026-06-15)
├── llama-cpp-bin/                       prebuilt Windows DLLs + exe (llama-cli, llama-server, ...)
├── llama-cpp-win.zip                    16.9 MB — zabalené Windows binárky
├── instance_info.json                   Vast.ai instance metadata (UTF-16)
├── contract_id.txt                      „41137799" (Vast contract ID, UTF-16)
├── STATUS.md                            stavový report k 2026-06-15
├── start-inference.bat                  spouštěč inference serveru (localhost:8080, n_ctx=32768, 8 threadů)
└── start-q5_k_m.bat                     spouštěč pro Q5_K_M model
```

### 3.3 Merge proces (kritické know-how)

Standardní `PeftModel.merge_and_unload()` vyžaduje **64 GB+ RAM** pro 32B model — na 32 GB RAM selhává OOM. Proto byl vyvinut **vlastní layer-by-layer merge** (`scripts/merge_final.py`):

1. Načte LoRA adapter z `checkpoint-8000/adapter_model.safetensors`
2. Spočítá scale = `lora_alpha / r` = 128/64 = **2.0** (rslora)
3. Pro každý safetensors shard base modelu:
   - Načte tensor
   - Najde odpovídající `base_model.model.{key}.lora_A.weight` + `lora_B.weight`
   - Aplikuje delta: `W_merged = W_base + scale * (B @ A)`
   - Uloží výsledný shard
4. Zkopíruje `config.json`, `tokenizer.json`, `tokenizer_config.json`
5. Výsledek: merged HF model → konverze do **Q5_K_M GGUF** přes `llama.cpp/convert_hf_to_gguf.py` + `llama-quantize`

**LoRA aplikována na všechny 7 target_modules** → plný merge attention + MLP projekcí.

### 3.4 Inference

- **Funkční řešení** (viz `STATUS.md`): base `Qwen3-32B-Q4_K_M.gguf` (18.4 GB) + LoRA `hiran-v2.3-lora.gguf` (2 GB) aplikovaná při každém dotazu přes `llama-cpp-python`. Celkem ~20.4 GB VRAM.
- **Finální řešení**: jeden merged soubor `hiran-v2.3-8000-q5_k_m.gguf` (22 GB) — Q5_K_M kvantizace, vyžaduje **22–24 GB VRAM** (RTX 3090/4090 nebo A100).
- **Spouštěče:**
  - `start-inference.bat` — server na `http://localhost:8080`, `n_ctx=32768`, `n_threads=8`
  - `start-q5_k_m.bat` — spouštěč pro Q5_K_M model
- **Ověřeno:** model odpovídá na Zion blockchain témata (LoRA aktivní), příklad výstupu: „Understanding blockchain technology... Zion Blockchain..."

### 3.5 Známé problémy a poznámky

- **Lokální merge selhal** na 32 GB RAM (potřeba 64 GB+) — vyřešeno layer-by-layer skriptem + cloud instancí.
- **Cloud instance byly zabity** (France, Quebec) mid-merge — proto `checkpoint-8000-france` záloha.
- **Bez Vast AI API key** nelze autonomně vytvořit novou instanci (API key je v `docs/3.0.1Genesis/HIRAN_V23_V24_MASTER_GUIDE.md`).
- **`hiran-v2.3-merged-8000/`** je nekompletní (jen `model-00003-of-00014.safetensors`, 258 MB) — nepoužívat, finální merged je v `models/hiran-v2.3-FINAL-q5_k_m.gguf`.
- **Dočasný soubor** `.hiran-v2.3-8000-q5_k_m.gguf.zgEDMn` (2.56 GB) v `models/` je zaseknutý partial download — lze smazat.

---

## 4. Hiran v2.4 — „Maestro" (navazující plán)

**Status:** Proposal / Design phase (2026-06-13). Žádný trénink neproběhl.

Vize: přechod od **domain-specific chatbotu** (v2.3) k **centrálnímu orchestrátoru** celého Zion ekosystému.

- Dokumenty v `HiranV2.4/`:
  - `PROPOSAL_v2.4.md` — vision, orchestrace L1–L6
  - `ARCHITECTURE_v2.4.md` — technická architektura
  - `AGENT_HIERARCHY_v2.4.md` — hierarchie agentů
  - `SERVICE_MESH_v2.4.md` — service mesh
  - `TOOL_REGISTRY_v2.4.md` — registr nástrojů
- Plán: `zion agent` CLI — Devin.ai-style autonomní operátor (čte kód, edituje soubory, spouští příkazy, plánuje tasky). Hybrid: lokální Rust orchestrator + remote inference na Vast A100.
- Master guide: `docs/3.0.1Genesis/HIRAN_V23_V24_MASTER_GUIDE.md` (SSH access, instance lifecycle, monitoring, emergency procedures)
- CLI plán: `docs/3.0.1Genesis/HIRAN_CLI_PLAN.md`

---

## 5. Edge server — Hiran stav

Na Edge (`62.171.141.136`) **není nasazen žádný Hiran model ani inference služba**. Přítomné pouze:

- **Web assety** (v Docker overlay pro `zion-web-next`):
  - `public/zion-icon-hiran.{svg,png}`, `public/zion-logo-hiran.{svg,png}`
  - `/l3-hiran` Next.js stránka (pre-rendered `.html`, `.rsc`, `.segments`)
  - Kniha `docs/{,cs,en}/books/ekam-deeksha/UCEBNICE-09-HIRANYAGARBHA.md`
- **Žádný** `ollama`, `llama-server`, `llama-cli` binární soubor
- **Žádný** `.gguf` soubor
- **Žádný** systemd service pro inference

→ **Hiran v2.3 je momentálně čistě lokální** (Windows disk `D:\Hiran\HiranV2.3\` ↔ Linux `sdc2`).

---

## 6. Související dokumenty v repu

| Cesta | Obsah |
|-------|-------|
| `docs/3.0.1Genesis/HIRAN_V23_V24_MASTER_GUIDE.md` | Master ops guide — SSH, instance lifecycle, monitoring, Vast API key |
| `docs/3.0.1Genesis/HIRAN_V2_3_MERGE_GUIDE.md` | Kompletní průvodce merge + GGUF konverzí |
| `docs/3.0.1Genesis/HIRAN_CLI_PLAN.md` | Plán `zion agent` autonomního operátora |
| `docs/3.0.4/POC_HIRAN_INTEGRATION_SPEC.md` | PoC integrační specifikace |
| `docs/HIRAN_LOCAL_SETUP.md` | Lokální setup návod |
| `PoC-lab/poc-hiran/` | Proof-of-concept kód |
| `.zion/session-hiran.md` | Session poznámky |
| `venv-hiran/` | Python virtualenv pro Hiran práci |

---

## 7. Další kroky (návrh)

1. **Záloha finálního GGUF** — `hiran-v2.3-8000-q5_k_m.gguf` (22 GB) je jen na jednom NTFS disku. Zvážit zkopírování na Edge (`/opt/hiran/`) nebo do offsite zálohy.
2. **Nasazení inference na Edge** — A100 není na Edge, ale Q5_K_M lze provozovat i na CPU (pomalé) nebo pořídit GPU instanci. Alternativně lokální inference na Mac/Windows.
3. **Integrace do `zion` CLI** — implementovat `zion agent` dle `HIRAN_CLI_PLAN.md` (v2.4 Maestro).
4. **Vyčištění** — smazat partial soubory (`.hiran-v2.3-8000-q5_k_m.gguf.zgEDMn`, `hiran-v2.3-merged-8000/`).
5. **API key rotace** — Vast AI API key je commitnut v master guide; zvážit přesun do 1Password / env var.
