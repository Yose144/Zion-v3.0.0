# HiranDev — Hiran (Hiranyagarbha) Recovery & Dev State

> Snapshot: **2026-10-09**. Recovery workspace po ztrátě modelových dat.
> Kanonický workspace: `Hiran/{2.3,2.4,2.5}` · frozen reference: `archive/HiranV2.*`
> Resume point pro další session.

## 1. Incident

- `/mnt/data/Recovered/Hiran/*` = převážně **zero-filled stuby** (jména+velikosti OK,
  obsah nuly). Totéž `Recovered/WalletKeys/*` ⚠️ — ověřit, že klíče existují jinde.
- **ALE: `hiran_curriculum_v2.1.jsonl` PŘEŽIL (10.7 MB, 3 056 párů, 100 % valid JSON,
  žádné nulové díry)** → `Hiran/2.3/data/` + SHA256 manifesty v2.1 artefaktů
  (`Hiran/2.3/baseline/*.SHA256` — hashe původních weights pro budoucí verifikaci).
- Ztraceno: `hiran-v2.3-8000-q5_k_m.gguf` (21.6 G), `checkpoint-8000` LoRA (~2 G),
  v2.3 dataset (48 436 párů), v2.2 modely (f16/q8/q5/q4/onnx), v2.1 weights
  (sha256 známy — pro verify budoucích nálezů), `hiran_project_scripts_data.tar.gz`.
- Git nikdy netrackoval weights/datasety → ztráta nevratná, jedině **retrain**.

## 2. Co přežilo — recovery map

