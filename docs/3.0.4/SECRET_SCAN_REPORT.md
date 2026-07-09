# ZION v3 — Secret Scan Report (Pre-Publication)

**Scan date:** 2026-07-09
**Scope:** Full repo `/home/zionserver/2.9.6-main/` (git-tracked + working tree)
**Method:** Read-only grep/find across all categories

---

## Summary

| # | Category | Severity | Count | Status |
|---|----------|----------|-------|--------|
| 1 | SimpleMining.net API token | **HIGH** | 46 scripts | REAL credential — MUST remove |
| 2 | PostgreSQL password (`zion_db_2675`) | **MED** | 1 file (legacy v2.6) | REAL — MUST remove |
| 3 | Production server IP (`62.171.141.136`) | **LOW-MED** | ~75 refs | Infrastructure info — scrub for public |
| 4 | Old server IP (`77.42.71.94`, `100.76.16.108`) | **LOW** | ~30 refs | Historical — safe but noisy |
| 5 | SSH public key (ed25519) | **SAFE** | ~10 refs | Public key only — no private key |
| 6 | `newzionssh.md` (private SSH key) | **RESOLVED** | 0 | Already deleted (not in repo) |
| 7 | Canonical wallet addresses | **LOW** | ~20 refs | Public on chain — OK to publish |
| 8 | Pool payout SK hex | **SAFE** | 0 real | All instances are `<SET_VIA_SECURE_ENVIRONMENT_DO_NOT_COMMIT>` |
| 9 | Private key hex (64-char) | **SAFE** | 0 real | All are test vectors (zeros, F's, deadbeef, 1111..., 2222...) |
| 10 | Mnemonics / seed phrases | **SAFE** | 0 real | Only references in docs ("write down your seed phrase") |
| 11 | GitHub PATs (`ghp_7gxI3Y…`) | **RESOLVED** | 6 refs | Already redacted + revoked |
| 12 | OpenAI key (`sk-proj-CsUPFB…`) | **RESOLVED** | 6 refs | Already redacted + revoked |
| 13 | `.env` files (real, tracked) | **LOW** | 2 files | `V3/docker/.env` (example w/ real wallets), `scripts/backup-node.env` (real IP) |
| 14 | Grafana admin password | **LOW** | 1 ref | Default `admin` — not a real secret |
| 15 | Telegram/Discord bot tokens | **SAFE** | 0 real | Config uses `null` placeholders |
| 16 | AWS / Cloud credentials | **SAFE** | 0 | None found |
| 17 | JWT / signing keys | **SAFE** | 0 | None found |
| 18 | Personal info / emails | **SAFE** | 0 | None found |
| 19 | WARP module (`V3/L3/warp/`) | **EXCLUDE** | entire dir | User decision: NOT published |

---

## Detailed Findings

### 1. SimpleMining.net API Token — **HIGH (MUST REMOVE)**

**Token:** `api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8`
**Rig ID:** 518837
**API:** `https://api.simplemining.net`

This is a **real, active API token** for the SimpleMining.net rig management platform. It grants full API access to control mining rigs (reflash, reboot, OC settings, group moves). Found in **46 scripts** under `scripts/`:

```
scripts/_rig_*.py (43 files)
scripts/vega_autopilot.py
scripts/tmp_smos_*.py (4 files)
```

**Action:** Replace with `os.environ.get("SIMPLEMINING_API_TOKEN")` or exclude entire `scripts/_rig_*` directory from public repo.

---

### 2. PostgreSQL Password — **MED (MUST REMOVE)**

**Password:** `zion_db_2675`
**File:** `docs/docs2.9/legacy_v2.6/zion_pool/mining_pool.py:223`

```python
password="zion_db_2675"
```

**Action:** Replace with `os.environ.get("DB_PASSWORD")` or exclude legacy v2.6 code from public repo.

---

### 3. Production Server IP — **LOW-MED (SCRUB)**

**IP:** `62.171.141.136`
**Found in:** ~75 references across:
- `dns.md` (DNS zone file)
- `ZionStart/ubuntu/*.sh` (miner/pool connection scripts)
- `HARDRESETOFFICIAL.md`, `AGENTS.md`, `SECURITY_TODO_2026-07-03.md`
- `scripts/backup-node.env`
- Various docs

**Note:** The IP is already public via DNS (`zionterranova.com` resolves to it), but scrubbing it from source code is good hygiene for a public repo.

**Action:** Replace with `ZION_SEED_PEERS` env var reference, or `example.com` placeholder in public version.

---

### 4. SSH Public Key — **SAFE**

**Key:** `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOBW4wUXIVo7dUJ9lkFzfSYyV3JxCOmFNf+ezJMlMpNE`

This is a **public** key (no private key material). Found in `docs/3.0.0/dement.md` and `archive/2.9.9/docs/Servers.md`. Safe to publish but unnecessary — can scrub.

---

### 5. `newzionssh.md` — **RESOLVED**

The file containing the unencrypted SSH private key has **already been deleted**. Confirmed: `find . -name "newzionssh*"` returns nothing.

---

### 6. Canonical Wallet Addresses — **LOW (OK TO PUBLISH)**

These addresses are public on-chain (in genesis block):
- `zion1d6m0h2r8m7k8k2d8n072y7j3j4m0254323vq0e3` (miner)
- `zion1e0u5q5s660k4m4a634p2c2v358r8g59564054z7` (humanitarian)
- `zion1f7y7l5k678y0v408e8s654d2282346k375526t2` (issobella)
- `zion1e4489793c5x2r0a0a4d8z7r4u5d6k0s4k3ht5m2` (pool wallet)

**Action:** OK to publish — they're in the genesis block which is public.

---

### 7. `.env` Files (Tracked)

| File | Contents | Action |
|------|----------|--------|
| `V3/docker/.env` | Example config with real wallet addresses + `GRAFANA_ADMIN_PASSWORD=admin` | Rename to `.env.example`, scrub real IPs |
| `scripts/backup-node.env` | Real production IP + wallet addresses | Exclude from public repo |

---

### 8. WARP Module — **EXCLUDE (USER DECISION)**

**Path:** `V3/L3/warp/`
**Decision:** Will NOT be published (revolutionary tech, competitive advantage).
**Action:** Exclude from public repo copy script.

---

## Recommended Exclusion List for Public Repo

```
# Secrets / credentials
scripts/_rig_*.py              # SimpleMining API token
scripts/tmp_smos_*.py          # SimpleMining API token
scripts/vega_autopilot.py      # SimpleMining API token
scripts/backup-node.env        # Production IP

# Legacy code with embedded password
docs/docs2.9/legacy_v2.6/zion_pool/mining_pool.py

# WARP (competitive advantage — NOT published)
V3/L3/warp/

# Internal docs (server topology, migration history)
HARDRESETOFFICIAL.md
SECURITY_TODO_2026-07-03.md
SECURITY_PATCH_3.0.4_PLAN.md
StatusV3.md
docs/SECURITY_NOTICE_2026-04-28.md
archive/                        # entire archive dir

# DNS zone file (reveals topology)
dns.md

# Scrub (replace IPs with placeholders):
# - ZionStart/ubuntu/*.sh
# - V3/docker/.env → .env.example
# - AGENTS.md (internal server info)
```

---

## Conclusion

**No actual private keys, mnemonics, or seed phrases** were found in the repository.

**Two real credentials must be removed before publication:**
1. SimpleMining.net API token (46 scripts)
2. PostgreSQL password `zion_db_2675` (1 legacy file)

**Infrastructure info (server IP) should be scrubbed** but is already public via DNS.

After removing these items and excluding WARP + internal docs, the repo is safe for open-source publication.
