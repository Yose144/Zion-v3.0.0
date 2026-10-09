# Hiran v2.2 Completion Plan — Dokončení a Přemostění k v2.3

> **Status:** Active — dataset rebuilt, ready for training  
> **Created:** 2026-05-13  
> **Updated:** 2026-05-18  
> **Target:** Dokončit v2.2 training → quantization → eval → deployment, pak začít v2.3 data collection  
> **Depends on:** `HiranV2.2/README.md`, `HiranV2.2/TRAINING_IMPLEMENTATION_PLAN.md`, `HiranV2.2/DETAILED_IMPLEMENTATION_PLAN.md`

---

## 1. Current State Summary

### ✅ Completed
| Item | Detail |
|------|--------|
| Dataset | **3,226 pairs** across 5 curriculum stages (local rule-based generation). Source: `HiranV2.2/scripts/build_curriculum.py` |
| Dataset validation | All 5 stages present, correct `instruction/output` format, global dedup OK |
| Training scripts | `train_v2.2.py`, `dynamic_lora.py`, curriculum pipeline ready |
| Vast sync + deploy scripts | `sync_curriculum_to_vast.sh`, `deploy_vast.sh`, `run_training.sh` ready |
| CLI + Docker integration | `HIRAN_V2.2_CLI_INTEGRATION.md` — fully merged |

### 🔄 Ready to start
- **5-stage curriculum training** on Vast.ai (or local GPU ≥16 GB VRAM)
- Dry-run: `python HiranV2.2/scripts/train_v2.2.py --dry_run`
- Full run: `bash HiranV2.2/scripts/run_training.sh`

### ⏳ Remaining (this plan)
- Phase 2-A: All 5 curriculum stages (Foundation → Zion Core → Zion Advanced → Cross-Domain → RAG Synthesis)
- Hybrid quantization (Q4_K_M, Q5_K_M, Q8_0, ONNX)
- Multi-backend inference testing
- Vast.ai deployment + Docker image
- Final model validation & release tag

---

## 2. Phase Breakdown

### Phase 2-A: Complete Training Pipeline (~2–3 days)

#### 2-A.1 Zion Core Stage — Complete
- [ ] Verify `checkpoints_vast/zion_core/` has final checkpoint (should be ~450–500 steps for 3 epochs)
- [ ] Confirm final loss < 0.55 and stable (no spikes > 1.0 in last 50 steps)
- [ ] If loss diverges: reduce LR to `5e-5`, resume from last good checkpoint
- [ ] Log final metrics to `training_history.json`

#### 2-A.2 Zion Advanced Stage
- [ ] Load best Zion Core checkpoint as base
- [ ] Config: rank=32, alpha=64, dropout=0.05, LR=1e-4, epochs=2
- [ ] Run 891 pairs × 2 epochs ≈ 1782 samples → estimate ~6–8 hours on RTX 4090
- [ ] Target: loss < 0.50, grad_norm stable < 1.0

#### 2-A.3 Cross-Domain Stage
- [ ] Config: rank=64, alpha=128, dropout=0.02, LR=5e-5, epochs=2
- [ ] Run 1,033 pairs × 2 epochs ≈ 2066 samples → estimate ~8–10 hours
- [ ] Target: cross-domain accuracy > 80% (evaluated post-hoc)

#### 2-A.4 RAG Synthesis Stage
- [ ] Config: rank=64, alpha=128, dropout=0.02, LR=5e-5, epochs=1
- [ ] Run 512 pairs × 1 epoch ≈ 512 samples → estimate ~3–4 hours
- [ ] Target: RAG-context coherence score > 0.85 (manual sample eval)

#### 2-A.5 Full Curriculum Checkpoint Merge
- [ ] Merge stage LoRAs or use final adapter from last stage
- [ ] Save unified adapter to `checkpoints_vast/hiran-v2.2-final-adapter/`
- [ ] Back up to local or second Vast instance

**Phase 2-A Exit Criteria:**
- All 5 stages complete with logged metrics
- Final checkpoint exists and loads without error
- `training_history.json` contains all stages

---

### Phase 3: Quantization (~1 day)

- [ ] **GGUF conversion** using `llama.cpp` convert script:
  - Merge base model + final LoRA adapter into single FP16
  - Quantize to Q8_0, Q5_K_M, Q4_K_M
- [ ] **ONNX export**:
  - Use `optimum` or manual export for cross-platform inference
  - Verify with ONNX Runtime CPU and GPU (CUDAExecutionProvider)
- [ ] **TensorRT** (optional / deferred to v2.3):
  - If time allows, build TensorRT engine from ONNX for NVIDIA deployment
- [ ] **Validation**:
  - Run perplexity eval on holdout set for each variant
  - Ensure Q4_K_M perplexity < 1.4, Q5_K_M < 1.2, Q8_0 < 1.1
  - Sanity-check generation quality on 10 hand-picked prompts

**Artifacts:**
```
HiranV2.2/models/
├── hiran-v2.2-f16.gguf
├── hiran-v2.2-q8_0.gguf
├── hiran-v2.2-q5_k_m.gguf
├── hiran-v2.2-q4_k_m.gguf
└── hiran-v2.2-onnx/
```

---

