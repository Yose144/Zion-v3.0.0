# Website v2.9 — Security & Legal Cleanup Plan

**Created:** 2026-07-06  
**Updated:** 2026-07-07  
**Scope:** `APP&WEB/website-v2.9/` (Next.js 15 frontend + API routes)  
**Goal:** Make the codebase audit-ready for (a) production security review, (b) potential open-source publication, and (c) legal/IP compliance.  
**Overall Risk Level:** MEDIUM-HIGH (4 CRITICAL, 6 HIGH, 5 MEDIUM, 3 LOW)

**Status:** Phase 1 code changes **DONE** — all hardcoded IPs removed from `src/`, `deploy/` scripts, and deployment docs. `npm run build` passes. Remaining before production deploy: DNS records + secret rotation (see §Implementation Checklist).

---

## Executive Summary

The website codebase contains **no private keys or mnemonics**, but exposes production infrastructure topology (IPs, SSH paths, Tailscale VPN addresses) and one API key directly in source. Third-party image assets are used without license attribution. JWT secret handling has inconsistent fallback behavior. These issues block both a clean security audit and safe open-source publication.

**Estimated remediation time:** 3-5 hours for Phase 1 (critical), 1-2 days for full plan including legal review.

---

## Table of Contents

1. [Phase 1 — CRITICAL (Blocks Deployment / Publication)](#phase-1--critical)
2. [Phase 2 — HIGH (Must Fix Before Launch)](#phase-2--high)
3. [Phase 3 — MEDIUM (Pre-Launch Hardening)](#phase-3--medium)
4. [Phase 4 — LOW (Nice-to-Have)](#phase-4--low)
5. [Implementation Checklist](#implementation-checklist)
6. [DNS Migration Plan](#dns-migration-plan)
7. [Environment Variable Registry](#environment-variable-registry)
8. [Legal / IP Compliance](#legal--ip-compliance)

---

## Phase 1 — CRITICAL

### C-01: Hardcoded Production IP Addresses

**Problem:** `77.42.71.94` (Edge VPS), `100.76.16.108` (Tailscale Edge), `100.74.34.40` (Tailscale Core) are embedded directly in source code across 20+ files.

**Files:**
| File | Lines | IP(s) |
|------|-------|-------|
| `src/lib/site.ts` | 15, 24, 29-30 | All three |
| `src/lib/core-endpoints.ts` | 10 | `100.76.16.108` |
| `src/contexts/ZionWalletContext.tsx` | 93-94 | `77.42.71.94` |
| `next.config.ts` | 92 | `77.42.71.94` |
| `scripts/deploy.sh` | 10 | `77.42.71.94` |
| `deploy/deploy_maintenance.py` | 20-22 | `100.76.16.108` |

**Fix:**
```typescript
// src/lib/site.ts — BEFORE
export const SITE_PRIMARY_HOST = process.env['ZION_' + 'RPC_' + 'HOST'] || '77.42.71.94';

// src/lib/site.ts — AFTER
export const SITE_PRIMARY_HOST = process.env.NEXT_PUBLIC_ZION_RPC_HOST || 'rpc.zionterranova.com';
```

**Strategy:**
1. Set up DNS records (see [DNS Migration Plan](#dns-migration-plan))
2. Replace all literal IPs with `process.env.NEXT_PUBLIC_*` variables falling back to DNS names
3. Move Tailscale IPs to server-only env vars (no `NEXT_PUBLIC_` prefix — never expose to client bundle)
4. Update `deploy.sh` to read host from env or `~/.ssh/config`

---

### C-02: API Key Hardcoded in DEPLOYMENT.md

**Problem:** `ZION_DAO_API_KEY=zion-dao-edge-key-2026` is in plaintext at line 97 of `DEPLOYMENT.md`.

**File:** `DEPLOYMENT.md:97`

**Fix:**
```markdown
<!-- BEFORE -->
- ZION_DAO_API_KEY=zion-dao-edge-key-2026

<!-- AFTER -->
- ZION_DAO_API_KEY=${ZION_DAO_API_KEY}   # Set in .env.production (never commit)
```

**Additional actions:**
- [ ] Rotate `zion-dao-edge-key-2026` on production (generate new 64-char random key)
- [ ] Audit git history: `git log -p -- DEPLOYMENT.md | grep -i "api_key\|secret"`
- [ ] Add to `.env.production.example` with placeholder

---

### C-03: SSH Credentials & Server Paths Exposed

**Problem:** `scripts/deploy.sh` and `deploy/deploy_maintenance.py` contain SSH key paths, remote user (`root`), remote filesystem paths.

**Files:**
- `scripts/deploy.sh:10-14` — `REMOTE_HOST`, `REMOTE_USER`, `SSH_KEY` defaults
- `deploy/deploy_maintenance.py:20-22` — `R = "root@100.76.16.108"`
- `DEPLOYMENT.md:147-155` — Full SSH connection details

**Fix:**
```bash
# deploy.sh — BEFORE
REMOTE_HOST="${REMOTE_HOST:-77.42.71.94}"
REMOTE_USER="${REMOTE_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ssh-key-zion-edge}"

# deploy.sh — AFTER  
REMOTE_HOST="${REMOTE_HOST:?Set REMOTE_HOST or use --host}"
REMOTE_USER="${REMOTE_USER:-deploy}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
```

**Additional actions:**
- [ ] Remove hardcoded IPs from deploy scripts (require env var or SSH config)
- [ ] Change remote user from `root` to dedicated `deploy` user
- [ ] Remove SSH key filename hints from source code
- [ ] Redact operational paths from `DEPLOYMENT.md` (keep only generic instructions)

---

### C-04: JWT Secret Inconsistent Fallback

**Problem:** Two different fallback behaviors exist:
- `src/lib/auth.ts` → random ephemeral secret (sessions break on restart)
- `src/proxy.ts` → hardcoded `'zion-dev-secret-ephemeral'` (predictable, exploitable)

**Files:** `src/lib/auth.ts:15-22`, `src/proxy.ts:44-50`

**Fix:**
```typescript
// BOTH files — unified behavior:
const secret = process.env.ZION_JWT_SECRET;
if (!secret) {
  throw new Error('[FATAL] ZION_JWT_SECRET is required. Set it in .env.production');
}
```

**Additional actions:**
- [ ] Generate production JWT secret: `openssl rand -base64 48`
- [ ] Add `ZION_JWT_SECRET` to `.env.production` on Edge server
- [ ] Ensure dev environment uses `.env.local` with a separate dev secret

---

## Phase 2 — HIGH

### H-01: API Key Validation Missing in Proxy Routes

**Files:** `src/app/api/warp/[...path]/route.ts:24`, `src/app/api/dao/[...path]/route.ts:24`

**Problem:** If env vars are unset, API key resolves to `undefined` — no explicit rejection.

**Fix:** Add early-return guard:
```typescript
const apiKey = request.headers.get('x-dao-key') ?? process.env.ZION_DAO_API_KEY;
if (!apiKey) {
  return NextResponse.json({ error: 'API key not configured' }, { status: 503 });
}
```

---

### H-02: Third-Party Image Assets Without Attribution

**Files:** `src/lib/site.ts:34-44` (Ekam/Oneness Movement images from Kajabi CDN + onenessoceania.org)

**Problem:** External images hotlinked without license attribution. Risk: DMCA takedown, broken links.

**Fix:**
1. Download images locally to `public/ekam/` (with permission)
2. Add `/legal/attributions` page crediting Ekam / Sri Amma Bhagavan Foundation
3. If permission cannot be obtained, replace with original ZION artwork

---

### H-03: Dogecoin Logo Trademark

**File:** `public/dogecoin-logo.png`

**Fix:**
- Verify Dogecoin Foundation trademark policy (allows non-commercial community use)
- Add attribution in `/legal/attributions`
- If commercial use: replace with generic coin icon or request permission

---

### H-04: Admin Panel Security

**File:** `src/proxy.ts:103-112`

**Problem:** Basic Auth with env-var password — no brute-force protection.

**Fix:**
- Add rate limiting (max 5 attempts / 5 min per IP) on `/admin` routes
- Enforce minimum password length validation at startup
- Log failed auth attempts (IP + timestamp, not the attempted password)

---

### H-05: Tailscale IPs in Client-Visible Code

**Files:** `src/lib/core-endpoints.ts:10`, `src/lib/site.ts:29-30`

**Problem:** Tailscale IPs (`100.x.x.x`) are internal VPN addresses that should never be in client-side bundles.

**Fix:**
- Move to server-only env vars (no `NEXT_PUBLIC_` prefix)
- Services using Tailscale should be accessed via server-side API routes (proxy pattern already exists)
- Replace with Tailscale MagicDNS names in server config: `edge.zion.ts.net`

---

### H-06: `.env.production` Not in .gitignore

**File:** `.gitignore:31-33`

**Problem:** Only `.env*.local` and `.env` are ignored. If someone creates `.env.production`, it could be committed.

**Fix:**
```gitignore
# Environment files — NEVER commit
.env
.env.*
!.env.example
!.env.local.example
```

---

## Phase 3 — MEDIUM

### M-01: Personal Names Linked to Wallet Addresses

**Files:** `src/lib/constants.ts:11,116-128`

**Problem:** `ISSOBELLA_WALLET`, `HUMANITARIAN_WALLET` link real names to on-chain addresses.

**Fix:** Keep functional names (they're public-facing brand names), but:
- Remove any comments linking to legal names
- Ensure no personal email/phone is associated

---

### M-02: Console Logging in Production API Routes

**Files:** Multiple `/api/` routes (auth, blockchain, ai-chat)

**Fix:**
- Add `if (process.env.NODE_ENV === 'development')` guard around verbose logs
- Use structured logger (`pino`) for production — JSON output, no PII

---

### M-03: Contract Addresses Hardcoded

**Files:** `src/lib/defi-contracts.ts:48-99`, `src/lib/bridge-api.ts:39-105`

**Problem:** 20+ contract addresses hardcoded. Makes multi-chain/testnet switching difficult.

**Fix (post-launch):**
- Move to `NEXT_PUBLIC_CONTRACTS_*` env vars
- Or: fetch from a registry API endpoint at startup

---

### M-04: Overly Permissive CSP

**File:** `next.config.ts:78-126`

**Problem:** `'unsafe-inline'` and `'unsafe-eval'` in Content-Security-Policy.

**Fix (post-launch):**
- Remove `'unsafe-eval'` (breaks nothing in production Next.js)
- Replace `'unsafe-inline'` with nonce-based CSP for inline scripts
- Tighten allowed domains to only active integrations

---

### M-05: Compromised Deployer Address Still Referenced

**Files:** `src/lib/defi-contracts.ts:120,135-136`

**Problem:** `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` is the old compromised deployer.

**Fix:**
- Add comment: `// LEGACY — compromised 2026-06-28, DO NOT USE for new deploys`
- Ensure no active funds flow to this address
- Plan contract re-deployment with new deployer in 3.1.0

---

## Phase 4 — LOW

### L-01: Unused Legacy Endpoints
- Audit all `/api/` routes; remove dead endpoints
- Add API versioning prefix (`/api/v1/`)

### L-02: Rate Limiting Enhancement
- Current: 120 req/60s global
- Target: Per-endpoint limits (stricter for `/admin`, `/api/auth`)

### L-03: Explicit CORS Policy
- Add `Access-Control-Allow-Origin` headers to API routes
- Restrict to `zionterranova.com` + `localhost:3000`

---

## Implementation Checklist

### Pre-Implementation
- [ ] Create DNS records (see below)
- [ ] Generate new secrets: JWT, DAO API key, admin password
- [ ] Create `.env.production` on Edge server with all required vars
- [ ] Backup current deployment: `docker commit zion-website zion-website:pre-cleanup`

### Phase 1 Execution Order
```
1. [ ] Create DNS A records (rpc.zionterranova.com → 77.42.71.94)
2. [ ] Replace all hardcoded IPs in src/ with env vars + DNS fallbacks
3. [ ] Redact DEPLOYMENT.md (remove API key, SSH paths)
4. [ ] Fix deploy.sh + deploy_maintenance.py (remove hardcoded creds)
5. [ ] Unify JWT secret handling (fail-fast, no fallbacks)
6. [ ] Update .gitignore (block all .env variants)
7. [ ] Add API key validation guards to proxy routes
8. [ ] Rotate: DAO API key, JWT secret, admin password on production
9. [ ] Local build test: npm run build (must pass)
10.[ ] Deploy to Edge; verify health check
```

### Phase 2 Execution Order
```
11.[ ] Download Ekam images locally (or replace)
12.[ ] Create /legal/attributions page
13.[ ] Add rate limiting to /admin routes
14.[ ] Move Tailscale IPs to server-only config
15.[ ] Verify Dogecoin logo usage rights
```

### Post-Cleanup Verification
- [ ] `grep -rn "77\.42\.71\.94" src/` → 0 results
- [ ] `grep -rn "100\.76\.16\.108\|100\.74\.34\.40" src/` → 0 results
- [ ] `grep -rn "zion-dao-edge-key" .` → 0 results
- [ ] `npm run build` passes
- [ ] `npm audit` — 0 critical vulnerabilities
- [ ] All API routes return 401/503 when keys are missing (not 500)

---

## DNS Migration Plan

Set up the following DNS records **before** removing IPs from code:

| Record | Type | Value | Purpose |
|--------|------|-------|---------|
| `rpc.zionterranova.com` | A | `77.42.71.94` | L1 RPC endpoint (port 8443) |
| `pool.zionterranova.com` | A | `77.42.71.94` | Pool stratum (port 8444) |
| `api.zionterranova.com` | A | `77.42.71.94` | DAO + WARP APIs |
| `edge.zionterranova.com` | A | `77.42.71.94` | Generic Edge services |

**Caddy/Nginx config:** Add virtual hosts or pass-through for subdomains.

**Tailscale services** (server-side only, never in client bundle):
- Use MagicDNS: `mainnetedge` resolves to `100.76.16.108` within Tailscale network
- Or keep IPs in `.env.production` only (never in source)

---

## Environment Variable Registry

Complete list of env vars needed after cleanup:

| Variable | Scope | Example | Required |
|----------|-------|---------|----------|
| `NEXT_PUBLIC_ZION_RPC_HOST` | Client | `rpc.zionterranova.com` | Yes |
| `NEXT_PUBLIC_ZION_POOL_HOST` | Client | `pool.zionterranova.com` | Yes |
| `ZION_DAO_API_KEY` | Server | `<64-char random>` | Yes |
| `ZION_WARP_API_KEY` | Server | `<64-char random>` | Yes |
| `ZION_JWT_SECRET` | Server | `<base64 48-byte>` | Yes |
| `ADMIN_PASSWORD` | Server | `<64-char random>` | Yes |
| `ZION_EDGE_TAILSCALE_IP` | Server | `100.76.16.108` | No (use MagicDNS) |
| `ZION_CORE_TAILSCALE_IP` | Server | `100.74.34.40` | No (use MagicDNS) |
| `NEXT_PUBLIC_POOL_API_URL` | Client | `https://api.zionterranova.com:8455` | Optional |
| `NEXT_PUBLIC_DAO_API_URL` | Client | `https://api.zionterranova.com:8450` | Optional |

**Template file:** Create `.env.production.example`:
```bash
# === ZION Website v2.9 Production Environment ===
# Copy to .env.production and fill in real values.
# NEVER commit .env.production to git!

# Public (included in client JS bundle)
NEXT_PUBLIC_ZION_RPC_HOST=rpc.zionterranova.com
NEXT_PUBLIC_ZION_POOL_HOST=pool.zionterranova.com

# Server-only (never exposed to browser)
ZION_DAO_API_KEY=CHANGE_ME
ZION_WARP_API_KEY=CHANGE_ME
ZION_JWT_SECRET=CHANGE_ME
ADMIN_PASSWORD=CHANGE_ME
NODE_ENV=production
```

---

## Legal / IP Compliance

### Third-Party Assets Requiring License Verification

| Asset | Source | License Status | Action |
|-------|--------|----------------|--------|
| Ekam images (7 URLs) | kajabi-cdn.com / onenessoceania.org | **Unknown** | Contact Ekam Foundation for permission or replace |
| Dogecoin logo | `public/dogecoin-logo.png` | Dogecoin TM (community use OK) | Add attribution |
| LI.FI Widget | npm package `@lifi/widget` | Apache 2.0 | OK — attribution in package.json |
| Spline 3D assets | runtime.spline.design | Spline TOS (free tier OK for web) | OK |

### Personal Data (GDPR Considerations)

| Data | Location | Public? | Action |
|------|----------|---------|--------|
| "Yeshua ben Yose" / "Yose / Zion Creator" | About pages, constants | Intentional (founder branding) | OK — consent assumed |
| `@terranova_project` Instagram handle | genesis/page.tsx | Intentional | OK |
| Windows paths `C:\Users\yosef\` | .md files only (61 occurrences in root repo) | Not in website src | OK for website; clean in root repo |
| Wallet addresses with names | constants.ts | Public (on-chain) | Acceptable — no legal names exposed |

### Open-Source Publication Readiness

**Status: NOT READY** — requires Phase 1 + Phase 2 completion.

Before publishing website-v2.9 as open source:
1. All hardcoded IPs removed (Phase 1)
2. All secrets removed/rotated (Phase 1)
3. Ekam images replaced with self-hosted or removed (Phase 2)
4. `LICENSE` file added (recommend MIT or Apache 2.0)
5. `npm run build` clean on fresh clone with `.env.example` values
6. `npm audit` — 0 critical
7. Git history audit (BFG scrub if IPs/keys ever committed directly — check with `git log --all -p -- "*.ts" | grep -c "77.42.71.94"`)

---

## Git History Audit

Before any public release, verify git history is clean:

```bash
# Check for hardcoded secrets ever committed
git log --all -p -- "*.ts" "*.tsx" "*.json" "*.md" | grep -E "(zion-dao-edge-key|ssh-key-zion|ADMIN_PASSWORD=)" | head -20

# Check for .env files ever committed  
git log --all --full-history -- ".env*"

# If contaminated: use BFG Repo-Cleaner
# (same approach as V3 — see V3/scripts/git-filter-repo-leaked-paths-v2.sh)
```

---

## References

- Security disclosure: [`docs/security/SECURITY_DISCLOSURE_2026-07.md`](../../docs/security/SECURITY_DISCLOSURE_2026-07.md)
- V3 open-source plan: [`docs/3.0.4/OPEN_SOURCE_PUBLICATION_PLAN.md`](./OPEN_SOURCE_PUBLICATION_PLAN.md)
- Root repo audit findings: [`docs/security/vulnerabilities.json`](../../docs/security/vulnerabilities.json)
- Edge server hardening: [`SecurityFirst.md`](../../SecurityFirst.md)

---

*Generated by Devin security audit — 2026-07-06*
