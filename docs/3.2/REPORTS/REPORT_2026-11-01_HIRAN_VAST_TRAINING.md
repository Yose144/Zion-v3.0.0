# REPORT 2026-11-01 — Hiran QLoRA trénink na Vast.ai RTX 3060 (koexistence s miningem)

> **Status:** ✅ RUN 1 DONE (adaptér na EDGE) · 🔵 RUN 2 RUNNING (zion_core) · Autor: Devin
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

## 5. Deploy cesta (pending 👤)

- Servis: nový `llama-server` na EDGE2 (vzor `zion-hiran-inference`):
  `llama-server -m base-gguf/…Q5_K_M.gguf --lora hiran-lora-vast.gguf -p 80XX`
- Alias: `hiran-maitreya` (lore/rag) v `/etc/zion/hiran-models.json` — upstream na nový port, `mockup` → false po smoke testu
- Run 2 (`zion_core` specialist) → kandidát `hiran-issobella` (agentic) po dokončení
- Full merge varianta (jeden soubor) až na mašině s ≥24 GB RAM — `base-fp16` připraven na EDGE

## 6. Rizika/otevřené

- [ ] Disk rigu ~2 GB volných — run 2 output ~1,4 GB; při dalších běvech čistit
- [ ] Eval loss 0.284 = silné fitnutí na curriculum; validovat na held-out promptech před produkcí (overfitting check)
- [ ] zion-miner zůstává vypnutý — po runu 2 rozhodnout restart (duty 28)
- [ ] `hiran-inference` na EDGE2 je CPU llama.cpp — GPU servírování by šlo na local node PC (👤 migrace probíhá)

Související: `VAST-HIRAN-TRAINING-PLAN.md` (detail runu), `AIhiran.md` (přehled stacku),
`infra/RUNBOOK.md` (EDGE/EDGE2 topology).
