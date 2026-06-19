# ZION V3 — Audit Summary

**Date:** 2026-06-19 (updated 13:20 CEST)  
**Branch:** `main`  
**Scope:** `V3/` Rust workspace (L1–L6, SDK, CLI) + Edge server operational state  
**Auditor:** Kilo / automated agent

---

## TL;DR

The `V3/` workspace compiles (`cargo check --workspace` passes), but it is **not CI-clean**:

- `cargo fmt --all --check` ❌ fails — **431 diff blocks across 80 files** in every layer (L1–L6, CLI), not just CLI/L6.
- `cargo clippy --workspace -D warnings` ❌ fails — **92+ errors total**, including 31 in consensus-critical `L1/cosmic-harmony`.
- Full workspace tests time out in debug builds; `zion-core` unit tests run but PoW-heavy tests are correctly ignored in debug.
- **Edge server (77.42.71.94):** node + dashboard up, but `zion-edge-pool.service` is `inactive` while a manually-started pool holds port 8444 (systemd restart loop fails with `Address already in use`). SSH became unreachable mid-audit (port 22 timeout).
- No L1 files were modified during this audit per `AGENTS.md` L1 security protocol.

> **Note:** This supersedes the optimistic "vynikající formě / Mainnet ready" conclusion in `V3/AUDIT_REPORT_V3.md` (2026-06-09). The runtime/chain may be live, but the **source tree does not pass CI gates** as of this date.

---

## Build & Validation Status

| Check | Result | Detail |
|---|---|---|
| `cargo check --workspace` | ✅ Passes | warnings only (dead code, unused imports/vars) |
| `cargo test --workspace` | ⚠️ Times out | PoW-heavy in debug |
| `cargo test -p zion-core` | ⚠️ Times out | ~500 unit tests OK before timeout; slow PoW tests `#[ignore]` |
| `cargo fmt --all --check` | ❌ Fails | 431 diff blocks / 80 files |
| `cargo clippy --workspace -D warnings` | ❌ Fails | L1 cosmic-harmony blocks whole workspace |

---

## Formatting Drift (cargo fmt)

431 diff blocks across **80 files**, spanning all layers:

| Layer | Files affected (examples) |
|---|---|
| L1 core | `bin/node.rs`, `lib.rs`, `genesis.rs`, `bridge.rs`, `peer_block_validation.rs`, util bins |
| L1 cosmic-harmony | `deeksha_lite.rs`, `deeksha_lite_fire.rs`, `scratchpad_ekam.rs`, `revenue.rs`, `stream_layers.rs`, `lib.rs` |
| L1 miner | `main.rs`, `gpu_backend.rs`, `gpu_guard.rs`, `interactive.rs`, `ui.rs`, `parallel.rs`, `b3_verify.rs`, `banner.rs` |
| L1 pool | `bin/server.rs`, `lib.rs`, `ncl_gateway.rs`, `pplns.rs`, `revenue_proxy.rs` |
| L2 | `dao/*` (8 files), `atomic-swap/tests`, `swap-aggregator/orchestrator.rs` |
| L3 | `warp/adapter/*`, `ncl/backend.rs`, `ai-native/*` |
| L4 | `oasis/quests.rs`, `oasis/server.rs`, `oasis/hiran_bridge.rs` |
| L5 | `free-world/*` (6 files) |
| L6 | `issobella/*` (6 files) |
| CLI | `commands/*` (12 files), `config.rs`, `lib.rs`, `main.rs`, `tests/topology_e2e.rs` |

⚠️ `cargo fmt --all` touches L1 files — per `AGENTS.md` those changes must be reviewed/approved separately.

---

## Clippy Errors by Layer (`-D warnings`)

| Crate | Errors | Highlights |
|---|---|---|
| **L1 `zion-cosmic-harmony`** | 31 | needless_range_loop, manual_swap, manual_div_ceil, doc_overindented_list_items, needless_borrows, needless_return, manual_range_contains. **Protected — explicit approval required.** |
| **L2 `zion-bridge`** | 13 | manual_div_ceil, manual_repeat_n, too_many_arguments, assertions_on_constants, field_reassign_with_default, unnecessary_map_or |
| **L2 `zion-dao`** | 7 | unused_variables (`consent.rs`), cast_abs_to_unsigned, field_reassign_with_default |
| **L2 `zion-atomic-swap`** | 2 | new_without_default, unnecessary_sort_by |
| **L3 `zion-warp`** | 28 | new_without_default (stub adapters), dead_code (`LightningAdapter`), needless_borrows, iter_skip_next, manual_div_ceil, unnecessary_sort_by, too_many_arguments, op_ref, unnecessary_literal_unwrap, get_first, identity_op |
| **L3 `zion-ncl`** | 1 | clone_on_copy |
| **L4 `zion-oasis`** | 10 | unnecessary_sort_by, unnecessary_map_or, len_zero |
| **L5/L6/SDK/CLI** | n/a | Blocked: workspace clippy aborts at L1 cosmic-harmony before reaching these crates |

