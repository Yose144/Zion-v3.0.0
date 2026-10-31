# 1.B3 — IA-06 P2P rollback verification (Fix C) + deployed-binary evidence

**Date:** 2026-10-31 · **Scope:** `V31/L1/core/src/p2p.rs::sync_peer`, `v3_chain.rs`, `v3_reorg.rs`, `node.rs::submit_block` · **Verdict:** PASS, Fix C live on all 3 production nodes; one documented residual (height-as-work-proxy)

## What IA-06 required (audit `INTERNAL_AUDIT_2026-10-05.md`, Fix C)

| Fix C requirement | Verified in code |
|---|---|
| Reorg only for a strictly longer peer chain | `p2p.rs:~329` `peer_height <= our_height` → early return; `validate_peer_branch` → `last.header.height <= our_height` → reject. Two-layer strictly-longer gate |
| Fetch + verify the competing branch BEFORE discarding local blocks | `validate_peer_branch` runs before `rollback_to_height`: non-empty, starts at `fork_height+1`, `previous_hash` links to our fork block, height-contiguous + hash-contiguous, ends strictly above our tip |
| Save our suffix, roll back, apply; on failure restore | `our_suffix = get_blocks_range(fork+1, our_height)` saved → `rollback_to_height` → per-block `submit_block` (full PoW `verify_header` + merkle + timestamp validation) → on error: rollback to fork + resubmit our suffix, error propagates |
| Depth-0 cases skip rollback | `depth == 0` → falls through to linear sync without touching our chain; no common ancestor within `P2P_SYNC_WALK_LIMIT` (64) → warn + keep local |

Fix C commit: **`c8f8e95f3`** (2026-10-05, "harden P2P fork choice") — the
production-relevant behavior is exactly the audited spec.

## Regression coverage (all green — `cargo test -p zion-core --lib p2p::` 14/14)

- `sync_peer_lagging_peer_keeps_our_chain` — the original IA-06 attack: lagging peer can no longer make us discard newer blocks
- `sync_peer_equal_height_different_tip_keeps_our_chain` — same-height ≠ longer → no reorg
- `sync_peer_adopts_longer_valid_fork` — the legitimate reorg still works
- `sync_peer_restores_chain_when_branch_fails_midway` — **the Fix C restore path**
- `sync_peer_rejects_non_linking_branch`, `sync_peer_simple_behind_still_syncs`
- 7× `validate_peer_branch_*` unit tests (empty, wrong start, bad link, non-contiguous, broken hash chain, not-longer)

## Cumulative work — honest assessment (residual)

Plan item asks "rollback jen na větší kumulovanou práci". The implementation
compares **height**, which is the codebase's deliberate work proxy:

- `v3_reorg.rs` states it explicitly: *"more total work (here, a greater height)"*
- Every accepted block is PoW-validated at `submit_block` (`verify_header` against
  `difficulty_to_target` + LWMA schedule) — a private branch cannot mint blocks
  below its era's consensus difficulty, so under honest mining a strictly-longer
  valid branch carries ≥ the work of ours
- `ForkChoice` in `v3_chain.rs` **does** track real `total_work` (`insert` sums
  per-block difficulty; `is_stronger` uses strict `>`) — but it has **0 callers
  outside its own file** (unwired engine, prepared for consensus use)

**Residual:** with variable LWMA difficulty, a sufficiently long miner-isolated
branch can in principle gain more height than accumulated work. The strictly-
correct fork choice (Σ total_work) exists as `ForkChoice` but wiring it into the
P2P path is a **consensus-facing change → outside the G8 freeze** → recommended
follow-up for the external auditor, not a silent patch. Current exposure window
is additionally narrowed by `P2P_SYNC_WALK_LIMIT = 64`.

## Deployed-binary verification (all 3 production nodes)

Probe: `node_version` field in `getStatus` was added **in the same commit** as
Fix C (`c8f8e95f3`) → its presence proves the fix is in the binary; marker
string `"reorg branch rejected at h="` confirms the restore path compiled in.

| Node | RPC | `node_version` | binary sha256 | marker | height / tip |
|---|---|---|---|---|---|
| EDGE2 `zion-v31-node` (primary) | 127.0.0.1:9445 | **3.2.0** | `02e83286e369b856…` | ✓ (1×) | 103479 / `d4f9397c…` |
| EDGE node (:9446) | 127.0.0.1:9446 | **3.2.0** | `02e83286e369…` | ✓ (1×) | 103479 / `d4f9397c…` |
| EDGE node (:9447) | 127.0.0.1:9447 | **3.2.0** | `02e83286e369…` | ✓ (1×) | 103479 / `d4f9397c…` |

All nodes agree on tip `d4f9397c00f02d…` at height ~103480 — healthy consistent
view, no divergence (matches the audit's note that the current follower→node1
topology exercises depth-0 only).

## Verdict

**PASS** — Fix C is implemented per spec, regression-tested (14/14 p2p tests),
and verified present in all 3 deployed node binaries (sha `02e83286…`, Oct-29
deploy). Residual: literal cumulative-work fork choice is a documented
simplification → external-audit follow-up, not a G8-window change.
