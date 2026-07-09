# V3 Security Checklist — Sprint 5 F1 + F1 Exploit Post-Mortem

**Last audited:** 2026-07-02 (post F1 exploit + Phase 2 hardening)  
**Previous audit:** 2026-03-21 (Sprint 5)  
**Auditor:** autopilot + Devin  
**Scope:** V3/L1 pool, miner, core, node + Edge server infrastructure  
**Cross-ref:** [`docs/3.0.4/SecurityFirst.md`](../../docs/3.0.4/SecurityFirst.md) (full post-mortem) · [`docs/3.0.4/SecurityBackup.md`](../../docs/3.0.4/SecurityBackup.md) (forensic timeline) · [`docs/3.0.4/CRITICAL_3.0.4_SECURITY_FINDINGS.md`](../../docs/3.0.4/CRITICAL_3.0.4_SECURITY_FINDINGS.md)

---

## 1. Dependency Audit

| Check | Status | Notes |
|-------|--------|-------|
| `cargo audit` clean | ✅ | bincode unmaintained (transitive via heed) — no vulnerability |
| No yanked crates | ✅ | |
| Lockfile committed | ✅ | `V3/Cargo.lock` in repo |

## 2. Panic Audit — Pool

| Check | Status | Notes |
|-------|--------|-------|
| No `.unwrap()` in production code | ✅ | All `.unwrap()` confined to `#[cfg(test)]` modules |
| No `panic!` / `todo!` / `unimplemented!` in production | ✅ | Only in test code |
| No `unsafe` blocks | ✅ | Pool crate has zero unsafe |
| `expect()` only on lock poisoning (unrecoverable) | ✅ | Pattern: `.lock().expect("…lock poisoned")` — appropriate |

## 3. Panic Audit — Core

| Check | Status | Notes |
|-------|--------|-------|
| Single `unsafe` block | ✅ | `storage.rs:181` — heed LMDB `EnvOpenOptions::open()` — required by API |
| Hash functions use safe wrappers | ✅ | cosmic-harmony via `zion_core` |
| Block validation rejects invalid candidates deterministically | ✅ | `validate_candidate()` returns `Option` |

## 4. Input Validation — Pool Server

| Boundary | Protection | Status |
|----------|-----------|--------|
| Miner Hello — algorithm mismatch | Rejects connection immediately | ✅ |
| Share Submit — unknown job_id | Returns `InvalidJob`, increments rejected_shares | ✅ |
| Share Submit — stale job (TTL expired) | Returns `StaleJob`, removes job, notifies miner | ✅ |
| Share Submit — header mismatch | Returns `JobMismatch`, increments rejected_shares | ✅ |
| Share Submit — low difficulty | Returns `RejectedLowDifficulty` | ✅ |
| Wire protocol — malformed JSON | `serde_json::from_str` returns `Err`, connection dropped | ✅ |
| Wire protocol — empty line | `read_line` returns 0 → "peer closed" error | ✅ |
| Hex parsing — wrong length | Returns descriptive error | ✅ |
| Hex parsing — non-hex chars | Returns descriptive error | ✅ |
| Max sessions per IP | `ZION_MAX_SESSIONS_PER_IP` (default 10) rate limiting | ✅ |

## 5. Input Validation — Node RPC

| Boundary | Protection | Status |
|----------|-----------|--------|
| RPC request decode | `decode_rpc_request()` returns `Result` | ✅ |
| Template ID validation | Node checks template_id matches current | ✅ |
| Stale template rejection | Includes reason string for miner feedback | ✅ |

## 6. Rate Limiting & DoS

| Protection | Status | Config |
|-----------|--------|--------|
| Per-IP session limit | ✅ | `ZION_MAX_SESSIONS_PER_IP=10` |
| Accept limit | ✅ | `ZION_ACCEPT_LIMIT` (optional) |
| Job TTL expiration | ✅ | `ZION_JOB_TTL_MS=15000` |
| SIGTERM graceful shutdown | ✅ | ctrlc handler with drain |
| Non-blocking listener accept | ✅ | 50ms sleep loop, avoids accept-storm |

## 7. Cryptographic Safety

| Check | Status | Notes |
|-------|--------|-------|
| No custom crypto implementations | ✅ | Uses standard `sha2`, `sha3`, `blake3` crates |
| Cosmic Harmony hash function pinned | ✅ | `consensus_profile()` = `cosmic_harmony_ekam_deeksha_v2` |
| Difficulty target comparison is constant-time safe | ✅ | Byte array comparison in `validate_candidate()` |
| No secret material in wire protocol | ✅ | Only hashes, nonces, job IDs |

