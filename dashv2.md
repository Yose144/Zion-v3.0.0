# ZION Dashboard V2 — Architecture & Roadmap

**Status:** Draft  
**Date:** 2026-05-29  
**Current version:** Dashboard V1 (`dashboard/app.py` — 5545 lines, monolith)

---

## 1. Current State (V1 Recap)

### What works
- Python stdlib HTTP server (zero deps) on port 8766
- 16+ services monitored across L1–L6 + infrastructure
- 50+ API endpoints, 24 UI tabs
- Real-time metrics, log streaming (SSE), terminals
- Service controls (start/stop/restart), dependency-aware launch
- Checklist, alerts, wallet explorer, backup management
- AI integration (Hiran inference + Hiranyagarbha orchestrator)
- CSV export, DB inspection, log search, process manager

### What's wrong ( Audit: 68 issues, 13 critical )

| Category | Count | Examples |
|----------|-------|----------|
| **Security** | 13 critical | No auth, XSS via onclick, SQL injection, path traversal, command injection, secrets exposed |
| **Reliability** | 22 high | Unbounded timers, race conditions, no fetch timeouts, missing `.ok` checks, Promise.all without allSettled |
| **Maintainability** | 23 medium | Monolithic 5545-line file, 147 inline event handlers, duplicate functions, hardcoded values |
| **Polish** | 10 low | Missing ARIA, no SRI hashes, Czech text mixed in, theme switcher not wired |

### Production blockers (P0)
1. No authentication → anyone on localhost can kill processes, rotate genesis, delete backups
2. XSS in JS `onclick` interpolation
3. SQL injection in DB inspector
4. Path traversal in backup delete
5. State-changing GET endpoints (`/api/watchdog/toggle`, `/api/logs/rotate`)
6. Unbounded `setInterval` accumulation (memory leak)
7. Process kill without PID validation

---

## 2. V2 Goals

### Architectural
- [ ] **Split monolith** into modules: `routes/`, `services/`, `models/`, `auth/`
- [ ] **Add config file** (`dashboard.toml` or `.env`) — no more hardcoded values
- [ ] **Plugin architecture** for new panes (L7+, custom integrations)
- [ ] **Graceful shutdown** with signal handlers

### Security
- [ ] **API key auth** for all state-changing endpoints (or session cookie)
- [ ] **CSRF tokens** for POST/DELETE/PUT
- [ ] **Input validation** layer (pydantic-style or manual)
- [ ] **Secret redaction** in all API responses and logs
- [ ] **Rate limiting** (10 req/sec per IP)
- [ ] **Audit logging** for all admin actions

### Frontend
- [ ] **Migrate to data-attributes** — eliminate all inline `onclick` handlers
- [ ] **Fix timer lifecycle** — clearInterval before setInterval, abort controllers
- [ ] **Fetch wrapper** with timeout, retry, `.ok` check, `Promise.allSettled`
- [ ] **Bundle CDN assets locally** with SRI hashes
- [ ] **Accessibility** — ARIA labels, keyboard navigation, screen reader support
- [ ] **i18n** — extract all Czech strings, support EN/CS switching
- [ ] **Theme switcher** actually wired

### Backend
- [ ] **Connection pooling** for RPC calls (reuse sockets)
- [ ] **Metrics persistence** — SQLite instead of 120-sample in-memory ring buffer
- [ ] **Backup rotation** — keep last N, auto-delete old
- [ ] **Health endpoint** `/health` for external monitoring
- [ ] **HTTPS** — self-signed cert minimum for non-localhost binding

### Features
- [ ] **Real-time WebSocket** instead of polling for metrics
- [ ] **Mobile-responsive** layout (currently desktop-only)
- [ ] **Dark/light theme** fully implemented
- [ ] **Notification system** (browser push or SSE alerts)
- [ ] **Multi-node dashboard** — view Core + Edge in unified UI
- [ ] **Miner tuning UI** — GPU overclock/undervolt presets (not just toggle)
- [ ] **Pool analytics** — PPLNS window viz, payout history, fee audit
- [ ] **Chain reorg detection** and visual alert
- [ ] **Docker container view** — if running Docker stack

---

## 3. Phase Breakdown

### Phase 1 — Security Hardening (P0)
**Goal:** Make dashboard safe for any network exposure.

| Task | Effort | Owner |
|------|--------|-------|
| Add API key auth middleware | M | Backend |
| Fix XSS — migrate onclick to data-attrs + addEventListener | L | Frontend |
| Fix SQL injection (whitelist table names) | S | Backend |
| Fix path traversal (validate backup names with regex) | S | Backend |
| Move state-changing GETs to POST + add CSRF | M | Backend |
| Add secret redaction in `/api/env/load` and log search | M | Backend |
| Restrict `/api/processes/kill` to registered PIDs | S | Backend |
| Fix unbounded timers (clearInterval) | M | Frontend |

