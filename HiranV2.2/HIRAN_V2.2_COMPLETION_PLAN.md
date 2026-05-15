# Hiran v2.2 Completion Plan

> Post-training checklist a status tracker pro Hiran v2.2.

---

## Pre-Training (Done)

- [x] Curriculum pipeline design (`curriculum/curriculum_pipeline.py`)
- [x] Dataset expansion (5001 pairs, target 5000 met)
- [x] Data quality validation (0 duplicates, 0 toxic content)
- [x] Curriculum configs (`config/dynamic_lora.py`, `config/curriculum_config.json`)
- [x] Training scripts (`scripts/train_v2.2.py`, `scripts/run_training.sh`, `scripts/data_loader.py`, `scripts/trainer_utils.py`)
- [x] Evaluation scripts (`evaluate/evaluate_v2.2.py`, `evaluate/metrics.py`)
- [x] Merge & quantize helper (`scripts/merge_and_quantize.py`)
- [x] Vast sync + deploy scripts (`scripts/sync_curriculum_to_vast.sh`, `scripts/deploy_vast.sh`)
- [x] Dataset stats generated (`data/dataset_stats.json`)

## Training Execution (Pending GPU)

- [ ] Run 5-stage curriculum training on GPU (Vast.ai / local)
- [ ] Monitor convergence (TensorBoard, training_history.json)
- [ ] Auto-resume from checkpoints if pre-empted
- [ ] Save final adapters per stage

## Post-Training

- [ ] Merge final adapter into base model (`scripts/merge_and_quantize.py`)
- [ ] Quantize to GGUF variants (`quantization/hybrid_quant.py`)
- [ ] Run evaluation (`evaluate/evaluate_v2.2.py`)
- [ ] Verify perplexity < 1.5 and cross-domain accuracy > 75%
- [ ] Deploy inference server (`inference/serve.py`)
- [ ] Update docs and mark this plan complete

---

*Last updated: 2026-05-15*
