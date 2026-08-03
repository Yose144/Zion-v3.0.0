# ZION V3 Audit Report — 2026-05-19

**Auditor:** Devin (automated agent)  
**Scope:** V3/ workspace (Rust crates, Docker configs, docs, whitepapers)  
**Commit base:** `835d3dd7` (docs(WP-Mainet): Publikovatelný Whitepaper v3.0 EN + CZ)  
**Methodology:** Static analysis (`cargo clippy`, `cargo test`), code review, consistency checks, security review

---

## Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1 | Pending fix |
| HIGH | 2 | Pending fix |
| MEDIUM | 2 | Pending fix |
| LOW | 1 | Documented |
| INFO | 2 | Documented |

**Overall assessment:** The V3 codebase is structurally sound. Clippy reports 0 errors and all tests compile. The critical finding is a **hardcoded private key fallback in Docker Compose** that could expose pool payouts if an operator deploys without overriding the environment variable. The high finding is **duplicated fee-split constants across four source locations**, creating a maintenance hazard.

---

## 1. CRITICAL: Hardcoded Pool Payout Private Key in Docker Compose

**Location:** `V3/docker/docker-compose.yml:74`

```yaml
- ZION_POOL_PAYOUT_SK_HEX=${ZION_POOL_PAYOUT_SK_HEX:-[REDACTED — pool SK removed for security]}
```

**Impact:** If an operator runs `docker compose up` without setting `ZION_POOL_PAYOUT_SK_HEX` in their `.env` file, the container falls back to this hardcoded secret key. Any pool payouts signed with this key are trivially stealable by anyone who reads the compose file or the public repo.

**Also present in:** `V3/docker/.env.example:49`

**Recommended fix:**
- Remove the fallback value from `docker-compose.yml` — require the operator to supply it explicitly.
- Add a `V3/docker/.env.mainnet.example` with a **commented-out placeholder** and a large `⚠️ DO NOT USE DEFAULTS IN PRODUCTION` warning.
- Document key rotation procedure in `V3/docker/DOCKER.md`.

---

## 2. HIGH: Duplicated Fee-Split Constants (4 Locations)

The 89/5/5/1 protocol-level fee split is defined in **four independent places**:

| File | Constants / Defaults | Risk |
|------|----------------------|------|
| `V3/L1/core/src/emission.rs:53-62` | `MINER_PCT=89`, `HUMANITARIAN_PCT=5`, `ISSOBELLA_PCT=5`, `POOL_FEE_PCT=1` | Canonical on-chain split |
| `V3/L1/cosmic-harmony/src/revenue.rs:21-24` | `ZION_MINER_PCT=89`, `ZION_HUMANITARIAN_PCT=5`, `ZION_ISSOBELLA_PCT=5`, `ZION_POOL_PCT=1` | Duplicated; used by pool revenue tracking |
| `V3/L1/pool/src/pplns.rs:57-60` | `FeeConfig::default()` hardcodes `5, 5, 1` | Duplicated; used for PPLNS distribution |
| `V3/L1/pool/src/bin/server.rs:2759-2761` | `parse_env_u64(..., 5)`, `parse_env_u64(..., 5)`, `parse_env_u64(..., 1)` | Duplicated; env override fallbacks |

**Impact:** If a governance proposal ever adjusts the split (e.g. humanitarian tithe from 5% to 6%), it is extremely likely that one or more of these locations will be missed, causing on-chain payouts to diverge from pool accounting.

**Recommended fix:**
- Make `emission.rs` the **single source of truth**.
- Re-export the constants from `zion-core` and consume them in `zion-cosmic-harmony`, `zion-pool`, and `server.rs`.
- Remove all hardcoded defaults in `pplns.rs` and `server.rs` in favour of importing `emission::MINER_PCT` etc.

---

## 3. HIGH: Default Grafana Admin Password in Compose

**Location:** `V3/docker/docker-compose.yml:200`

