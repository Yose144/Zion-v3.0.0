# ZION 2.9.7 — Production Base Checklist

> Scope: CHv4 core compatibility + Revenue + NCL/NPU operational readiness.
> Date: 2026-03-03

## 1) Required runtime flags

Set explicitly in production environment:

- `ZION_NCL_ENABLED=1` (set `0` to hard-disable NCL RPC path)
- `ZION_NCL_ROUNDS=1000` (safe default; clamped to `100..20000`)
- `ZION_REVENUE_CONFIG=/config/ch4_revenue_settings.json`

Optional NPU flags for gateway:

- `NCL_NPU_ENABLED=1|0` (override provider autodetect)
- `NCL_GPU_ENABLED=1|0`

## 2) Config files

- Primary: `config/ch4_revenue_settings.json`
- Fallback: `config/ch3_revenue_settings.json`

Pool now prefers CHv4 config automatically when both are present.

## 3) Build gates (must pass)

Run before deploy:

```powershell
cargo check -p zion-pool
cargo check -p zion-miner
cargo test -p zion-cosmic-harmony-v3 algorithms_npu -- --nocapture
cargo test -p zion-pool test_algorithm_parsing -- --nocapture
cargo test -p zion-pool test_algorithm_all_known_aliases -- --nocapture
```

## 4) Functional smoke tests

### A. CHv4 alias path

- Connect miner with `--algorithm cosmic_harmony_v4`
- Verify pool accepts and routes as CosmicHarmony family
- Confirm reject storms are not present

### B. NCL RPC path

- `ncl.register` returns `status=registered`
- `ncl.get_task` returns `task_type=hash_chaining_v1`
- `ncl.submit` accepts valid result and returns `bonus_zion`
- `ncl.status` reports `enabled=true` and current `rounds`

### C. Metrics

Confirm counters increase on activity:

- `ncl_registered_total`
- `ncl_tasks_created_total`
- `ncl_tasks_submitted_total`
- `ncl_tasks_accepted_total`
- `ncl_tasks_rejected_total`

## 5) Go/No-Go criteria

Go live only if all true:

1. Build gates pass (no errors)
2. CHv4 miner shares accepted on pool
3. NCL task loop register/get/submit works end-to-end
4. NCL metrics increment correctly
5. `ZION_NCL_ENABLED` and `ZION_REVENUE_CONFIG` are pinned in deployment manifests

## 6) Known deferred items (not blocking 2.9.7 base)

- ONNX/CoreML model artifact integration (`native-npu` acceleration path)
- Final governance decision for CHv4 fork-height activation policy
- Persistent accounting of NCL bonus into payout DB pipeline
