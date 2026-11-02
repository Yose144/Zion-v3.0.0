# VAST Hiran Training — plán běhu na existující instanci (2026-10-31)

> Stav: **RUN 1 DONE ✅ + VALIDOVÁN (overfit; interim `--lora-scaled`)** · **RUN 2 = NULL-RUN ⚠️**
> (dataset se přes schémovou bug v pipeline nedostal — fixnuto, run 3 = 👤) ·
> Instance: vast.ai **58077390** (RTX 3060 12 GB, $0.0544/h, ssh6.vast.ai:27582) · Autor: Devin
> Validace + diagnóza run 2: `docs/3.2/REPORTS/REPORT_2026-11-01_HIRAN_VAST_TRAINING.md` §7–§8
>
> **👤 rozhodnutí 21:20Z:** `zion-miner` vypnut (šetří VRAM/SM pro trénink).
> Mining = SRBMiner QTC ~201 MH/s + xmrig. ZION zůstává vypnutý po dobu tréninku.
>
> **Výsledek:** eval_loss **0.284** / ppl **1.33** (ze ~3.7), adaptér 335 MB.
> **Kanonická kopie: EDGE** `/opt/zion/hiran/zion-llama-lora-vast/` (adapter.safetensors
> md5 `dadf80513bbec8ede9b20f8d3dc2f86b`) + archive `hiran-adapter.tgz`
> (313 MB, md5 `6c4ab3d77f000d1116332d4f6204b52d`) — na Macu smazáno (místo).
> Checkpointy (resume): vast rig `outputs/zion-llama-lora/checkpoint-{86,172,258}`.

## 1. Cíl

Natrénovat fine-tune váhy pro market Hiran modely (`market.zionterranova.com/v1/models`):
mockupy **`hiran-amitabha`** (thinking), **`hiran-issobella`** (agentic/code),
**`hiran-maitreya`** (lore/rag) — všechny `x-mockup: true` dokud nepadnou FT
váhy. `hiran-coder` je definován (qwen2.5-coder-7b upstream :8005) — deploy
nebo FT později.

První běh = **jeden generalist QLoRA adaptér** na merged curriculum
(`hiran_curriculum_v2.1.jsonl`, 3056 párů) — kandidát pro `hiran-maitreya` /
refresh `hiran-mini`. Per-role datasety (thinking/agentic split) = další vlna,
pipeline se opakuje.

**Souběh s miningem je podmínkou:** ZION + SRBMiner QTC + xmrig běží dál
(viz §3). Mining se zpomalí — měříme dopad, nepausujeme.

## 2. Ověřené zdroje instance (měřeno 2026-10-31 ~19:00Z)

| Zdroj | Stav | Verdikt |
|---|---|---|
| GPU | RTX 3060, 12 288 MiB; mining bere ~4,5 GiB → **~7,5 GiB volných** | 8B QLoRA @ seq 512/bs1/ckpt ≈ 6,5–7,5 GB → těsné, jde; fallback §6 |
| RAM | 31 GB (26 free) | OK |
| Disk | overlay **20 GB, 282 MB used** | stačí při `ZION_SKIP_GGUF=1` (merge/GGUF až lokálně) — viz §4 |
| CPU | 8 vCPU Ryzen 7 5800X, 100 % util mining | DataLoader workers=0 |
| Mining | ZION stream1 (duty ~42 % → ~300 KH/s cíl), SRBMiner quantus ~205–219 MH/s (`srb-qtu` tmux), xmrig ~3,9 kH/s | běží, neměnit |

## 3. Mining koexistence — rozhodnutí

- **ZION:** `zion-miner` stream1, duty laděno na ~300 KH/s (5 %→50, 30 %→210, cíl ~42 %).
- **QTC:** SRBMiner `--algorithm quantus` → náš pool `:8444` (`qtun:` leg), worker `vast-58077390-qtu`. ~4,2 GiB VRAM.
- **XMR:** xmrig CPU — netýká se GPU.
- Trénink + mining na jedné kartě = time-sharing; očekávaný dopad: QTC −20–40 %, trénink 2–4× pomalejší než solo. Akceptujeme — dokumentujeme změřené hodnoty.
- VRAM envelope: trénink drží ~7 GB; SRBMiner 4,2 GB + zion ~0,2 GB + driver rezerva ≈ 12 GB — na hraně, monitorovat.

## 4. Disk budget (20 GB cap)

