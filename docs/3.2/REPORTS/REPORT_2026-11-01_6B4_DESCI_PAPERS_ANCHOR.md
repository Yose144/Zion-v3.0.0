# 6.B4 — DeSci papers repository + L1 hash anchor (implementace) · Rozpor #13 dead DEX UI cleanup

**Date:** 2026-11-01 · **Scope:** `V31/L6/issobella/{Cargo.toml,src/{anchor.rs,api.rs,db.rs,error.rs,lib.rs},tests/db.rs}`, `apps/website-v2.9/src/{app/api/issobella,app/l6-issobella,components/dex}`, `V31/Cargo.lock` · **Commit:** `d9358015e` · **Status:** code + tests + docs done; **anchor activation = 👤 operator** (custody keys)

## Audit item resolution

### 6.B4 DeSci — `/l6-issobella/papers` + L1 hash anchor

Plan line: public repository of L6 Issobella research outputs where every
paper's existence+integrity is timestamp-anchored on L1. Design:
[`../L6_DESCI_PAPERS_ANCHOR_DESIGN.md`](../L6_DESCI_PAPERS_ANCHOR_DESIGN.md)
(31. 10.) — implemented 1. 11. as scoped: two SQLite tables, 6 REST routes,
two anchor modes, fail-closed ops gating.

**Data model (`db.rs`, `issobella-v31.db`):**

- `papers` — id (`pap-*`), optional `mission_id`/`proposal_id` FK, title,
  authors (JSON), abstract, `content_sha256` (blake3 hex of file bytes —
  column name kept per design/schema compat), `content_url`,
  `submitted_by`, status lifecycle
  `submitted → anchoring → anchored → published` (+`anchor_failed`),
  `anchor_txid`/`anchor_height`/`anchor_mode`/`merkle_path`/`batch_id`.
- `anchor_batches` — Merkle batch bookkeeping: root, member paper ids,
  anchor txid/height, `pending → broadcast → anchored` (+`anchor_failed`).

**Anchor (`anchor.rs`, ~560 LOC):**

- `memo-direct` — one tx per paper, memo `ISSPAPER:v1:<blake3-hex>`,
  dust output (default 1 flower, `ISS_ANCHOR_DUST_FLOWERS`) to sentinel
  (`ISS_ANCHOR_SENTINEL`, default = anchor address).
- `merkle-batch` — pending papers folded into a blake3 Merkle tree; one tx
  carries `ISSANCHOR:v1:<root-hex>`; per-paper `merkle_path` persisted for
  public proof replay.
- Signing/broadcast reuses the DAO-treasury custody pattern:
  `ISS_ANCHOR_KEY` (hex Ed25519) + `ISS_ANCHOR_ADDRESS` (source/change)
  → `build_send_with_memo` → node RPC. Same ops-key model as
  `ZION_DAO_TREASURY_KEY`; no new key material or money-path invented.
- **Reorg-safe confirm:** a paper counts as `anchored` only after
  `ISS_ANCHOR_FINALITY` confirmations (default 6). Primary check =
  `getUtxos` on the sentinel; fallback = bounded `getBlockByHeight` scan
  (`ISS_ANCHOR_CONFIRM_LOOKBACK`) for the case where sentinel == anchor
  wallet and the dust output was spent by a later anchor tx.
- **Fail-closed when unconfigured:** without `ISS_ANCHOR_KEY`/`ISS_ANCHOR_ADDRESS`
  the sweep is a no-op returning
  `"anchor wallet not configured (ISS_ANCHOR_KEY/ISS_ANCHOR_ADDRESS)"` —
  papers stay `submitted`/`anchoring` (`awaiting_broadcast` pattern from
  `treasury_tx.rs`). No money path activates by accident.

**REST surface (`api.rs`):**

| Route | Access |
|---|---|
| `GET /api/v1/papers` | public — `status='published'` only; `?all=1` requires admin |
| `POST /api/v1/papers` | daemon-internal admin (public submit goes through the website proxy) |
| `GET /api/v1/papers/:id` | public — unpublished → 404 |
| `GET /api/v1/papers/:id/proof` | public — hash, txid, height, mode, optional merkle path + verify hints |
| `POST /api/v1/papers/:id/publish` | admin |
| `POST /api/v1/anchor/run` | admin — manual sweep trigger |

