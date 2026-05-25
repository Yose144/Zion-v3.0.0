# DASHV2 — ZION Dashboard v2.0 Upgrade Plan

> **Datum:** 2026-05-25
> **Autor:** Devin / ZION Core Team
> **Cíl:** Kompletní přepis a modernizace dashboardu z monolitického Python+Vanilla-JS stacku na modularizovaný, typovaný, výkonný systém.

---

## 1. Současný stav (Dashboard v1.x)

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

| # | Cíl | Priorita |
|---|-----|----------|
| P1 | **TypeScript + React** frontend s Vite bundlerem | Critical |
| P1 | **Modularizace** — každý tab = samostatný komponent | Critical |
| P1 | **Zachovat Python backend** — není čas přepisovat na Rust/Axum | High |
| P2 | **WebSocket** místo SSE pro log streaming | High |
| P2 | **Stav management** — Zustand nebo Redux Toolkit | High |
| P2 | **Virtuální scrolling** pro dlouhé logy (>2000 řádků) | Medium |
| P3 | **Responsive design** — mobilní first | Medium |
| P3 | **PWA** — offline cache, service worker | Medium |
| P3 | **a11y** — keyboard nav, screen reader, ARIA | Medium |
| P4 | **E2E testy** — Playwright | Low |
| P4 | **Storybook** — izolované komponenty | Low |

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
│  Frontend (React + TypeScript + Vite) │
│  ├── src/components/Tabs/...          │
│  ├── src/stores/ (Zustand)            │
│  ├── src/hooks/ (useStatus, useLogs)  │
│  ├── src/services/ (API client)       │
│  └── src/types/ (shared interfaces)   │
├─────────────────────────────────────────┤
│  Python Backend (zachováno, lean)       │
│  ├── HTTP API (~65 routes)            │
│  ├── WebSocket endpoint (/ws)         │
│  ├── Background sampler thread          │
│  └── Process registry + watchdog      │
├─────────────────────────────────────────┤
│  Proxy (optional): Nginx / Caddy      │
└─────────────────────────────────────────┘
```

---

## 4. Detailní plán — Fáze

### Fáze 0: Příprava (1 týden)

- [ ] Audit všech API endpointů — dokumentace v `dashboard/API.md`
- [ ] TypeScript interface definitions pro všechny API responses
- [ ] Vite projekt scaffold v `dashboard/v2/`
- [ ] Zustand store design — strom stavů
- [ ] CSS design system — shadcn/ui nebo custom Tailwind theme
- [ ] Wireframe klíčových obrazovek (Figma/Excalidraw)

### Fáze 1: Core Infrastructure (1–2 týdny)

- [ ] Vite + React + TypeScript setup
- [ ] Tailwind CSS config s custom ZION theme (zlatá, fialová, cyan)
- [ ] API client layer (`src/api/client.ts`) — fetch wrapper s retry, timeout
- [ ] Zustand store: `statusStore`, `logStore`, `settingsStore`
- [ ] WebSocket connection manager (`src/ws/manager.ts`)
- [ ] Python: přidat `/ws` WebSocket route pro real-time push
- [ ] Error boundary + Suspense fallback UI
- [ ] Loading skeletons pro všechny panely

### Fáze 2: Tab Rewrite — Batch 1 (2 týdny)

Přepsat 6 nejdůležitějších tabů:

| Tab | Priorita | Poznámka |
|-----|----------|----------|
| **Overview** | Critical | Hero, service cards, checklist, resource bars |
| **Logs** | Critical | SSE→WebSocket, virtuální scrolling, search |
| **Explorer** | High | Block list, search, detail modal |
| **Controls** | High | Launch buttons, CLI console, miner config |
| **Charts** | High | Chart.js → Recharts nebo Tremor |
| **Services** | High | Health grid, dependency graph |

### Fáze 3: Tab Rewrite — Batch 2 (2 týdny)

| Tab | Poznámka |
|-----|----------|
| **L1 (Consensus)** | Node status, mempool, hashrate real-time |
| **L2–L6** | Sjednotit do "Layers" s dynamickým načítáním |
| **Hiran AI** | Chat interface, NCL jobs, inference status |
| **DAO** | Proposals, treasury, proxy |
| **Wallets** | Premine + operational, balances |
| **Blockers** | P0 checklist s countdown |

### Fáze 4: Polish & Performance (1 týden)

- [ ] Virtualized listy pro logy (react-window / react-virtuoso)
- [ ] Debounce/throttle všech inputů
- [ ] Memoizace komponent (React.memo, useMemo)
- [ ] Code splitting — lazy load každý tab
- [ ] PWA manifest, service worker, offline page
- [ ] Keyboard shortcuts (převod z v1)
- [ ] Mobile sidebar redesign (drawer/bottom nav)
- [ ] Dark/light mode toggle (systém i manuální)

### Fáze 5: Testování & Deploy (1 týden)

- [ ] Unit testy pro store + API client (Vitest)
- [ ] E2E: Playwright — kritické flow (launch, stop, log tail)
- [ ] Cross-browser test (Chrome, Firefox, Safari)
- [ ] Mobile test (iOS Safari, Chrome Android)
- [ ] Performance audit (Lighthouse >90)
- [ ] Security review — XSS prevention, CSP headers
- [ ] Dokumentace: `dashboard/v2/README.md`
- [ ] Build + Docker integration (prod nginx static serve)

---

## 5. Technologický stack

### Frontend
| Kategorie | Volba | Důvod |
|-----------|-------|-------|
| Bundler | **Vite** | Rychlé HMR, jednoduchá konfigurace |
| Framework | **React 19** | Známý, velká komunita |
| Language | **TypeScript 5.5** | Type safety, DX |
| Styling | **Tailwind CSS 4** + **shadcn/ui** | Rychlý vývoj, konzistentní design |
| State | **Zustand** | Jednoduchý, nebo Redux Toolkit pro komplexní async |
| Charts | **Recharts** + **Tremor** | React-native, responsive |
| Tables | **TanStack Table** | Virtuální scroll, sort, filter |
| Icons | **Lucide React** | Čisté, konzistentní |
| Date | **date-fns** | Lightweight |
| WS client | **native WebSocket** | Žádná závislost |
| Testing | **Vitest** + **Playwright** | Unit + E2E |

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

## 7. Komponentní hierarchie (výňatek)

```
<DashboardLayout>
  <Sidebar />
  <MainContent>
    <TabRouter>
      <OverviewTab>
        <HeroCard />
        <ServiceGrid />
        <ChecklistWidget />
        <ResourceBars />
        <MiniCharts />
      </OverviewTab>
      <LogsTab>
        <LogServiceGrid />
        <LogStream (virtualized) />
        <LogSearchBar />
      </LogsTab>
      ... (ostatní taby lazy-loaded)
    </TabRouter>
  </MainContent>
  <ToastContainer />
  <SettingsModal />