| Položka | Odhad |
|---|---|
| pip stack (torch, transformers, trl, peft, bnb, datasets) | ~4–5 GB |
| Base model `unsloth/Meta-Llama-3.1-8B-Instruct` (HF cache) | ~5,5 GB |
| Dataset `hiran_curriculum_v2.1.jsonl` | 11 MB |
| LoRA checkpointy (save_total_limit 2–3, ~0,3–0,6 GB/ks) | ~1,5 GB |
| **Celkem** | **~12 GB → rezerva ~8 GB** |

GGUF merge **na rigu neděláme** (`ZION_SKIP_GGUF=1`) — ušetří ~6 GB + build
llama.cpp; adaptér se stáhne a merge/quant běží lokálně (`merge_export.py`).

## 5. Kroky (checklist)

- [x] V0 — Mining setup: ZION native + QTC SRBMiner, pearl zrušen (`vastctl zion srbpool`), ZION duty → ~300 KH/s → **pak vypnut na 👤 pokyn (21:20Z)**
- [x] V1 — Sync pipeline: `finetune_lora.py`, `requirements.txt`, `merge_export.py` + dataset (3056 párů) → rig `/root/hiran-train/` (`data/zion_train.jsonl`)
- [x] V2 — Deps: `pip install -r requirements.txt` + **fix: `torch==2.5.1 --index-url .../cu121`** (torch 2.14.1 = CUDA 13 > driver 535) + `rich` (trl dep)
- [x] V3 — Smoke ✅: 30 párů, 1 epocha, seq 512 → **train_loss 3.68 / eval 3.75 / ppl 42.7**, adaptér `outputs/smoke`, QTC držel ~201 MH/s
- [x] V4 — Full run ✅: 258 steps / 3 epochy, ~118 s/step, runtime 21:37Z→06:13Z (~8,6 h), `TRAIN_EXIT=0`
- [x] V5 — Monitor ✅: eval epoch1 **0.385** → final eval **0.284 / ppl 1.33**; GPU 9,1 GiB/100 %; QTC 6h avg 128,8 MH/s (dip za sdílení GPU — očekávané)
- [x] V6 — Package+pull ✅: `hiran-adapter.tgz` (313 MB) → **EDGE `/opt/zion/hiran/`** (rozbaleno v `zion-llama-lora-vast/` + tgz archiv vedle, md5 ověřen); na rigu zůstávají checkpoint-86/172/258 v `outputs/zion-llama-lora/`; Mac kopie smazána
- [x] V7 — GGUF na EDGE ✅ (2026-11-01): plný merge 8B fp16 nejde na EDGE (7 GB RAM) ani EDGE2 (11 GB) → cesta **adapter-GGUF + runtime LoRA**: `convert_lora_to_gguf.py --base fp16` → **`/opt/zion/hiran/hiran-lora-vast.gguf`** (335 MB, 448 tensorů, llama arch) + base **`base-gguf/Meta-Llama-3.1-8B-Instruct-Q5_K_M.gguf`** (5,7 GB, bartowski). Servírování: `llama-server -m base.gguf --lora hiran-lora-vast.gguf` (= merged kvalita, bez 16 GB merge). Artefakty na EDGE `/opt/zion/hiran/`: `hiran-lora-vast.gguf`, `base-gguf/`, `zion-llama-lora-vast/` (safetensors), `base-fp16/` (15 GB — pro budoucí full merge), `hiran-adapter.tgz`. llama.cpp clone: `/opt/llama.cpp` (nebuildené — jen python tools). Deploy na `hiran-maitreya` upstream = nový `llama-server` servis na EDGE2 + `hiran-models.json` (👤)
- [x] V8 — Dokumentace ✅ (2026-11-01): report `docs/3.2/REPORTS/REPORT_2026-11-01_HIRAN_VAST_TRAINING.md`
  (§7 validace base-vs-LoRA → overfit + `--lora-scaled` mitigace; §8 run 2 NULL-RUN root cause),
  `AIhiran.md` truth-sync, smoke prompty `hiran-smoke-prompts.json`
- [x] V9 — Validace adaptéru ✅: artefakty na EDGE2, `llama-server --lora` smoke (8 held-out promptů);
  scale sweep 0.5/0.7/1.0 → sweet spot ~0.5; DRAFT unit `zion-hiran-maitreya.service` na EDGE2 (👤 aktivace)
