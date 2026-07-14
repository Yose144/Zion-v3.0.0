# ZION Website Fix Report

> Generated: 2026-07-10
> Scope: `APP&WEB/website-v2.9/` (Next.js 16, standalone Docker runtime)
> Live URL: https://zionterranova.com
> Host: 62.171.141.136 (zion-new)

---

## 1. Executive Summary

This report documents the complete round of fixes applied to the public ZION website after the v3.0.5 Mainnet Beta deployment. The work covered three tracks:

1. **Pool / Explorer E2E hardening** — canonical URL redirects, miner search robustness, and end-to-end verification of blocks, transactions, addresses, and miner detail pages.
2. **Czech and English language correction** — full pass over visible UI text and public docs.
3. **Documentation and operational cleanup** — sanitized public docs of server IPs, added a Docs icon to the top navigation, and updated deployment docs.

All changes were built locally with `npm run build` (Next.js webpack mode), shipped to the Edge server runtime, and verified with `curl` smoke tests.

---

## 2. Pool / Miner / Explorer Fixes

### 2.1 Explorer canonical slugs now redirect

The Explorer detail pages are implemented as query-param routes (`/explorer/tx?hash=...`, `/explorer/address?addr=...`, `/explorer/block?id=...`). Direct `/explorer/tx/<hash>` or `/explorer/address/<addr>` links returned **404**, breaking external shares and search-engine expectations.

**Fix:** added permanent redirects in `next.config.ts`:

- `/explorer/tx/:hash` → `/explorer/tx?hash=:hash`
- `/explorer/address/:addr` → `/explorer/address?addr=:addr`
- `/explorer/block/:id` → `/explorer/block?id=:id`

**Verification (live):**

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" \
  https://zionterranova.com/explorer/tx/fa46e54f8061fdb4f0993365802806c6e3944c5e37f89cc2f102394a1c119acf
# => 308 https://zionterranova.com/explorer/tx?hash=...
```

### 2.2 Miner detail page reachable by payout address

The address `zion1k603m783j2w0l45506e0t4v7a797t7l0d78l3m2` was already retrievable via the pool API (`/api/pool/miner/<address>`), but users were landing on 404-style paths. With the redirects and the existing pool search form, the address now resolves to `/pool/miner/<address>`.

**Verification:**

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  https://zionterranova.com/pool/miner/zion1k603m783j2w0l45506e0t4v7a797t7l0d78l3m2
# => 200
```

Pool API response confirms the address exists with a pending balance:

```json
{
  "ok": true,
  "address": "zion1k603m783j2w0l45506e0t4v7a797t7l0d78l3m2",
  "active": false,
  "stats": { "pending_balance": 4351054488527, ... }
}
```

> Note: the miner is currently **inactive** (no active worker) but has a pending payout balance. The "not found" symptom was caused by trying to access the page through a non-existent `/explorer/address/<addr>` path or by looking in the active-miners table, which only lists currently connected workers.

### 2.3 `/miner-stats` accepts both `address` and `addr` query params

`src/components/MinerStatsClient.tsx` previously only read `?address=...`. It now accepts `?addr=...` as a fallback, matching the rest of the explorer link convention.

### 2.4 E2E Explorer flow verification

| Flow | URL | Status |
|---|---|---|
| Blockchain stats | `/api/blockchain/stats` | 200 |
| Blocks list | `/api/blockchain/blocks?limit=5` | 200 |
| Block detail | `/explorer/block?id=1511` | 200 |
| Block canonical redirect | `/explorer/block/1511` | 308 → above |
| Transaction detail | `/explorer/tx?hash=fa46e54f...` | 200 |
| Transaction canonical redirect | `/explorer/tx/fa46e54f...` | 308 → above |
| Address detail | `/explorer/address?addr=zion1e448...` | 200 |
| Address canonical redirect | `/explorer/address/zion1e448...` | 308 → above |
| Pool miner detail | `/pool/miner/zion1k603...` | 200 |
| Miner stats | `/miner-stats?address=zion1k603...` | 200 |

