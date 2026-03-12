---
description: "Use when working on APP&WEB/desktop-agent, Electron main process, mining fallback scripts, prepare-rust-miner packaging, or desktop mining UX."
applyTo: "APP&WEB/desktop-agent/**"
---

# Desktop Agent Instructions

## What This Area Owns

- APP&WEB/desktop-agent is the Electron desktop mining client.
- src/main.js is the runtime orchestrator for windows, tray, miner processes, logging, IPC, and pool/miner lifecycle.
- resources/mining contains Python and GPU fallback paths that must stay aligned with the Rust miner capabilities.
- scripts/prepare-rust-miner.js and package.json are packaging gates for shipping the bundled miner correctly.

## Practical Rules

- Treat src/main.js as a process orchestration file, not just UI glue. Changes there can affect mining lifecycle, reconnect behavior, logs, packaging, and auto-start.
- Preserve fallback chains. If you adjust algorithm selection or miner startup, verify the Rust path, Python fallback path, and packaged resources still agree.
- Do not assume README defaults are current. Prefer the runtime defaults in code and packaging scripts.
- Keep logging changes low-noise. main.js intentionally separates debug logging from console-visible metrics.

## Validation For Desktop-Agent Changes

- If src/main.js changed: run node --check APP&WEB/desktop-agent/src/main.js.
- If a Python miner fallback changed: run python3 -m py_compile on the touched file or files.
- If packaging inputs changed: inspect APP&WEB/desktop-agent/package.json and scripts/prepare-rust-miner.js together.
- If the task affects Deeksha mining behavior: verify references to cosmic_harmony_deeksha_fallback.py and related resource selection logic.

## Known Project Context

- package.json still reports version 2.9.7 in this workspace, while live network work is centered on 2.9.8. Do not auto-normalize that unless asked.
- Desktop-agent fixes often intersect with pool selection, worker naming, and mining process restarts. Prefer root-cause fixes over extra retries or UI-only messaging.
- When a change touches both Electron orchestration and miner resources, describe clearly which file is the source of truth for each behavior.

## Ekam Deeksha GPU Support (since 2026-03-11)

- Ekam Deeksha is the next-generation PoW pipeline: Blake3 XOF scratchpad init + Blake3 XOF mixing + 8-round Cosmic Fusion.
- GPU kernels exist for all three backends:
  - **Metal**: `cosmic_harmony_ekam_mine` / `cosmic_harmony_ekam_benchmark` in `metal_shader.metal`
  - **OpenCL**: `ekam_deeksha_mine` in `cosmic_harmony_deeksha_canonical.cl` (synced from `L1/cosmic-harmony/src/gpu/kernels/cosmic_harmony_deeksha.cl`)
  - **CUDA**: `ekam_deeksha_mine` + host API `ekam_cuda_mine()` in `cosmic_harmony_deeksha.cu`
- Python dispatch: `EkamDeekshaOpenCLBackend` in `cosmic_harmony_v42_gpu.py`, `Algorithm.COSMIC_HARMONY_EKAM_DEEKSHA` in `zion_native_miner_v2_9.py`
- Canonical CPU reference: `cosmic_harmony_ekam_deeksha()` in `L1/cosmic-harmony/src/deeksha.rs`
- Test vector: `6339f2fb178fe2957a10d9e2a84cf9d5e340064f0d165e845b6a54eaf7924fbd`
- When editing Ekam GPU kernels, keep all 4 copies in sync: `L1/cosmic-harmony/src/gpu/kernels/`, `L1/miner/src/miner/gpu/kernels/`, `L1/native-libs/all/`, `APP&WEB/desktop-agent/resources/mining/`