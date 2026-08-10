# ZION V3 3.0.9 Security Audit Report

**Date:** 2026-08-03
**Auditor:** Devin (automated)
**Scope:** V3 L1 consensus + account model (code audit), full repo secret scan

---

## A1.1 — L1 Consensus + Account Model Audit

**Scope:** `/Users/yeshuae/Projects/2.9.6/V3/L1/core/src/`
**Files:** validation.rs, difficulty.rs, tx.rs, wallet.rs, chain.rs, storage.rs, peer_manager.rs, peer_block_validation.rs, p2p_security.rs, crypto.rs, genesis.rs, lib.rs, emission.rs

### Verdict: NO CRITICAL or HIGH vulnerabilities found

### Findings

| Severity | Finding | Location | Status |
|----------|---------|----------|--------|
| MEDIUM | v1 tx hash malleability (address/memo boundary collision) | `tx.rs:89-108` | Mitigated by v2 hash (length-prefixed), activation pending hard fork |
| LOW | Coinbase maturity `is_coinbase` hardcoded `false` in peer validation | `peer_block_validation.rs:455-460` | Documented TODO, conservative default |

### Mitigations Verified In Place

- **PoW:** Full recomputation with algorithm selection, target comparison via `DifficultyTarget::allows()`
- **LWMA difficulty:** Solve-time clamping (30-120s), ±25% per-block clamp, u128 arithmetic (no overflow)
- **Timestamp:** MTP from last 11 blocks, ±2h future window, lower bound check
- **Reorg:** MAX_REORG_DEPTH=10, strictly-greater work (no ties), soft finality at 60 blocks
- **Double-spend:** HashSet within-block, UTXO existence cross-block, bridge unlock replay keys
- **Signatures:** Ed25519 via `ed25519-dalek`, length validation, SegWit-style hash (excludes sig)
- **Value conservation:** `checked_add` throughout, explicit `ValueOverflow` error
- **Coinbase maturity:** 100 blocks, UTXO age checked
- **Premine lock:** Dual-layer (time-lock H=144,000 + admin 3-of-3 multisig + DAO vote)
- **Nonce:** Per-sender uniqueness, coinbase nonce = block height
- **Balance:** `saturating_add`/`saturating_sub`, `max(0)` floor, i128 intermediate, mempool debits included
- **P2P DoS:** Rate limiting (100 msg/60s), escalating bans (300s→1800s→7200s→permanent), peer scoring
- **Storage:** LMDB ACID, atomic block+UTXO updates, schema versioning, undo blocks

### Recommendations

1. Activate TX_HASH_V2 via hard fork (eliminates v1 malleability)
2. Implement `is_coinbase` flag propagation in peer validation UTXO snapshots
3. Consider increasing MAX_REORG_DEPTH to 20-30 for network partition resilience
4. Add integration tests for checkpoint rollback scenarios

---

## A1.5 — Git Secrets Scan

**Scope:** Full repository (git-tracked files only)
**Method:** Manual pattern-based scan (git-secrets/gitleaks not installed)

### Findings

| Severity | Finding | File | Action Taken |
|----------|---------|------|--------------|
| HIGH | ANKR API key in plaintext | `docs/3.0.0/KeyForMainetLaunch.md` | Replaced with 1Password reference. **KEY MUST BE ROTATED** — appears in git history on 15+ commits |
| MEDIUM | Grafana admin password hardcoded | `scripts/launch-test-mainnet.sh:56,176` | Replaced with env var fallback `${GF_SECURITY_ADMIN_PASSWORD:-ChangeMe_...}` |

### Items Verified Clean

- No private keys (Ed25519/PEM/OpenSSH) in git-tracked files
- No hardcoded mnemonics/seed phrases in git-tracked files
- No hardcoded hex secrets (64+ chars) in git-tracked files
- `.env` files properly gitignored (`V3/docker/.env` confirmed untracked)
- `edge-environment.sh` tokens use `<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>` placeholders
- Tracked `.env` files (`scripts/backup-node.env`, `MinerP3.0.6/Smos/vega-smos.env`) contain only public addresses and config — no secrets
- GPG/SSH key files in git are public keys only (`tevador.asc`, `CREATOR_PUBKEY.asc`)

