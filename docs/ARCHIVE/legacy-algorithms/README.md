# 🗄️ Legacy Algorithm Archive

> **Archived:** 15. února 2026  
> **Reason:** CHv3 Unification — single algorithm implementation

These files were removed from `core/src/algorithms/` during the CHv3 unification.
They are kept here for historical reference only.

## Files

| File | Original Path | Description |
|------|--------------|-------------|
| `cosmic_harmony_v1.rs` | `core/src/algorithms/cosmic_harmony.rs` | Original CH v1: 12-round golden ratio mixing, u32 state, SHA-256 IV. **289 lines** |
| `cosmic_harmony_v2.rs` | `core/src/algorithms/cosmic_harmony_v2.rs` | CH v2: Memory-hard with 4MB scratchpad, dynamic params. **482 lines** |

## Why archived (not deleted)

- Historical reference for consensus compatibility debugging
- Test vector comparison if needed
- Git blame preservation

## Current production algorithm

**Cosmic Harmony v3** lives in `cosmic-harmony/` crate (`zion-cosmic-harmony-v3`):
- 5-phase pipeline: Keccak→SHA3→GoldenMatrix→(Scratchpad)→CosmicFusion
- Memory-hard scratchpad (256KB) activated at fork height
- Single source of truth for core, pool, and miner
