# ZION Mainnet — Status Report 2026-06-07

> **Verze:** 3.0.1  
> **Topologie:** Edge-only (Hetzner VPS) — Core (lokální PC) jako backup node  
> **Chain height:** ~180  
> **Blocks found:** 60+  
> **Pool hashrate:** ~4.6 KH/s (4 active sessions)

---

## TL;DR — Všechny služby green

| Služba | Host | Port | Status |
|--------|------|------|--------|
| Node 1 (Primary / Genesis) | Edge | 8333 / 8443 | ✅ Online |
| Node 2 (Follower) | Edge | — | ✅ Online |
| Pool | Edge | 8444 / 8455 | ✅ Online |
| DAO | Edge | 8450 | ✅ Online |
| WARP | Edge | 8453 | ✅ Online |
| Bridge | Edge | 9102 | ✅ Online |
| Agent | Edge | 8767 | ✅ Online |
| Website | Edge | 3000 | ✅ Online |
| OASIS | Edge | 8094 | ✅ Online |
| Free World | Edge | 8095 | ✅ Online |
| Issobella | Edge | 8096 | ✅ Online |
| Infra Dashboard | Edge | 8888 | ✅ Online |
| Python Dashboard | Local | 8766 | ✅ Online |
| node_exporter | Edge | 9100 | ✅ Online |
| Prometheus | Edge | 9090 | ✅ Online |
| Caddy | Edge | — | ✅ Online |
| Atomic Swap | Edge | — | ✅ Online |

---

## Infrastruktura

### Edge Server (Hetzner VPS)
- **IP:** `77.42.71.94`
- **Tailscale:** `100.76.16.108`
- **OS:** Ubuntu 24.04
- **Disk:** ~20% využito (58 GB volno po cleanupu)

### Lokální PC (Core / Backup)
- **Role:** Backup node + miner + dashboard
- **GPU:** AMD RX 5700 XT (OpenCL)
- **Tailscale:** aktivní, DERP relay (~60–75 ms)

---

## Dashboardy

| Dashboard | URL | Popis |
|-----------|-----|-------|
| Python Mainnet Launch | `http://localhost:8766` | Hlavní dashboard — status, payout, wallet, mempool, explorer |
| Rust Infra | `http://100.76.16.108:8888` | Service telemetry — node, pool, DAO, WARP, agent, website, OASIS, Free World, Issobella |
| Website | `https://77.42.71.94:3000` | Next.js produkční web |
| Grafana | `http://100.76.16.108:3100` | Metriky a vizualizace |
| Prometheus | `http://100.76.16.108:9090` | Scraping metrik |

---

## Canonical Wallets (Edge Pool)

| Role | Adresa |
|------|--------|
| Pool Wallet | `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604` |
| Humanitarian | `zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4` |
| Issobella | `zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702` |
| Pool Fee | *(prázdná — 0%)* |

**Fee split:** `89/5/5/0` (miner / humanitarian / issobella / pool_fee)

---

## Sdílení služeb mezi dashboardy

- **Python dashboard (8766)** polluje Edge infra dashboard (8888) přímo přes Tailscale
- **Proxy routy:** `/api/edge/infra` → `100.76.16.108:8888/api/infra`
- **Payout data:** z Edge pool stats (port 8455), ne lokálního pool.log
- **Wallet data:** z `/api/payout` (live Edge), ne `/api/wallet/status`

---

## Známé omezení / TODO

| Omezení | Důvod | Priorita |
|---------|-------|----------|
| AI / Hiran inference | Edge nemá GPU — lokálně na Core | P2 |
| NCL samostatný binární soubor | `zion-ncl` je knihovna bez `main.rs` — integrována do Hiranyagarbhy | P3 |
| Bridge UI transfer form | Čeká na Phase 26b backend wiring | P2 |
| Tailscale direct P2P | ISP blokuje UDP — používá se DERP relay | — |

---

## Commity (2026-06-07)

- `00416151` — feat(dashboard): live Edge telemetry cards + payout/wallet fixes
- `c776481a` — feat(dashboard): add oasis, free-world, issobella to edge-primary status

---

*Report vygenerován automaticky. Poslední aktualizace: 2026-06-07 16:30 UTC+2*
