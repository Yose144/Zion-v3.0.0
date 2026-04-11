# ZionOS Masterplan (Autopilot)

## Cíl
Postavit ZionOS jako plnohodnotný mining OS management stack ve stylu HiveOS/SMOS:
- central dashboard + API
- agent na rigu
- robustní miner orchestrace
- watchdog + self-healing
- flight sheets, batch operace, governance-ready audit
- bezpečné nasazení na více farmách

## Produktový rozsah v1.0
1. Fleet Management
- registrace rigů, heartbeat, stav online/offline
- batch start/stop/restart/reboot
- skupiny rigů podle tagů (location, owner, gpu class)

2. Mining Operations
- flight sheets (coin/algo/pool/wallet/args)
- rollout flight sheetů na skupiny
- rollout policy: canary -> wave1 -> wave2

3. Telemetrie a Monitoring
- real-time hashrate, shares, rejected/stale, temp/power/fan
- historizace, alerting, severity, acknowledgement
- watchdog pravidla: no shares, high temp, miner crash loop

4. Reliability a Self-Healing
- agent supervisor (auto-restart mineru, backoff)
- rig-level recovery scénáře (restart mineru, soft reboot)
- command queue s retry a timeout

5. Security
- token auth pro write API
- per-rig auth token (agent -> dashboard)
- audit log všech write operací

6. Deploy/Upgrade
- release channels: stable/canary
- version pinning
- rollback na předchozí binárku/profile

## Architektura (target)
1. dashboard (Rust + Axum)
- zdroj pravdy pro stav fleetu
- REST + WebSocket
- persistence (SQLite/Postgres ve v1.1)

2. agent (Rust daemon)
- miner process manager
- GPU telemetry collector
- command executor (pull/push hybrid)

3. miner runtime
- zionos-miner + fallback orchestrace
- standard telemetry output parser

4. smos packaging bridge
- packaging scripts pro nasazení do SMOS/Hive-like flow
- deterministic build metadata

## Implementační fáze

### Fáze 0 - Stabilizace základu (1-2 dny)
- [ ] sjednotit env config + defaults
- [ ] hard fail/soft fail policy pro dashboard startup
- [ ] scriptované smoke testy (dashboard/agent/miner)
- [ ] baseline release checklist

### Fáze 1 - Core OS Control Plane (3-5 dní)
- [ ] command queue (dashboard -> agent)
- [ ] reliable ack + command history
- [ ] watchdog policy engine (rule-based)
- [ ] alert escalace + auto actions

### Fáze 2 - Fleet UX parity (5-8 dní)
- [ ] rig groups + tags + filtering
- [ ] canary rollout flight sheets
- [ ] maintenance mode / drain mode
- [ ] richer console + structured logs

### Fáze 3 - Production hardening (5-10 dní)
- [ ] persistent DB + migrations
- [ ] RBAC (admin/operator/viewer)
- [ ] signed updates + rollback
- [ ] HA deployment profile (active/passive dashboard)

## KPI (Definition of Done)
- rig online availability >= 99.5%
- auto-recovery success >= 90% pro běžné fault scénáře
- median command latency <= 2s (LAN)
- telemetry delay <= 5s (p95)
- failed rollout rollback time <= 3 min

## Technický backlog (prioritní)
1. Dashboard command queue endpointy + state model
2. Agent command poller + ack endpoint
3. Watchdog module (rule parser + executor)
4. Structured event log (jsonl + API)
5. Integration tests: dashboard <-> agent <-> miner

## Autopilot Execution Pravidla
1. Pracovat po fázích, bez přeskakování reliability foundation.
2. Každá změna musí mít:
- build check
- minimálně 1 smoke/integration ověření
- update AUTOPILOT_STATUS.md
3. Když test padá, zastavit rollout a provést fix před další fází.
4. Vždy zachovat backward compatibility pro existující API call flow.

## První autopilot sprint (spuštěno nyní)
- Scope:
- vytvořit status tracker
- přidat autopilot script
- připravit skeleton pro command queue (další krok)

- Exit criteria sprintu:
- [ ] status tracker existuje
- [ ] autopilot script je spustitelný
- [ ] build/smoke baseline proběhne
