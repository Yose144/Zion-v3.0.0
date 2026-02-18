# ZION TerraNova — Akční Plán (Sprint 1.10+)

> **Vytvořeno**: 9. února 2026  
> **Autor**: yeshuae + AI copilot  
> **Stav**: Fáze 1 DOKONČENA — Error 21 fix deployed, GPU mining stable  
> **Cíl**: Přechod do Fáze 2 a příprava na Mainnet 31.12.2026  
> **Poslední commit**: `d3fbd0d` — fix: resolve Stratum Error 21 (Job not found)

---

## 🎯 Poslední výsledek (9. únor 2026 — 12:03 CET)

**Stratum Error 21 "Job not found" — VYŘEŠENO ✅**

| Metrika | Před fixem | Po fixu |
|---------|-----------|---------|
| Share acceptance | ~45 pak 100% reject | **223 accepted / 2 rejected** |
| Error 21 count | Každý share | **NULA** |
| GPU hashrate | 2.44 MH/s | **2.40 MH/s** (stabilní) |
| Uptime bez chyby | ~30s | **80+ sekund** (stále běží) |

### 3 nalezené příčiny:
1. **Pool `handle_xmrig_submit`** — hard-reject při neznámém job_id → opraveno na fallback k aktuální šabloně
2. **Pool RPC cesta** — pool volal `http://core:8444/` (404) místo `http://core:8444/jsonrpc` → prázdná cache šablon
3. **Miner chyběl retry** — při Error 21 nezažádal o nový job → přidán `request_job()` volání

### Opravené soubory:
- `2.9.5/zion-native/pool/src/stratum/server_v2.rs` — fallback v `handle_xmrig_submit`
- `Zion-2.9.5/pool/src/stratum/server_v2.rs` — totéž (deployed na Helsinki)
- `Zion-2.9.5/pool/src/main.rs` — RPC path fix (`"/"` → `"/jsonrpc"`)
- `2.9.5/zion-universal-miner/src/miner/mod.rs` — GPU error 21 → `request_job()`
- Helsinki docker: `ZION_CORE_RPC=http://core:8444/jsonrpc`, Dockerfile xmrig optional

---

## 📍 Kde jsme teď

| Metrika | Hodnota |
|---------|---------|
| Testy | ✅ 234/234 passing (0 failing) |
| Servery | 3/3 live (Helsinki 🇫🇮, USA 🇺🇸, Singapore 🇸🇬) |
| P2P peers | 6 aktivních |
| Blockchain | TestNet ~864+ bloků, aktivní těžba |
| GPU mining | ✅ 2.40 MH/s Metal, 223 accepted / 2 rejected |
| Error 21 | ✅ VYŘEŠENO — zero "Job not found" errors |
| Docker stack | core + pool + miner + redis na každém serveru |
| Explorer | ✅ Direct RPC API (charts, emission, mempool, peers) |
| Constitution | DRAFT (čeká na freeze) |

---

## 🔴 PRIORITA 1 — Sprint 1.10: Stability Gate (tento týden)

**Cíl**: Ověřit, že TestNet vydrží 72h bez pádu. Toto je gate pro Fázi 2.

### 1.1 Monitoring skript (30 min)
- [ ] Vytvořit `scripts/stability_monitor.sh`
- Každou hodinu loguje: `height`, `peers`, `difficulty`, `memory`, `uptime`
- Zapisuje do `logs/stability_72h.csv`
- Alertuje pokud: výška neroste > 5 min, peers < 2, container restart

### 1.2 Spustit 72h stability run
- [ ] Nasadit monitoring skript na Helsinki (seed node)
- [ ] Nechat běžet 72h bez zásahu
- [ ] Po 72h vyhodnotit:
  - ✅ Žádné crashe
  - ✅ Výška konzistentně roste (~1 blok/min)
  - ✅ Žádné forky > 1 blok
  - ✅ Memory neroste (memory leak check)
  - ✅ Peers stabilní (3-6)

### 1.3 Live partition test
- [ ] Odpojit Singapore na 30 min (iptables rule)
- [ ] Ověřit: reconnect, reorg, chain sync po obnovení
- [ ] Zdokumentovat výsledek

### 1.4 Multi-miner stress test
- [ ] Spustit 10+ miner instancí proti pool
- [ ] Ověřit: VarDiff adjustments, share acceptance rate, payout batching

---

## 🟠 PRIORITA 2 — Block Explorer (Fáze 2, první polovina)

**Cíl**: Funkční block explorer na `explorer.zionterranova.com`

### 2.1 Indexer
- [ ] Vytvořit `Zion-2.9.5/explorer/` crate
- [ ] Čte bloky z LMDB (nebo přes RPC)
- [ ] Indexuje: bloky, transakce, adresy, balances
- [ ] SQLite/PostgreSQL pro indexed data

### 2.2 Web UI
- [ ] Minimální Axum + HTMX (nebo Next.js)
- [ ] Stránky: Bloky (list + detail), Transakce (detail), Adresy (balance + TX history)
- [ ] Live stats: výška, hashrate, difficulty, supply
- [ ] Responzivní, mobilní

