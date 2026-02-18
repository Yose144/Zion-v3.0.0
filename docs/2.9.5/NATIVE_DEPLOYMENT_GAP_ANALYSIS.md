# 🛑 ZION v2.9.5 "Native Awakening" - Deployment Gap Analysis

**Datum:** 30. ledna 2026
**Autor:** GitHub Copilot (Gemini 3 Pro)

Tento dokument analyzuje chybějící části pro **kompletní náhradu** Python stacku za Native Rust stack.

---

## 1. 🔍 Chybějící komponenty pro Deployment

### A) Service Management (Vyřešeno)
`systemd` unit files jsou **legacy** a nejsou cílový směr. Kanonické nasazení pro v2.9.5 je Docker-only přes Compose.

### B) Configuration
Rust pool používá ENV proměnné nebo `pool_config.json`.
- **Status:** Vytvořena šablona `pool_config_template.json`.
- **Gap:** Python pool používá složitější strukturu v `config/config.json`. Je třeba manuální migrace hodnot (wallet, porty).

---

## 2. 🔌 API Discrepancies (Kritické pro Frontend)

Frontend (Next.js Dashboard) očekává API `router_v2_9.py`. Rust `main.rs` má jinou strukturu.

| Funkce | Python Endpoint (`/v2.9/...`) | Rust Endpoint (`/api/v1/...`) | Status |
|--------|-------------------------------|-------------------------------|--------|
| **Miner Stats** | `/history/miner/{addr}` | `/miner/{addr}/stats` | ⚠️ Jiná struktura JSON |
| **Pool Stats** | `/history/pool` | ❌ Chybí | 🛑 Kritické |
| **Leaderboard** | `/leaderboard/top-miners` | ❌ Chybí | 🛑 Kritické (pouze NCL leaderboard) |
| **WebSocket** | `/ws/{client_id}` | ❌ Chybí (pouze Stratum TCP) | 🛑 Kritické pro "live" update |
| **DAO** | `/dao/proposals` | ❌ Chybí | ⏳ Low priority (DAO alfa) |

**Řešení:**
1. Buď upravit Frontend Dashboard na nové Rust API.
2. Nebo (preferováno) dopsat API wrappery do Rust poolu, aby odpovídaly `/v2.9` specifikaci.

---

## 3. 💾 Data Persistence (Historie)

- **Python:** Ukládá čtvrthodinové/hodinové snapshoty do SQLite/Postgres (`historical_db`).
- **Rust:** Ukládá pouze *aktuální* stav do Redis.
- **Důsledek:** Po restartu Rust poolu nebo pro grafy historie (24h hashrate) nejsou data.
- **Chybí:** Modul `historical_stats` v Rustu, který by periodicky (cron/tokio task) ukládal snapshoty do DB.

---

## 4. 🛠️ Action Plan (Co je třeba dopsat)

1. **Rust API Parity:** Implementovat `/api/pool` (global stats) a `/api/leaderboard`.
2. **History Worker:** Background task v Rustu, který každých X minut uloží `pool_stats` a `miner_stats` do trvalého úložiště (SQL/Timescale).
3. **Frontend Config:** Upřesnit, zda Dashboard volá `pool:8081` přímo, nebo přes NGINX proxy. Pokud přes proxy, nastavit rewrite rules.

---

## 5. ✅ Ready parts

- **Mining Core:** Stratum v2, PoW, Share validation = 100% Ready.
- **Payouts:** PPLNS logic = Ready.
- **Core Blockchain:** P2P, Consensus = Ready.
