# Report: Website docs / public subtree sync, wallet public-API fix, and deploy

**Date:** 2026-08-18  
**Scope:** `APP&WEB/website-v2.9`, `public/` subtree, `docs/WP-Mainet/`, desktop-agent wallet API, live web deploy  
**Authors:** Devin (agent) + estrelaisabellazion3  
**Status:** Done, deployed, pushed

---

## 1. Summary

Completed a full sweep to align all public and master documentation with the current V3.2.0 **One Love / Mainnet Stable** canonical state:

- Genesis hashes, protocol version, consensus algorithm, and genesis/block dates.
- Synchronized `public/` (MIT public repo subtree), the live `app.zionterranova.com` Next.js public docs, and the internal `docs/WP-Mainet/` master sources.
- Picked up and committed the pending desktop-agent wallet fix (public HTTPS API fallback) that was already prepared in the working tree.
- Rebuilt and deployed the website to the Edge server.
- Pushed all commits to the private `origin/main` and the `public/` subtree remote.

---

## 2. Canonical values applied

| Item | Value |
|------|-------|
| Public line | `v3.2.0 "One Love" / Mainnet Stable` |
| Consensus | `Ekam Deeksha v3.2` — 512 KiB scratchpad, 2 AES passes, 128 random reads, Keccak-256 final |
| Protocol version | `zion-v3-node/3.1.0-alpha` |
| V3 compat genesis hash | `4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71` |
| V31 native genesis hash | `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb` |
| Genesis block timestamp | `1767225600` → **1 January 2026** |
| One Love hard reset date | **6 August 2026** |
| Total supply | 144 000 000 000 ZION |

---

## 3. What was changed

### 3.1 Public MIT subtree (`public/`)

Updated all stale genesis hashes and protocol versions:

- `public/README.md`, `public/README_FULL.md`
- `public/CHANGELOG.md`
- `public/docs/WP/*.md` (whitepapers 3.1, 3.2, technical, WpStory)
- `public/docs/lang/README*.md` and `README_FULL*.md` (CZ, ES, FR, PT)
- `public/docs/genesis.md`, `public/docs/whitepaper.md`
- `public/docs/archive/README_FULL.md`
- `public/docs/CREATOR_STATEMENT.txt`, `public/docs/TOKEN_DISCLOSURE.md`
- `public/docs/security/SECURITY_DISCLOSURE_2026-07.md`
- `public/V3/docs/MAINNET_CONSTANTS.md`

All references to the three historical hashes (`08a94fb0...`, `21e2b274...`, `4f75a0df...`) were replaced with the current `961094...` V31 native hash and `4cf756...` V3 compat hash where the dual-hash table exists.

### 3.2 Live website public docs (`APP&WEB/website-v2.9/public/docs/`)

- `index.md` / `cs/index.md` — updated `Genesis #0` line to **1 January 2026 (block timestamp)** + One Love hard reset **6 August 2026**.
- `WP/ZION_MASTER_WHITEPAPER_3.2_ONE_LOVE_*.md` — `First block` set to **1 Jan 2026** / **1. 1. 2026**.
- `WP/ZION_MASTER_WHITEPAPER_3.1_*.md`, `WP/ZION_Technical_Whitepaper_v3.1_*.md`, `WP/WpStory6_*.md` — stale hashes and dates replaced.
- `onboard/*.md` and `onboard/book/*.md` — all onboarding chapters (CZ + EN) now use the 1 Jan 2026 genesis date and the V31 native hash.
- `onboard/soul-of-the-earth.md` — summary table uses `timestamp 1767225600 (1. 1. 2026)`.

### 3.3 Website UI / generated content

- `public/terranova-editions.json` — all `4 Dec 2025` / `4. 12. 2025` references replaced with `1 Jan 2026` / `1. 1. 2026`.
- `src/app/terranova/bookData.ts`
- `src/app/terranova/chapters/chD-bhagavad-gita.ts`
- `src/app/terranova/chapters/chE-zlata-stredni-cesta.ts`
- `src/app/terranova/chapters/chF-zaver-jedno-srdce.ts`
- `src/app/terranova/generatedEditions.ts`
- `src/app/roadmap/page.tsx` — `MainNet Genesis TerraNova` updated to **6. 8. 2026 (One Love)** / **6 Aug 2026 (One Love)**.
- `src/app/ai-native/page.tsx` and `src/components/docs/PhilosophyContent.tsx` — narrative genesis dates moved to 1 Jan 2026.

