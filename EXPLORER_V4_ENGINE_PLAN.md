# ZION TerraNova Explorer V4 — Engine Plan

> Goal: build a full-featured blockchain explorer in the ZION web design language (ZionTheme), with content parity to [Verus Insight](https://insight.verus.io), but optimized for the ZION v3.0.6 mainnet.

---

## 1. Why V4?

The current `/explorer` already has useful sections (network ticker, recent blocks/TXs, rich list, mempool, supply, charts), but it is a **dashboard** rather than a full **block/tx/address inspection engine**.

Verus Insight provides:

- searchable block, transaction and address views,
- input/output breakdowns with value flows,
- confirmations, fees, difficulty, merkle roots,
- rich list, supply, mempool, network status,
- raw tx / raw block access,
- broadcast transaction & verify message tools,
- REST + WebSocket real-time feed.

ZION Explorer V4 will match that depth while keeping the dark glass/Rasta/Zion look used on `/pool` and the new `/network` page.

---

## 2. Design Language (ZionTheme)

Reuse existing primitives so the explorer feels native:

| Element | Implementation |
|---|---|
| **Cards** | `zion-rainbow-card`, `zion-rainbow-sub`, `zion-panel-soft` |
| **Gradients** | `text-gradient`, Rasta accents (emerald / gold / rose), cyan/purple/gold glows |
| **Tables** | rounded 2xl, `overflow-x-auto`, glass headers, monospace hashes, copy buttons |
| **Data typography** | `font-mono` for hashes/amounts/heights; `tabular-nums` for numbers |
| **Badges** | `zion-badge-gold`, `zion-badge-green`, status dots |
| **Hero** | left text + right live search, exactly like `/explorer` and `/pool` |
| **Charts** | Recharts sparklines and area charts, auto-refresh every 15 s |
| **Real-time** | Server-Sent Events (SSE) feed for new blocks and mempool events |
| **i18n** | Czech + English via `useLang` / `tr()` helpers |

Responsive rules already in place:

- mobile first, `sm/md/lg/xl` breakpoints,
- `break-all` for addresses/hashes,
- tables become horizontally scrollable on small screens.

---

## 3. Routes (App Router)

All routes live under `/explorer/v4/` during construction, then replace `/explorer/` when ready.

| Route | Purpose |
|---|---|
| `/explorer/v4` | Landing dashboard (latest blocks, latest TXs, network ticker, quick links) |
| `/explorer/v4/blocks` | Paginated blocks list |
| `/explorer/v4/block/[height_or_hash]` | Block detail + contained transactions |
| `/explorer/v4/txs` | Paginated transactions list |
| `/explorer/v4/tx/[hash]` | Transaction detail (inputs, outputs, memo, raw) |
| `/explorer/v4/address/[address]` | Address detail (balance, total in/out, TX history) |
| `/explorer/v4/richlist` | Top holders |
| `/explorer/v4/mempool` | Pending transactions, fee histogram, double-spend check |
| `/explorer/v4/charts` | Hashrate, difficulty, block time, supply, TX count |
| `/explorer/v4/status` | Node / network status (version, protocol, peers, supply) |
| `/explorer/v4/search` | Dedicated search results page |
| `/explorer/v4/broadcast` | Broadcast raw signed transaction |
| `/explorer/v4/verify-message` | Verify signed message |
| `/explorer/v4/api-docs` | OpenAPI-style docs for the explorer API |

---

## 4. API Layer

Extend the existing `src/app/api/blockchain/*` routes. Add new endpoints where missing.

### Existing (keep / enrich)

- `GET /api/blockchain/stats` — network summary (height, hashrate, difficulty, supply, peers, mempool).
- `GET /api/blockchain/blocks?limit=&offset=` — recent blocks.
- `GET /api/blockchain/transactions?limit=&offset=` — recent transactions.
- `GET /api/blockchain/address?address=` — address summary + history.
- `GET /api/blockchain/search?q=` — unified search.
- `GET /api/blockchain/mempool` — pending TX list.
- `GET /api/blockchain/richlist` — top addresses.
- `GET /api/blockchain/charts` — historical chart data.
- `GET /api/blockchain/emission` — supply / emission data.
- `GET /api/blockchain/peers` — peer list / geo.

### New / to add

| Endpoint | Data |
|---|---|
| `GET /api/blockchain/block?identifier=<hash_or_height>` | Full block + transaction IDs. |
| `GET /api/blockchain/tx?hash=<tx_hash>` | Full TX with inputs/outputs, confirmations, raw hex. |
| `POST /api/blockchain/broadcast` | Submit raw signed TX, return txid or error. |
| `POST /api/blockchain/verify-message` | `{address, message, signature}` → `{valid: bool}`. |
| `GET /api/blockchain/sse` | Server-Sent Events stream for `new_block` and `mempool_update`. |

### Back-end strategy

- Proxy to the ZION node RPC (`rpc.zionterranova.com:8443` / internal `127.0.0.1:9443`).
- Add a thin **ZION → Insight-compatible adapter** where useful (block, tx, address JSON shapes).
- Cache responses with `unstable_cache` / Redis-friendly TTL:
  - blocks: 60 s,
  - stats: 15 s,
  - mempool: 5 s.
- Rate limit public endpoints (already configured via Next.js middleware / Vercel/edge).

---

## 5. Frontend Components

Create a new component tree under `src/components/explorer/v4/`.

### Global

- `ExplorerV4Layout` — sub-nav for explorer sections, live ticker, footer.
- `ExplorerSearchBar` — omnibox with block/tx/address detection (reuse `ProSearchBar` logic).
- `ExplorerTicker` — slim live stats strip (height, hashrate, difficulty, mempool, price if available).
- `CopyButton` — copy hash/address to clipboard.
- `HashChip` — truncated hash with tooltip and copy.
- `ZionDataTable` — generic responsive table wrapper.
- `ZionStatCard` — icon + label + value for grids.
- `LiveBadge` — pulsing "LIVE" badge.

### Page specific

- `LatestBlocksSection` / `BlocksTable`
- `LatestTransactionsSection` / `TransactionsTable`
- `BlockDetailCard` — metadata grid + tx list.
- `TransactionDetailCard` — summary + inputs/outputs + memo + raw JSON.
- `AddressDetailCard` — balance, totals, QR code, TX history table.
- `RichListTable`
- `MempoolFeed` + `FeeHistogram`
- `NetworkStatusPanel`
- `BroadcastTxForm`
- `VerifyMessageForm`

### Charts

- Reuse `ExplorerCharts` and `NetworkSparkline` components.
- Add new charts: `TxVolumeChart`, `SupplyChart`, `BlockTimeDistribution`.

---

## 6. State & Real-Time

- Use **SWR** for polling:
  - dashboard stats: 15 s,
  - block/tx detail: 30 s,
  - mempool: 5 s.
- Use **SSE** for instantaneous updates:
  - new block → prepend to latest blocks/refresh stats,
  - mempool event → update mempool list.
- Use URL state for pagination (`?page=`, `?limit=`), filters, sorting.

---

## 7. Page-by-Page Specification

### 7.1 Dashboard `/explorer/v4`

Layout (top → bottom):

1. `NetworkTicker` (slim strip).
2. Hero: left title/description + right `ExplorerSearchBar`.
3. 4-column stat grid: height, hashrate, difficulty, mempool size.
4. Two-column layout: Latest Blocks | Latest Transactions (auto-refresh).
5. Quick link grid to sub-pages.
6. Mini charts (hashrate / difficulty / block time / supply).

### 7.2 Blocks `/explorer/v4/blocks`

- Table columns: Height, Hash (truncated), Timestamp, Age, Transactions, Difficulty, Size, Reward.
- Pagination: 25 / 50 / 100 per page.
- Click row → block detail.
- Export: CSV of visible page.

### 7.3 Block Detail `/explorer/v4/block/[id]`

- Header: Block #X, hash chip, timestamp, confirmations.
- Metadata grid:
  - Height, Hash, Previous Block, Next Block, Merkle Root, Time, Difficulty, Bits, Size, Reward, Fees, TX count, Version, Nonce.
- Transactions list for the block (paginated if > 50).
- Raw block JSON tab.

### 7.4 Transactions `/explorer/v4/txs`

- Table columns: Hash, Type, Block, Age, Sender, Recipient, Amount, Fee, Memo.
- Filters: type, date range, amount range.
- Pagination.

### 7.5 Transaction Detail `/explorer/v4/tx/[hash]`

- Header: TX hash, status (confirmed / pending), block height, confirmations, timestamp, fee.
- Input list (address + amount).
- Output list (address + amount + type).
- Memo / OP_RETURN display.
- Flow diagram (optional): inputs → outputs.
- Raw TX hex / JSON tabs.

### 7.6 Address Detail `/explorer/v4/address/[address]`

- QR code.
- Balance, total received, total sent, TX count.
- Tabs: Transactions | Rewards (if mining) | Raw JSON.
- Transaction table for the address (paginated).

### 7.7 Rich List `/explorer/v4/richlist`

- Top 100 addresses table.
- Columns: Rank, Address, Balance, % of Supply, TX Count.
- Highlight premine / pool / bridge / known contracts.

### 7.8 Mempool `/explorer/v4/mempool`

- Summary: pending TX count, total fees, avg fee, fee histogram.
- Table: hash, age, fee, size, inputs/outputs, sender → recipient.
- Double-spend / replace-by-fee indicator.

### 7.9 Charts `/explorer/v4/charts`

- Hashrate (1h / 24h / 7d / 30d).
- Difficulty.
- Block time.
- TX count / volume.
- Supply / emission.
- Export PNG / CSV.

### 7.10 Status `/explorer/v4/status`

- Node info: version, protocol, chain, sync status.
- Network info: peers, hashrate, difficulty, block time.
- Supply info: circulating, mined, premine, Decade Decay schedule.
- API info: endpoints, rate limits.

### 7.11 Broadcast `/explorer/v4/broadcast`

- Textarea for raw signed TX hex.
- Submit button.
- Result card: txid or error.

### 7.12 Verify Message `/explorer/v4/verify-message`

- Inputs: address, message, signature.
- Submit → valid/invalid badge.

---

## 8. Technical Implementation Plan

### Phase 1 — API foundation (1–2 days)

1. Implement `/api/blockchain/block` and `/api/blockchain/tx` endpoints.
2. Add SSE endpoint `/api/blockchain/sse`.
3. Add `/api/blockchain/broadcast` and `/api/blockchain/verify-message`.
4. Normalize RPC responses to a stable JSON schema.

### Phase 2 — Shared components (1–2 days)

1. Build `ZionDataTable`, `HashChip`, `CopyButton`, `ExplorerTicker`, `LiveBadge`.
2. Create `ExplorerV4Layout` with sub-navigation.
3. Wire SWR hooks: `useStats`, `useBlocks`, `useTxs`, `useBlock`, `useTx`, `useAddress`, `useMempool`, `useRichList`.

### Phase 3 — Pages (2–3 days)

1. Dashboard, Blocks, Block Detail, Transactions, Transaction Detail.
2. Address Detail, Rich List, Mempool.
3. Charts, Status, Broadcast, Verify Message, API Docs.

### Phase 4 — Polish & integration (1–2 days)

1. Responsive QA on mobile.
2. Add loading skeletons and error states.
3. Wire real-time SSE to dashboard tables.
4. Add CSV/PNG export.
5. Replace `/explorer` index with `/explorer/v4` content and redirect old detail URLs.

---

## 9. File Structure

```text
src/app/explorer/v4/
├── page.tsx                 # dashboard
├── layout.tsx               # explorer sub-layout
├── blocks/
│   └── page.tsx
├── block/
│   └── [id]/page.tsx
├── txs/
│   └── page.tsx
├── tx/
│   └── [hash]/page.tsx
├── address/
│   └── [address]/page.tsx
├── richlist/
│   └── page.tsx
├── mempool/
│   └── page.tsx
├── charts/
│   └── page.tsx
├── status/
│   └── page.tsx
├── broadcast/
│   └── page.tsx
├── verify-message/
│   └── page.tsx
└── api-docs/
    └── page.tsx

src/components/explorer/v4/
├── layout/
├── shared/
├── dashboard/
├── blocks/
├── txs/
├── tx/
├── address/
├── richlist/
├── mempool/
├── charts/
├── status/
├── broadcast/
└── hooks/

src/lib/explorer/
├── api.ts                   # typed fetch helpers
├── types.ts                 # Explorer V4 TS types
├── adapters.ts              # RPC → UI adapter
└── sse.ts                   # SSE client helper
```

---

## 10. Data Shapes (examples)

### Block

```json
{
  "height": 7799,
  "hash": "a3f1...",
  "previous_block_hash": "9c2e...",
  "next_block_hash": null,
  "merkle_root": "7b8d...",
  "timestamp": 1752643200,
  "confirmations": 12,
  "difficulty": 12345678,
  "bits": "1a0c...",
  "size": 1847,
  "weight": 1847,
  "tx_count": 4,
  "reward": 8.0,
  "fees": 0.002,
  "miner": "zion1g5...",
  "version": 536870912,
  "nonce": 123456,
  "transactions": ["txid1", "txid2"]
}
```

### Transaction

```json
{
  "hash": "txid1",
  "block_height": 7799,
  "block_hash": "a3f1...",
  "confirmations": 12,
  "timestamp": 1752643200,
  "size": 312,
  "fee": 0.0001,
  "version": 1,
  "type": "transfer",
  "memo": "BRIDGE:base:...",
  "inputs": [
    {"address": "zion1a...", "amount": 10.0}
  ],
  "outputs": [
    {"address": "zion1b...", "amount": 9.9999, "type": "standard"},
    {"address": "zion1c...", "amount": 0.0, "type": "op_return"}
  ],
  "raw": "020000..."
}
```

---

## 11. Non-Functional Requirements

- **Performance**: TTFB < 200 ms for cached endpoints; skeletons on first paint.
- **SEO**: static params for block/tx/address where possible; canonical URLs.
- **Accessibility**: focus rings, aria labels, keyboard navigation for tables.
- **Security**: never expose private node credentials; rate limit public endpoints; validate all params.
- **Observability**: log slow RPC calls; surface API health on status page.

---

## 12. Open Questions / Next Steps

1. Does the node RPC already expose `getrawtransaction` and `getblock` with full TX data, or do we need to extend the Rust node?
2. Should we preserve the old `/explorer` routes as redirects, or replace them outright?
3. Do we want a public WebSocket endpoint, or is SSE sufficient?
4. Should the explorer expose a public GraphQL layer in addition to REST?
5. Which known addresses should be labeled in the rich list / address views (pool, bridge, DAO treasury, etc.)?

---

## 13. First Concrete Task

Start **Phase 1**: create the two missing endpoints `/api/blockchain/block` and `/api/blockchain/tx`, plus the SSE stream. Then build the dashboard page using the new endpoints and verify mobile responsiveness before moving to detail pages.
