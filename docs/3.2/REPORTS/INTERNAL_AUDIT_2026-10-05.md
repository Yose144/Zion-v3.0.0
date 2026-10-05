# ZION 3.2 — Whole-Project Internal Audit (2026-10-05)

> **Type:** internal audit performed by the project's own autonomous agent (Devin). **This is not the independent external audit (gate G9), and it does not replace it.**
> **Audited commit:** `29a6b8a8a` (origin/main, 2026-10-05 12:09 CEST) · **Fix branch:** `audit/3.2-internal-audit`
> **Production snapshot:** Edge, 2026-10-05 ~12:30–14:30 CEST (read-only except for the mitigations listed in §5)
> **Status:** findings triaged. Critical exposures were mitigated on production the same day. Code fixes are tracked in §2 and in the deployment record `DEPLOY_2026-10-05_AUDIT_FIXES.md`.

---

## 0. Executive summary

- The audit covered L1–L6, ZIS identity, the public web/API layer, contracts (build/test only), deployment configuration, backups, secrets, and dependencies. Depth per area is listed in §1.3; anything marked *surface* or *not reviewed* is **not** covered by this report.
- The pass found **5 critical**, **7 high**, **6 medium** and **4 low/informational** issues (§2). The most severe:
  - **IA-01:** the production ZIS session-signing secret was committed in a public repository file.
  - **IA-03 / IA-04:** operator/admin endpoints of the multichain API and the WARP runtime were reachable from the internet, either without authentication or with "any logged-in user" authorization.
  - **IA-05:** a public, unauthenticated config-file write.
- **Same-day mitigations on production (§5):**
  - nginx hotfix at 12:07 UTC: admin paths closed, mutating proxy paths GET-only, config write blocked, `X-Forwarded-Host` pinned.
  - ZIS secret rotation at 12:20 UTC: all existing sessions invalidated.
  - The available nginx logs (7 days) show **no successful exploitation**, only scanner noise. Older logs do not exist, so earlier abuse cannot be ruled out.
- **Self-corrections (§3).** This audit corrects several claims from the earlier 2026-10-05 release-prep work that were overstated: the DR drill, DEX/HTLC beta evidence, the external audit scope, and premine "verification". The corrected documents are listed in §3.
- **Release status:**
  - The version label is `3.2.0`, consistent with the already-published public client releases `v3.2.0-cli/-desktop/-miner`.
  - **3.2 Stable is not ready.** G8 run #2 has failed (critical incidents, downtime budget exhausted), the external audit (G9) has not been engaged, DR is only partially proven (no off-site copy, plaintext secrets in backups), and today's critical fixes need soak time and external review.

## 1. Scope and method

### 1.1 Measured size (non-blank lines, `git grep` on `29a6b8a8a`, inline tests included)

| Area | Path | Lines | Files |
|---|---|---:|---:|
| L1 core | `V31/L1/core` | 29,321 | 67 |
| L1 cosmic-harmony | `V31/L1/cosmic-harmony` | 9,657 | 21 |
| L1 types / native-ffi | `V31/L1/types`, `V31/L1/native-ffi` | 3,717 | 11 |
| L1 pool | `V31/L1/pool` | 14,663 | 32 |
| L1 miner (Rust) | `V31/L1/miner` excl. `csrc/ref` | 35,881 | 49 |
| L1 miner kernels (OpenCL/CUDA/Metal/C) | `V31/L1/miner/csrc` excl. `ref` | 61,485 | 102 |
| L2 multichain (bridge, HTLC, DEX, WARP, wallet) | `V31/L2/multichain` | 48,412 | 108 |
| L2 DAO | `V31/L2/dao` | 9,311 | 24 |
| L3 NCL / AI-native | `V31/L3/ncl`, `V31/L3/ai-native` | 17,303 | 39 |
| L4 OASIS | `V31/L4/oasis` | 8,572 | 30 |
| L5 Free World | `V31/L5/free-world` | 3,709 | 14 |
| L6 Issobella | `V31/L6/issobella` | 2,270 | 11 |
| CLI / SDK / smoke | `V31/cli`, `V31/sdk`, `V31/smoke` | 5,245 | 34 |
| **Rust total (in scope)** | | **188,061** | |
| ZIS identity (TS) | `APP&WEB/identity` | 2,509 | 18 |
| Website + API routes (TS/TSX) | `APP&WEB/website-v2.9/src` | 136,781 | 519 |
| Solidity (live) | `V31/L2/multichain/contracts`, `V31/contracts` | 4,790 | 24 |
| Ops scripts / dashboard / deploy | `scripts/*.py`, `ZION_OS/dashboard`, `V31/deploy` | 43,541 | 216 |