### 3.4 Internal master docs (`docs/WP-Mainet/`)

- Master whitepapers 3.1, 3.2, v3.0.5, v3.0, Technical 3.1, TerraNova 3.0.
- `SulZeme/` onboarding source files.
- `WpStory*.md` historical narratives.
- `marketing/` RASTA / onboarding / PR lite files.
- `generate_wplite_pdfs.py`, `generate_genesis_pdf.py`, `generate_genesis_pdfs.py` — generators now embed current hash, protocol `3.1.0-alpha`, and reset date `2026-08-06`.
- `Zion-WpLite.txt`.

### 3.5 Desktop-agent wallet public-API fix

A separate commit (`c2e72713a`) fixed the desktop-agent wallet section that was failing for public users because it tried to reach the operator-only TCP JSON-RPC (`62.171.141.136:8443`) behind nginx IP allowlist:

- Files: `APP&WEB/desktop-agent/src/main.js`, `archive/DesktopAgentP3.0.6/src/main.js`.
- Added public HTTPS API constants:
  - `GET /api/blockchain/address?address=...`
  - `POST /api/blockchain/broadcast`
- Added helpers `fetchWalletSnapshotPublic()` and `broadcastTransactionPublic()` with `AbortController` timeouts.
- Rewrote wallet balance, UTXO fetch, account-model balance check, and broadcast to use public HTTPS API as primary path, with direct TCP RPC as fallback for operators running a local node.
- Provider comment updated: *Hetzner* → *Contabo VPS, Prague*.
- Verified live: wallet now returns `rpc_ok=true`, real balance, UTXOs, and mining stats for a public test address.

---

## 4. Verification

### 4.1 Website

```bash
cd APP&WEB/website-v2.9 && npm run build
```

Result: **PASS** — 110 static pages generated successfully.

### 4.2 Rust workspace

```bash
cd V31 && cargo test --workspace
```

Result: **PASS** — 195 + 165 + 4 + 3 tests, 0 failures, plus doc-tests.

### 4.3 Deploy health checks

After running `APP&WEB/website-v2.9/deploy/deploy-web2.9.sh`:

| Check | HTTP code | Status |
|-------|-----------|--------|
| `https://app.zionterranova.com/` | 200 | OK |
| `https://app.zionterranova.com/docs` | 200 | OK |
| `zion-website.service` restart | healthy | OK |

---

## 5. Commit and push log

### 5.1 Commits

| SHA | Message | Files |
|-----|---------|-------|
| `6f9c7b6c2` | `docs(public,website,master): align all public and master docs with One Love v3.2.0 genesis` | 92 files |
| `c2e72713a` | `fix(wallet): use public HTTPS API instead of operator-only TCP RPC` | 2 files (`desktop-agent/src/main.js`, `archive/DesktopAgentP3.0.6/src/main.js`) |

### 5.2 Pushes

- `git push origin main` — private repo updated.
- `git subtree push --prefix=public public main` — public MIT repo updated.

---

## 6. Deployment

- **Website built** locally and rsynced to Edge at `/opt/zion/website-v2.9`.
- **Ownership** `zion:zion` set, `zion-website.service` restarted.
- **Live URL** `https://app.zionterranova.com/` confirmed healthy after ~20 s.
- **Intro hub** `maintenance.html` was not redeployed because it already reflects `v3.2.0 Mainnet Stable "One Love"`.

---

## 7. Notes and remaining items

- The `archive/MinerP3.0.6/` directory had uncommitted deletions in the working tree at the start of the session. It was restored to match `HEAD` to avoid accidental archival removal. If the old V3 miner archive should be removed, do it in a separate explicit commit.
- Internal historical directories (`docs/TerraNova/`, `docs/docs2.9/`) still contain many `4 Dec 2025` references. These are historical reports and book drafts, not active public docs, and were intentionally left unchanged.
- `archive/MinerP3.0.6/` still contains old V3 genesis data — it is archived read-only per `AGENTS.md`.

---

## 8. References

- `AGENTS.md` § V3.2 One Love genesis reset
- `StatusV3.md`
- `V31/L1/core/src/genesis.rs` (`GENESIS_TIMESTAMP = 1_767_225_600`)
- `V31/L1/core/src/node_runtime.rs` (`NODE_PROTOCOL_VERSION = "zion-v3-node/3.1.0-alpha"`)