**Deliverable:** `dashboard-v1.1-secure` branch, security audit pass.

---

### Phase 2 — Refactor & Modularize
**Goal:** Make codebase maintainable.

| Task | Effort | Owner |
|------|--------|-------|
| Extract `routes/api_v1.py`, `routes/static.py`, `routes/websocket.py` | L | Backend |
| Extract `services/node_monitor.py`, `services/pool_monitor.py`, `services/ai_monitor.py` | L | Backend |
| Extract `models/config.py`, `models/auth.py`, `models/metrics.py` | M | Backend |
| Add `dashboard.toml` config with env var override | M | Backend |
| Split `dashboard.js` into modules: `api.js`, `ui.js`, `charts.js`, `services.js` | L | Frontend |
| Create shared fetch wrapper with timeout/retry | S | Frontend |
| Add `pytest` tests for API endpoints | L | Backend |

**Deliverable:** Modular codebase, no file > 500 lines.

---

### Phase 3 — Feature Completion
**Goal:** Close gaps between V1 promise and reality.

| Task | Effort | Owner |
|------|--------|-------|
| WebSocket real-time metrics stream | L | Backend + Frontend |
| Mobile-responsive CSS overhaul | L | Frontend |
| i18n EN/CS extract + translate | M | Frontend |
| Theme dark/light fully wired | M | Frontend |
| Metrics persistence (SQLite) | M | Backend |
| Backup rotation policy | S | Backend |
| Health endpoint `/health` | S | Backend |
| Notification/toast system | M | Frontend |

**Deliverable:** `dashboard-v2.0-beta`.

---

### Phase 4 — Advanced Features
**Goal:** Operator-grade control center.

| Task | Effort | Owner |
|------|--------|-------|
| Multi-node unified view (Core + Edge side-by-side) | L | Frontend |
| GPU tuning presets (RX 5600 XT profiles) | M | Frontend + Miner |
| Pool analytics dashboard (PPLNS viz, payout history) | L | Frontend |
| Chain reorg alert + rollback visualizer | M | Frontend + Backend |
| Docker container status panel | M | Backend |
| Prometheus metrics endpoint for external scraping | S | Backend |
| CLI integration — execute `zion-cli` commands from UI | M | Backend |

**Deliverable:** `dashboard-v2.1`.

---

## 4. Priority Matrix

### Must Have (Mainnet launch blockers)
- [ ] Authentication + CSRF
- [ ] XSS fix
- [ ] SQL injection fix
- [ ] Path traversal fix
- [ ] Timer leak fix
- [ ] Config file (no hardcoded secrets)

### Should Have (Launch week)
- [ ] Fetch wrapper with timeout/retry
- [ ] Metrics persistence
- [ ] i18n cleanup
- [ ] Mobile responsive
- [ ] Health endpoint

### Nice to Have (Post-launch)
- [ ] WebSocket streaming
- [ ] GPU tuning UI
- [ ] Pool analytics
- [ ] Docker view
- [ ] Notification system

---

## 5. Current Work Status

| Phase | Progress | Blockers |
|-------|----------|----------|
| Phase 1 (Security) | 1/8 done | One fix applied: AI layer excluded from auto-launch in `/api/launch/full` |
| Phase 2 (Refactor) | 0% | Waiting for Phase 1 |
| Phase 3 (Features) | 0% | Waiting for Phase 2 |
| Phase 4 (Advanced) | 0% | Future |

---

## 6. Decision Log

| Date | Decision | Context |
|------|----------|---------|
| 2026-05-29 | Exclude `hiranyagarbha` + `ai-native` from `/api/launch/full` | AI layer causes GPU overload + system freeze on RX 5600 XT |
| 2026-05-29 | Keep V1 as Python stdlib — no framework migration | Zero deps is a feature for mainnet reliability |
| 2026-05-29 | Do NOT bind to non-localhost until Phase 1 complete | Security audit flagged 13 critical issues |

---

## 7. Quick Wins (can do today)

1. **Fix unbounded timers** in `dashboard.js` — add `clearInterval` before every `setInterval`
2. **Add `.ok` check** to all `fetch()` calls
3. **Replace inline onclick** with `data-action` + `addEventListener` in 3 most critical places (alerts, wallets, backups)
4. **Add `/health` endpoint** — 5 lines in `app.py`
5. **Translate Czech strings** in Launch Day tab

---

*Last updated: 2026-05-29*