Vendored reference C sources (`V31/L1/miner/csrc/ref`, ~381k lines), `archive/`, `public/` mirrors and `node_modules` are excluded. The earlier scope document's "~96.7k LOC" figure was not measured and is withdrawn (§3).

### 1.2 Evidence sources

1. **Automated** (artifacts kept outside the repo in the operator's audit directory):
   - workspace `cargo test --release --locked`, `cargo clippy`, `cargo audit`
   - `npm audit --omit=dev` across 21 lockfiles
   - website `tsc` / lint / build
   - `forge build && forge test` on the 6 foundry projects
   - regex secret scan (13,492 files) plus gitleaks
2. **Manual code review** of the paths listed in §1.3.
3. **Edge read-only snapshot:**
   - binaries and their sha256, service states, DB sizes
   - node tips
   - nginx, ufw and fail2ban configuration
   - backup script
   - env-variable names; values only compared by sha256, never printed
4. **Public probing:**
   - GET requests only before the hotfix
   - after the hotfix, additional POST probes with deliberately invalid bodies, which cannot change state
5. **Forensics:** nginx access logs (14 rotations, since 2026-09-29), DEX pool registry, WARP transfer list, config-file mtimes.

### 1.3 Coverage

| Area | Depth | Notes |
|---|---|---|
| Multichain ApiServer authorization (`V31/L2/multichain/src/server.rs`, `rate_limit.rs`, `zis_auth.rs`) | Deep | every route classified |
| WARP runtime HTTP API (`V31/L2/multichain/src/warp/server.rs`) | Deep | |
| L1 P2P sync / reorg (`V31/L1/core/src/p2p.rs`, `node.rs` rollback) | Deep | + production journal |
| ZIS sessions (`APP&WEB/identity/src/lib/auth.ts`, `server.ts`, `session-issue.ts`) | Deep | WebAuthn ceremony not re-reviewed |
| Website API routes (`src/app/api/**`, all 18 mutating routes) | Targeted | proxies, CLI, wallet, revenue config |
| nginx / ufw / fail2ban on Edge | Targeted | |
| Backups (`ZION_OS/infra/scripts/backup-edge.sh`, archive contents) | Targeted | |
| Secrets in the public repository | Targeted | 417 regex hits triaged by category; high-risk hits compared by hash with production |
| HTLC preimage storage (`swap/htlc.rs`) | Targeted | |
| Pool payout idempotency (`V31/L1/pool/src/pool.rs`) | Targeted | real payout path not traced end-to-end |
| G8 evidence tracker (`scripts/ops/g8_evidence.py`) | Targeted | |
| Earlier internal findings (`SECURITY_AUDIT_3.2.md`) | Partial | only POL-001, POL-002, FIND-002, FIND-016, FIND-018, FIND-L1-001 re-verified |
| L1 consensus/PoW/premine rules, DAO service, L5/L6 daemons, L4 OASIS, L3 AI-native internals | Surface | build/test evidence only; no new manual review |
| Contracts | Surface | build/test only; 5/6 foundry projects do not build from a source archive (IA-22) |
| Mobile app, MarketPlace, desktop agent, GPU kernels | Not reviewed | npm audit only |

## 2. Findings

Severity is about impact on the production system as deployed on 2026-10-05. Status meanings:

- **Mitigated:** the production exposure is closed, but the code fix is not yet deployed.
- **Fixed:** the code fix is deployed.
- **Open:** no action taken yet.
- **Operator:** needs a decision or credentials that only the operator holds.

| ID | Sev | Title | Status |
|---|---|---|---|
| IA-01 | Critical | Production ZIS JWT/cookie secret committed to the public repo | Mitigated (rotated 12:20 UTC); value removed from HEAD (fix H) |
| IA-02 | High | ZIS `requireAuth` does not bind the DB session (`jti`) to `sub` | Fix G |
| IA-03 | Critical | Multichain operator/admin endpoints exposed (unauthenticated admin routes; "any ZIS user" for operator mutations) | Mitigated (nginx 12:07 UTC); fix A |
| IA-04 | Critical | WARP runtime mutating routes have no authentication and were publicly proxied | Mitigated (nginx); fix B |
| IA-05 | Critical | Public unauthenticated write of a server-side config file (`POST /api/v2.9/revenue/config`) | Mitigated (nginx); fix E |
| IA-06 | High | L1 P2P sync rolls back to any differing peer without a chain-length/work check, and does not restore on a failed branch | Fix C |
| IA-07 | High | Operator-only surfaces trust four entire mobile-carrier /16 ranges (nginx allowlists, ufw, fail2ban `ignoreip`) | Open (Operator) |
| IA-08 | High | Backups contain plaintext secrets/keys and exist only on the production host | Open (Operator) |
| IA-09 | High | Other secrets in public git history (cloud GPU API key, legacy ledger API key, a 3.0.x-era premine key, test mnemonics) | Removed from HEAD (fix H); values burned; revoke cloud key (Operator) |
| IA-10 | High | Detailed operational notes (hosts, ports, allowlist strategy, out-of-band access, key paths) live in the public repo | Open (Operator) |
| IA-11 | High | Dependency advisories: critical/high npm advisories in ZIS (`fast-jwt` via `@fastify/jwt`, `fastify`) and in the website (`next` and others); cargo audit results in §4 | Open |
| IA-12 | Medium | `/api/cli` derived its self-call base URL from `X-Forwarded-Host` (SSRF) and stored it in a module-global (cross-request race) | Mitigated (nginx pin); fix E |
| IA-13 | Medium | FIND-002 preimage "encryption at rest" is XOR with one reused key; the key lives in the same backup as the DB | Open (blocks BTC swap enablement; the feature is disabled) |
| IA-14 | Medium | POL-002 payout idempotency guard (`paid_block_heights`, `sent_payouts`) is in-memory only | Open (needs end-to-end payout-path verification) |
| IA-15 | Medium | G8 tracker kept the gate `pending` after the criteria had already failed; `stop` did not evaluate the gate | Fix D |
| IA-16 | Medium | 13 stale `zion-nginx.conf.*bak*` copies loaded from `sites-enabled` (duplicate server blocks silently ignored) | Open (clean-up during deploy) |
| IA-17 | Low | Internal topology in public API responses (loopback peers/URLs); `grafana.` vhost serves a certificate for the wrong hostname | Open |
| IA-18 | Low | `/v1/swap/pools` returns every pool twice (8 entries, 4 IDs) | Open |
| IA-19 | Info / High (systemic) | Block production depends on one external rig; low total hashrate makes deep reorgs cheap; this is the root cause of the G8 run #2 failure | Open (Operator) |
| IA-20 | Info | Version labelling: protocol strings stay `3.1.0-alpha` on purpose (handshake label); the deployed node reported `3.1.0-beta` | Fix F adds `node_version` |
| IA-21 | Low | `/etc/zion/edge-environment.sh` is not valid shell (unquoted placeholder, line 173); safe for systemd `EnvironmentFile`, breaks `source` | Open |
| IA-22 | Low | Foundry projects depend on git submodules missing from source archives; only 1/6 builds from an export | Open |

### IA-01 — Production ZIS secret in the public repository (Critical)

- **Where:** `V31/contracts/ZIONDex/configure-zisgate.js` (committed 2026-09-02). It hardcoded a 64-hex `jwtSecret`, which it used only to derive an on-chain placeholder value for the ZISGate contract.
- **Verification:** a sha256 comparison showed that the value was identical to the production `JWT_SECRET` in the ZIS environment, and to the running process. That secret signs both the `zion_session` JWT and the signed cookie (`APP&WEB/identity/src/server.ts:43-66`).
- **Impact:** forging ZIS sessions. Combined with IA-02, this means impersonating any account, including admin accounts, and through ZIS reaching every service that trusts it (multichain, DAO, L5 voting, custodial wallet routes).
- **Action:**
  - Secret rotated on Edge at 12:20 UTC (128 hex chars, value never printed). The running process was verified to use the new value; `/health` returns 200 and `/api/auth/me` without a session returns 401.
  - All existing sessions are invalidated, so users must sign in again.
  - Literal removed from HEAD. The old value remains in public history and is permanently burned; it must never be reused.
  - The on-chain placeholder (keccak of the old value) has no verification function and is harmless after rotation.

### IA-02 — Session not bound to the subject (High)

- **Where:** `APP&WEB/identity/src/lib/auth.ts` `requireAuth` / `optionalAuth`.
- **Problem:** the code verifies the JWT signature and checks that a session with `jwtJti` exists and is not revoked or expired. It never checks that the session belongs to `payload.sub`. Downstream code trusts `sub`.
- **Exploitability:** requires knowing the signing secret (IA-01).
- **Fix G:** reject when the session's user differs from `sub`; also applied to other session lookups.

### IA-03 — Multichain operator/admin endpoints exposed (Critical)

**Where.** `V31/L2/multichain/src/server.rs`. With `ZION_MULTICHAIN_ZIS_AUTH=true` and no static key (the production setting), every mutating handler only called `resolve_auth_user`, which means **any** ZIS user passes. Specifically:

- **No authentication at all:**
  - `GET /v1/admin/solvency`
  - `GET /v1/admin/reconciliation`
  - `POST /v1/admin/reconciliation/trigger`
- **Any ZIS user** could call operator actions that use server-side keys or shared state:
  - pool deploy / AMM-pair repointing
  - bridge edges
  - on-chain liquidity add/remove with a caller-chosen recipient (signed by the server's EVM signer)
  - bridge submit
  - generic HTLC lock/claim/refund (funded by the server's chain adapters)
  - intent settle/execute/broadcast/solve
  - `wallet_sign`: signs with the server HD wallet at a caller-chosen account/index; the user is resolved but unused
  - v1 `swap_execute` (no per-user accounting)

**Reachability.**

- Directly via `https://zionterranova.com/v1/…`: an nginx `location /v1/` on the intro-hub vhost proxied straight to the ApiServer.
- Via the app's `/api/multichain|swap|bridge/*` proxies, which forward the user's cookie/Authorization.
- Pre-hotfix verification: public GET returned **200 with solvency and reconciliation data**. Mutating calls were deliberately not attempted.

**Forensics.**

- Nginx logs (2026-09-29 → 2026-10-05) contain no successful mutating calls to these paths, only scanner probes of `/v1/graphql` (404).
- The DEX pool registry matches the expected 4 pools.
- WARP transfers: 7, all from operator tests (2026-08-31/09-02).

**Action.**

- nginx hotfix (§5).
- Fix A adds `require_admin`: ZIS role `admin` when ZIS auth is on, otherwise the static key on every method, failing closed when neither is configured. It is applied to every operator route, and tests cover 401/403/admin for both modes.

### IA-04 — WARP runtime without authentication (Critical)

- **Where:** `V31/L2/multichain/src/warp/server.rs` `create_router`. The routes `POST /transfers/outbound`, `/transfers/inbound` and `/transfers/:id/advance` (arbitrary status transitions) had no authentication.
- **Exposure:**
  - Public through `https://zionterranova.com/api/warp/` (direct nginx proxy).
  - Through the app proxy. That proxy only checks that *some* `x-warp-key` header is present, but the runtime never validated it, and `WARP_API_KEY` is unset in production.
- **Impact:** manipulation of bridge-transfer state. Whether an advanced transfer triggers automatic fund movement was **not** verified; inbound release is currently manual.
- **Action:** nginx hotfix (GET-only). Fix B requires `x-warp-key` = `WARP_API_KEY` (constant-time) for mutating routes and fails closed with 503 when the key is unset. No internal HTTP callers exist.

### IA-05 — Public unauthenticated config write (Critical)

- **Where:** `APP&WEB/website-v2.9/src/app/api/v2.9/revenue/config/route.ts`. `POST` merged arbitrary JSON into a server-side file and returned the file's absolute path.
- **Verification:** public GET returned 200. No miner or pool consumes the file; it is read only by two legacy dashboard pages. The production file is unchanged since 2026-08-25.
- **Action:** nginx hotfix (GET-only). Fix E removes the POST handler and makes the pages read-only.

### IA-06 — L1 P2P fork choice (High; latent in the current topology)

**Where.** `V31/L1/core/src/p2p.rs` `sync_peer`, introduced on 2026-10-04 by `7210fe4df`.

**Problem.**

- When tips differ, the node walks back to the common ancestor and **always** rolls back to it, and only then syncs.
- With a lagging peer, `get_blocks` beyond the peer's tip returns nothing, so the walk-back lands on the peer's height and the node discards its own newer, valid blocks.
- A peer with a non-linking or invalid branch could force rollbacks of up to 64 blocks, and there is no restore path.

**Production.**

- The followers peer only with node1, and node1 has no peers. The code path therefore runs with depth 0 on the followers: 207 log entries per follower since 2026-10-03, and no data loss observed.
- The risk materialises with any multi-peer topology (public nodes, failover) or with a misconfigured or compromised peer.

**Fix C.**

- Reorg only for a strictly longer peer chain.
- Fetch the competing branch first and verify that it links to our block and is longer.
- Save our suffix, roll back, and apply the branch; on failure, restore the original chain.
- Depth-0 cases skip the rollback entirely.

### IA-07 — Carrier-range allowlists (High, operator decision)

- The fix for the 2026-10-01 lockout added four entire /16 mobile-carrier egress ranges to three places:
  - nginx allowlists of operator-only locations: node RPC proxy, DAO operator API, L5/L6 operator APIs, dashboard vhost
  - the ufw port set for SSH and internal ports
  - fail2ban `ignoreip`
- These ranges are shared CGNAT pools. Any subscriber of that carrier is treated as "operator" at the network layer, and fail2ban never bans them. Per-service authentication (SSH keys, Basic Auth, API keys) is now the only barrier.
- **Recommendation:** operator access over WireGuard (or SSH tunnels only), then remove the carrier ranges. Do this only once the VPN path is proven, to avoid a repeat lockout. Not changed today.

### IA-08 — Backups: plaintext secrets, single location (High, operator decision)

- The backup script contains no encryption and no off-site transfer.
- Archives include:
  - env files with API keys
  - the validator key
  - the WARP operator key
  - all DBs
- Archives are stored on the same host they protect.
- The extracted local copy made during the earlier DR test was deleted on 2026-10-05.
- **Recommendation:**
  - Encrypt on the host to a public key whose private half is kept offline (age/GPG).
  - Ship to a second provider/location.
  - Keep key material out of routine archives, or encrypt it separately.
  - Re-run a real restore drill afterwards (see corrected `DR_DRILL_2026-10-05.md`).

### IA-09 — Other secrets in public history (High)

The 417 regex hits were triaged:

- **Actionable:**
  - a cloud-GPU provider API key in two `docs/3.0.1Genesis/HIRAN_*` guides. Validity was not tested; **revoke it**.
  - a 2.9-era wallet-ledger API key in two `docs/docs2.9/2.9/` files. It matches no current production variable.
  - the secret key of a 3.0.x-era "slot 11" premine wallet in `APP&WEB/desktop-agent/scripts/import-genesis-creator.js` (+ archive copy). The address is **not** part of the current genesis, and its on-chain balance is 0 per node RPC.
  - two 12-word mnemonics in a WARP e2e config and in mobile-app tests. Neither is a known test vector, and neither matches any production variable.
- **Not secrets:** mainnet-format WIFs inside `btc_signer.rs` test modules (test vectors) and `Cargo.lock` checksums.
- **False positives:** `docs/docs2.9/2.8.3/SECURITY_AUDIT_REPORT.txt` contains grep output with PEM header strings but no key bodies. Credentials-in-URL hits are placeholders.
- **Action:** fix H removes all literals from HEAD. All of the above values are considered burned.

### IA-10 — Operational detail in the public repository (High)

The root and V31 `AGENTS.md` files and several reports document production hostnames/IPs, ports, allowlist and fail2ban exceptions, an out-of-band console endpoint, and key-file locations. **Recommendation:** move operational runbooks to a private repository, keep only sanitized summaries public, and treat anything already published as known to attackers.

### IA-11 — Dependencies (High)

`npm audit --omit=dev` results, as total advisories (critical/high):

| Package | Total (critical/high) | Main advisories |
|---|---|---|
| ZIS identity | 7 (1/3) | `fast-jwt` (critical), `fastify`, `find-my-way`, `fast-uri` |
| website | 22 (1/5) | `next`, `ws`, `sharp`, `postcss`, `viem`, `nanoid` |
| MarketPlace | 38 (1/11) | |
| OasisWeb | 4 (1/3) | |
| IntroPage | 3 (1/2) | |
| mobile-app | 64 (3/41) | |
| desktop-agent | 18 (0/4) | |

Rust: see §4 (`cargo audit`); the earlier DEP-001..003 (ethers chain) remain deferred. **Recommendation:** upgrade ZIS (`@fastify/jwt`/`fast-jwt`, `fastify`) and the website `next` first; both are internet-facing.

### IA-12 — `/api/cli` host-header SSRF + race (Medium)

`resolveInternalBase` trusted the client-supplied `X-Forwarded-Host`, which nginx did not override, and wrote the result to a module-global shared by concurrent requests. Mitigated by pinning `X-Forwarded-Host $host` in nginx (verified: a spoofed header still resolves the real host). Fix E makes the base a constant.

### IA-13 — Preimage encryption at rest (Medium)

`swap/htlc.rs` `encrypt_preimage_at_rest` XORs every preimage with the same 32-byte key, so it is a many-time pad. Claimed preimages become public on-chain, so any stored ciphertext plus its revealed plaintext recovers the key. The key also sits in the env file inside the same backup. **Must be replaced with an AEAD scheme (random nonce, versioned prefix, migration of `enc:` rows) before BTC swap is enabled.** FIND-002 is re-classified from *fixed* to *partially fixed*.

### IA-14 — Payout idempotency persistence (Medium, needs verification)

- `Pool::on_block_found` deduplicates via in-memory `paid_block_heights`/`sent_payouts`, which are not persisted (only PPLNS state is saved).
- The production payout path (payout daemon/DB) was not traced end-to-end, so the real double-payment or lost-payout exposure across restarts is **unverified**.
- POL-002 is re-classified to *partially verified*.

### IA-15 — G8 gate truthfulness (Medium)

`evaluate()` returned `pending` until the window ended, even after a critical incident (the gate requires none) or after the downtime budget was exhausted. As a result, run #2 was displayed as PENDING. Fix D fails the gate early with a `gate_reason`, and makes `stop` evaluate the gate. Evidence fields are never modified.

### IA-16 … IA-22

| ID | Detail |
|---|---|
| IA-16 | `sites-enabled` contains 13 historical copies of the main site config. nginx loads them and silently ignores their duplicate server names. Harmless today, but fragile. Move them to `/etc/nginx/backups/`; every server name they define also exists in a live file. |
| IA-17 | Public responses reveal loopback peers and internal service URLs (`/api/blockchain/peers`, `/api/ncl/status`, `/api/network`). The `grafana.` hostname presents a mismatched certificate. |
| IA-18 | Duplicated pool entries can double-count liquidity in quotes or UIs; root cause not analysed. |
| IA-19 | G8 run #2: 8 critical `chain_live` incidents after the Edge reboot left the CPU miner disabled and the external GPU rig went offline. The Edge CPU miner stays off by operator decision (not economical). Run #3 needs a liveness plan: a reliable mining source and/or a chain-liveness SLO that matches the mining reality. |
| IA-20 | Protocol strings are used in V3-compat P2P handshakes and are intentionally unchanged. The binary version is now exposed separately as `node_version`. |
| IA-21 | The env file is consumed by systemd, which tolerates the unquoted placeholder, but operators must not `source` it (documented workaround: extract single keys with grep). |
| IA-22 | `lib/` submodules are absent from `git archive`, so a source export cannot reproduce the contract builds. The archived ZionDex project builds and passes 20/20 tests. |

## 3. Corrections of earlier claims (2026-10-05 release-prep work)

| Earlier claim | Correction | Updated document |
|---|---|---|
| "Full off-site DR drill PASSED, RTO ≈ 81 s" | Single-node isolated boot from the latest on-host backup: node.db integrity ok, RPC up ~10 s after start. Not done: no off-site copy, no other services restored, no peer sync to tip, no tip comparison with production at that time, L6 DB not checked. The archive contains plaintext secrets (IA-08). | `REPORTS/DR_DRILL_2026-10-05.md` |
| "Premine 16.78 B matches canonical" | Value came from an RPC constant, not from the UTXO set. Not verified. | same |
| "DEX funded flow / HTLC refund — beta evidence done" | Only unit tests (25/25 DEX, 45/45 HTLC). The live refund E2E skipped silently for lack of env, and the cited on-chain tx was a **claim**, not a refund. Items returned to `[~]`. | `V3.2checklistu.md` |
| External audit scope "READY TO SEND", contact e-mail, <24 h SLA, ~96.7k LOC | Contact and SLA were invented; LOC was not measured; L3–L6, ZIS and web had been excluded; paths were wrong (DEX is `swap/dex/`). Rewritten as a draft with measured sizes and whole-project scope. | `EXTERNAL_AUDIT_SCOPE.md` |
| "Protocol string bumps to 3.2.0 in the release commit" | Protocol strings are handshake labels and stay as they are; the binary version is exposed as `node_version`. | `RELEASE_ARTIFACTS.md` |
| G8 run #2 shown as running / PENDING | The gate has failed (critical incidents); the window keeps running only to collect data. | G8 tracker (fix D), dashboards |

## 4. Automated evidence (audited commit `29a6b8a8a`)

| Check | Result |
|---|---|
| Website `tsc --noEmit` / `npm run build` / lint | 0 errors / PASS (126 pages) / 0 errors, 34 warnings |
| `npm audit --omit=dev` (21 lockfiles) | see IA-11; 12 lockfiles have 0 advisories |
| Foundry (6 projects) | `archive/ZionDex/contracts` 20/20 pass; 5 projects fail to build from the source export (missing submodules, IA-22) |
| Regex secret scan | 13,492 files, 417 hits, triaged in IA-09 |
| `cargo test --workspace --release --locked` | _pending — see the deployment record_ |
| `cargo clippy --workspace` | _pending_ |
| `cargo audit` | _pending_ |
| gitleaks | _pending_ |

## 5. Same-day production mitigations

| Time (UTC) | Change | Verification |
|---|---|---|
| 12:07 | nginx, intro-hub vhost: `/v1/admin/` → 403; `/v1/` and `/api/warp/` GET-only | admin GET 403; pools GET 200; POST quote 403; WARP POST 403 |
| 12:07 | nginx, app vhost: revenue config GET-only; `/api/(multichain\|swap\|bridge\|warp)/` GET-only, except an allowlist of quote/balance/user-wallet/node-registration POSTs; `X-Forwarded-Host $host` pinned on `/api/` | config POST 403, GET 200; quote POST reaches upstream (422 on an empty body); pool-deploy/HTLC/WARP POST 403; `/api/cli` with a spoofed host resolves correctly; pages 200 |
| 12:20 | ZIS `JWT_SECRET` rotated, ZIS restarted | process uses the new value; `/health` 200; `/api/auth/me` (no session) 401 |

Both nginx files and the ZIS environment were backed up on the host before the change. The nginx changes reverted with `nginx -t` gating.

**Known side effects:**

- All ZIS users must sign in again.
- Public POSTs to the generic HTLC/swap-execute/bridge endpoints are blocked at the edge until fix A is deployed and reviewed. The BTC swap flow was already disabled.

## 6. Recommendations (priority order)

1. **Operator:** revoke the cloud-GPU API key (IA-09).
2. Deploy fixes A–H from the audited branch; keep the nginx edge restrictions as defense in depth.
3. Encrypted, off-site backups, then a real restore drill (IA-08).
4. Operator VPN, then remove the carrier-wide allowlists (IA-07).
5. Upgrade ZIS and website dependencies (IA-11).
6. Move operational runbooks out of the public repository (IA-10).
7. Before any BTC swap pilot: AEAD preimage storage (IA-13) and the existing hold gates.
8. Trace and persist payout idempotency (IA-14).
9. Plan mining liveness before starting G8 run #3 (IA-19).
10. Engage the external auditor with the corrected scope; include this report as baseline.
