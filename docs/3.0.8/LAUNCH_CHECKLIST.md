# ZION Mainnet Launch Checklist — 3.0.9 → 3.1.0

> **Scope:** Gates that must be closed before ZION is declared **Mainnet Alpha** (3.1.0) and the public launch countdown begins.
> **Source:** [`3.0.9.md`](../3.0.6/3.0.9.md) + [`3.1.0.md`](../3.0.6/3.1.0.md) + [`MAINNET_ALPHA_PLAN.md`](../3.0.6/MAINNET_ALPHA_PLAN.md).
> **Status:** In preparation — migrated from the 3.0.9/3.1.0 plans into this single canonical checklist.

---

## 1. Security & Audit (3.0.9)

| # | Gate | Status | Owner | Evidence / Command |
|---|------|--------|-------|-------------------|
| 1.1 | L1 consensus + account model internal audit | ⏳ pending | core team | Internal audit report with findings + mitigations |
| 1.2 | 24h transaction fuzzing — 0 critical crashes | ⏳ pending | QA / automation | Fuzzing log + final state checksum |
| 1.3 | Tailscale ACL deployed and tested | ⏳ pending | ops | `/etc/fail2ban/jail.d/zion-p2p.conf` + Tailscale admin console |
| 1.4 | Key rotation (premine, pool, bridge, EVM) — air-gapped | ⏳ pending | owner | New addresses documented in `AGENTS.md` |
| 1.5 | Secrets scan clean | ⚠️ tooling | Devin / ops | `git secrets --scan` or equivalent; see §4 below |

---

## 2. Chaos & Load Testing (3.0.9)

| # | Gate | Status | Owner | Evidence |
|---|------|--------|-------|----------|
| 2.1 | 1000+ simulated miners on pool — memory flat, no panics | ⏳ pending | QA / pool | Load test report |
| 2.2 | Node restart + sync ≤ 5 min | ⏳ pending | ops | Stop/start timing log |
| 2.3 | Bridge watcher 50× reconnect — no lost events | ⏳ pending | bridge / QA | Reconnect script + event log |
| 2.4 | Pool reconnect storm ≤ 1 reconnect/min per IP | ⏳ pending | pool | Pool log analysis |

---

## 3. Repo Purity (3.0.9)

| # | Gate | Status | Owner | Evidence |
|---|------|--------|-------|----------|
| 3.1 | Legacy root trees archived (`L1/`, `L2/`, `L3/` no longer in `main`) | ✅ done | Devin | `L1/2/3` absent from working tree |
| 3.2 | Philosophical / marketing books separated or moved | ⏳ pending | owner | `docs/philosophy/` or separate repo |
| 3.3 | Research / PoC separated (`PoC-lab/`, `HiranV2.x/`) | ⏳ pending | owner | `research/` or separate repo |
| 3.4 | Old `APP&WEB/website-v2.9/` archived if replaced | ⏳ pending | owner | Archive tag / git history |
| 3.5 | Duplicate docs merged; versioned reports under `docs/3.0.x/` | 🟡 in progress | Devin | `LAUNCH_CHECKLIST.md` created |
| 3.6 | `pre-purification-3.0.9` tag before any destructive purge | ✅ done | Devin | Tag `pre-purification-3.0.9` pushed to origin |

---

## 4. Public Subtree (3.0.9)

| # | Gate | Status | Owner | Evidence |
|---|------|--------|-------|----------|
| 4.1 | `public/` contains only MIT-safe subset | 🟡 in progress | Devin | Manual review; see §5 |
| 4.2 | `git subtree push --prefix=public public main --dry-run` clean | ⏳ pending | release lead | Dry-run output |
| 4.3 | `public/README.md` reflects 3.0.9/3.1.0 status | ⏳ pending | docs | PR / commit diff |
| 4.4 | No private keys, server secrets, or internal ops in `public/` | 🟡 in progress | Devin | Scan report; see §5 |

---

## 5. Secrets Scan Procedure

`git secrets` is not installed in this environment. Until it is, use this manual procedure:

1. Search tracked files for high-risk patterns:
   ```bash
   git grep -Ei '(BEGIN|END).* (RSA|DSA|EC|OPENSSH) (PRIVATE|PUBLIC) KEY'
   git grep -Ei '(api[_-]?key|apikey|secret|password|token|mnemonic|private[_-]?key)' -- '*.md' '*.rs' '*.toml' '*.sh' '*.ps1' '*.json'
   git grep -E '([0-9]{1,3}\.){3}[0-9]{1,3}' -- '*.md' '*.rs' '*.toml' | grep -vE '(127\.0\.0\.1|0\.0\.0\.0|255\.255\.255\.255|62\.171\.141\.136)'
   ```
2. Inspect matches; whitelist public endpoints and test fixtures.
3. ✅ **Manual pre-scan completed 2026-07-27** — no hardcoded 64-char private keys, no AWS/GitHub/Stripe-style live tokens, and env files (`*.env`) contain only configuration, not plaintext secrets. `git secrets` still needs to be run formally.
4. On a Linux/macOS machine install `git-secrets` and run:
   ```bash
   git secrets --install
   git secrets --register-aws
   git secrets --scan
   ```

---

## 6. Release Readiness (3.1.0)

| # | Gate | Status | Owner | Evidence |
|---|------|--------|-------|----------|
| 6.1 | Feature freeze — no new coins/algorithms | ⏳ pending | product | Deferred list frozen |
| 6.2 | Full regression test suite pass | ⏳ pending | QA | `cargo test --workspace` all green |
| 6.3 | 30d continuous run on Edge | ⏳ pending | ops | Uptime / orphan report |
| 6.4 | GitHub `v3.1.0-beta` release with binaries + SHA256SUMS | ⏳ pending | release | Release page |
| 6.5 | SMOS package `zion-miner-v3.1.0-mainnet-alpha.zip` | ⏳ pending | release | SMOS group config updated |
| 6.6 | Monitoring & alerting (page on downtime) | ⏳ pending | ops | Grafana/alertmanager or PagerDuty |
| 6.7 | Backup & disaster recovery tested | ⏳ pending | ops | DR drill log |
| 6.8 | Public docs and READMEs updated | ⏳ pending | docs | `public/README.md` + translations |
| 6.9 | Beta announcement + bug bounty channel | ⏳ pending | community | Blog / Discord / Telegram posts |

---

## 7. Go / No-Go for 3.1.0

- [ ] All 3.0.9 Go/No-Go gates closed.
- [ ] 30 days without critical incident.
- [ ] All crate tests pass, all E2E smoke tests pass.
- [ ] GitHub release published and SMOS package available.
- [ ] Launch checklist (this file) is 100% checked.

---

*Last updated: 2026-07-27 · Version: v3.0.9 Pre-Alpha Hardening*
