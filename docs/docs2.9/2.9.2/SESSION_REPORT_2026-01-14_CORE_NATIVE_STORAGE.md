# Session Report: Core Native - Persistent Storage (2026-01-14)

## Overview
Implemented the **Persistence Layer** for the ZION Core Node using **LMDB** (Lightning Memory-Mapped Database).
This transition moves the node from an in-memory prototype to a persistent blockchain node that retains state across restarts.

## Completed Tasks

### 1. Storage Engine (`core/src/storage/lmdb.rs`)
- **Technology:** Rust `heed` crate (typed wrapper for LMDB) + `bincode` for serialization.
- **Database Structure:**
  - `blocks`: Hash -> Block (Serialized)
  - `height_to_hash`: Height -> Hash (Index)
  - `utxos`: "TxID:Index" -> TxOutput (Serialized)
- **Features:**
  - ACID transactions (atomic block application).
  - Fast reads (memory mapped).
  - Max DB size set to 10GB for V1.

### 2. State Integration (`core/src/state/mod.rs`)
- Replaced `Mutex<HashMap>` UTXO set with `ZionStorage` instance.
- **Genesis Handling:** On first run (empty DB), the node automatically injects the **Genesis Premine** (14.34B ZION) into the `utxos` database table.
- **Tip Restoration:** Loads chain height and tip from DB on startup.

### 3. RPC & Logic Updates
- Updated `submit_block` to atomically apply UTXO changes and save block to DB.
- Updated `submit_tx` to verify inputs against persistent storage.
- fixed `ed25519-dalek` verification logic (use `PublicKey` instead of `VerifyingKey`).

## Technical Debt / Notes
- **Error Handling:** Currently unwraps errors in some places; needs proper error propagation.
- **Validation:** Block inputs are checked against DB; effectively implements full node validation.
- **Locking:** `heed` handles internal locking, but we are inside an async runtime. Future optimization: run DB ops in `tokio::task::spawn_blocking`.

## Next Steps
- **P2P Implementation:** Now that we have storage, we can sync blocks from peers.
- **CLI Args:** Allow configuring DB path and ports via command line.
