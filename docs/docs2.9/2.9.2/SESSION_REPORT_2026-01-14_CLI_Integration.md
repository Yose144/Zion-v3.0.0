# Session Report: CLI Configuration & Initial Peer Logic
**Date:** 2026-01-14
**Status:** Integrated

## 1. CLI Integration
Integrated `clap` to allow configuring the node at runtime. This is crucial for multi-node testing on a single machine.
- `--rpc-port`: Configures JSON-RPC API port (default: 8080)
- `--p2p-port`: Configures P2P listener port (default: 8089)
- `--data-dir`: Configures DB location (default: `./data/zion-core-v1`)
- `--peers`: Comma-separated list of initial peers to connect to (e.g., `127.0.0.1:8099`).

## 2. Bootstrapping Logic
Updated `p2p/mod.rs` to accept `initial_peers: Vec<String>`.
- **Logic:** Before starting the listener loop, the node attempts to connect to all provided peers.
- **Connection:** Spawns a task for each peer to `TcpStream::connect` and then `handle_connection`.

## 3. Architecture Ready
With this update, we can now run:
1. **Node A**: `cargo run -- --rpc-port 8000 --p2p-port 8009 --data-dir ./data/nodeA`
2. **Node B**: `cargo run -- --rpc-port 8001 --p2p-port 8010 --data-dir ./data/nodeB --peers 127.0.0.1:8009`

This setup enables the integration testing phase (syncing blocks/txs between Two Nodes).
