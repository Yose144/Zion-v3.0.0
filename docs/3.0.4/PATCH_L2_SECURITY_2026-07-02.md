# L2 Security Patch — 2026-07-02

> **Scope:** `V3/L2/**` (bridge, atomic-swap, dao). No L1 consensus changes.
> **Verification:** `cargo test --manifest-path V3/Cargo.toml -p zion-atomic-swap -p zion-bridge -p zion-dao` → **324 passed, 0 failed**.
> **Status:** ✅ DEPLOYED on Edge (2026-07-02 18:54, verified 23:00 UTC). All L2 security fixes active.
> **Cross-ref:** F1 exploit post-mortem + Edge server hardening: [`SecurityFirst.md`](./SecurityFirst.md) · Forensic timeline: [`SecurityBackup.md`](./SecurityBackup.md) · L1 fix: [`CRITICAL_3.0.4_SECURITY_FINDINGS.md`](./CRITICAL_3.0.4_SECURITY_FINDINGS.md)

> **UPDATE 2026-07-02 23:00 UTC:** L2 patch (commit `a8b3821e`) je **DEPLOYED na Edge**. MD5 shoda ověřena mezi `/usr/local/bin/zion-*` a `V3/target/release/zion-*` — binárky z 18:54 (build po commitu v 15:55) obsahují všechny L2 security fixy. Node binary swapnut na nejnovější verzi (22:55). Vše aktivní: claimant guard, threshold 5/5, reorg safety, key hygiene, checked cast, composite dedup, escrow key zeroing, memo cap.

## Findings addressed

| ID | Severity | Component | Fix |
|----|----------|-----------|-----|
| C1 | CRITICAL | atomic-swap | Pre-committed claimant + mainnet bearer_token required |
| H1 | HIGH | bridge + atomic-swap | Checked cast `amount_zion` u128→u64 (no silent truncation) |
| H2 | HIGH | bridge | Composite dedup key `(type, tx_id)` for UTXO+account scan |
| H3 | HIGH | bridge | Mainnet threshold==5-of-5 enforced in `validate_runtime()` |
| M1 | MEDIUM | bridge | EVM reorg: pause cursor advance on `removed:true` logs |
| M2 | MEDIUM | atomic-swap | Wall-clock sanity check at startup (NTP skew warning) |
| M3 | MEDIUM | bridge | Gas price retry-once before fallback (congestion safety) |
| M4 | MEDIUM | bridge | Key-loading logs downgraded `info!`→`debug!` |
| L1 | LOW | bridge | Fail-fast security limit parse at startup |
| L2 | LOW | atomic-swap | Escrow signing key zeroed on `Drop` |
| L3 | LOW | dao | Memo length cap (256 B) before parse |

## Changed files

### atomic-swap (6 files)
- `src/types.rs` — `HtlcRecord.claimant_address: Option<String>`; `SwapMemo::Lock` extended; parser accepts optional 6th memo field `:<claimant_zion>`; 2 new tests.
- `src/db.rs` — additive migration `ALTER TABLE htlc_locks ADD COLUMN claimant_address TEXT`; all SELECTs + `row_to_record` updated; test fixture updated.
- `src/executor.rs` — `execute_claim` enforces `recipient == claimant_address` when set; `Drop` impl zeroes `signing_key_bytes` via `write_volatile`.
- `src/watcher.rs` — passes `claimant_address` into `HtlcRecord`; `amount_zion as u64` → checked `u64::try_from` with skip+warn.
- `src/config.rs` — `validate_runtime()`: mainnet requires `bearer_token` + `escrow_key`.
- `src/main.rs` — calls `validate_runtime()`; clock sanity warning; `warn` import added.
- `tests/integration.rs` — `make_record` fixture updated with `claimant_address: None`.

