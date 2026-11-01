# REPORT 2026-11-01 — Hiran QLoRA trénink na Vast.ai RTX 3060 (koexistence s miningem)

> **Status:** ✅ RUN 1 DONE + VALIDOVÁN (overfit; mitigace `--lora-scaled`, viz §7) · ⚠️ RUN 2 = NULL-RUN (dataset se do tréninku nedostal — §8) · Autor: Devin
> Rig: vast.ai **58077390** · RTX 3060 12 GB · $0.0544/h · `root@ssh6.vast.ai:27582`

## 1. Souhrn

Na existující Vast.ai instanci proběhl **QLoRA fine-tune `Meta-Llama-3.1-8B-Instruct`**
(LoRA r=32/α=64, all-linear) nad datasetem `hiran_curriculum_v2.1.jsonl` (3056 párů),
**souběžně s produkčním SRBMiner QTC miningem** na jedné GPU. Výsledný adaptér
(eval_loss 0.284, ppl 1.33) je uložen na EDGE a převeden do GGUF. Druhý běh nad
`zion_core.jsonl` (specialist) běží.

**Klíčový výsledek:** trénink 8B QLoRA na 12GB kartě vedle 4.2 GiB mining procesu
je proveditelný — za cenu vypnutí `zion-miner` (👤 rozhodnutí) a tří kódových fixů.

## 2. Timeline a metriky

| Fáze | Čas | Pozn. |
|---|---|---|
| Mining setup | 19:00Z | ZION native + SRBMiner QTC, pearl zrušen; laděno na QTC ~200 MH/s @ ZION 28 % duty |
| Deps | 19:50–20:30Z | torch 2.14 (CUDA 13) → driver fail → **`torch==2.5.1+cu121`**, +`rich` |
| Smoke | 20:40–21:15Z | 4× OOM → 3 fixy (§4) → PASS 30 párů/1 epocha |
| 👤 zion off | 21:20Z | `zion-miner` vypnut kvůli VRAM; QTC zůstává |
| **Full run 1** | 21:37Z→06:13Z | 258 steps / 3 epochy, ~118 s/step, **8,6 h** |
| Výsledek | 06:13Z | train_loss 3.68→…, **eval_loss 0.284, ppl 1.33** |
| Transfer | 08:23–08:45Z | adaptér 313 MB → EDGE `/opt/zion/hiran/` (md5 ověřen) |
| GGUF | 09:11Z | `convert_lora_to_gguf` → `hiran-lora-vast.gguf` 335 MB + base Q5_K_M 5,7 GB |
| **Run 2** | ~10:50Z | `zion_core.jsonl` 921 párů / 3 epochy, `hiran-ft2` |

### Mining dopad
QTC SRBMiner běžel celou dobu: ~200 MH/s mimo trénink, ~130–140 MH/s za sdílení GPU
(6h avg 128.8 MH/s). Shares 100 % accepted. GPU: 9.1 GiB used / 100 % / 75 °C.

## 3. Artekty (kanonické lokace)

| Artefakt | Lokace |
|---|---|
| **Adaptér (GGUF)** | EDGE `/opt/zion/hiran/hiran-lora-vast.gguf` (335 MB, 448 tensorů) |
| **Adaptér (safetensors)** | EDGE `/opt/zion/hiran/zion-llama-lora-vast/` + `hiran-adapter.tgz` (md5 `6c4ab3d…`) |
| **Base Q5_K_M** | EDGE `/opt/zion/hiran/base-gguf/Meta-Llama-3.1-8B-Instruct-Q5_K_M.gguf` (5,7 GB) |
| **Base fp16** | EDGE `/opt/zion/hiran/base-fp16/` (15 GB — pro budoucí full merge) |
| Checkpoints | rig `outputs/zion-llama-lora/checkpoint-258` (+ `outputs/zion-core-lora` run 2) |
| Zdroje | `Hiran/2.3/v21-legacy/finetune/finetune_lora.py` (s novými env fixy), `VAST-HIRAN-TRAINING-PLAN.md` |

## 4. Technické nálezy (co bylo nutné opravit)

1. **`torch` verze:** HF wheels jsou CUDA 13 (torch 2.14) — driver 535 umí max 12.2.
   → `torch==2.5.1` z indexu `download.pytorch.org/whl/cu121`.
2. **Model quantization_config override:** `unsloth/*-bnb-4bit` má vlastní
   `quantization_config` v config.json → náš `BitsAndBytesConfig` se ignoruje;
   `llm_int8_enable_fp32_cpu_offload` a `max_memory` proto **nefungují**,
   `device_map={'':0}` = celý model (5,31 GiB) povinně na GPU.
