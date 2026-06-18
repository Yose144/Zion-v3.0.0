# ZION TerraNova Explorer — Comprehensive Upgrade Plan

## Overview
Maximally expand the ZION block explorer to match the robustness, depth, and UX of leading explorers (Blockscout, Orb, Etherscan, Solscan). Keep the existing beautiful dark glassmorphic design.

## Current State Audit

### What already exists
- Explorer homepage: network ticker, stats grid, recent blocks, recent txs, charts, emission monitor, network peers, rich list, quick nav
- Block archive with pagination
- Block detail with prev/next nav, tx table
- Transaction feed with pagination, address filter
- Transaction detail with inputs/outputs, extra data
- Address detail with balance, mining stats, consciousness level, UTXOs, tx history
- Search bar with prefix hints (`block:`, `tx:`, `addr:`), dropdown previews, keyboard nav
- Network stats with sparklines and 24h area charts
- Mempool with fee histogram, sorting, search, WS live indicator
- Bridge tracker with pipeline visualization
- Supply dashboard with donut chart, emission progress, reward distribution, decade schedule
- Rich list with type filters
- Multi-timeframe charts (1h, 6h, 24h, 7d, 30d, all)

### Gaps vs. modern explorers
1. **No recent search persistence**
2. **No address watchlist / favorites**
3. **No raw JSON / hex view on block & tx detail**
4. **No transaction status timeline visualization**
5. **No fee estimator / recommended fee page**
6. **No dedicated miners / pool leaderboard page**
7. **No consensus / algorithm info panel**
8. **No export to CSV for transactions**
9. **No QR codes for addresses**
10. **No block navigation shortcuts (jump to height)**
11. **No live "new block" toast notifications**
12. **Address detail lacks incoming/outgoing tx filters**
13. **No tooltip explanations for metrics**
14. **Charts only show 4 types in multi-view, missing txcount/blocksize**
15. **No "copy link to this page" buttons**

---

## Implementation Plan

### Phase 1: Shared Utilities & Hooks
1. **`useRecentSearches`** hook — persist last 10 searches in localStorage
2. **`useWatchlist`** hook — persist bookmarked addresses in localStorage
3. **CSV export utility** — `exportToCSV(rows, filename)`
4. **QR Code component** — using `qrcode.react` (check if available, else inline SVG)
5. **CopyLinkButton** component — copies current URL with toast
6. **LiveToast** component — animated "New Block #XXXXX" notification

### Phase 2: Search & Homepage
1. **ProSearchBar** — add recent searches dropdown, clear history button
2. **Explorer homepage** — add live toast container, quick jump to block input, watchlist preview if items exist

### Phase 3: Detail Pages (Block, Tx, Address)
1. **BlockDetailClient** — add raw JSON toggle tab, copy link button, jump-to-height input in header, block size/fee analysis if data available
2. **TxDetailClient** — add raw JSON toggle tab, status timeline (Pending → Confirmed), fee per byte, copy link button
3. **AddressDetailClient** — add QR code, incoming/outgoing/all tx filter, CSV export button, copy link button, watchlist toggle (star icon)

### Phase 4: New Pages
1. **`/explorer/fee-estimator`** — analyze mempool data, suggest low/medium/high fee rates based on recent blocks
2. **`/explorer/miners`** — leaderboard of top miners by blocks found, hashrate, consciousness level; links to address detail
3. **`/explorer/consensus`** — static educational page about LWMA DAA, Decade Decay, PoW algorithms (Deeksha Lite/Fire/Ekam), 89/5/5/1 split, block time target

### Phase 5: Charts & Data
1. **ExplorerCharts** — include txcount and blocksize in multi-view dashboard (add to CHART_ORDER)
2. **NetworkStatsClient** — add tooltip helper icon next to each stat card explaining the metric

### Phase 6: Navigation & Polish
1. Add new quick links on explorer homepage for Fee Estimator, Miners, Consensus
2. Ensure all new pages have breadcrumbs, back links, zion-shell backgrounds
3. Ensure responsive grid layouts
4. Add metadata to new pages

---

## Design Constraints
- Keep `zion-panel`, `rounded-[28px]`, `bg-black/60`, `backdrop-blur-2xl` design language
- Keep existing color tokens: `zion-cyan`, `zion-gold`, `zion-purple`, `emerald-400`, `amber-400`
- Keep Lucide icons only
- Maintain Czech/English bilingual via `useLang`
- Do not break existing API assumptions

## Files to Create
- `src/hooks/useRecentSearches.ts`
- `src/hooks/useWatchlist.ts`
- `src/components/explorer/CopyLinkButton.tsx`
- `src/components/explorer/LiveToast.tsx`
- `src/components/explorer/QRCode.tsx`
- `src/lib/csvExport.ts`
- `src/app/explorer/fee-estimator/page.tsx`
- `src/app/explorer/fee-estimator/FeeEstimatorClient.tsx`
- `src/app/explorer/miners/page.tsx`
- `src/app/explorer/miners/MinersLeaderboardClient.tsx`
- `src/app/explorer/consensus/page.tsx`
- `src/app/explorer/consensus/ConsensusClient.tsx`

## Files to Modify
- `src/components/explorer/ProSearchBar.tsx`
- `src/app/explorer/page.tsx`
- `src/app/explorer/block/BlockDetailClient.tsx`
- `src/app/explorer/tx/TxDetailClient.tsx`
- `src/app/explorer/address/AddressDetailClient.tsx`
- `src/components/explorer/ExplorerCharts.tsx`
- `src/app/explorer/network-stats/NetworkStatsClient.tsx`

## Dependencies
- `qrcode.react` may need install; check package.json first. If missing, use lightweight inline approach or install.