### 2.3 Deployment
- [ ] Docker container pro explorer
- [ ] Nasadit na Helsinki server
- [ ] Nginx reverse proxy → `explorer.zionterranova.com`

---

## 🟡 PRIORITA 3 — Monitoring & Observability

**Cíl**: Vidět co se děje v reálném čase, alerting na problémy.

### 3.1 Prometheus metrics
- [ ] Ověřit `/metrics` endpoint v zion-core
- [ ] Přidat metriky: `zion_block_height`, `zion_peers_count`, `zion_difficulty`, `zion_mempool_size`, `zion_hashrate`
- [ ] Prometheus scraping config

### 3.2 Grafana dashboard
- [ ] Docker container Grafana + Prometheus
- [ ] Dashboard: Block Production, Network Health, Mining Stats, System Resources
- [ ] Přístup přes `grafana.zionterranova.com`

### 3.3 Alerting
- [ ] Telegram bot pro alerty (nebo Discord webhook)
- [ ] Pravidla: node down > 2 min, fork > 2 bloky, peers < 2, memory > 80%

---

## 🟢 PRIORITA 4 — Node Dokumentace ("Run node in 10 min")

**Cíl**: Kdokoliv spustí ZION node za 10 minut.

### 4.1 QUICK_START.md
- [ ] Vytvořit `Zion-2.9.5/QUICK_START.md`
- [ ] Požadavky: 2 CPU, 4GB RAM, 20GB disk, Ubuntu 22.04+
- [ ] One-liner: `curl -sSL https://get.zionterranova.com | bash` (nebo docker-compose)
- [ ] Krok za krokem: install → config → run → verify

### 4.2 CLI improvements
- [ ] `zion-core --help` — přehledný help
- [ ] `zion-core status` — one-line stav
- [ ] Structured logy (JSON mode pro parsing)

### 4.3 Docker Hub
- [ ] Publikovat `ghcr.io/yose144/zion-core:v2.9.5`
- [ ] Publikovat `ghcr.io/yose144/zion-pool:v2.9.5`
- [ ] Multi-arch: amd64 + arm64

---

## 🔵 PRIORITA 5 — Síťová infrastruktura

### 5.1 Rozšířit na 5+ seed nodů
- [ ] 4. server: EU (Německo nebo Nizozemí)
- [ ] 5. server: Asia (Japonsko nebo Korea)
- [ ] Aktualizovat seed list v kódu + config

### 5.2 DNS seed
- [ ] `seed1.zionterranova.com` → Helsinki
- [ ] `seed2.zionterranova.com` → USA
- [ ] `seed3.zionterranova.com` → Singapore
- [ ] `seed4.zionterranova.com` → EU #2
- [ ] `seed5.zionterranova.com` → Asia #2

---

## ⚪ PRIORITA 6 — Pre-Launch (Fáze 3)

### 6.1 MAINNET_CONSTITUTION freeze
- [ ] Finální review Constitution
- [ ] SHA-256 hash do README
- [ ] Git tag `constitution-v1.0`
- [ ] Po zmrazení = NEMĚNNÉ

### 6.2 Security audit
- [ ] Interní code review (všechny unsafe bloky, crypto primitiva)
- [ ] External audit firm (budget: TBD)
- [ ] Penetration test na RPC/P2P

### 6.3 Legal
- [ ] Dokončit Terms of Service (6/6)
- [ ] Privacy Policy
- [ ] Mining Disclaimer
- [ ] DAO Governance dokument

### 6.4 Mainnet Genesis
- [ ] Finální genesis.rs s production parametry
- [ ] Genesis block hash publikovat
- [ ] Koordinovaný launch (všechny seed nody současně)

---

## 📅 Časová osa

```
Únor 2026 (TEĎ)
├── Sprint 1.10: Stability Gate ← 🎯 TADY ZAČÍNÁME
│   ├── 72h stability run
│   ├── Partition test
│   └── Multi-miner stress test
│
Březen–Duben 2026
├── Block Explorer v1
├── Prometheus + Grafana
└── QUICK_START.md
│
Květen–Červen 2026
├── 5+ seed nodů
├── Docker Hub images
├── CLI polish
└── Constitution freeze
│
Červenec–Září 2026
├── Security audit
├── Legal dokumenty
├── Public TestNet (open)
└── Bug bounty program
│
Říjen–Listopad 2026
├── Mainnet dress rehearsal
├── Final freeze
└── Community onboarding
│
31. Prosince 2026
└── 🚀 MAINNET GENESIS
```

---

## ✅ Zítra začínáme s:

1. **Monitoring skript** (`scripts/stability_monitor.sh`) — 30 min
2. **Nasadit na Helsinki** a spustit 72h run — 15 min
3. **QUICK_START.md** draft — 1h

---

## 📊 Metrika úspěchu pro Fázi 2

| KPI | Target |
|-----|--------|
| Uptime 72h | 100% (žádný restart) |
| Block production | < 2% missed blocks |
| Memory growth | < 10% za 72h |
| Peer stability | ≥ 3 peers po celou dobu |
| Fork depth | Max 1 blok |
| Block explorer | Funkční na TestNetu |
| Node setup time | < 10 min od nuly |

---

*"One step at a time, toward the light."* 🌟  
*Vytvořeno: 9. února 2026*