</DashboardLayout>
```

---

## 8. API Compatibility Matrix

Všechny existující `/api/*` endpointy zůstávají. Nové endpointy:

| Endpoint | Metoda | Popis |
|----------|--------|-------|
| `/ws` | WebSocket | Real-time push: logy, status, alerty |
| `/api/v2/status` | GET | Kompletní status jedním voláním (místo 5 paralelních) |
| `/api/v2/batch` | POST | Batch více dotazů v jednom requestu |

---

## 9. Rizika & Mitigace

| Riziko | Pravděpodobnost | Mitigace |
|--------|-----------------|----------|
| Časový skluz | Střední | Fáze 0–2 = MVP, zbytek nice-to-have |
| Naučit se nový stack | Nízká | React+TS+Vite je standard |
| Python WS knihovna | Nízká | `websockets` je stabilní, SSE fallback |
| Build size > 1MB | Střední | Code splitting, tree shaking |
| Kompatibilita s v1 | Nízká | Zachováváme všechny `/api/*` routes |

---

## 10. Měření úspěchu

| Metrika | Cíl v2 |
|---------|--------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3s |
| Lighthouse Performance | > 90 |
| JS bundle (initial) | < 200 KB gzip |
| Polling requests/min | < 60 (adaptivní) |
| WebSocket reconnects | < 1/hod |
| Test coverage | > 70 % |
| Lighthouse Accessibility | > 95 |

---

## 11. Závislosti na dalších týmech

| Co | Kdo | Kdy |
|----|-----|-----|
| Hiran v2.2 inference API stabilní spec | AI tým | Fáze 2 |
| NCL API dokumentace (/ncl/*) | AI tým | Fáze 2 |
| DAO daemon API spec (místo proxy) | L2 tým | Fáze 3 |

---

## 12. Poznámky

- Vývoj v nové větvi `feat/dashboard-v2`, ne na `main` dokud není MVP ready
- Legacy dashboard (`dashboard/app.py` + `dashboard.html` + `dashboard.js`) zůstává jako `dashboard/legacy/` fallback
- Build bude produkovat `dashboard/v2/dist/` které Python servuje jako SPA
- ZION gold (#FFD700), purple (#9333EA), cyan (#06B6D4) — barvy zůstávají

---

*Generated with [Devin](https://cli.devin.ai/docs)*
*Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>*