---

## 3. Czech / English Language Correction

A full pass over the website's visible text was performed by focused sub-agents and reviewed manually.

### 3.1 Files corrected

- **Shared UI:** `src/lib/translations.ts`, `src/components/Navigation.tsx`, `src/components/Footer.tsx`, `src/components/RoadmapPulse.tsx`, `src/components/QuantumRevolution.tsx`
- **App pages:** `api-reference`, `download`, `network`, `mining`, `miner-stats`, `explorer/*`, `admin/*`, `l3-hiran`, `l4-oasis`, `l5-free-world`, `l6-issobella`, `ekam/deeksha`, `quantum-revolution`, `resonance`
- **Public docs:** `public/docs/index.md`, `public/docs/mainnet/README.md`, all `public/docs/mainnet/cli-*.md`, `public/docs/mainnet/coingecko.md`, `public/docs/mainnet/genesis-book.md`, and the Czech counterparts.

### 3.2 Representative corrections

| Before (CZ) | After |
|---|---|
| `Pruzkumnik blockchainu` | `Průzkumník blockchainu` |
| `zasoba` | `zásoba` |
| `agenticka orchestrace` | `agentická orchestrace` |
| `herni vrstva` | `herní vrstva` |
| `Humanitarni mise` | `Humanitární mise` |
| `Orbitalni observator` | `Orbitální observatoř` |
| `nulovým balancem` | `nulovým zůstatkem` |
| `Protocol version bumped na 3.0.5` | `Verze protokolu zvýšena na 3.0.5` |
| `iregulér compute graph` | `iregulární výpočetní graf` |
| English CLI docs written in Czech | Fully translated to English |

### 3.3 Terminology standardised

- `Mainnet` (not `MainNet`) in body text.
- `DeFi Run` (not `Defi Run`).
- `těžaři` / `těžba` preferred over `mineři` in Czech.

---

## 4. Security & Public Docs Cleanup

- Removed hard-coded server IPs (`62.171.141.136`, `77.42.71.94`, `109.81.30.165`) from public markdown files.
- Replaced attacker/server references with neutral wording or domain names (`pool.zionterranova.com`).
- Verified with a site-wide grep that no public docs under `public/docs/` expose these IPs.

---

## 5. Navigation & UX

- Added a **Docs** icon to the top hero navigation bar (next to Explorer, Pool, Network, Wallet).
- Removed the duplicate Docs entry from the secondary icon row.
- Added `cex` / `cex_listings` translation keys and wired them into Navigation and Footer.
- Footer bottom-bar status label now uses the shared translation key.

---

## 6. Deployment Status

- **Build:** `npm run build` passes (97 static/dynamic routes).
- **Runtime image:** `zion-web:runtime` rebuilt on server.
- **Container:** `zion-web-next` restarted in host-network mode.
- **Smoke tests:** homepage `/`, `/docs`, `/tree-of-life`, `/pool`, `/explorer`, and all canonical redirects return `200` / `308`.

---

## 7. Commits

- `9f29f0d99` — security: sanitize public docs of server IPs and remove legacy `/zohar` route files.
- `5392280d9` — feat: add Docs icon to top navigation bar.
- `88720a7ea` — fix(i18n): comprehensive CZ and EN language correction across website.
- *(this report commit)* — docs: add fix report and update deployment history.

---

## 8. Follow-up Recommendations

1. **Pool active-miners list:** consider surfacing payout addresses that have a pending balance but no active worker, so users do not mistake "inactive" for "not found".
2. **CoinGecko checklist:** `public/docs/mainnet/coingecko.md` still references an outdated CHv4 / September-2025 timeline. It needs a separate factual update to match the current Ekam Deeksha / Mainnet Beta narrative.
3. **MinerStatsClient internationalisation:** the page is currently English-only and should consume `src/lib/translations.ts` like the rest of the site.

---

*Report compiled by Devin for the ZION TerraNova team.*