### Action Required

**ANKR API key rotation (A1.5-URGENT):**
- Key `<SCRUBBED_ANKR_API_KEY>` is compromised
- Appears in git history across 15+ commits (cannot be removed without force-push rewrite)
- **Must be rotated at Ankr dashboard** and new key stored in 1Password
- Update `V3/docker/.env` on Edge server with new key after rotation

---

## A1.3 — Edge Server Hardening

**Date:** 2026-08-03
**Scope:** Edge server (62.171.141.136 / 2a02:c207:2342:5821::1)

### Hardening Applied

| Layer | Control | Status |
|-------|---------|--------|
| SSH | Key-only auth (PasswordAuthentication no) | ✅ |
| SSH | Port 2222 (non-default) | ✅ |
| SSH | MaxAuthTries 3, LoginGraceTime 30 | ✅ |
| SSH | UFW rate limiting (LIMIT) on ports 22+2222 | ✅ |
| fail2ban | sshd jail: 3 retries, 24h ban, ufw action | ✅ |
| fail2ban | zion-p2p jail: 50 retries, 24h ban, nftables | ✅ |
| UFW | Default deny incoming, allow outgoing | ✅ |
| UFW | Only required ports open (2222, 22, 80, 443, 8333-8335, 8443-8446, 8454, 8766, 9443, 9999) | ✅ |
| Services | Internal services bound to 127.0.0.1 (RPC 9443/9445, postgres 5432, dashboard 8888) | ✅ |

### Tailscale

Tailscale not installed — hardening done via SSH key-only + fail2ban + UFW rate limiting instead.

---

## A2 — Chaos & Load Testing

**Date:** 2026-08-03
**Target:** Edge server (62.171.141.136)

### A2.1 — 1000+ Miner Simulation

| Metric | Value |
|--------|-------|
| Miners | 1000 |
| Duration | 60s |
| Pool panics | 0 |
| Pool memory | 39,524 KB (flat) |
| Pool CPU | 34.2% (< 80%) |
| Pool alive | Yes |
| **Result** | **PASS** |

### A2.2 — Node Restart + Sync

| Metric | Value |
|--------|-------|
| Service | zion-edge-node1.service |
| Restart time | 12s (service → RPC responsive) |
| First block relayed | 41s post-restart (height 11021) |
| Catch-up time | 41s (< 5 min threshold) |
| **Result** | **PASS** |

### A2.3 — Bridge Watcher 50x Reconnect

| Metric | Value |
|--------|-------|
| Cycles | 50 |
| Success | 50/50 |
| Failures | 0 |
| Events lost | 0 |
| **Result** | **PASS** |

### A2.4 — Pool Reconnect Storm

| Metric | Value |
|--------|-------|
| Cycles | 100 |
| Success | 100/100 |
| Failures | 0 |
| Pool alive after storm | Yes |
| **Result** | **PASS** |

---

## Summary

| Check | Result |
|-------|--------|
| A1.1 Consensus audit | ✅ PASS — no critical/high issues |
| A1.2 Transaction fuzzing | ✅ PASS — 7 proptest tests, 10k cases each, 0 panics |
| A1.3 Edge hardening | ✅ PASS — SSH key-only + fail2ban + UFW rate limiting |
| A1.4 Key rotation | ⏳ PENDING — requires air-gapped user action |
| A1.5 Secret scan | ⚠️ 2 findings fixed in working tree, ANKR key needs rotation |
| A2.1 1000+ miner sim | ✅ PASS — 0 panics, memory flat, CPU 34% |
| A2.2 Node restart + sync | ✅ PASS — catch-up 41s (< 5 min) |
| A2.3 Bridge 50x reconnect | ✅ PASS — 50/50, 0 events lost |
| A2.4 Pool reconnect storm | ✅ PASS — 100/100, pool alive |