Admin gate: `x-api-key` or `Authorization: Bearer` == `ISSOBELLA_API_KEY`;
empty configured key denies (fail-closed), matching existing
missions/proposals admin pattern.

**Website (`website-v2.9`):**

- `src/app/api/issobella/[[...path]]/route.ts` — catch-all proxy to the
  daemon (same convention as `/api/dao/[...path]`); upstream
  `ISSOBELLA_API_URL` env with local default. GET exposes only
  `papers|health|metrics`; **POST allows `papers` submission only, gated on
  a ZIS session** — `submitted_by` is bound server-side to
  `zis:<user.id>` (never client-supplied) and the daemon admin key is
  injected from `ISSOBELLA_API_KEY` env. This implements the design's
  ZIS-gated submit at the web tier while the daemon's own write surface
  stays admin-only; publish/anchor sweeps are not proxied at all.
- `src/app/l6-issobella/papers/page.tsx` — bilingual (cs/en via `useLang`)
  list of published papers: title, authors, date, anchor badge
  (`anchored @height` → explorer tx link), proof link.
- `src/app/l6-issobella/page.tsx` — added `/l6-issobella/papers` CTA
  ("Papers · L1 kotva" / "Papers · L1 anchor", Anchor icon).

### Rozpor #13 — dead DEX UI trio deleted

NIRVANA plan §2 #13: `RecentSwaps.tsx` fetched `${ROUTER_URL}/swaps?limit=10`
and `TransactionStatus.tsx` `/swaps/:id` — **routes that do not exist in
`warpd`** (legacy ZionDex Router surface). `ZionDexDashboard` was their
only consumer and is rendered nowhere under `app/`.

Verified before deletion: no imports outside the trio itself
(`grep -rln` over `src/`); live surface (`/market` page) imports
`PriceChart`/`CrossChainSwapWidget`/`DexPoolList`/`WarpBtcSwapWidget`
directly — untouched.

Resolution chosen: **delete** (the cleanup option in W4 K3), not implement —
`/swaps` routes would be a new warpd feature; real swaps will surface via
V3 on-chain `tx_hash` after K2 anyway. Registry row → ✅, changelog v1.5.

## Tests / verification

- `cargo check -p zion-issobella` — clean
- `cargo test -p zion-issobella` — **23 passed, 0 failed**:
  - 11 anchor tests: memo formats (`ISSPAPER:v1:`/`ISSANCHOR:v1:`), blake3
    leaf validation, odd/even Merkle trees, path replay, mode parsing,
    unconfigured-key fail-closed
  - 12 db tests: paper lifecycle transitions, batch lifecycle, listing
    filters
- `npx tsc --noEmit` (website) — clean before and after deletion
- `npm run build` (website) — **342/342 static pages**, new routes
  `/l6-issobella/papers` + `/api/issobella/[[...path]]` present

## Ops / deployment notes

- **Not deployed.** Daemon change lands with next `zion-issobella` release
  build; website with next web deploy.
- **Anchor activation checklist (👤):**
  1. Provision anchor ops wallet; set `ISS_ANCHOR_KEY` (hex Ed25519) +
     `ISS_ANCHOR_ADDRESS` in the daemon environment — same custody class as
     `ZION_DAO_TREASURY_KEY` (file perms, not in repo).
  2. Optional: dedicated `ISS_ANCHOR_SENTINEL` (default = anchor address),
     `ISS_ANCHOR_FEE_FLOWERS`, `ISS_ANCHOR_DUST_FLOWERS`,
     `ISS_ANCHOR_FINALITY` (6), `ISS_ANCHOR_CONFIRM_LOOKBACK`.
  3. `ISSOBELLA_API_KEY` must be set for admin routes (submit/publish/run)
     — in the **daemon** env and also in the **website** env (the proxy
     injects it for ZIS-authenticated submissions; unset → 503, fail-closed).
  4. Website upstream: `ISSOBELLA_API_URL` env (defaults to local daemon
     `127.0.0.1:8097`).
- Anchor cost model: `memo-direct` = 1 tx + fee per paper (fine <10/day);
  `merkle-batch` = 1 tx per sweep regardless of volume.

## Follow-ups (not in this commit)

- Batch anchoring cadence decision (cron vs manual `/anchor/run`).
- Real on-chain swap `tx_hash` surfacing in UI — after K2 (W4).
