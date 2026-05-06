# ZION TerraNova v2.9.8 — Ekam Deeksha Canonical Path

> Release window: March 2026  
> Role in lineage: canonical runtime unification after the v2.9.7 pre-mainnet gate

v2.9.8 unifies the consensus path into a single canonical branch `cosmic_harmony` (Ekam Deeksha) while preserving operational compatibility with CHv3 revenue subsystems.

## What matters

- One canonical PoW profile for network runtime.
- NPU/GPU acceleration remains acceleration, not a separate consensus branch.
- Consolidated rollout on the active public host with internal seed containers.
- Ongoing compatibility for revenue streams (pool/proxy/scheduler wiring).

## Operations summary

- Topology: one public host + internal seed containers.
- Rollout: rebuild + reset + verified block production.
- Validation outcome: chain runs, pool accepts shares, miner reports accepted work.

## Documents in this line

- `v2.9.8/changelog.md` — short release delta summary
- `v2.9.8/runtime.md` — runtime policy and compatibility

## Lineage

- v2.9.7: stability and documentation pre-mainnet gate
- v2.9.8: canonical runtime unification
- v2.9.9: pure-code cleanup and migration prep toward a clean V3 mainnet track
