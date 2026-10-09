# Hiran (Hiranyagarbha) — ZION AI Native Layer

> **2026-10-09 RECOVERY WORKSPACE.** Původní trained artefakty (GGUF weights,
> LoRA checkpointy, trénovací datasety) byly ztraceny na poškozeném disku —
> `/mnt/data/Recovered/Hiran/` obsahuje jen zero-filled stuby (jména+velikosti
> správné, obsah nuly). Toto je živý workspace pro rebuild **2.3 → 2.5**.
> Archiv `archive/HiranV2.*` zůstává frozen reference.

## Co přežilo (zdroje pravdy)

| Artefakt | Kde | Stav |
|---|---|---|
| **v2.2 pipeline** (QLoRA curriculum, dataset buildery, eval, hybrid quant, RAG, inference) | `archive/HiranV2.2/` → zkopírováno do `Hiran/2.3/` | ✅ plná |
| **v2.1 finetune pipeline** (collect_dataset, finetune_lora, merge_export, vast scripts, H100/omni setup) | `Hiran/2.3/v21-legacy/` | ✅ plná |
| **Dataset shard** `zion_train_buddhism_guided.jsonl` (19 párů, chat format) | `Hiran/2.3/data/` | ✅ seed data |
| **v2.4 Maestro design** (architektura, agent hierarchy, service mesh, tool registry) | `Hiran/2.4/` (copy z `archive/HiranV2.4/`) | ✅ docs |
| **v2.5 Amṛtabhoja vision** | `docs/3.0.5/archive-root-md/HIRAN_EVOLUTION_2.3_TO_2.5_AMATHABOJ.md` (1155 ř.) | ✅ docs |
| **V31 ai-native crate** — 29 Rust modulů (~10k ř.): hiranyagarbha (Dharma Validator), orchestrator, rag, llm_backend, ekam_field, memory, message_bus, pool_optimizer, warp_agent, consciousness_engine… | `V31/L3/ai-native/` | ✅ živý kód |
| **L3 bridges** | `V31/L4/oasis/src/hiran_bridge.rs`, `V31/L6/issobella/src/hiran_bridge.rs` | ✅ živý kód |
| **agent-cli L3 klienti** (ai_client, ncl_client, warp_client) | `ZION_OS/agent-cli/src/l3/` | ✅ živý kód |
| **RAG korpus** — 49 md dokumentů (V3.2 docs, Deeksha, Autonomous Router, L5/L6 plány…) | Edge backup `/opt/zion/data/l3-rag-docs/` → `/mnt/data/zion-backups/edge/opt_zion/data/l3-rag-docs/` | ✅ data |
| **v2.3 train spec** — Qwen3-32B, DeepSpeed ZeRO-3 full FT, 48 436 párů, 2×A100 80GB (vast #40791384), checkpoint-8000 | `docs/3.0.1Genesis/HIRAN_V23_FULL_TRAIN_GUIDE.md`, `HIRAN_V2_3_CONTEXT.md`, `HIRAN_V2_3_MERGE_GUIDE.md`, `Hiran2.3Agent.md` | ✅ recept |
| **AI Native spec** | `HiranV2.1/AI_NATIVE_CONCEPT_2.9.md`, `AiNativev2.md`, `public/docs/*/ai-native/{README,cuda-x,ncl,oasis}.md`, `docs/v2.9.6/L3_AI_ARCHITECTURE.md`, `docs/2.9.9/archive/{AI-L3,CUDAX_L3_AI_NATIVE_PLAN,HIRANYAGARBHA_AI_NATIVE}.md` | ✅ docs |
| **PoC** | `archive/PoC-lab/poc-hiran/` (client, mock, types) | ✅ |
| **Docker inference** | `archive/V3/docker/hiran-inference/` | ✅ |
| **Učebnice** | `docs/book/ekam-deeksha/UCEBNICE-09-HIRANYAGARBHA.md` + nirvana/gemini chapters | ✅ |
| **Public page** | `APP&WEB/website-v2.9/src/app/l3-hiran/page.tsx` (v2.3 + AI Native + Amitabha v2.5 popis) | ✅ live |

## Co je ztraceno (regenerovatelné)

| Artefakt | Poznámka |
|---|---|
| `hiran-v2.3-8000-q5_k_m.gguf` (21.6 G) | Retrain z checkpointu nutný — recept v `HIRAN_V23_FULL_TRAIN_GUIDE.md` |
| `HiranV2.3-Checkpoints/checkpoint-8000` (LoRA HF, ~2 G) | — |
| v2.3 dataset `zion_train_hiran_v2.jsonl` (~11 M, 48 436 párů v guide) | Rebuild přes `data/build_dataset.py` + `boost_dataset.py` + scrape_v3_docs |
| v2.2 trained models (f16/q8/q5/q4/onnx) | Rebuild pipeline v `Hiran/2.3/` |
| `Recovered/WalletKeys/*` | ⚠️ nezávislá ztráta — ověřit klíče jinde |

## Rebuild path (2.3)

1. **Dataset** — `Hiran/2.3/scripts/rebuild_dataset.sh` (verified 2026-10-09):
   rebuilds `merged_seed.jsonl` = **1 558 unikátních párů** z `archive/V3/docs`
   (68 md) + NCL curriculum + buddhism shard (19) + v2.1 seed (47).
   **Dataset gap:** původní v2.2 = 22 181 párů (`baseline/dataset_stats.json`),
   v2.3 = 48 436 (train guide). Deterministický rebuild pokryje ~3 %.
   Doplnění vyžaduje generátor:
   - `collect_dataset.py` bez `--seed-only` potřebuje `NVIDIA_API_KEY` (NIM),
   - alternativa: lokální `~/zion-hiran/models/Qwen3-4B-Q4_K_M.gguf`
     (sha256 ověřen, přežil) jako syntetický QA generátor přes llama-server,
   - nebo nový scrape nad `V31/` + `docs/` (116+ md — dnes větší korpus než V3).
2. **Training**: vast.ai ≥ A100 80GB — **ověřit instanci 40791384**
   (lokální `~/.config/vastai/vast_api_key` je 401 invalid — potřeba čerstvý
   klíč; SSH `hiran_v2.4_key` byl na ztraceném D:). Recept:
   `HIRAN_V23_FULL_TRAIN_GUIDE.md` (DeepSpeed ZeRO-3, `save_total_limit=1`,
   ≥1 TB disk) nebo QLoRA varianta `scripts/train_v2.2.py` pro RTX 4090.
3. **Merge+Quant**: `scripts/merge_and_quantize.py`, `quantization/hybrid_quant.py`
   → `convert_hf_to_gguf.py` → Q4_K_M/Q5_K_M/Q8_0.
4. **Inference**: `inference/serve.py` + Edge `scripts/start-hiran-inference.sh`
   (port 8002, llama-server/Ollama/LM Studio chain) + `zion-v31-ai-native.service`
   (port 8001, RAG `/opt/zion/data/l3-rag-docs`).

## Edge L3 deployment (jak běžel před ztrátou)

```
zion-v31-ai-native.service (Rust API :8001)
  → LLM_BASE_URL=http://127.0.0.1:8002/v1  (llama-server + hiran-v2.2 GGUF)
  → ZION_DOCS_PATH=/opt/zion/data/l3-rag-docs (49 md — zálohováno)
  → ZION_NODE_RPC_ADDR=:9445, ZION_POOL_API_URL=:8080
```

Kanonický ai-native kód = **lokální `V31/L3/ai-native` (29 modulů, vč.
`lexical.rs`)**; Edge `V31` checkout je starší (28 modulů, jiný `lib.rs` +
`zion-ai-native-api.rs`), Edge `canonical-main`/`wt-main` = shodné s lokálem.

## Baseline (historická eval evidence → `Hiran/2.3/baseline/`)

- `model_interview_results.json` — v2.2 = **Llama-3.1-8B-Instruct** base
  (v2.3 přešel na Qwen3-32B), 20 otázek
- `e2e_test_results{,_v2}.json`, `gpu_experiment_results{,_v2}.json` —
  inferenční metriky (ollama backend :8002)
- `dataset_stats.json` — v2.2 curriculum rozpis: 22 181 párů
  (foundation 3 869 / zion_core 2 368 / zion_advanced 2 458 /
  cross_domain 11 434 / rag_synthesis 2 052)

## 2.4 Maestro → 2.5 Amṛtabhoja

- `Hiran/2.4/` — orchestrator design (implementace = aktivace V31/L3/ai-native
  orchestrator.rs + message_bus + tool_registry proti živým službám).
- `Hiran/2.5/` — Amṛtabhoja: Proof-of-Care NPU validátor, Dharma Validator v
  inference loop, plná L1–L6 orchestrace. Roadmap v evolution docu.