- [x] Run 2 (zion_core) — doběhl 10:50Z, **NULL-RUN**: `format_for_llama3` ignoroval `instruction/output`
  schéma → trénoval 921× jen SYSTEM_PROMPT (eval 0.008). Fix v repu + diversity guard + sync na rig.
  Artefakty archivovány (degenerativní, nepoužitelné). Run 3 po přegenerování datasetu = 👤

## 6. Rizika a fallbacky

| Riziko | Mitigace |
|---|---|
| OOM pri seq 512 vedle minerů | seq 384 → seq 256 → micro-batch… už bs1; poslední fallback: pauza `srb-qtu` na dobu tréninku (dokumentované okno) |
| Instance interrupt / vast výpadek | `save_steps=50`, `save_total_limit=3`, rsync-pull checkpointů každých ~15 min na dev host |
| Disk fill (HF cache + torch) | `HF_HOME=/root/hiran-train/.hf`, `ZION_SKIP_GGUF=1`, hlídat `df` |
| Trénink příliš pomalý pod zátěží | akceptovat (noc); případně zvýšit ZION duty dolů / SRBMiner pauza |
| kvalita adaptéru | eval_loss + smoke prompts (viz finetune README), per-role vlna později |

## 7. Konfigurace běhu (locked — ověřeno smoke)

```
BASE_MODEL   unsloth/Meta-Llama-3.1-8B-Instruct-bnb-4bit   (~5,3 GB cache;
             fp16 mirror = 16 GB > volný disk — bnb-4bit varianta povinná)
DATASET      hiran_curriculum_v2.1.jsonl → /root/hiran-train/data/zion_train.jsonl
METODA       QLoRA nf4 + double-quant, LoRA r32/α64, grad-ckpt
SEQ/BATCH    max_seq 512 (hard truncate v kódu — trl 0.9.6 max_seq_length
             nezkracuje před-tokenizovaný text), bs 1, grad_accum 32
EPOCHS       3
ENV          ZION_BASE_MODEL=...-bnb-4bit
             ZION_SKIP_FP32_UPCAST=1   (fp32 norm upcast = ~2 GiB burst → OOM)
             ZION_MAX_SEQ_LENGTH=512
             PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
             HF_HOME=/root/hiran-train/.hf
OUTPUT       /root/hiran-train/outputs/zion-llama-lora
```

### Ověřené hard limity co-residence (RTX 3060 12 GB + SRBMiner)

- `unsloth/*-bnb-4bit` repo má **vlastní `quantization_config`** → náš
  BitsAndBytesConfig se ignoruje; `llm_int8_enable_fp32_cpu_offload` nefunguje,
  `device_map={'': 0}` = celý model 5,31 GiB povinně na GPU.
- VRAM rozpočet: GPU 11,75 GiB − SRBMiner 4,13 − driver ~0,2 → model 5,31 +
  pracovní prostor ~2 GiB. Seq 512 fp32 logits ≈ 263 MiB ✓; seq 2048 ≈ 1 GiB ✗.
- fp32 upcast v `prepare_model_for_kbit_training` (embed 2 GiB burst) = OOM →
  `ZION_SKIP_FP32_UPCAST=1` přeskočí (QLoRA jede i bez něj).
- torch: `torch==2.5.1+cu121` (index `download.pytorch.org/whl/cu121`) —
  novější wheels jsou CUDA 13, driver 535 umí max CUDA 12.2.

## 8. Záznam běhu (doplňuje se)

- 19:00Z — mining pre-training stav: QTC 218.99 MH/s, ZION ~40–55 KH/s @duty5 → laděno 30 %→210 → 28 % → ~190 KH/s @ QTC 203–211 MH/s
- 19:50–20:30Z — deps instalace: torch 2.14.1 (CUDA 13) → driver error → torch 2.5.1+cu121 OK; chyběl `rich` (trl dep)
- 20:40–21:15Z — smoke iterace OOM → root causes: model quantization_config override (žádný CPU offload), fp32 upcast burst 2 GiB, trl max_seq_length neuplatněn → fixy v kódu (ZION_SKIP_FP32_UPCAST, hard truncate)
- 21:20Z — 👤: zion-miner vypnut pro trénink; QTC zůstává ~201 MH/s
- 21:30Z — **SMOKE PASS**: 1 epocha/30 párů, train_loss 3.68, eval 3.75, ppl 42.7; adaptér v `outputs/smoke`; QTC nezasažen
- (další řádky se dopisují průběžně)
