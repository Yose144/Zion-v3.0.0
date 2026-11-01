# AI Hiran — ZION AI stack, modely a pipeline

> Stav 2026-11-01 · První vlastní fine-tuned adaptér: **`zion-llama-lora-vast`**
> (QLoRA na Llama-3.1-8B, eval_loss 0.284 / ppl 1.33) — natrénován na Vast.ai
> RTX 3060 vedle produkčního QTC miningu. **Strategie 👤:** adaptéry = archiv
> na EDGE, žádný produkční deploy — směřujeme k **FULL trainingu na větší kartě**
> (8B nestačí; Hiran má znát celý ZION). Příprava: `HIRAN-FULL-TRAINING-PREP.md`.
> Detail runů: `VAST-HIRAN-TRAINING-PLAN.md`,
> report: `docs/3.2/REPORTS/REPORT_2026-11-01_HIRAN_VAST_TRAINING.md`.

## 1. Co je Hiran

Hiranyagarbha ("Hiran") = ZION AI-native asistent/agent. Český, technický,
orientovaný na V3 Rust workspace (`zion-core`, `zion-pool`, `zion-miner`, L2/L3,
`zion` CLI). Servírovaný přes **hiran-gateway** (OpenAI-compatible, paid B2B)
a interně přes **ai-native** API (`V3/L3/ai-native`).

Persona/system prompt (z `finetune_lora.py`): ZION blockchain expert,
AI Native agent a operátorský orchestrátor; kanonický kód V3/; odpovídá česky.

## 2. Model inventura

### Aliasy na market (`/etc/zion/hiran-models.json` na EDGE2)

| Alias | Role | Stav | Pozn. |
|---|---|---|---|
| `hiran-mini` | free tier | ✅ live | `hiran-v2.3mini-Q5_K_M.gguf`, llama.cpp CPU :8002 (+ :8004 tunnel) |
| `hiran-coder` | pro/coder | live | upstream qwen2.5-coder-7b :8005 (PC tunnel) |
| `hiran-amitabha` | thinking | `mockup` | čeká na váhy |
| `hiran-issobella` | agentic/code | `mockup` | run 2 = **NULL-RUN** (bug v pipeline — report §8); čeká na run 3 s opraveným skriptem |
| `hiran-maitreya` | lore/rag | `mockup` | run 1 adaptér validován → **overfit, neprodukční** při scale 1.0; **`--lora-scaled :0.5` použitelný interim** (report §7) |

### Natrénované adaptéry

| Adaptér | Base | Dataset | Eval | Artefakt |
|---|---|---|---|---|
| `zion-llama-lora-vast` | Llama-3.1-8B-Inst (bnb-4bit) | `hiran_curriculum_v2.1.jsonl` 3056 párů, 3 ep, seq 512 | **0.284 / ppl 1.33** | EDGE `/opt/zion/hiran/` (gguf + safetensors) + EDGE2 `/opt/zion/hiran-models/` |
| `zion-core-lora` ⚠️ | stejný | `zion_core.jsonl` 921 párů, 3 ep | eval 0.008 = **null-run** | degenerativní — trénoval jen SYSTEM_PROMPT (bug fixnut); archiv EDGE `zion-core-lora-final/` |

## 3. Artefakty — kde co leží

```
EDGE (62.171.141.136, ssh zion-v6):
  /opt/zion/hiran/
    hiran-lora-vast.gguf            335 MB   ← LoRA v GGUF (448 tensorů)
    base-gguf/Meta-Llama-3.1-8B-Instruct-Q5_K_M.gguf   5.7 GB  ← base pro servis
    zion-llama-lora-vast/           340 MB   ← safetensors adaptér + tokenizer
    base-fp16/                      15 GB    ← fp16 base (full merge později)
    hiran-adapter.tgz               313 MB   ← archiv adaptéru (md5 6c4ab3d…)
  /opt/llama.cpp                    ← clone (python tools, nebuildené)

EDGE2 (207.180.217.100, ssh zion-edge2):
  /opt/zion/hiran-models/
    hiran-v2.3mini-Q5_K_M.gguf      5.85 GB  ← produkční hiran-mini (:8002)
    Meta-Llama-3.1-8B-Instruct-Q5_K_M.gguf   5.73 GB ← base run 1/2 (md5 7a9dd5ff…)
    hiran-lora-vast.gguf            335 MB   ← adaptér run 1 (md5 42cf6508…)
  /opt/zion/llama-b11065/llama-server        ← binárka (umí --lora)
  RAM 11 GB — vedle hiran-mini (~5,8 GB mmap) se 8B vejde jen těsně;
  smoke test na :8010 proběhl, produkční servis = 👤 rozhodnutí

Vast rig 58077390:
  /root/hiran-train/outputs/zion-llama-lora/checkpoint-258   ← resume bod
  /root/hiran-train/outputs/zion-core-lora/                  ← run 2 (běží)
  /root/hiran-train/data/{zion_train,zion_core}.jsonl
  /root/hiran-train/.hf                  ← HF cache (bnb-4bit base, 5.4 GB)

Repo:
  Hiran/2.3/v21-legacy/finetune/finetune_lora.py   ← pipeline (s Vast env fixy)
  Hiran/2.3/data/hiran_curriculum_v2.1.jsonl       ← train dataset run 1
  Hiran/2.3/rebuild/HiranV2.2/data/curriculum/*.jsonl ← per-stage datasety
```

## 4. Training pipeline (jak to běží)

`finetune_lora.py` — QLoRA (bnb nf4 + double-quant), LoRA r=32/α=64/dropout 0.05,
all-linear target modules, grad-checkpointing, early stopping (patience 2),
90/10 train/eval split, `save_total_limit=3`.