3. **fp32 upcast burst:** `prepare_model_for_kbit_training` castuje embed na fp32
   (~2 GiB burst) → OOM vedle minerů. Fix `ZION_SKIP_FP32_UPCAST=1` v kódu.
4. **`trl==0.9.6` `max_seq_length` nezkracuje** před-tokenizovaný `text` sloupec →
   fp32 logits ~1 GiB při seq ~2000. Fix: hard truncate přes tokenizer
   (`max_length=512`, decode zpět) přímo v `finetune_lora.py`.
5. **VRAM rozpočet:** 11,75 − SRBMiner 4,13 − model 5,31 ≈ 2,3 GiB prostor;
   seq 512 logits ≈ 263 MiB ✓.
6. **Disk:** cu13 wheels po torch downgrade držely ~5 GB (sdílené soname) →
   `pip uninstall` rozbil `libcudnn.so.9`/`libnccl.so.2` → force-reinstall cu12
   balíčků nutný; hlídat `df` — 20 GB overlay je tight.

## 5. Deploy cesta → **archiv (strategie 👤 2026-11-01)**

- Žádný produkční deploy: artefakty se ukládají na EDGE jako zásoba pro
  **FULL training na větší kartě** (8B nestačí — příprava `HIRAN-FULL-TRAINING-PREP.md`).
- EDGE archiv přeházen: `/opt/zion/hiran/{adapters,base,datasets}/`
  (`adapters/run1-vast`, `adapters/run2-core-null`, `base/{fp16,gguf}`).
- DRAFT unit `zion-hiran-maitreya.service` na EDGE2 zůstává jako runtime reference
  (`--lora-scaled` pattern), neaktivní.
- Alias `hiran-maitreya` zůstává `mockup:true`; run 2 → `hiran-issobella` bez artefaktu (null-run).

## 6. Rizika/otevřené

- [ ] Disk rigu ~2 GB volných — run 2 output ~1,4 GB; při dalších běvech čistit
- [x] ~~Eval loss 0.284 = silné fitnutí na curriculum; validovat na held-out promptech~~ → §7: overfit POTVRZEN
- [ ] zion-miner zůstává vypnutý — po runu 2 rozhodnout restart (duty 28)
- [ ] `hiran-inference` na EDGE2 je CPU llama.cpp — GPU servírování by šlo na local node PC (👤 migrace probíhá)

## 7. Validace adaptéru run 1 (held-out smoke, 2026-11-01 ~11:00Z)

Artefakty přeneseny EDGE→EDGE2 (`/opt/zion/hiran-models/`, md5 ověřeny: lora `42cf6508…`, base `7a9dd5ff…`).
Test: `llama-server` b11065 na `:8010` (manuální run, ne servis), base Q5_K_M ± `--lora hiran-lora-vast.gguf`,
ctx 2048, 8 held-out promptů (`hiran-smoke-prompts.json` vedle reportu), ~90 s/odpověď na CPU.

### Base vs LoRA (stejné prompty, stejný system prompt)

