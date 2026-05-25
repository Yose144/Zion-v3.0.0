# ZION Dashboard v2

Modern React 19 + TypeScript + Vite frontend for the ZION node dashboard.

## Stack

| Layer | Tech |
|-------|------|
| Framework | React 19 + TypeScript 6 |
| Bundler | Vite 8 |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`) |
| State | Zustand 5 |
| Charts | Recharts 3 |
| Tables | TanStack Table 8 |
| Logs | react-virtuoso 4 (virtualized) |
| Icons | Lucide React |
| Date | date-fns 4 |
| Real-time | Native WebSocket (`/ws` → Python backend) |

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

## Architecture

```
src/
├── types/api.ts          — All TypeScript interfaces (StatusResponse, etc.)
├── api/client.ts         — Typed fetch wrapper for all ~65 API endpoints
├── ws/manager.ts         — WebSocket singleton with auto-reconnect
├── stores/
│   ├── statusStore.ts    — Node/pool/miner/resource state (Zustand)
│   ├── logStore.ts       — Log lines ring buffer (3000/service)
│   ├── settingsStore.ts  — User preferences (localStorage)
│   └── alertStore.ts     — Alert queue + toast dispatch
├── hooks/
│   ├── usePolling.ts     — Adaptive polling (slower when WS connected)
│   └── useWebSocket.ts   — Connects WS manager → all stores
└── components/
    ├── layout/
    │   ├── Sidebar.tsx        — Collapsible nav with 22 tabs
    │   └── DashboardLayout.tsx — Root layout, lazy tab loading
    ├── ui/                    — Card, Badge, Button, Toast
    └── tabs/                  — One file per tab (lazy loaded)
```

## Tabs

| Tab | Description |
|-----|-------------|
| Overview | Hero stats, service health grid, resource bars |
| Logs | Virtualized log stream per service, search |
| Explorer | Block list, mempool, transaction search |
| Controls | Service start/stop/restart, CLI console |
| Charts | Hashrate, CPU/RAM, block height, peers (Recharts) |
| Services | Health grid for all 14 services + dep graph |
| L1 | Node1/Node2/Pool/Miner detail |
| L2–L6 | Unified layers view with live stats |
| Hiran AI | Chat with Hiran v2.2 (llama-server/Ollama) |
| DAO | Proposal list with vote bars |
| Wallets | Premine + operational wallets with copy |
| Alerts | Active + archived alerts, dismiss |
| Topology | Network diagram (Core + Edge) |
| Env Files | Read .env files |
| Database | DB stats + inspect |
| Ops | Backup create/verify/restore + ops log |
| Launch Day | Checklist status |
| Settings | Refresh interval, log lines, display prefs |

## Production deploy

The Python backend (`dashboard/app.py`) automatically serves `v2/dist/` as a SPA when the build exists. Run `npm run build` once, then the dashboard at `http://127.0.0.1:8766` serves the React frontend.

The `/ws` WebSocket endpoint is handled directly by the Python stdlib HTTP server using RFC 6455 framing (no external dependencies).

## ZION Colors

```css
--color-zion-gold:   #FFD700
--color-zion-purple: #9333EA
--color-zion-cyan:   #06B6D4
--color-zion-green:  #22C55E
--color-zion-red:    #EF4444
```
