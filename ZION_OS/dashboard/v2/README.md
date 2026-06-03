# ZION Dashboard v2

Modern React 19 + TypeScript + Vite frontend for the ZION node dashboard.
Implements the **v2.9 glassmorphism design system** (mesh gradients, RGB CSS vars, backdrop blur).

> **Status:** MVP complete — branch `feat/dashboard-v2`, build ✅ 0 TS errors, 346 ms

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | React 19 + TypeScript |
| Bundler | Vite 8 |
| Styling | Tailwind CSS 4 + v2.9 design system |
| State | Zustand 5 |
| Charts | Recharts 3 |
| Tables | TanStack Table 8 |
| Logs | react-virtuoso 4 (virtualized) |
| Icons | Lucide React |
| Date | date-fns 4 |
| Real-time | Native WebSocket (`/ws` → Python backend) |

---

## Development

```bash
# Install dependencies
npm install

# Start dev server (proxies /api/* and /ws to localhost:8766)
npm run dev
# → http://localhost:5173

# Type check + production build
npm run build
# → dist/

# Preview production build
npm run preview
```

---

## Architecture

```
src/
├── types/api.ts           — All TypeScript interfaces (StatusResponse, etc.)
├── api/client.ts          — Typed fetch wrapper for all ~65 API endpoints
├── ws/manager.ts          — WebSocket singleton with auto-reconnect
├── stores/
│   ├── statusStore.ts     — Node/pool/miner/resource state (Zustand)
│   ├── logStore.ts        — Log lines ring buffer (3000/service)
│   ├── settingsStore.ts   — User preferences (localStorage)
│   └── alertStore.ts      — Alert queue + toast dispatch
├── hooks/
│   ├── usePolling.ts      — Adaptive polling (slower when WS connected)
│   └── useWebSocket.ts    — Connects WS manager → all stores
└── components/
    ├── layout/
    │   ├── Sidebar.tsx         — Collapsible nav, glassmorphism, gradient active states
    │   └── DashboardLayout.tsx — Root layout, .zion-shell grid overlay, lazy tab loading
    ├── ui/
    │   ├── Card.tsx            — .zion-panel glass cards with accent colours
    │   ├── Badge.tsx           — Glass badges with glow shadows
    │   ├── Button.tsx          — Primary/secondary/danger variants
    │   ├── Toast.tsx           — Glassmorphism toast with fade-in
    │   ├── Skeleton.tsx        — Shimmer loading states + ChartSkeleton
    │   ├── KeyboardHelp.tsx    — Glass modal with grouped keyboard shortcuts
    │   └── ChecklistWidget.tsx — Collapsible launch-day checklist (Overview)
    └── tabs/                   — One file per tab (lazy loaded)
```

---

## Tabs

| Tab | Description | Status |
|-----|-------------|--------|
| **Overview** | Hero stats, service health grid, ChecklistWidget, resource bars, pool metrics | ✅ |
| **Logs** | Virtualized log stream per service, search, pill service selectors | ✅ |
| **Explorer** | Block list, mempool, transaction search | ✅ |
| **Controls** | Service start/stop/restart, gradient cards, dark CLI console | ✅ |
| **Charts** | Hashrate, CPU/RAM, block height, peers (Recharts) | ✅ |
| **Services** | Health grid for all 14 services + dependency graph | ✅ |
| **L1** | Node1/Node2/Pool/Miner detail, gradient sparklines | ✅ |
| **Layers (L2–L6)** | Unified layers view with live stats | ✅ |
| **Hiran AI** | Chat with Hiran v2.2, NCL jobs, inference status | ✅ |
| **DAO** | Proposal list with vote bars | ✅ |
| **Wallets** | Premine + operational wallets, gold/cyan glow balances, fee-split | ✅ |
| **Alerts** | Severity glass cards, all-clear panel, archived | ✅ |
| **Topology** | Network diagram (Core + Edge over Tailscale) | ✅ |
| **Env Files** | Read .env files | ✅ |
| **Database** | DB stats + inspect | ✅ |
| **Ops** | Backup create/verify/restore + ops log | ✅ |
| **Launch Day** | 3-tile summary, readiness progress bar, item checklist | ✅ |
| **Settings** | Refresh interval, log lines, display prefs, gradient toggles | ✅ |

---

## Design System (v2.9)

All styles live in `src/index.css`. Key conventions:

```css
/* RGB triplets — not hex — for rgba() composition */
--color-zion-gold:   255 215 0
--color-zion-purple: 147 51 234
--color-zion-cyan:   6 182 212
--color-bg:          2 4 12

/* Usage */
color: rgba(var(--color-zion-gold), 0.9);
```

### CSS utility classes

| Class | Effect |
|-------|--------|
| `.zion-panel` | `backdrop-filter: blur(22px) saturate(140%)` + gradient overlay |
| `.zion-panel-soft` | Lighter glass variant |
| `.zion-panel-hover` | Hover lift + glow |
| `.zion-shell::before` | 96px grid overlay + radial purple/cyan gradients |
| `.text-gradient` | Gold→purple→cyan gradient text |
| `.zion-btn-primary` | Gold→purple→cyan gradient button |
| `.zion-kicker` | Uppercase pill badge |

---

## Production Deploy

The Python backend (`dashboard/app.py`) automatically serves `v2/dist/` as a SPA when the build exists.

```bash
# Build once
npm run build

# Python backend now serves React at http://127.0.0.1:8766
```

The `/ws` WebSocket endpoint is handled directly by the Python stdlib HTTP server using RFC 6455 framing (no external dependencies). If WS is unavailable, the frontend falls back to 5 s polling.

---

## ChecklistWidget

`ChecklistWidget` is a collapsible inline component rendered in `OverviewTab` (below Services, above Pool Metrics). It fetches `/api/launch_day_status` and shows:

- Collapsible header with inline progress bar + readiness % badge
- 2-column grid of check items with coloured status icons
- Graceful fallback when endpoint is unavailable

---

*Last updated: 2026-05-25 (commit `bc07d88c`)*

*Generated with [Devin](https://cli.devin.ai/docs)*
*Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>*
