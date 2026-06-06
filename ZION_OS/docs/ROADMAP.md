# ZION OS v2.0 Roadmap

## Phase 1: Foundation (Completed 2026-06-06)

- [x] Archive legacy ZION_OS codebase to `archive/`
- [x] Create clean directory skeleton
- [x] Write README, ARCHITECTURE, ROADMAP docs
- [x] Migrate unified dashboard from `archive/ZionOSsmos/dashboard/`
- [x] Migrate agent from `archive/agent/`
- [x] Deploy dashboard + agent to Edge (port 8888 + 8767)
- [x] Update deploy scripts (`deploy-edge.sh`, `autopilot-v3.sh`)

## Phase 2: Core Components (Next)

### dashboard/unified
- [ ] Pool stats endpoint fix (`/stats` returns 000, investigate)
- [ ] Add rig auto-registration from agent telemetry
- [ ] Add hashrate chart with real data (not demo)
- [ ] WebSocket live updates for infra panel
- [ ] Add alert thresholds UI (configurable in settings)

### agent
- [ ] Auto-register with dashboard on startup
- [ ] Push telemetry to dashboard (not just log locally)
- [ ] Add CPU-only fallback when GPU detection fails
- [ ] Watchdog: disk space monitoring
- [ ] Agent CLI mode for manual rig setup

### infra
- [ ] Move all systemd files from `edge-deploy/systemd/` to `ZION_OS/infra/systemd/`
- [ ] Move deploy scripts from `scripts/` and `edge-deploy/` to `ZION_OS/infra/scripts/`
- [ ] Create `infra/config/edge-environment.sh` with all env vars
- [ ] Add `infra/scripts/backup-state.sh` for state.json backups

## Phase 3: Fleet Management (2026-Q3)

### fleet/backend
- [ ] Multi-rig command queue (broadcast start/stop to all rigs)
- [ ] Rig grouping (by location, GPU type, pool)
- [ ] Fleet-wide hashrate aggregation
- [ ] Alert routing (Discord/Email webhooks)

### fleet/frontend
- [ ] React-based fleet view (replace vanilla JS for fleet use)
- [ ] Map view (rig geolocation)
- [ ] Profitability calculator (power cost vs. mining reward)

## Phase 4: Desktop + Mobile (2026-Q3/Q4)

### desktop/
- [ ] Tauri v2 scaffold
- [ ] System tray icon with status indicator
- [ ] Native notifications for alerts
- [ ] Offline mode (cached data when Edge unreachable)

### mobile/
- [ ] React Native scaffold
- [ ] Push notifications for critical alerts
- [ ] Quick actions (start/stop miner from phone)
- [ ] Wallet integration (view balances, send transactions)

## Phase 5: Mining Integration (2026-Q4)

### mining/
- [ ] Pool failover (auto-switch to backup pool)
- [ ] Profit-switching (mine most profitable coin)
- [ ] OC profile management per-algorithm
- [ ] Benchmark mode (test hashrate per config)

## Backlog / Ideas

- [ ] Grafana/Prometheus integration for historical metrics
- [ ] Ansible playbooks for bare-metal rig provisioning
- [ ] Docker Compose for local dev environment
- [ ] CI/CD pipeline for Edge deploy (GitHub Actions → Edge)
- [ ] Multi-language support (EN, CZ, DE)

---

## Done Log

| Date | Milestone |
|------|-----------|
| 2026-06-06 | Archive legacy, create v2.0 skeleton, deploy dashboard + agent to Edge |