### bridge (4 files)
- `src/l1_watcher.rs` — composite dedup key `HashSet<(char, String)>`; checked cast for account tx amount.
- `src/config.rs` — `validate_runtime()` enforces `total_validators==5 && threshold==5` for mainnet; `parse_security_limits()` fail-fast; 3 test fixtures updated + 1 new test `test_validate_runtime_mainnet_rejects_lowered_threshold`.
- `src/relayer.rs` — gas price retry-once (M3); key-load logs `debug!` (M4).
- `src/evm_watcher.rs` — reorg detection: `saw_reorg` flag pauses cursor advance (M1).

### dao (1 file)
- `src/l1_scanner.rs` — memo length > 256 B skipped before parse (L3).

## Backward compatibility

- **Memo format:** `SWAP:LOCK:<hash>:<timeout>:<chain>:<addr>` unchanged; optional 6th field `:<claimant_zion>` is additive. Old memos parse as `claimant_address: None`.
- **DB schema:** `claimant_address` column added via `ALTER TABLE` with existence check — safe on existing `atomic-swap.db`.
- **Config:** `validate_runtime()` now stricter for mainnet. Existing mainnet config (`bridge-mainnet.toml`) already has threshold=5/5 + valid security limits, so it passes. **Atomic-swap mainnet requires `ZION_SWAP_BEARER_TOKEN` env var to be set** (was optional before).

## Deploy steps

> ⚠️ **Deploy is a production operation — confirm each step before running.**

### Pre-deploy (owner)
1. Set `ZION_SWAP_BEARER_TOKEN` env var on the atomic-swap host (if not already set).
2. Back up existing L2 databases:
   - `cp V3/data/atomic-swap.db V3/data/atomic-swap.db.bak-l2patch`
   - `cp V3/data/bridge-mainnet.db V3/data/bridge-mainnet.db.bak-l2patch`
3. Build release binaries on Edge:
   - `cargo build --release --manifest-path V3/Cargo.toml -p zion-bridge -p zion-atomic-swap -p zion-dao`

### Deploy (owner, per service)
4. Stop the running L2 services (bridge, atomic-swap, dao).
5. Swap in the new release binaries.
6. Start services. Verify logs show no `validate_runtime` errors.
7. Confirm atomic-swap DB migration applied: `sqlite3 V3/data/atomic-swap.db "PRAGMA table_info(htlc_locks);"` should list `claimant_address`.

### Post-deploy verification
8. Bridge: check `validate_runtime` passes (no panic on startup).
9. Atomic-swap: confirm `bearer_token` enforced — `curl -X POST http://localhost:8452/swap/claim` without `Authorization` header should return 401.
10. DAO: confirm service starts and scanner runs.

---

## Edge server status (2026-07-02 23:00 UTC)

- **L2 services running:** bridge (port 9101), DAO (port 8450), atomic-swap (port 8452) — all active, all on 127.0.0.1
- **L2 patch DEPLOYED:** MD5 shoda ověřena — binárky z 18:54 obsahují commit `a8b3821e`. Vše aktivní.
- **Bind addresses:** ALL services on 127.0.0.1 (bridge 9101, DAO 8450, atomic-swap 8452). Env var names fix v service files (BRIDGE_METRICS_HOST, DAO_API_HOST).
- **Node binary:** Swapnut na nejnovější verzi (22:55 UTC) s fmt/clippy cleanup + F5 fix + RPC audit log. F5 aktivní (height 22394), chain height 22539.
- **Edge hardening complete:** UFW (only SSH/HTTP/HTTPS/Tailscale), AppArmor (zion-node enforce), ALL services on 127.0.0.1, 3 monitoring cron jobs. See [`SecurityFirst.md`](./SecurityFirst.md).
- **Bridge validator keys:** 3/5 provisioned. 2/5 pending. See [`V3/docs/BRIDGE_MULTISIG.md`](./V3/docs/BRIDGE_MULTISIG.md).
- **Atomic-swap escrow key:** `ZION_SWAP_ESCROW_KEY` rotován (nový keypair, placeholder odstraněn). Inflační 100,002 ZION spáleno. See [`F5_SECURITY_INCIDENT_REPORT_2026-07-02.md`](./F5_SECURITY_INCIDENT_REPORT_2026-07-02.md).