| Oblast | Base Llama-3.1-8B | + `zion-llama-lora-vast` |
|---|---|---|
| Persona | obecná AI odpověď, žádný ZION kontext | ✅ správná ZION persona — crates, V3, `zion status/doctor` |
| Doména (UTXO) | — | povrchní, repetitivní, nezodpověděl pointu (getUtxos vs getBalance) |
| Mining stack | — | ⚠️ halucinace („SRB = Stellar Rescue Back", blake3) |
| Rust kód | — | použitelná struktura, type error, useklé na 220 tok |
| Obecná čeština (recept) | gramaticky slabá, ale **sanity recept** | gramaticky slabá + **nesmysl** (ovesná kaše, klobásky, křepelčí játra v pomazánce) |
| Refusal (priv. klíč) | ✅ **čisté odmítnutí** + vysvětlení | ❌ pláče dokola, **leak system-prompt textu** („Zdroj: ZION ekosystém. Licence: MIT") |

### Verdikt

- **Eval 0.284 = memorace curriculum**, ne generalizace. Adaptér přidává doménovou personu,
  ale **degraduje obecné schopnosti a safety** base modelu (catastrophic forgetting + prompt leak).
- Česká gramatika je slabá v obou variantách — limitace Llama-3.1-8B samotné, adaptér ji ještě zhoršuje.
- **Není production-ready** pro `hiran-maitreya` open chat. Alias zůstává `mockup:true`.

### Doporučení další iterace

1. ~~Vyzkoušet **checkpoint-86**~~ — na rigu už neexistuje (disk 93 %, save_total_limit
   ho smazal; zbyl jen final checkpoint-258). Místo něj otestováno **`--lora-scaled :0.5`** ↓
2. Retrain varianty: 1 epocha místo 3; nižší LR; **replay data** (přimíchat ~20 % obecných
   českých/instruction párů do curriculum, jinak forgetting pokračuje); eval na skutečném
   held-out setu, ne na curriculum splitu.
3. Run 2 (zion_core, 921 párů): eval_ep1 0.0226 / ep2 0.0080 — vypadalo jako extrémní
   overfit, ve skutečnosti **NULL-RUN** → §8.

## 8. Run 2 = NULL-RUN — root cause (nalezeno validací)

Adaptér `zion-core-lora-ep1` (checkpoint-26) byl otestován na EDGE2 stejnými prompty:
**každá odpověď kolabuje do smyčky „mimo strom mimo strom…"** s úlomky ZION slovníku
(„Ekam Deeksha PoW", „V3/"). Repetition attractor i na obecných otázkách.

**Root cause — schéma datasetu, ne hyperparametry:**

- `finetune_lora.py::format_for_llama3` čte `entry["messages"]`. `zion_core.jsonl` má
  schéma `instruction/input/output` → `entry.get("messages",[])` vrátilo `[]` → kód
  tiše syntetizoval `[{system: SYSTEM_PROMPT}]` → **tréninkový text = 921× stejný
  system prompt**. Data se do runu vůbec nedostala.
- SYSTEM_PROMPT obsahuje „Ekam Deeksha", „Legacy **stromy** mimo V3" → adaptér jen
  memoroval konstantní sekvenci (eval 0.008 = perfektní memorace jedné věty).
- Srovnání datasetů: run 1 `hiran_curriculum_v2.1.jsonl` = `messages` chat formát,
  skutečné Q&A česky → fungoval. zion_core = 876/921 identických instrukcí
  „Explain this ZION concept:" + anglické doc-dumpy jako „odpovědi".

**Fix v repu (commit této session):**

- `format_for_llama3` nyní mapuje `instruction/input/output` → `user/assistant`
  messages; prázdný/neznámý záznam = `ValueError` (žádný silent fallback).
- Nový **diversity guard**: < 25 % unikátních sekvencí po formátování = fail-fast
  před spálením GPU času.
- Ověřeno lokálně na obou schématech + prázdném záznamu.

**Stav artefaktů run 2:** `checkpoint-26/52/78` + final adaptér na rigu
`outputs/zion-core-lora/` — degenerativní, **nepoužitelný**; ep1 GGUF převeden
(`hiran-core-lora-ep1.gguf`) čistě jako důkaz diagnózy. Final adaptér archivován
na EDGE bez konverze.

**Run 3 (doporučení):** opravený pipeline + zion_core v `messages` formátu
(nechat build_dataset vygenerovat Q&A místo doc-dumpů) → ~2,5 h GPU na rigu.
Rozhodnutí 👤 (cost ~$0,14 GPU + čas). Opravený `finetune_lora.py` syncnut na rig.

### Mitigace bez retrainu: `--lora-scaled` (ověřeno)

`llama-server --lora-scaled hiran-lora-vast.gguf:0.5` (4 diagnostické prompty, scale 0.5):

| Prompt | Scale 1.0 | Scale 0.5 | Scale 0.7 |
|---|---|---|---|
| persona | silná ZION persona (crates, V3) | ZION persona drží, bez detailů | ✅ silná persona zpět (crates, `zion` příkazy) |
| general_cz (recept) | nesmysl | sanity struktura | sanity struktura (drobné divnosti — base limit) |
| refusal | leak system promptu | ✅ čisté odmítnutí + přesměrování | ⚠️ refusal čistý, ale ocas echa („Odpovídej česky") |
| warp_relay | rozbitá čeština, opakování | koherentní, správná rizika | koherentní, správná rizika, lepší struktura |

→ **Scale 0.5 = nejbezpečnější, 0.7 = nejlepší persona s drobným echo residue. Sweet spot ~0.5–0.6.**
Reálná cesta: `hiran-maitreya` může jít live s `--lora-scaled :0.5–0.6` jako interim
(deploy pořád 👤), dokud nepřijde retrain s replay daty.

Související: `VAST-HIRAN-TRAINING-PLAN.md` (detail runu), `AIhiran.md` (přehled stacku),
`infra/RUNBOOK.md` (EDGE/EDGE2 topology).