| Artefakt | Kde | Stav |
|---|---|---|
| v2.2 pipeline (curriculum, dataset buildery, eval, hybrid quant, RAG, inference) | `Hiran/2.3/` (copy z `archive/HiranV2.2`) | ✅ plná |
| v2.1 finetune (collect_dataset, finetune_lora, merge_export, vast scripts) | `Hiran/2.3/v21-legacy/` | ✅ plná |
| **🏆 v2.1 curriculum** `hiran_curriculum_v2.1.jsonl` — **3 056 párů** (system=„Hiranyagarbha v2" prompt), 100 % valid | `Hiran/2.3/data/` (z `/mnt/data/Recovered/Hiran/` — jediný velký soubor co přežil) | ✅ RECOVERED |
| Dataset shard `zion_train_buddhism_guided.jsonl` (19 párů, messages) | `Hiran/2.3/data/` | ✅ |
| v2.4 Maestro design (arch/agents/mesh/tool-registry) | `Hiran/2.4/` | ✅ docs |
| **AI-native archive snapshots** | `archive/V3/L3/ai-native` = starší v2.4 snapshot (maestro/planner/tool_registry, odlišný od V31); `archive/2.9.9/legacy-code/L3/ai-native` = pre-Maestro (19 modulů). V31/L3 = kanonický | ✅ historie |
| **v2.1 eval + RAG manifesty** | `Hiran/2.3/baseline/e2e_results_v21.json` (reálné CZ RAG odpovědi) · `Hiran/2.3/data/rag/` (SuttaCentral classical+tibetan manifesty + pipeline config — recept přežil i bez corpus dat) | ✅ |
| **v1 Modelfile + system prompt** | `Hiran/2.3/inference/hiranyagarbha-v1.Modelfile` — originální Ollama system prompt Hiranyagarbha | ✅ |
| **Grafana dashboard** | `Hiran/2.3/inference/grafana-dashboard.json` (hiran-inference-overview) | ✅ |
| **CLI integrace** | `archive/V3/cli/src/{commands/hiran.rs,rpc/hiran_rpc.rs}` (352+94 ř.) → kopie v `Hiran/2.4/reference/` | ✅ |
| **Docker stack + desktop integrace** | `docker-compose.ai-native.yml`, `Dockerfile.v3.ai-native`, `HIRAN_V2.2_{CLI_INTEGRATION,COMPLETION_PLAN}.md`, `DesktopAgentP3.0.6/AI_NATIVE_*.md` → `Hiran/2.4/reference/` | ✅ |
| v2.5 Amṛtabhoja | `docs/3.0.5/archive-root-md/HIRAN_EVOLUTION_2.3_TO_2.5_AMATHABOJ.md` (1155 ř.) | ✅ docs |
| **ai-native crate — 29 modulů ~17k ř.** (hiranyagarbha/Dharma Validator, maestro, orchestrator, planner, tool_registry, layer_agents, health_poller, intent, rag, llm_backend, ekam_field, memory, message_bus, pool_optimizer, warp_agent, consciousness_engine, telemetry, task, autotuner, lexical, in_context, knowledge_base, oasis_bridge, hiran_inference, types, error) | `V31/L3/ai-native/` — **lokální = kanonický** | ✅ živý kód |
| Bridges | `V31/L4/oasis/hiran_bridge.rs`, `V31/L6/issobella/hiran_bridge.rs`, `ZION_OS/agent-cli/src/l3/` | ✅ |
| RAG korpus 49 md | `/mnt/data/zion-backups/edge/opt_zion/data/l3-rag-docs/` | ✅ |
| v2.3 train recept (Qwen3-32B, ZeRO-3, 48 436 párů, 2×A100, ckpt-8000) | `docs/3.0.1Genesis/HIRAN_V23_*` + `Hiran2.3Agent.md` | ✅ |
| v2.2 eval baselines | `Hiran/2.3/baseline/` (interview, e2e, gpu, stats) | ✅ |
| Inference scripts + openclaw wrapper | Edge backup `opt_zion/scripts/` | ✅ |
| AI Native spec + PoC | `public/docs/*/ai-native/`, `archive/PoC-lab/poc-hiran`, `archive/V3/docker/hiran-inference` | ✅ |

## 3. Klíčová fakta

- **v2.2 base = Llama-3.1-8B-Instruct** (unsloth) → **v2.3 = Qwen3-32B** full-FT.
- v2.2 curriculum = **22 181 párů** (foundation 3 869 / zion_core 2 368 /
  zion_advanced 2 458 / cross_domain 11 434 / rag_synthesis 2 052).
- **Edge L3 stack (před ztrátou):**
  `zion-v31-ai-native.service` (Rust :8001, RAG `l3-rag-docs`, node :9445,
  pool :8080) → `LLM_BASE_URL=http://127.0.0.1:8002/v1` →
  `start-hiran-inference.sh` (llama-server → LM Studio → Ollama → serve.py).
- `openclaw-hiran-wrapper`: bash wrapper maskující Hirana jako `claude` CLI
  (Ollama `hiran-v2.2-fast`) pro coding-agent skill.
- **ai-native canonicality**: local = 29 modulů (vč. `lexical.rs`) =
  Edge `canonical-main`/`wt-main`; Edge `V31` live checkout je starší (28).

## 4. Rebuild state — DONE ✅

- `Hiran/2.3/scripts/rebuild_dataset.sh` + `merge_rebuilt.py` →
  **`rebuild/merged_seed.jsonl` = 7 059 unikátních párů** (roste):
  - v2.1 curriculum **3 056** (RECOVERED — viz §1)
  - deterministic rebuild 1 558 (V3 scrape + boost + seeds)
  - syntetika Qwen3-4B **2 683+ a roste** (generátor běží → ~6k)
  - buddhism shard 19
- Rebuild/ output dir je reálný (ne symlink) → archive zůstává frozen.
- Baselines v `Hiran/2.3/baseline/`; merge tooling `scripts/merge_rebuilt.py`.

## 5. OPEN / next

| Blokér | Stav |
|---|---|
| **vast.ai instance 40791384** | ❌ **pryč — ověřeno API** (key nastaven 2026-10-09, account kredit **$0.61**). Checkpoint-8000 ztracen definitivně. |
| **Dataset gap**: **7 059 → ~10.5k** vs 22 181 (v2.2) / 48 436 (v2.3) | 🟢 výrazně lepší po nálezu v2.1 curriculum (3 056) — lokální syntéza dobíhá (2960/6185 chunků, ~47 parse errs). ~48 % v2.2 scale. Dál: víc párů/chunk, větší korpus, nebo NIM. |
| Retrain | QLoRA smoke: vast RTX 3090 $0.179/h (3.4 h za kredit) · real run: A100 40GB $0.375/h — potřeba dobít kredit |
| 2.4 wiring | ✅ **mapováno → `Hiran/2.4/WIRING_MAP.md`** — live Edge topology ověřena (ss+systemctl): 11 port-diffů v kódu (issobella 8097, dao 8456, node2/3 9446/9447, stats 8080…), :8002 = sshd inference tunnel, Maestro je CLI-only (není v :8001 API). Robustní plán: env endpoints, `/v2/*` mount + mutation gate + audit + breaker. `cargo check` čistý. |

**Lokální inference (běží)**: `~/zion-hiran/bin/llama-b11065/llama-server` +
`models/Qwen3-4B-Q4_K_M.gguf` na :8002 — GPU 1070 Ti částečný offload (15/36 vrstev,
zbytek CPU; miner drží 5.5 GB VRAM). Kvalita generovaných párů ověřena — grounded
z dokumentů, 0 chyb.
**Vast cheapest offers (2026-10-09)**: P40 $0.107/h (❌ Pascal), V100 $0.123,
**RTX 3090 $0.179 (id 44579216)**, RTX 4080S $0.221, Q RTX 8000 45GB $0.254,
A100 40GB $0.375 (id 54851465).

## 6. Commits

- `ae151b66d` — workspace Hiran/{2.3,2.4,2.5} + recovery map
- `e2027eddd` — dataset rebuild ověřen (1 558) + baselines + merge tooling
