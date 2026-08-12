# V31 vs V3 Gap Analysis

**Date:** 2026-08-12
**Auditor:** Devin

## Executive Summary

V31 represents a major architectural refactoring from V3, with significant consolidation of L2/L3 modules into a unified **Multi-Chain** crate, extensive V3 compatibility layers in L1 core, and removal of several CLI commands. The V31 codebase is more modular but has removed several standalone features that existed in V3.

## Module Comparison

| Module (V3 path) | V31 Path | Status | Notes |
|-----------------|----------|--------|-------|
| **L1/core** | V31/L1/core | **Ported (Enhanced)** | V31 has 21 binaries vs 9 in V3. Added V31-native implementation (block.rs, chain_state.rs, consensus.rs, mempool.rs, node.rs, node_runtime.rs, p2p.rs, transaction.rs, utxo.rs, v31_wallet.rs) plus V3 compatibility layer (v3_*.rs files: 16 files for bridge, chain, checkpoint, mempool, p2p, rpc, state, tx, validation, wallet, node_builder). |
| **L1/cosmic-harmony** | V31/L1/cosmic-harmony + cosmic-harmony-v3 | **Ported (Split)** | V31 split into two crates: cosmic-harmony (canonical V31) and cosmic-harmony-v3 (V3 compatibility). V3 had single crate. |
| **L1/miner** | V31/L1/miner | **Ported (Refactored)** | V31 has 48 files vs 16 in V3. Added auxpow/ subdirectory (13 files: client, dual_stratum, gpu_miner, hasher, native, parent_chains, progpow_codegen, pure, scheduler, true_auxpow, types), gpu/ subdirectory, stream architecture (stream.rs, stream_profit.rs), v3_pool_client.rs. Removed b3_verify binary. |
| **L1/pool** | V31/L1/pool | **Ported (Expanded)** | V31 has 31 files vs 7 in V3. Added auxpow_bridge, auxpow_runtime, block_tracker, deferred_payout, notifications, payout, profit_switcher, rate_limit, revenue_scheduler, routing, share_forwarder, share_relay, telemetry, template_cache, tls, v3_pplns, v3_protocol, validator, vardiff. Removed revenue-proxy binary (bin/revenue-proxy.rs). |
| **L1/types** | V31/L1/types | **Ported (Enhanced)** | V31 expanded dependencies (sha3, blake3, k256, ed25519-dalek, thiserror, chrono). V3 had minimal types. |
| **L1/native-ffi** | V31/L1/native-ffi | **Ported (Identical)** | Identical C source files and Cargo.toml. Features kawpow, kheavyhash, randomx declared but no C implementation (stubs in both versions). |
| **L2/bridge** | V31/L2/multichain/src/bridge | **Merged** | Standalone bridge crate merged into multichain as bridge/ submodule. |
| **L2/dao** | V31/L2/dao | **Ported (Enhanced)** | V31 added runtime.rs. Otherwise similar file structure. |
| **L2/atomic-swap** | V31/L2/multichain/src/swap/htlc | **Merged** | Standalone atomic-swap crate merged into multichain swap/htlc module. |
| **L2/swap-aggregator** | V31/L2/multichain/src/swap/dex/aggregator | **Merged** | Standalone swap-aggregator merged into multichain swap/dex/aggregator. |
| **L2/multichain** | V31/L2/multichain | **New (Unified)** | New unified crate (76 files) consolidating bridge, swap/dex, wallet, credits, and warp. Includes contracts/, docker/lightning/, scripts/lightning/. |
| **L3/warp** | V31/L2/multichain/src/warp | **Moved** | Standalone warp crate moved to multichain as warp/ submodule. |
| **L3/ncl** | V31/L3/ncl | **Ported** | Similar file structure (9 files each). |
| **L3/ai-native** | V31/L3/ai-native | **Ported** | Similar file structure (31 files each). |
| **L4/oasis** | V31/L4/oasis | **Ported** | V31 has 27 files vs 28 in V3 (minor difference). |
| **L5/free-world** | V31/L5/free-world | **Ported (Simplified)** | V31 uses workspace dependencies, simplified Cargo.toml. |
| **L6/issobella** | V31/L6/issobella | **Ported (Simplified)** | V31 uses workspace dependencies, simplified Cargo.toml. |
| **sdk** | V31/sdk | **Ported (Enhanced)** | V31 added zion-l1-types, zion-multichain dependencies. Added reqwest, hex, sha3. |
| **cli** | V31/cli | **Partial (Reduced)** | V31 removed many command files: doctor.rs, mine.rs, pool.rs, wallet.rs, node.rs, swap.rs, monitor.rs, status.rs, onboard.rs, explorer.rs. Only agent, atomic_swap, auxpow, completions, compose, dao, deploy, free_world, hiran, issobella, ncl, topology, update, warp remain. |

