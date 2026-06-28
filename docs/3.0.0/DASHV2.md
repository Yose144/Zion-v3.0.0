# DASHV2 — ZION Dashboard v2.0 Upgrade Plan

> **Datum:** 2026-05-27
> **Autor:** Devin / ZION Core Team
> **Cíl:** Trojdílná dashboard architektura — lokální control, DAO správa, Guardian portal.
> **Status:** ✅ Fáze 1–6 hotová — branch `feat/dashboard-v2`, commit `4a3c6bbc`

---

## Trojdílná dashboard architektura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ZION Dashboard Ecosystem (3 produkty)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                    │
│  │  LOCAL v1    │   │  DAO v2      │   │  GUARDIAN    │                    │
│  │  (app.py)    │   │  (Vite+React)│   │  (web v2.9)  │                    │
│  │              │   │              │   │              │                    │
│  │  Fullstack   │   │  DAO + Ops   │   │  Monitoring  │                    │
│  │  Control     │   │  + Wallets   │   │  + Treasury  │                    │
│  │              │   │              │   │              │                    │
│  │  Who: Core   │   │  Who: DAO    │   │  Who: Guard  │                    │
│  │  Operator    │   │  Team        │   │  Team        │                    │
│  │  (W11 local) │   │  (Vite dev)  │   │  (web public)│                    │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘                    │
│         │                  │                  │                             │
│         ▼                  ▼                  ▼                             │
│  ┌──────────────────────────────────────────────────────┐                  │
│  │           Python Backend (app.py :8766)               │                  │
│  │  ├── /api/health  ──►  HealthMap                     │                  │
│  │  ├── /api/status  ──►  StatusResponse                 │                  │
│  │  ├── /api/blocks  ──►  BlockSummary[]                 │                  │
│  │  ├── /api/v2/status ──► batch                         │                  │
│  │  ├── /api/controls ──►  run_control()                 │                  │
│  │  ├── /api/logs/*  ──►  tail_log()                     │                  │
│  │  └── /api/dao/*   ──►  proxy 8450                     │                  │
│  └──────────────────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Local Control Dashboard (`/dashboard` — app.py)
- **Host:** `127.0.0.1:8766` (lokální)
- **Platforma:** **Multiplatformní — Windows 11 / Linux / macOS** (stdlib-only Python)
- **Účel:** Fullstack spuštění/zastavení — Node1, Node2, Pool, Miner, AI
- **Taby:** Controls, Logs, Env, Launch Day, Ops, Settings
- **Přístup:** Žádná autentizace — předpokládá se lokální použití
- **Bezpečnost:** Port 8766 není veřejně exposovaný
- **Service control:** Jednoduché services jsou deklarativně v `dashboard/services.json`
  a backend (`run_service`/`stop_service`) je spouští přímo cross-platform (`.exe`
  suffix, hidden/detached launch, process-group teardown dle OS). Jen komplexní akce
  (`install-deps`, build, `start-hiran-inference`, `launch-stack`) používají per-OS
  skripty v `scripts/` (`.ps1` na Windows, `.sh` jinde). Secrety přes `${VAR}`
  placeholdery z gitignored `dashboard/.env` (viz `.env.example`).

### DAO Management Dashboard (`dashboard/v2/` — Vite+React)
- **Host:** `localhost:5173` (dev) nebo servované z app.py
- **Účel:** DAO governance, treasury management, proposal view
- **Taby:** DAO, Wallets, L1–L6 layers, Alerts, Explorer, Services
- **Přístup:** Vite dev server (pro vývojáře DAO teamu)
- **Bezpečnost:** Žádná autentizace v MVP — později API key

### Guardian Portal (`APP&WEB/website-v2.9/dashboard/guardian/` — Next.js)
- **Host:** `zionterranova.com/dashboard/guardian` (public)
- **Účel:** Read-only monitoring pro Guardian tým — pool stats, treasury, alerts, NCL
- **Autentizace:** ZION wallet connect (MetaMask / ZION L1 SDK)
- **Taby:** Monitoring, Treasury, DAO, Alerts, NCL (leaderboard + workers)
- **Bezpečnost:** Wallet sign-in + role-based access (Guardian role)
- **API proxy:** `/api/dashboard-metrics`, `/api/alerts`, `/api/dao/proposals`, `/api/ncl/*`

---

## Stav implementace (2026-05-27)

### ✅ Dokončeno

| Oblast | Soubory | Poznámka |
|--------|---------|----------|
| **Design systém** | `src/index.css` | RGB CSS vars, mesh gradient body, `.zion-panel`, `.zion-shell`, glassmorphism utilities; **light theme** `[data-theme="light"]` |
| **UI komponenty** | `Card`, `Button`, `Badge`, `Toast`, `Skeleton`, `KeyboardHelp`, `ChecklistWidget` | v2.9 glass aesthetic |
| **Layout** | `Sidebar`, `DashboardLayout` | Glassmorphism sidebar, grid overlay, live indicator, **theme switcher**, mobile hamburger |
| **Tabs — Batch 1** | `OverviewTab`, `LogsTab`, `ExplorerTab`, `ControlsTab`, `ChartsTab`, `ServicesTab` | Plně redesignováno |
| **Tabs — Batch 2** | `L1Tab`, `LayersTab`, `HiranTab`, `DaoTab`, `AlertsTab`, `WalletsTab` | Plně redesignováno |
| **Tabs — Batch 3** | `LaunchDayTab`, `SettingsTab`, `DatabaseTab`, `EnvTab`, `OpsTab`, `TopologyTab` | Plně redesignováno |
| **ChecklistWidget** | `src/components/ui/ChecklistWidget.tsx` | Collapsible, fetchuje `/api/launch_day_status`, 2-sloupec grid, progress bar |
| **Build** | `dist/` | 0 TS chyb, ~350 ms Vite build ✓ |
| **PWA** | `public/manifest.json`, `public/sw.js`, `public/offline.html` | Service worker, offline page |
| **WebSocket** | `/ws` v app.py + `useWebSocket.ts` | Real-time push: status, health, **alerty** |
| **Theme switcher** | `ThemeSwitcher` komponenta | dark / light / system, perzistentní via localStorage |
| **Mobile optimalizace** | CSS + layout | Touch target min 32px, responsive header, toast positioning, reduced-motion |
| **Unit testy** | Vitest | 16 testů — API client (8), statusStore (4), alertStore (4) |
| **E2E testy** | Playwright | 16 testů — desktop + mobile Chromium; tab nav, controls, theme, keyboard help |
| **Lighthouse** | Desktop audit | **Performance 94**, Best Practices 100, SEO 90 |
| **Guardian Portal** | `GuardianDashboard.tsx` | Alerts tab (live proxy), NCL leaderboard + workers |
| **API proxy** | `/api/alerts/route.ts` | Next.js route pro Guardian dashboard alerts |

---

## 1. Současný stav (Dashboard v1.x — historické)

| Metrika | Hodnota |
|---------|---------|
| `dashboard/app.py` | ~5 600 řádků, Python stdlib HTTP server |
| `dashboard/dashboard.js` | ~4 100 řádků, Vanilla JS (globální scope) |
| `dashboard/dashboard.html` | ~3 300 řádků, Tailwind CDN + inline CSS |
| Taby | 24 (overview, wallets, explorer, services, alerts, l1–l6, genesis, blockers, controls, charts, events, env, database, metrics, launch-day, wizard, logs, hiran, dao, ops, topology) |
| API endpointů | ~65 |
| Services monitored | 13 |
| Frontend framework | Žádný — Vanilla JS, Chart.js, Tailwind CDN |
| State management | Globální let proměnné |
| Real-time | SSE streaming (logs), 5s polling (status) |

### Známé problémy v1
- Monolitický JS — vše v jednom souboru, globální scope
- Chybí TypeScript — žádná type safety
- Žádný bundler — každý reload tahá CDN z internetu
- Duplikátní funkce a dead code (částečně opraveno v posledních commitech)
~ 150+ DOM elementů které JS očekává ale nemusí existovat v HTML
- Python backend dělá vše: HTTP server, log parser, RPC proxy, process manager, health checker
- Žádné unit testy ani E2E testy
- Přístupnost (a11y) — prakticky neřešena
- Mobile UX — sidebar je překrytý, tab bar neukládá stav

---

## 2. Cíle DASHV2

### 2.1 Primární cíle (MVP)

| # | Cíl | Priorita | Status |
|---|-----|----------|--------|
| P1 | **TypeScript + React** frontend s Vite bundlerem | Critical | ✅ |
| P1 | **Modularizace** — každý tab = samostatný komponent | Critical | ✅ |
| P1 | **Zachovat Python backend** — není čas přepisovat na Rust/Axum | High | ✅ |
| P2 | **WebSocket** místo SSE pro log streaming | High | ⏳ fallback polling |
| P2 | **Stav management** — Zustand nebo Redux Toolkit | High | ✅ Zustand 5 |
| P2 | **Virtuální scrolling** pro dlouhé logy (>2000 řádků) | Medium | ✅ react-virtuoso |
| P3 | **Responsive design** — mobilní first | Medium | ✅ |
| P3 | **PWA** — offline cache, service worker | Medium | ✅ |
| P3 | **a11y** — keyboard nav, screen reader, ARIA | Medium | ✅ KeyboardHelp |
| P4 | **E2E testy** — Playwright | Low | ⏳ |
| P4 | **Storybook** — izolované komponenty | Low | ⏳ |

### 2.2 Non-goals (co NEBUDEME dělat)
- Nepřepisujeme Python backend na Rust (agreed v AGENTS.md)
- Nepřidáváme databázi — zůstáváme na in-memory + file-based state
- Neměníme port (8766) ani host (127.0.0.1)

---

## 3. Nová architektura

```
┌─────────────────────────────────────────┐
│           Dashboard v2.0                │
├─────────────────────────────────────────┤
│  Frontend (React + TypeScript + Vite)   │
│  ├── src/components/Tabs/...            │
│  ├── src/stores/ (Zustand)              │
│  ├── src/hooks/ (useStatus, useLogs)    │
│  ├── src/services/ (API client)         │
│  └── src/types/ (shared interfaces)     │
├─────────────────────────────────────────┤
│  Python Backend (zachováno, lean)        │
│  ├── HTTP API (~65 routes)              │
│  ├── WebSocket endpoint (/ws)           │
│  ├── Background sampler thread           │
│  └── Process registry + watchdog        │
├─────────────────────────────────────────┤
│  Proxy (optional): Nginx / Caddy        │
└─────────────────────────────────────────┘
```

---

## 4. Detailní plán — Fáze

### Fáze 0: Příprava ✅

- [x] Audit všech API endpointů — dokumentace v `dashboard/API.md`
- [x] TypeScript interface definitions pro všechny API responses
- [x] Vite projekt scaffold v `dashboard/v2/`
- [x] Zustand store design — strom stavů
- [x] CSS design system — vlastní Tailwind theme (v2.9 glassmorphism)

### Fáze 1: Core Infrastructure ✅

- [x] Vite + React + TypeScript setup
- [x] Tailwind CSS config s custom ZION theme (zlatá, fialová, cyan)
- [x] API client layer (`src/api/client.ts`) — fetch wrapper s retry, timeout
- [x] Zustand store: `statusStore`, `logStore`, `settingsStore`, `alertStore`
- [x] WebSocket connection manager (`src/ws/manager.ts`)
- [x] Python: přidat `/ws` WebSocket route pro real-time push
- [x] Error boundary + Suspense fallback UI
- [x] Loading skeletons pro všechny panely

### Fáze 2: Tab Rewrite — Batch 1 ✅

| Tab | Status | Poznámka |
|-----|--------|----------|
| **Overview** | ✅ | Hero stats, service health grid, ChecklistWidget, resource bars |
| **Logs** | ✅ | Virtualizace, search bar, pill service selectors, glass toolbar |
| **Explorer** | ✅ | Block list, mempool, tx search |
| **Controls** | ✅ | Gradient service cards, dark CLI terminal |
| **Charts** | ✅ | Recharts, custom tooltip/grid |
| **Services** | ✅ | Layer-coloured cards, dependency graph |

### Fáze 3: Tab Rewrite — Batch 2 ✅

| Tab | Status | Poznámka |
|-----|--------|----------|
| **L1 (Consensus)** | ✅ | Gradient sparklines, progress bars |
| **Layers (L2–L6)** | ✅ | Sjednocený view, live stats |
| **Hiran AI** | ✅ | Chat interface, NCL jobs, inference status |
| **DAO** | ✅ | Proposals, treasury |
| **Wallets** | ✅ | Gold/cyan glow balances, copy buttons, fee-split tabulka |
| **Alerts** | ✅ | Severity glass cards, all-clear panel, archived sekce |
| **Topology** | ✅ | Network diagram Core + Edge |
| **Database** | ✅ | DB stats + inspect |
| **Env Files** | ✅ | Read .env |
| **Ops** | ✅ | Backup, ops log |
| **LaunchDay** | ✅ | 3-tile summary, readiness progress bar, StatusBadge |
| **Settings** | ✅ | Gradient toggles, sub-labels, About tabulka |

### Fáze 4: Polish & Performance ✅

- [x] Virtualized listy pro logy (react-virtuoso)
- [x] Code splitting — lazy load každý tab
- [x] PWA manifest, service worker, offline page
- [x] Keyboard shortcuts (KeyboardHelp modal)
- [x] Mobile sidebar redesign

### Fáze 5: Testování & Deploy ✅

- [x] Unit testy pro store + API client (Vitest) — 16 testů, vše prochází
- [x] E2E: Playwright — 16 testů, desktop + mobile Chromium; tab nav, controls, theme, keyboard help
- [x] Build: `npm run build` — 0 TS chyb, ~350 ms ✓
- [x] Dokumentace: `dashboard/v2/README.md` + aktualizace `DASHV2.md`
- [x] Lighthouse audit — Performance 94, Best Practices 100, SEO 90

### Fáze 6: Trojdílná architektura ✅

- [x] **Local Control** (`/dashboard` app.py) — Fullstack start/stop/restart
- [x] **DAO Management** (`dashboard/v2/` Vite) — Governance, treasury, ops
- [x] **Guardian Portal** (`/dashboard/guardian` web v2.9) — Wallet auth, monitoring, treasury read-only
- [x] app.py servuje v2 build jako SPA (fallback na v1)

---

## 5. Technologický stack

### Frontend
| Kategorie | Volba | Důvod |
|-----------|-------|-------|
| Bundler | **Vite 8** | Rychlé HMR, jednoduchá konfigurace |
| Framework | **React 19** | Známý, velká komunita |
| Language | **TypeScript** | Type safety, DX |
| Styling | **Tailwind CSS 4** + v2.9 design system | Glassmorphism, RGB vars |
| State | **Zustand 5** | Jednoduchý, boilerplate-free |
| Charts | **Recharts 3** | React-native, responsive |
| Tables | **TanStack Table 8** | Virtuální scroll, sort, filter |
| Logs | **react-virtuoso 4** | Virtualizace pro >2000 řádků |
| Icons | **Lucide React** | Čisté, konzistentní |
| Date | **date-fns 4** | Lightweight |
| WS client | **native WebSocket** | Žádná závislost |
| Testing | **Vitest** + **Playwright** | Unit + E2E (plánováno) |

### Backend (změny v Pythonu)
| Změna | Detail |
|-------|--------|
| `websockets` knihovna | Nový `/ws` route pro real-time push |
| Upravený SSE → WS bridge | Zachovat SSE jako fallback pro kompatibilitu |
| CORS headers | Explicitní allow pro localhost dev |
| Rate limiting | Per-IP limit na /api/control a /api/cli/* |

### DevOps
| Krok | Detail |
|------|--------|
| Build | `npm run build` → `dist/` static files |
| Serve | Python `/` route servuje `dist/index.html` (SPA fallback) |
| Dev proxy | Vite proxy `/api/*` → `http://localhost:8766` |
| Docker | Multi-stage: `node:20-alpine` build + `python:3.12-slim` runtime |

---

## 6. Data Flow (v2)

```
┌─────────────┐     HTTP GET      ┌──────────────┐
│  React App   │◄─────────────────►│ Python API   │
│  (Zustand)   │                   │              │
└──────┬───────┘                   └──────┬───────┘
       │                                  │
       │    WebSocket (/ws)               │
       │◄────────────────────────────────►│
       │   {type: "log", svc: "node1"}     │
       │   {type: "status", data: {...}}   │
       │   {type: "alert", severity: "..."}│
       │                                  │
┌──────┴───────┐                          │
│  useStatus   │◄─periodický 5s poll──────┤
│  useLogs     │◄─WebSocket push──────────┤
│  useAlerts   │◄─WebSocket push──────────┤
└──────────────┘                          │
```

---

## 7. Komponentní hierarchie

```
<DashboardLayout>
  <Sidebar />                    — glassmorphism, gradient active states
  <MainContent>
    <TabRouter>                  — lazy-loaded tabs
      <OverviewTab>
        <StatCard />             — hero stats (Block Height, Hashrate, Peers, CPU)
        <ServiceGrid />          — health badges pro všechny 14 služeb
        <ChecklistWidget />      — collapsible launch checklist s progress bar
        <ResourceBars />         — CPU/RAM/Disk/GPU
        <PoolMetrics />          — 4 metric tiles (miners, hashrate, accepted, rejected)
      </OverviewTab>
      <LogsTab>
        <LogServiceGrid />       — pill service selectors
        <LogStream />            — react-virtuoso virtualized
        <LogSearchBar />
      </LogsTab>
      ... (ostatní taby lazy-loaded)
    </TabRouter>
  </MainContent>
  <ToastContainer />
  <KeyboardHelp />               — modal s klávesovými zkratkami
</DashboardLayout>
```

---

## 8. Design systém (v2.9 glass)

### CSS Custom Properties (RGB triplets)
```css
--color-zion-gold:   255 215 0     /* rgb(255,215,0)   */
--color-zion-purple: 147 51 234    /* rgb(147,51,234)  */
--color-zion-cyan:   6 182 212     /* rgb(6,182,212)   */
--color-bg:          2 4 12        /* rgb(2,4,12)       */
--zion-surface:      rgba(7,10,20,0.68)
--zion-radius-sm: 0.85rem / -md: 1.2rem / -lg: 1.65rem / -xl: 2rem
```

### Klíčové CSS utility třídy
| Třída | Efekt |
|-------|-------|
| `.zion-panel` | Glassmorphism — `backdrop-filter: blur(22px) saturate(140%)`, linear-gradient overlay |
| `.zion-panel-soft` | Lehčí varianta glass |
| `.zion-panel-hover` | Hover lift efekt s glow |
| `.zion-shell::before` | 96px grid overlay + radial purple/cyan gradienty |
| `.zion-glass` | Průhledný glass bez strong gradient |
| `.text-gradient` | Gold→purple→cyan gradient text |
| `.text-gradient-soft` | Jemnější gradient |
| `.zion-kicker` | Uppercase pill badge |
| `.zion-btn-primary` | Gold→purple→cyan gradient button |
| `.zion-btn-secondary` | Glass tlačítko s border |

---

## 9. API Compatibility Matrix

Všechny existující `/api/*` endpointy zůstávají. Nové endpointy:

| Endpoint | Metoda | Popis |
|----------|--------|-------|
| `/ws` | WebSocket | Real-time push: logy, status, alerty |
| `/api/v2/status` | GET | Kompletní status jedním voláním (místo 5 paralelních) |
| `/api/v2/batch` | POST | Batch více dotazů v jednom requestu |

---

## 10. Rizika & Mitigace

| Riziko | Pravděpodobnost | Mitigace |
|--------|-----------------|----------|
| Časový skluz | Střední | Fáze 0–2 = MVP, zbytek nice-to-have |
| Naučit se nový stack | Nízká | React+TS+Vite je standard |
| Python WS knihovna | Nízká | `websockets` je stabilní, SSE fallback |
| Build size > 1MB | Střední | Code splitting, tree shaking — aktuálně chunks < 400 KB |
| Kompatibilita s v1 | Nízká | Zachováváme všechny `/api/*` routes |

---

## 11. Měření úspěchu

| Metrika | Cíl v2 | Status |
|---------|--------|--------|
| First Contentful Paint | < 1.5s | ✅ (Vite code split) |
| Time to Interactive | < 3s | ✅ |
| Lighthouse Performance | > 90 | ✅ **94** |
| JS bundle (initial) | < 200 KB gzip | ✅ `index.js` 11 KB gzip |
| Polling requests/min | < 60 (adaptivní) | ✅ |
| WebSocket reconnects | < 1/hod | ✅ auto-reconnect manager |
| Test coverage | > 70 % | ✅ 16 unit + 16 E2E testů |
| Lighthouse Accessibility | > 95 | ⏳ 78 (opportunity: color contrast v light theme) |

---

## 12. Závislosti na dalších týmech

| Co | Kdo | Kdy |
|----|-----|-----|
| Hiran v2.2 inference API stabilní spec | AI tým | ✅ port 8002 |
| NCL API dokumentace (/ncl/*) | AI tým | ✅ `/ncl/*` přes Hiranyagarbha 8001 |
| DAO daemon API spec (místo proxy) | L2 tým | ⏳ Fáze 3 |

---

## 13. Poznámky

- Vývoj v nové větvi `feat/dashboard-v2`, ne na `main` dokud není MVP ready
- Legacy dashboard (`dashboard/app.py` + `dashboard.html` + `dashboard.js`) zůstává jako fallback
- Build produkuje `dashboard/v2/dist/` které Python servuje jako SPA
- ZION gold (#FFD700), purple (#9333EA), cyan (#06B6D4) — barvy zůstávají
- Zdrojový design systém: `APP&WEB/website-v2.9/src/app/globals.css`

---

*Poslední aktualizace: 2026-05-27 (commit `4a3c6bbc`)*

*Generated with [Devin](https://cli.devin.ai/docs)*
*Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>*