### Phase 4: Inference Testing (~1–2 days)

- [ ] **llama.cpp backend**
  - Load each GGUF variant, measure tokens/sec on CPU and GPU
  - Verify chat template formatting matches training prompt template
- [ ] **ONNX backend**
  - CPU inference latency < 2s per 256-token response
  - GPU inference latency < 500ms per 256-token response
- [ ] **Multi-backend comparison**
  - Same 20 prompts across all backends
  - Score consistency (BLEU or manual 1–5 rating)
- [ ] **Memory profiling**
  - Q4_K_M peak RAM < 8GB, Q5_K_M < 12GB, Q8_0 < 16GB
- [ ] **Edge test**
  - Run Q4_K_M on a machine with 16GB RAM, no GPU — must respond in < 5s

---

### Phase 5: Deployment & Release (~1 day)

- [ ] **Vast.ai deployment**
  - Deploy inference API with Q5_K_M or Q8_0 variant
  - Configure healthcheck endpoint (`/health`)
  - Set up auto-restart on crash
- [ ] **Docker image**
  - `Dockerfile` based on `nvidia/cuda` or `python:slim` for CPU
  - Bundle chosen model variant + `llama-server` or ONNX Runtime
  - Publish image tag `hiran-v2.2-{variant}`
- [ ] **ZION CLI integration**
  - Verify `zion hiran chat` and `zion hiran status` commands work with deployed endpoint
  - Update CLI config docs in `HIRAN_V2.2_CLI_INTEGRATION.md`
- [ ] **Documentation**
  - Update `HiranV2.2/README.md` — mark all phases complete
  - Update `StatusV3.md` — add Hiran v2.2 release note
  - Write `HiranV2.2/CHANGELOG_v2.2.md` with training metrics and known limitations
- [ ] **Git tag**
  - `git tag -a hiran-v2.2.0 -m "Hiran v2.2 release — 5001 pairs, 5-stage curriculum, multi-backend"`
  - Push tag: `git push origin hiran-v2.2.0`

---

## 3. Quick Reference Commands

```bash
# === MONITOR TRAINING ===
# SSH into Vast and tail logs
ssh root@<host>.vast.ai -p <port>
tail -f HiranV2.2/checkpoints_vast/logs/*/trainer_state.json

# TensorBoard (if running locally or via port-forward)
tensorboard --logdir HiranV2.2/checkpoints_vast/logs

# === QUANTIZE ===
# Merge adapter + base, then quantize (run on Vast or local with enough VRAM)
python3 HiranV2.2/scripts/merge_and_quantize.py \
  --base_model <path> \
  --adapter HiranV2.2/checkpoints_vast/hiran-v2.2-final-adapter \
  --output_dir HiranV2.2/models

# === EVAL ===
python3 HiranV2.2/evaluate/evaluate_v2.2.py \
  --model HiranV2.2/models/hiran-v2.2-q5_k_m.gguf \
  --benchmarks perplexity,quality \
  --backend llama.cpp

# === DEPLOY ===
docker build -t hiran-v2.2:latest -f HiranV2.2/Dockerfile .
docker run -d -p 8000:8000 --gpus all hiran-v2.2:latest
```

---

## 4. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Vast instance pre-empted / billing issue | Training interrupted | Enable checkpoint save every 100 steps; back up to S3 or second Vast |
| CUDA OOM during advanced stages (rank 64) | Crash | Use gradient checkpointing; reduce batch size to 2 if needed |
| Loss divergence in cross-domain stage | Poor generalization | Lower LR to 2e-5; add warmup steps |
| Quantized model quality drop > 20% | Bad user experience | Fall back to Q8_0 as default; keep F16 for high-quality mode |
| ONNX export fails for custom architecture | No cross-platform support | Defer ONNX to v2.3; ship GGUF only for v2.2 |

---

## 5. Bridge to Hiran v2.3

Once v2.2 is tagged and deployed, immediately begin v2.3 groundwork in parallel:

1. **Data collection** (week 1 of v2.3 timeline)
   - Start scraping Zion Oasis blueprints, game mechanics docs
   - Collect programming datasets (HumanEval, MBPP, Zion smart contracts)
   - Begin web-browsing tool-use dataset curation
2. **Infrastructure**
   - Request quotes for H100/A100 cluster (RunPod, Vast, Lambda)
   - Set up DeepSpeed / FSDP test environment on smaller model
3. **Keep v2.2 inference live**
   - v2.2 deployment serves as production fallback while v2.3 trains
   - Use v2.2 RAG pipeline to augment v2.3 data collection

See `HiranV2.3/README.md` and `HiranV2.3/IMPLEMENTATION_PLAN.md` for full v2.3 scope.

---

## 6. Sign-Off Checklist

- [ ] All 5 curriculum stages trained and logged
- [ ] At least 2 GGUF variants validated (Q5_K_M + Q4_K_M)
- [ ] Inference latency within targets on target hardware
- [ ] Docker image builds and runs
- [ ] ZION CLI commands verified against deployed model
- [ ] `hiran-v2.2.0` git tag pushed
- [ ] `StatusV3.md` updated with release note
- [ ] Handoff doc written for v2.3 team lead

---

*Generated 2026-05-13. Update this file as phases complete.*