**Vast env config (nutné pro 12GB kartu vedle minerů):**
```bash
ZION_BASE_MODEL=unsloth/Meta-Llama-3.1-8B-Instruct-bnb-4bit   # povinné — repo's quantization_config přepisuje náš
ZION_SKIP_FP32_UPCAST=1        # jinak ~2 GiB fp32 embed burst → OOM
ZION_MAX_SEQ_LENGTH=512        # hard truncate v kódu (trl max_seq_length nezkracuje)
PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
HF_HOME=/root/hiran-train/.hf
pip: torch==2.5.1+cu121 (driver 535 = max CUDA 12.2), trl 0.9.6, peft 0.21.2
```
Rychlost: ~118 s/opt-step (bs1×accum32) → ~3 h per 1000 párů na RTX 3060 + SRBMiner.
VRAM: model 5,31 GiB + SRBMiner 4,13 + activations ~1,5 ≈ 9,1/11,75 GiB.

## 5. Deploy recepta

### Runtime-LoRA (doporučené — bez full merge)
```bash
llama-server -m base-gguf/Meta-Llama-3.1-8B-Instruct-Q5_K_M.gguf \
  --lora hiran-lora-vast.gguf --port 80XX --ctx-size 8192
```
= merged kvalita, žádný 16 GB RAM merge. Adapter.gguf i base.gguf už jsou na EDGE.

### Full merge (jeden soubor, chce ≥24 GB RAM — např. local node PC)
```bash
python3 merge_export.py --adapter zion-llama-lora-vast --output zion-merged
llama.cpp/convert_hf_to_gguf.py zion-merged --outtype q5_k_m ...
```

### Zapnutí aliasu (EDGE2)
1. nový systemd servis `zion-hiran-maitreya` = llama-server ↑ na volném portu
2. `hiran-models.json`: alias `hiran-maitreya` → `mockup:false`, upstream `127.0.0.1:80XX`
3. `systemctl restart zion-hiran-gateway` + smoke `POST /v1/chat/completions`

## 6. Datové zdroje (další běhy)

| Dataset | Páry | Velikost | Role |
|---|---|---|---|
| `hiran_curriculum_v2.1.jsonl` | 3056 | 10,7 MB | generalist (run 1 ✅) |
| `curriculum/zion_core.jsonl` | 921 | 688 KB | V3/core specialist (run 2 🔵) |
| `curriculum/cross_domain.jsonl` | 1033 | 285 KB | cross-domain |
| `curriculum/zion_advanced.jsonl` | ~890 | 118 KB | advanced |
| `curriculum/foundation.jsonl` | ~1021 | 18 KB | základy |
| `curriculum/rag_synthesis.jsonl` | ~512 | 6 KB | RAG |
| `zion_train_buddhism_guided.jsonl` | malý | 7 KB | maitreya/lore flavor |
| builders | — | — | `data/build_dataset.py`, `boost_dataset.py`, `scrape_v3_docs.py` |

## 7. Migrace na local node PC (👤)

Doporučený postup:
1. Stáhni `hiran-adapter.tgz` + `base-gguf/…Q5_K_M.gguf` z EDGE (`/opt/zion/hiran/`)
   — scp/rsync; případně i `base-fp16` (15 GB) pro full merge.
2. Local: `llama-server -m …Q5_K_M.gguf --lora hiran-lora-vast.gguf` → ověř odpovědi.
3. S GPU ≥16 GB lze udělat plný merge → jeden Q5 gguf → deploy na EDGE2.
4. Vast rig zůstává pro run 2 + další experimenty (QTC mining jede dál ~200 MH/s,
   zion-miner po runu 2 k restartu na duty 28 — `vastctl launch zion --duty 28`).

## 8. Rizika a TODO

- ⚠️ Overfitting potvrzen validací (report §7): eval 0.284 = memorace. Adaptér přidává
  personu, ale **degraduje obecné schopnosti + safety** při scale 1.0. Interim řešení:
  `--lora-scaled :0.5` — persona drží, safety/generalita se vrací. Sweet spot ~0.5–0.6.
- 🔴 **BUG FIXNUT (2026-11-01):** `finetune_lora.py::format_for_llama3` tiše ignoroval
  `instruction/output` schéma → run 2 trénoval 921× jen system prompt (null-run).
  Fix: mapování na messages + diversity guard + ValueError. Syncnuto na rig.
- Run 3 doporučení: přegenerovat zion_core do `messages` formátu (Q&A, ne doc-dumpy)
  + replay data ~20 % obecných párů → potom rerun na rigu (~2,5 h, ~$0,14). 👤
- Deploy cesta `hiran-maitreya`: unit `/etc/systemd/system/zion-hiran-maitreya.service`
  = DRAFT na EDGE2 (port 8010, `--lora-scaled :0.5`, MemoryMax 7G — těsné vedle mini).
  Aktivace = daemon-reload + enable + `hiran-models.json` mockup:false + gateway restart. 👤
- Disk rigu: ~1,6 GB volných — před runem 3 čistit `outputs/*/checkpoint-*` a staré outputs.
- `hiran-models.json` změny = produkční config (deploy po smoke, rollback = vrátit `mockup:true`).
- zion-miner na rigu stále vypnutý (QTC + xmrig běží) — restart `vastctl launch zion --duty 28` = 👤.
- Base gated varianta: `meta-llama/Meta-Llama-3.1-8B-Instruct` (HF token) — license pozn. v pipeline; unsloth mirror = ungated.
