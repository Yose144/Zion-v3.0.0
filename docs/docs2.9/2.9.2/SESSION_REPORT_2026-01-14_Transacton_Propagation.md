# Session Report: Transaction Propagation & Full Duplex P2P
**Date:** 2026-01-14
**Status:** Feature Complete

## 1. Enhancements

### Network Layer Upgrade
- **Full Duplex**: Refactored `p2p/mod.rs` to split TCP sockets (`into_split`).
- **Channel Architecture**: `PeerManager` now holds `mpsc::Sender<Message>` for each connected peer. This allows asynchronous broadcasting without blocking the read loop.
- **Broadcast System**: The `Broadcaster` loop now iterates through active peer channels and sends messages efficiently.

### Transaction Propagation
- **Protocol**: Added `NewTx` (gossip), `GetTx` (request), and `Tx` (data) messages to `messages.rs`.
- **Logic**:
  - When `NewTx` is received, node checks local Mempool. If missing, it requests `GetTx`.
  - On `GetTx`, node serves transaction from Mempool.
  - On `Tx`, node calls `State::process_transaction`.
  - If valid, transaction is added to Mempool and re-broadcast via `tx_broadcaster`.

### State & Mempool
- **`process_transaction`**: Added to `State` logic.
  - Validates inputs (UTXO existence).
  - Checks against Mempool duplicates.
  - Adds to Mempool memory.
  - Triggers broadcast.

## 2. Validation
- `cargo check` passes.
- Architecture supports simultaneous Block and Transaction syncing.

## 3. Next Steps
- **Integration Test**: Spin up 2 nodes (different ports/dirs), connect them, submit a tx to Node A, verify Node B receives it.
- **PoW Mining Integration**: Ensure Mining module picks txs from Mempool (already standard).
