# V31 Edge Network / P2P / RPC Stability Report
**Date:** 2026-08-10
**Session:** RPC peer log noise, P2P `hello` storm, active peer lifecycle
**Status:** ✅ PRODUCTION — no RPC/P2P warning spam, all 3 V31 nodes synced

## Executive Summary

Resolved the remaining V31 network stability issues on the Edge server:

1. **RPC `Connection reset by peer` warning flood** from dashboard/health-check disconnects.
2. **P2P `invalid P2P message: hello` warnings** caused by follower nodes running V3 sync loop against V31 P2P.
3. **P2P active peer churn / implicit slot holding** from short sync queries not half-closing the socket.

Post-fix verification: zero RPC disconnect warnings, zero `hello` P2P errors, all services `active`, chain height 1110.

## Verification (post-fix)

| Check | Result |
|---|---|
| `zion-v31-node` / `node2` / `node3` services | `active` |
| `zion-v31-pool` / `zion-v31-miner` | `active` |
| RPC `getChainInfo` height | `1110` (`accepted_blocks: 1111`) |
| RPC peer disconnect warnings (last 30 min) | 0 |
| P2P `invalid P2P message: hello` (last 30 min) | 0 |
| `getPeerInfo` on Node 1 | `active_count: 4`, `known_count: 6` (bounded, not growing) |

## Root Causes Fixed

### 1. RPC logs treated normal client closes as warnings

**Files:** `V31/L1/core/src/rpc.rs`

The RPC handler used `?` on I/O errors and logged every client-side close as:

```
WARN zion_core::rpc: RPC peer 127.0.0.1:... disconnected: IO error: Connection reset by peer
```

This spammed the journal because dashboard health checks, short JSON-RPC probes and TLS/binary probes open and immediately close TCP sockets.

**Fix:**
- Added `is_benign_rpc_disconnect()` helper that treats `ConnectionReset`, `ConnectionAborted`, `BrokenPipe`, `UnexpectedEof`, `NotConnected` and `InvalidData` as normal.
- Updated `handle_socket`, `handle_raw_tcp` and `handle_http` to return `Ok(())` for benign client closes instead of propagating a warning.

### 2. V31 follower nodes accidentally ran V3 P2P sync

**Files:** `/etc/systemd/system/zion-v31-node2.service`, `/etc/systemd/system/zion-v31-node3.service`

The deployed Edge service files for `zion-v31-node2` and `zion-v31-node3` were missing `--v3-no-genesis`. Because `Node::run` spawns the V3 sync loop unless `--v3-no-genesis` is set, the followers tried to handshake with Node 1 using the legacy V3 `Hello` message on the V31 P2P port (8335).

This produced:

```
WARN zion_core::p2p: invalid P2P message: unknown variant `hello` ...
```

**Fix:**
- Added `--v3-no-genesis` to `zion-v31-node2.service` and `zion-v31-node3.service` on the Edge server.
- Ran `systemctl daemon-reload` and restarted both followers.
- Repo `V31/deploy/systemd/zion-v31-node{2,3}.service` already contained the flag; only the live server copies were stale.

### 3. P2P sync clients did not half-close the socket

**File:** `V31/L1/core/src/p2p.rs`

`get_status`, `get_blocks` and `gossip` opened a `TcpStream`, wrote a request, read the reply and returned. Because `WriteHalf` was never `shutdown()`, the remote server's `handle_peer` read loop stayed parked waiting for the next line, holding the `PeerGuard` (active inbound slot) until the kernel eventually timed out the connection.

**Fix:**
- Added `let _ = writer.shutdown().await;` after reading the response in `get_status`, `get_blocks` and `gossip`.
- Added 60s read and 30s write timeouts in `handle_peer` as a defensive backstop for any client that fails to close.
- Added the peer address to the `invalid P2P message` warning to make future debugging easier.

## Commits

- `087eae5d7` — `fix(p2p): report real active/known peers and stop peer-set bloat`
- `cd631c24d` — `fix(p2p,rpc): quiet client disconnect logs and tighten P2P connection lifecycle`

## Operational Changes on Edge

- Deployed new `zion-node` binary to `/opt/zion/V31/target/release/zion-node`.
- Restarted `zion-v31-node`, `zion-v31-node2`, `zion-v31-node3`, `zion-v31-pool`, `zion-v31-miner`.
- Updated `/etc/systemd/system/zion-v31-node2.service` and `zion-v31-node3.service` to include `--v3-no-genesis`.
- Ran `systemctl daemon-reload`.

## Files Changed in Repository

- `V31/L1/core/src/p2p.rs`
- `V31/L1/core/src/rpc.rs`
- `V31/L1/core/src/peer_manager.rs` (as part of `087eae5d7`)

## Follow-up

- Mining-specific issues will be handled in a separate session.
- Continue monitoring `getPeerInfo` `active_count`; it should remain bounded at ~4 for the current 2-follower topology.