## Key Findings

### 1. Major Architectural Changes

**L2/L3 Consolidation**: V31 consolidated multiple standalone L2/L3 crates into a unified `zion-multichain` crate:
- `L2/bridge` -> `multichain/src/bridge`
- `L2/atomic-swap` -> `multichain/src/swap/htlc`
- `L2/swap-aggregator` -> `multichain/src/swap/dex/aggregator`
- `L3/warp` -> `multichain/src/warp`

### 2. V3 Compatibility Layer

V31 L1 core includes extensive V3 compatibility through `v3_*.rs` files (16 files):
- v3_bridge.rs, v3_chain.rs, v3_checkpoint.rs, v3_compat.rs, v3_full_checkpoint.rs
- v3_mempool.rs, v3_node_builder.rs, v3_p2p.rs, v3_reorg.rs, v3_rpc.rs
- v3_state.rs, v3_template.rs, v3_tx.rs, v3_validation.rs, v3_wallet.rs

### 3. Missing/Stubbable Features in V31

**CLI Commands Removed** (archive/V3/cli/src/commands/):
- `doctor.rs` - Health check diagnostics
- `mine.rs` - Mining operations management
- `pool.rs` - Pool statistics and management
- `wallet.rs` - Wallet operations (encryption, key management)
- `node.rs` - Node management
- `swap.rs` - Swap operations
- `monitor.rs` - Monitoring
- `status.rs` - Status reporting
- `onboard.rs` - Onboarding
- `explorer.rs` - Explorer integration

**Pool Binary Removed**:
- `revenue-proxy` (archive/V3/L1/pool/src/bin/revenue-proxy.rs) - Not present in V31

**Miner Binary Removed**:
- `b3_verify` (archive/V3/L1/miner/src/b3_verify.rs) - Not present in V31

**Native Algorithm Stubs** (both V3 and V31):
- `native-kawpow` - Declared in Cargo.toml but no C implementation
- `native-kheavyhash` - Declared in Cargo.toml but no C implementation
- `native-randomx` - Declared in Cargo.toml but no C implementation

Only `native-etchash`, `native-autolykos`, `native-blake3-algo`, `native-cosmic-harmony`, `native-verushash`, `native-ghostrider` have C implementations.

### 4. File Count Comparison

| Layer | V3 Files | V31 Files | Delta |
|-------|---------|-----------|-------|
| L1/core | 43 | 61 | +18 |
| L1/miner | 16 | 48 | +32 |
| L1/pool | 7 | 31 | +24 |
| L2/bridge | 19 | 0 (merged) | -19 |
| L2/atomic-swap | 10 | 0 (merged) | -10 |
| L2/swap-aggregator | 6 | 0 (merged) | -6 |
| L2/multichain | 0 | 76 | +76 |
| L3/warp | 52 | 0 (moved) | -52 |
| L3/ncl | 9 | 9 | 0 |
| L3/ai-native | 31 | 31 | 0 |
| L4/oasis | 28 | 27 | -1 |
| CLI commands | 22 | 13 | -9 |

## Recommendations

1. **CLI Restoration**: Consider porting critical CLI commands (doctor, wallet, mine, pool) to V31 for operator usability.
2. **Native Algorithms**: Either implement C code for kawpow/kheavyhash/randomx or remove stub features from Cargo.toml to avoid confusion.
3. **Revenue Proxy**: Determine if revenue-proxy functionality is needed in V31 or if it's been superseded by multichain.
4. **Documentation**: Update V31 documentation to reflect the new multichain architecture and removed CLI commands.
5. **Migration Path**: Document how V3 users should migrate to V31 given the CLI command changes and service consolidation.
