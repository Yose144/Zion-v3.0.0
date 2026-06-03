# ZionOS Autopilot Status

## Current Phase
- Active phase: Faze 0 - Stabilizace zakladu
- Started: 2026-04-11

## Sprint Board
- [x] Vytvoren master plan
- [x] Vytvoren status tracker
- [x] Vytvoren autopilot script
- [x] Baseline build check dashboard
- [x] Baseline build check agent
- [x] Baseline build check miner
- [x] Definovat command queue contract
- [x] Implementovat dashboard command queue endpointy
- [x] Napojit agent poll/ack loop
- [x] Pridat queue lease timeout + retry limit
- [x] Pridat command history filtry + limit/offset

## Latest Notes
- Dashboard ma persistence + optional write auth.
- Baseline checks probehly uspesne (dashboard/agent/miner + app.js syntax).
- Implementovana minimal command queue: enqueue/list/next/ack + agent execution flow pro start/stop/restart.
- Queue je rozsirena o lease timeout, pokusy a retry limit failover pri neacknutem prikazu.
- Endpoint list commands podporuje status filter (`pending/acked/failed`) a pagination (`limit`, `offset`).

## Risks
1. Rozdily mezi dev/prod cwd a env cestami pri startu dashboardu.
2. Velke mnozstvi unrelated zmen v repu (nutne oddelit commit scope).
3. Agent telemetry je zatim semiplaceholder (hashrate/shares parser bude nutne dotahnout).

## Next Actions (Autopilot)
1. Dopsat lightweight integration test pro retry/lease scenar.
2. Dovest hard fail/soft fail startup politiku dashboardu (env/cesty).
3. Rozsirit agent telemetry parser (hashrate/shares) z miner outputu.
