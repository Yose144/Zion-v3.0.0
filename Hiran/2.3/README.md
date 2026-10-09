# Hiran 2.3 — Rebuild Workspace

**Cíl:** znovu vycvičit Hiran v2.3 (Qwen3-32B) po ztrátě weights + datasetu.

## Původní recept (z `docs/3.0.1Genesis/HIRAN_V23_FULL_TRAIN_GUIDE.md`)

- **Base:** Qwen/Qwen3-32B (32.8B params, 128K ctx, Apache-2.0)
- **Metoda:** DeepSpeed ZeRO-3 full fine-tune (ne QLoRA)
- **Hardware:** vast.ai 2× A100 SXM4 80GB, ≥1 TB disk, `save_total_limit=1`
- **Dataset:** ~48 436 párů
- **Výstup:** checkpoint-8000 → layer-wise merge → F16 GGUF → **Q5_K_M 21.6 GB**
- **Cena:** ~$50 (36–48 h)

## Postup rebuildu

```bash
# 1. Dataset — buildery jsou tu, zdrojová data v repu + l3-rag-docs
python3 data/scrape_v3_docs.py        # V31/V3 docs → pairs
python3 data/build_dataset.py         # curriculum assembly
python3 data/boost_dataset.py         # rozšíření na 8000+
python3 data/validate_dataset.py      # QA
# seed: data/zion_train_buddhism_guided.jsonl
# korpus: /mnt/data/zion-backups/edge/opt_zion/data/l3-rag-docs/ (49 md)

# 2. Training — lokálně (RTX 4090) jen QLoRA varianta; full-FT → vast.ai
pip install -r requirements-train.txt
python3 scripts/train_v2.2.py --dry_run
# vast: v21-legacy/finetune/vast_deploy.sh + sync_curriculum_to_vast.sh

# 3. Merge + quant
python3 scripts/merge_and_quantize.py
python3 quantization/hybrid_quant.py

# 4. Inference — inference/serve.py, Modelfile-4k/8k/safe
```

## Klíčové otázky před startem

- [ ] Existuje vast.ai instance **40791384** ještě? → checkpoint-8000 může přežít tam
- [ ] Je `~/.ssh/vast/hiran_v2.4_key` dostupný? (byl na Windows D:)
- [ ] Reuse v2.2 curriculum (5 stage, dyn LoRA) nebo v2.3 full-FT (dražší, lepší)?

## Odkazy

- Původní pipeline: `archive/HiranV2.2/` (frozen)
- v2.1 scripts: `v21-legacy/` (vast deploy, H100 setup, merge_export)
- Train guide: `docs/3.0.1Genesis/HIRAN_V23_FULL_TRAIN_GUIDE.md`
- Merge guide: `docs/3.0.1Genesis/HIRAN_V2_3_MERGE_GUIDE.md`
- Agent spec: `docs/3.0.1Genesis/Hiran2.3Agent.md`
