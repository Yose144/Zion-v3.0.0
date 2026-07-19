# ZION 3.0.6 Documentation Archive

This directory contains the root-level reports, plans and session notes that were produced during the **3.0.6 "Triple Parallel"** cycle. They are kept here as a historical reference; the current live status is always in the root [`StatusV3.md`](../../StatusV3.md).

## Canonical pointers (current)

| What | Where |
|------|-------|
| Live status | [`StatusV3.md`](../../StatusV3.md) |
| Forward roadmap | [`ROADMAP.md`](../../ROADMAP.md) |
| Agent rules | [`AGENTS.md`](../../AGENTS.md) |
| Main README | [`README.md`](../../README.md) |
| Current version overview | [`3.0.7.md`](../../3.0.7.md) |
| Triple Stream All Green plan | [`TRIPLE_STREAM_ALL_GREEN_PLAN.md`](../../TRIPLE_STREAM_ALL_GREEN_PLAN.md) |

## 3.0.6 archive contents

### Version overview & architecture
- [`3.0.6.md`](./3.0.6.md) — canonical 3.0.6 overview
- [`FullRevenueAuxPow.md`](./FullRevenueAuxPow.md) — multi-stream parallel mining architecture
- [`AuxPowTriplePlan.md`](./AuxPowTriplePlan.md) — implementation plan for Triple Parallel
- [`MultiAlgoPool.md`](./MultiAlgoPool.md) — 24-coin multi-algo pool design

### Performance & tuning
- [`CUDA_TUNING_RTX.md`](./CUDA_TUNING_RTX.md) — RTX 3090 CUDA tuning (303.8 KH/s)
- [`MINING_OPT_REPORT_2026-07-16.md`](./MINING_OPT_REPORT_2026-07-16.md) — SHA3-512 specialization, sequential passes cache
- [`30khsDeeksha.md`](./30khsDeeksha.md) — RX 5700 XT 28-32 KH/s settings
- [`TripleStream_AutoTune.md`](./TripleStream_AutoTune.md) — auto-tune GPU memory budget, M1-M5 compatibility
- [`SetupTripleAlgo.md`](./SetupTripleAlgo.md) — Apple Silicon Metal setup
- [`AUTOTUNE_STICKY_REPORT_2026-07-16.md`](./AUTOTUNE_STICKY_REPORT_2026-07-16.md) — hardware autotune + sticky header

### Mining reports by hardware
- [`M1_TRIPLE_STREAM_REPORT_2026-07-18.md`](./M1_TRIPLE_STREAM_REPORT_2026-07-18.md) — Apple M1 tuned results
- [`VegaRig.md`](./VegaRig.md) — Vega 64 SMOS configuration guide
- [`VEGA_64_I066D_REFLASH_REPORT_2026-07-17.md`](./VEGA_64_I066D_REFLASH_REPORT_2026-07-17.md) — Vega reflash to i066d image
- [`VEGA_RIG_DEBUG_REPORT_2026-07-16.md`](./VEGA_RIG_DEBUG_REPORT_2026-07-16.md) — Vega EPIC/BMI2 debug
- [`Vast1080.md`](./Vast1080.md) — GTX 1080 CUDA auto-detect test

### Coin-specific reports
- [`EPIC_PROGPOW_SHARE_FIX_REPORT_2026-07-19.md`](./EPIC_PROGPOW_SHARE_FIX_REPORT_2026-07-19.md)
- [`GPU_KERNEL_INTEGRATION_REPORT_2026-07-16.md`](./GPU_KERNEL_INTEGRATION_REPORT_2026-07-16.md)
- [`MINER_FIXES_REPORT_2026-07-16.md`](./MINER_FIXES_REPORT_2026-07-16.md)
- [`RandomXReport.md`](./RandomXReport.md)
- [`VerusHashReport.md`](./VerusHashReport.md)
- [`VRSC_STALE_FIX_REPORT_2026-07-16.md`](./VRSC_STALE_FIX_REPORT_2026-07-16.md)
- [`VRSC.md`](./VRSC.md)
- [`GHOSTRIDER_CN_FIX_REPORT.md`](./GHOSTRIDER_CN_FIX_REPORT.md)
- [`RTMdebug.md`](./RTMdebug.md)

### Session & operational reports
- [`SESSION_REPORT_2026-07-16.md`](./SESSION_REPORT_2026-07-16.md)
- [`TRIPLE_STREAM_E2E_REPORT_2026-07-16.md`](./TRIPLE_STREAM_E2E_REPORT_2026-07-16.md)
- [`TRIPLE_STREAM_FIX_REPORT_2026-07-18.md`](./TRIPLE_STREAM_FIX_REPORT_2026-07-18.md)
- [`PPLNS_Composite_Key_Fix_Report.md`](./PPLNS_Composite_Key_Fix_Report.md)
- [`bridgebug.md`](./bridgebug.md)
- [`AUDIT_CODE_VS_DOCS_2026-07-15.md`](./AUDIT_CODE_VS_DOCS_2026-07-15.md)
- [`AutoupdateMiner.md`](./AutoupdateMiner.md)
- [`EXPLORER_V4_ENGINE_PLAN.md`](./EXPLORER_V4_ENGINE_PLAN.md)