**Total non-L1 clippy errors confirmed: 61. L1: 31. Grand total ≥ 92.**

---

## Runtime / Code Quality Observations

- **Lock-poisoning panics:** `L1/core/src/bin/node.rs` and `L1/pool/src/bin/server.rs` use many `.expect("...poisoned")` / `.expect("lock")` calls. A poisoned mutex panics the node/pool. Grep found 1,651 `panic!`/`unwrap()`/`expect()`/`TODO`/`FIXME` matches across `V3/`.
- **Dead code in core:** `looks_like_utxo_address` (`lib.rs`) and `genesis_merkle_root` (`genesis.rs`) are never used.
- **Miner warnings:** 48 `cargo check` warnings in `zion-miner` (dead code, unused Windows VEH structs, unused imports).

---

## Edge Server Operational Findings (77.42.71.94)

Captured during a working SSH window before connectivity dropped.

| Component | Systemd | Process | Port | State |
|---|---|---|---|---|
| Node 1 (+follower) | `zion-edge-node1` active | `zion-node` PID 1276187 / 1276189 | 8333 / 8443 | ✅ Running |
| Pool | `zion-edge-pool` **inactive (dead)** | `zion-pool-server` PID 1152855 (manual) | 8444 | ⚠️ Running outside systemd |
| DAO | `zion-edge-dao` active | — | 8450 | ✅ |
| WARP | `zion-edge-warp` active | — | 8453 | ✅ |
| Node 2 | `zion-edge-node2` inactive | — | 8334 | ⚠️ Inactive |
| Dashboard (Rust) | — | `zionos-dashboard` PID 807123 | 8888 | ✅ Listening |
| Dashboard (Python) | — | `app.py` PID 981641 | — | ✅ Running |

**Issue — pool port conflict:** `zion-edge-pool.service` is in a restart loop failing with `Address already in use (os error 98)` on `0.0.0.0:8444`, because a manually-started `zion-pool-server` (PID 1152855, since Jun 18) already binds 8444. The live pool is functional but **not managed by systemd**, so it will not auto-restart on reboot.

**Resolution (apply when SSH is restored):**
1. `kill 1152855` (or `pkill zion-pool-server`)
2. `systemctl reset-failed zion-edge-pool; systemctl restart zion-edge-pool`
3. `systemctl status zion-edge-pool` and confirm bind on 8444
4. `systemctl enable zion-edge-pool` to survive reboot

**Other notes:**
- `zion-edge-pool.service` is `preset: enabled` but currently `disabled` — re-enable after fix.
- `zion-edge-node2` inactive; only node1 + follower are serving.
- Dashboard `GET /api/health` returned an error on port 8888 — health route may be missing/renamed.
- SSH to port 22 timed out repeatedly after the first window (server network/SSH transient). Could not apply the fix autonomously this session.

---

## Doc / Version (resolved 2026-06-19)

The canonical line is **v3.0.2** (git tag `v3.0.2` → commit `31d12f34`; `main` is ahead with later 3.0.2 work). Versions were unified during this pass:

- `V3/Cargo.toml`, `V3/config/bridge-mainnet.toml`, `V3/config/bridge-testnet.toml`: **3.0.1 → 3.0.2** ✅
- `V3/README.md`: now **3.0.2** ✅
- Root `README.md` / `ROADMAP.md`: now **v3.0.2** ✅
- `V3/AUDIT_REPORT_V3.md` (2026-06-09) labels the code "Mainnet Ready / vynikající formě" — contradicted by current fmt/clippy failures (correction banner added to that file).

---

## Recommended Actions

**Code / CI**
1. Run `cargo fmt --manifest-path V3/Cargo.toml --all` (stage L1 changes separately for human review per `AGENTS.md`).
2. Fix L2/L3/L4 clippy errors (mechanical: `.div_ceil()`, `sort_by_key`, `Default` impls, remove needless borrows/clones, `is_some_and`/`is_none_or`).
3. Resolve L1 `zion-cosmic-harmony` clippy errors **only with explicit human approval** (or add scoped `#[allow(...)]`).
4. Re-run clippy on L5/L6/SDK/CLI once L1 is unblocked.
5. Run slow tests in release: `cargo test --release --manifest-path V3/Cargo.toml --workspace -- --ignored`.
6. Sync `V3/README.md` version to 3.0.1.
7. Harden lock-poisoning `expect()` in `node.rs`/`server.rs`.

**Operations (Edge)**
8. Kill the orphaned manual pool, restart + enable `zion-edge-pool.service` (steps above).
9. Decide whether `zion-edge-node2` should be running; start/enable if intended.
10. Fix dashboard `/api/health` route on port 8888.
11. Investigate the SSH port-22 timeout (firewall/fail2ban/network) for reliable remote ops.

---

**Actionable fix plan:** [`/DEBUG_3.0.2.md`](./DEBUG_3.0.2.md) — phased debug plan with per-file clippy locations, L1 approval gates, test/runtime/Edge steps.

---

*Full audit detail is in the conversation transcript. No source files were modified during this audit (docs + version strings only).*
