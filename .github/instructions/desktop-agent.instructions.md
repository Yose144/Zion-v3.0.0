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