## 8. BFG / Secret Scrub

| Check | Status | Notes |
|-------|--------|-------|
| Premine backup never entered git history | ❌ | `git log --all --name-only` still shows `PREMINE_WALLETS_BACKUP.json`; BFG/history scrub remains required before any public launch or public fork |
| No private keys in source tree | ✅ | Only public addresses in `PREMINE_ADDRESSES_PUBLIC.txt` |
| `.env` files gitignored | ✅ | Server `.env` never committed |
| **Pool SK scrubbed from repo (2026-07-02)** | ✅ | 5 files scrubbed: `setup-edge.sh`, `launch-stack.sh`, `start-pool.sh`, `edge-environment.sh`, `V3/docker/.env` — replaced with `<REDACTED_ROTATE_IMMEDIATELY>` placeholder (commit `19e62989`) |
| **Pool SK in edge-environment.sh on Edge** | ✅ | Real SK present on Edge server (chmod 600), scrubbed from git only |

## 9. Fuzzing Readiness

| Target | Priority | Status |
|--------|----------|--------|
| `decode_message()` — pool wire protocol | HIGH | 🔲 Ready (pure function, easy fuzz target) |
| `parse_fixed_hex()` — hex parsing | MEDIUM | 🔲 Ready |
| `validate_candidate()` — block validation | HIGH | 🔲 Ready |
| P2P message parsing (node) | HIGH | 🔲 Ready |

> **Note:** `cargo-fuzz` harnesses already exist in `V3/L1/core/fuzz/` and `V3/L1/pool/fuzz/`.
> What remains is a deliberate pre-launch fuzz campaign, corpus seeding, and sign-off on runtime fuzz coverage.

## 10. Test Coverage Summary

| Crate | Tests | Coverage Focus |
|-------|-------|----------------|
| zion-core | 393 | Consensus, validation, chain state, P2P, storage |
| cosmic-harmony | 81 | Hash function, SIMD, correctness vectors |
| zion-miner | 59 | Config profiles, nonce scan, autotune, error handling |
| zion-pool | 73 | Wire protocol, PPLNS, revenue routing, share lifecycle, stats |
| **Total** | **606** | |

---

## Summary

- **No known vulnerabilities** in dependency tree
- **Zero unsafe** in pool/miner code, one justified unsafe in core (LMDB)
- **All user-facing inputs validated** with typed error returns
- **Rate limiting active** per-IP with configurable limit
- **Fuzzing harnesses exist**, but sustained fuzz execution and sign-off are still pending
- **73 pool tests** cover wire protocol edge cases, share lifecycle, revenue routing, PPLNS payouts, and Prometheus metrics output

---

## 11. F1 Exploit Post-Mortem (2026-07-02)

### What happened

Attacker from `109.81.30.165` connected to P2P port 8333 on Edge server and injected a forged account transaction. The transaction had `from = victim address` but was signed with an unrelated Ed25519 key. `validate_peer_block()` did not call `verify_signature()` for non-coinbase account TXs, so the forged TX was accepted into a mined block.

### Impact

- Chain rolled back to height 22180 (blocks 22181-22188 rejected)
- ~30M ZION in mining rewards temporarily lost (recovered as new blocks mined)
- No premine or bridge funds were stolen

### Fix deployed

- **Commit `9341344d`:** `validate_peer_block()` now calls `verify_signature()` for every non-coinbase account transaction. Height-gated to `account_tx_memo_v1_active` (height 22181+).
- **Regression test:** `validate_peer_block_rejects_forged_account_transaction` — verifies that a forged account TX is rejected by peer block validation.
- **Original fix:** Commit `5cee33c4` added `derive_address` check in `verify_signature()` itself.

### Forensic references

- [`docs/3.0.4/SecurityBackup.md`](../../docs/3.0.4/SecurityBackup.md) — full forensic timeline, rollback record, attacker IP analysis
- [`docs/3.0.4/SecurityFirst.md`](../../docs/3.0.4/SecurityFirst.md) — comprehensive security plan + Edge hardening
- [`docs/3.0.4/CRITICAL_3.0.4_SECURITY_FINDINGS.md`](../../docs/3.0.4/CRITICAL_3.0.4_SECURITY_FINDINGS.md) — original findings (Finding 1 = this exploit)

---

## 12. Edge Server Hardening (2026-07-02 Phase 2)

### UFW firewall