```yaml
- GF_SECURITY_ADMIN_PASSWORD=admin
```

**Impact:** Production deployments that forget to override this will expose Grafana with the well-known default password `admin`.

**Recommended fix:**
- Change to `${GF_SECURITY_ADMIN_PASSWORD:?Grafana admin password must be set}` so Docker Compose fails fast if the variable is missing.

---

## 4. MEDIUM: Missing `.env.mainnet.example`

**Location:** `V3/docker/docker-compose.yml:15` references `V3/docker/.env.mainnet.example`, but the file does not exist.

**Impact:** New operators may be confused about which env file to copy for mainnet deployments.

**Recommended fix:** Create `V3/docker/.env.mainnet.example` with production-oriented comments and warnings.

---

## 5. MEDIUM: Shell-out to `curl` in Pool Server (Best-Effort Hook)

**Location:** `V3/L1/pool/src/bin/server.rs:39-54`

The `notify_oasis_block_mined` function shells out to `curl` for a fire-and-forget HTTP call. While this is marked as best-effort and failure is silent, it is a potential vector for command injection if `oasis_url` or `miner_address` are ever attacker-controlled.

**Recommended fix:** Use an async HTTP client (e.g. `reqwest`) instead of `std::process::Command`. If `curl` must remain, strictly validate the URL format before invocation.

---

## 6. LOW: 50+ Clippy Warnings (Style Only)

`cargo clippy --workspace --all-targets` reports ~50 warnings across the workspace. Categories:
- `needless_range_loop` (cosmic-harmony)
- `manual_div_ceil` (cosmic-harmony)
- `unnecessary_sort_by` (core)
- `implicit_saturating_sub` (core)
- `needless_return` (cosmic-harmony)
- `unused_variables` (miner)

**Impact:** None functional. Address via `cargo clippy --fix` when convenient.

---

## 7. INFO: unwrap/expect/unsafe Counts

| Crate | unwrap | expect | unsafe | Notes |
|-------|--------|--------|--------|-------|
| zion-core | 195 | 130 | — | High; many in tests and serialization |
| zion-pool | 34 | 71 | — | Moderate; session lifecycle |
| zion-cosmic-harmony | — | — | — | (clippy only) |
| L1 native-ffi | — | — | 117 | Expected — FFI boundary |

**Note:** The `unsafe` count is entirely within the `zion-native-ffi` crate, which is expected for GPU/CPU mining primitives. No unexpected `unsafe` blocks were found in consensus or wallet code.

---

## 8. INFO: Whitepaper Factual Accuracy

The canonical whitepapers (`docs/WP-Mainet/ZION_TerraNova_Whitepaper_v3.0.md` and `v3.0_CZ.md`) correctly reference `V3/L1/core/src/emission.rs` for the fee split. **However**, the whitepapers state the split is "hardcoded in `emission.rs`", which is accurate for the on-chain constants, but the *pool enforcement* of the split relies on the duplicated constants in `revenue.rs` and `pplns.rs`. This distinction should be clarified in a footnote to avoid giving readers a false sense of single-source enforcement.

---

## Recommended Action Priority

| Priority | Action | Effort |
|----------|--------|--------|
| P0 | Remove hardcoded `ZION_POOL_PAYOUT_SK_HEX` fallback from `docker-compose.yml` and `.env.example` | 10 min |
| P0 | Create `.env.mainnet.example` with safe placeholder comments | 15 min |
| P1 | Unify fee-split constants to single source (`emission.rs`) | 30 min |
| P1 | Change Grafana password to required env var | 5 min |
| P2 | Replace `curl` shell-out with async HTTP client | 1 h |
| P3 | Run `cargo clippy --fix` across workspace | 15 min |
| P3 | Add whitepaper footnote about pool-level vs protocol-level enforcement | 10 min |

---

*Report generated by Devin — 2026-05-19*