| Rule | Status |
|------|--------|
| SSH (22) LIMIT | ✅ |
| HTTP/HTTPS (80/443) LIMIT | ✅ |
| Tailscale interface ALLOW | ✅ |
| Docker monitoring (3100/9090/9100) DENY | ✅ |
| All Zion ports (8333-9116) public access | ✅ Removed |

### Bind addresses (13/18 on 127.0.0.1)

| Service | Port | Bind | Status |
|---------|------|------|--------|
| oasis | 8094 | 127.0.0.1 | ✅ |
| free-world | 8095 | 127.0.0.1 | ✅ |
| issobella | 8096 | 127.0.0.1 | ✅ |
| node1 RPC | 8443 | 127.0.0.1 | ✅ |
| node2 RPC | 8446 | 127.0.0.1 | ✅ |
| node1 WS | 8445 | 127.0.0.1 | ✅ |
| node2 WS | 8447 | 127.0.0.1 | ✅ |
| node1 metrics | 9115 | 127.0.0.1 | ✅ |
| node2 metrics | 9116 | 127.0.0.1 | ✅ |
| pool metrics | 8455 | 127.0.0.1 | ✅ |
| warp | 8453 | 127.0.0.1 | ✅ |
| agent | 8767 | 127.0.0.1 | ✅ |
| python dashboard | 8766 | 127.0.0.1 | ✅ |
| dashboard | 8888 | 100.76.16.108 (Tailscale) | ✅ |
| P2P node1 | 8333 | 0.0.0.0 | ⏳ Must stay (Tailscale peers, UFW blocks) |
| P2P node2 | 8334 | 0.0.0.0 | ⏳ Must stay (Tailscale peers, UFW blocks) |
| pool | 8444 | 0.0.0.0 | ⏳ Must stay (Tailscale miners, UFW blocks) |
| bridge metrics | 9101 | 0.0.0.0 | ⏳ Pending rebuild (code change: `BRIDGE_METRICS_HOST` env) |
| DAO | 8450 | 0.0.0.0 | ⏳ Pending rebuild (code change: `DAO_API_HOST` env) |

### SSH hardening

| Setting | Value | Status |
|---------|-------|--------|
| PermitRootLogin | prohibit-password | ✅ |
| PasswordAuthentication | no | ✅ |
| X11Forwarding | no | ✅ |
| AllowUsers | root | ✅ |

### AppArmor

| Profile | Mode | Status |
|---------|------|--------|
| zion-node | enforce | ✅ Loaded |

### Monitoring (cron jobs)

| Monitor | Interval | Log | Status |
|---------|----------|-----|--------|
| Forged TX monitor | 5 min | `/var/log/zion-forged-tx-alerts.log` | ✅ |
| Balance monitor (5 premine + 2 attacker) | 5 min | `/var/log/zion-balance-alerts.log` | ✅ |
| P2P peer alert (unknown IP) | 2 min | `/var/log/zion-peer-alerts.log` | ✅ |
| Block submitter log | continuous | journalctl | ✅ `ZION_LOG_BLOCK_SUBMITTER=1` |

### RPC audit log (pending rebuild)

Code change in `V3/L1/core/src/bin/node.rs`:
- `handle_rpc_stream`: logs `rpc_audit peer=<IP> method=<line>` for every RPC connection
- `handle_rpc_http`: logs `rpc_audit_http method=<method> tx_id=<tx_id>` for HTTP POST requests
- Takes effect after next `cargo build` + redeploy

### Tailscale ACL (pending admin console apply)

Tag-based ACL with default deny. See [`docs/3.0.4/SecurityFirst.md`](../../docs/3.0.4/SecurityFirst.md) §F2.3 for full JSON config.

| Tag | Device | Access to Edge |
|-----|--------|----------------|
| tag:edge-server | mainnetedge | (self) |
| tag:workstation | jose--macbook-pro | SSH (22) + dashboard (8888) only |
| tag:mining-server | zionserver (Windows) | P2P (8333/8334) + pool (8444) only |
| tag:legacy | zionserver-144 | No access (offline) |

### Pending security tasks

| Task | Priority | Status |
|------|----------|--------|
| Tailscale ACL apply | HIGH | Doc ready, user must apply via admin console |
| systemd User=zion | MEDIUM | Riskantní, test on one service first |
| Key rotation (premine, pool, bridge, EVM) | HIGH | Air-gapped operation required |
| Bridge/DAO metrics rebuild | MEDIUM | Code change ready, needs `cargo build` + redeploy |
| BFG git history scrub | HIGH | Required before public launch |
| Max TX amount cap (100M ZION) | MEDIUM | L1 consensus change, needs spec + audit |
