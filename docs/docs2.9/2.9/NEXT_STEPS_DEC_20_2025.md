# 🚀 ZION v2.9 - Příští Kroky (20. prosince 2025)

## Dnešní Priorita: Validace & Příprava na TestNet

Máme kompletní infrastrukturu. Teď jde o ověření, že všechno funguje a příprava na spuštění.

---

## 📋 TODO - Dnes (20. prosince)

### 1️⃣ Spustit End-to-End Mining Test

```bash
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main

# Aktivovat virtual env
source .venv/bin/activate

# Spustit kompletní E2E test
python3 test_e2e_complete_v2_9.py
```

**Co test kontroluje:**
- ✓ Stratum připojení k pool serveru
- ✓ Pool API endpoints
- ✓ Blockchain RPC
- ✓ Prometheus metriky (4 targety)
- ✓ Docker služby

**Očekávaný výstup:**
```
══════════════════════════════════════════════════════════
     ZION v2.9 - COMPLETE END-TO-END TEST SUITE
══════════════════════════════════════════════════════════

TEST SUMMARY
─────────────────────────────────────────────────────────────
Test Name                     Status          Details
─────────────────────────────────────────────────────────────
Stratum Connection            ✓ PASS          Connected and authenticated
Pool API                      ✓ PASS          5/5 endpoints responding
Blockchain RPC                ✓ PASS          Height: 1000, Peers: 5
Prometheus Metrics            ✓ PASS          4/4 targets UP
Docker Services               ✓ PASS          All core services detected

─────────────────────────────────────────────────────────────
Overall: 5/5 tests passed ✓ PASS

🎉 ALL TESTS PASSED - INFRASTRUCTURE READY FOR MINING!
```

**Možné problémy:**
- Pokud test selže → debug pomocí `docker compose logs -f [service]`
- Pokud Prometheus targets nejsou UP → zkontrolovat Prometheus konfiguraci

---

### 2️⃣ Import Grafana Dashboard

```bash
# Skript automaticky importuje system-resources dashboard
chmod +x scripts/grafana_dashboard_import.sh
./scripts/grafana_dashboard_import.sh

# Nebo ručně (pokud script selže):
# 1. Otevřít http://localhost:3000
# 2. Jít na: Home → New → Import
# 3. Upload file: monitoring/grafana/dashboards/system-resources.json
# 4. Vybrat Prometheus datasource
# 5. Click "Import"
```

**Co se zobrazí:**
- CPU Usage % (Alert >80%)
- Memory Usage % (Alert >85%)
- Disk Usage % (Alert <15% free)
- Network Traffic (RX/TX)
- Docker Container Stats
- Load Average, TCP Connections, apod.

**URL:** `http://localhost:3000/d/system-resources-dashboard`

---

### 3️⃣ Spustit Final Smoke Test

```bash
# Kontrola, že všechno je ready pro produkci
chmod +x scripts/smoke_test_complete.sh
./scripts/smoke_test_complete.sh
```

**Co test dělá:**
- Kontroluje docker services (6 core services)
- Ověřuje síťové připojení (porty 8545, 3333, 8001, 9090, 3000, 6379)
- Testuje API endpoints (/health, /metrics, /api/v1/stats)
- Ověřuje Prometheus targety
- Kontroluje blockchain stav (height, peers)
- Ověřuje datové soubory (blockchain, pool.db, prometheus data)
- Hledá kritické errory v logech

**Očekávaný výstup:**
```
╔════════════════════════════════════════════════════════════╗
║  ZION v2.9 - PRODUCTION SMOKE TEST                         ║
╚════════════════════════════════════════════════════════════╝

SECTION 1: DOCKER SERVICES
─────────────────────────────────────────────────────────────
[1] Docker daemon... ✓
[2] Docker Compose available... ✓
[3] Core services running... ✓

SECTION 2: NETWORK CONNECTIVITY
─────────────────────────────────────────────────────────────
[4] Blockchain RPC (8545)... ✓
[5] Pool Stratum (3333)... ✓
[6] API Gateway (8001)... ✓
[7] Prometheus (9090)... ✓
[8] Grafana (3000)... ✓
[9] Redis (6379)... ✓

SECTION 3: API ENDPOINTS
─────────────────────────────────────────────────────────────
[10] API /health... ✓
[11] API /metrics... ✓
[12] Pool API /api/v1/stats... ✓

SECTION 4: MONITORING & METRICS
─────────────────────────────────────────────────────────────
[13] Prometheus API... ✓
[14] Prometheus targets UP... ✓
    → 4 targets UP

SECTION 5: BLOCKCHAIN STATE
─────────────────────────────────────────────────────────────
[15] Getting blockchain height... ✓
    → Height: 1000 blocks

[16] Network peers... ✓
    → Peers: 5 connected

SECTION 6: FILE SYSTEM & PERSISTENCE
─────────────────────────────────────────────────────────────
[17] Blockchain data volume... ✓
    → Size: 512M

[18] Pool database... ✓
    → Size: 25M

[19] Prometheus data persistence... ✓
    → Size: 150M

SECTION 7: LOGS & DIAGNOSTICS
─────────────────────────────────────────────────────────────
[20] Checking for critical errors... ✓
[21] Backup files... ✓
    → Latest: zion-backup-20251219_020000.tar.gz

╔════════════════════════════════════════════════════════════╗
║  TEST SUMMARY                                              ║
╚════════════════════════════════════════════════════════════╝

Tests Passed:  21/21 (100%)
Tests Failed:  0

Overall Status: ✓ PASS

✓ PRODUCTION READY!
```

---

## 📊 Ověření Progress

| Úkol | Status | Detail |
|------|--------|--------|
| E2E Test | ▶️ TODO | Spustit test_e2e_complete_v2_9.py |
| Grafana Import | ▶️ TODO | Importovat system-resources.json |
| Smoke Test | ▶️ TODO | Finální validace všech systémů |
| Mining Test | ⏳ READY | Kdyžtesty projdou → spustit miner |

---

## 🎯 Pokud Všechny Testy Projdou

Pak můžeme:

1. **Spustit test miner:**
```bash
python3 zion_native_miner_v2_9.py \
  --pool localhost:3333 \
  --wallet ZION_YOUR_ADDRESS \
  --worker test-miner-01 \
  --threads 4
```

2. **Monitorovat metriky:**
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000
- Pool stats: http://localhost:8080/api/v1/stats

3. **Ověřit shares:**
```bash
# Pool API - shares submitted
curl http://localhost:8080/api/v1/miners

# Blockchain - nové bloci
curl -X POST http://localhost:8545/json_rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getblockcount","params":[]}'
```

---

## ⚠️ Možné Problémy & Řešení

### Problem: E2E Test selže na Stratum

**Příčina:** Pool není spuštěn nebo není dostupný
```bash
# Zkontrolovat stav pool serveru
docker compose ps zion-pool

# Zobrazit pool logs
docker compose logs -f zion-pool

# Restartovat pool
docker compose restart zion-pool
```

### Problem: Prometheus targets jsou DOWN

**Příčina:** Services neexportují metriky

```bash
# Zkontrolovat Prometheus config
curl http://localhost:9090/api/v1/config | jq .

# Reloadovat Prometheus
curl -X POST http://localhost:9090/-/reload

# Zkontrolovat přímý přístup k metrikám
curl http://localhost:8001/metrics  # API
curl http://localhost:9101/metrics  # Pool
```

### Problem: Smoke Test selže na síťovém portu

**Příčina:** Service není naslouchání

```bash
# Zkontrolovat otevřené porty
netstat -tuln | grep LISTEN

# Zkontrolovat docker network
docker network inspect zion-internal

# Restartovat všechny služby
docker compose restart
```

---

## 📅 Časový Plán

```
20. prosince:
  09:00 - E2E Test
  10:00 - Grafana Import
  11:00 - Smoke Test
  12:00 - Mining Test (pokud vše projde)
  14:00 - Dokumentace finalizace

21-25. prosince:
  ✓ Stability monitoring
  ✓ Community announcements
  ✓ TestNet soft launch (24 Dec?)

31. prosince:
  🚀 Public TestNet Launch
```

---

## 🎉 Success Criteria

Všechny 3 testy projdou = ✅ READY FOR LAUNCH

```
✓ E2E Test: 5/5 PASS
✓ Grafana: Dashboard live & responding
✓ Smoke Test: 21/21 PASS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 SYSTEM READY FOR TESTNET
```

---

## 📝 Příkazy na Быстro

```bash
# Vše v jednom (spustit vše postupně)
python3 test_e2e_complete_v2_9.py && \
./scripts/grafana_dashboard_import.sh && \
./scripts/smoke_test_complete.sh && \
echo "✅ VŠECHNO HOTOVO - Ready for Launch!"

# Nebo jednotlivě:
python3 test_e2e_complete_v2_9.py              # 5 min
./scripts/grafana_dashboard_import.sh           # 2 min
./scripts/smoke_test_complete.sh                # 3 min
```

---

## 💬 Otázky?

Pokud něco nejde:
1. Zkontroluj logy: `docker compose logs -f [service]`
2. Zkontroluj konfiguraci: `docker compose config`
3. Restartuj služby: `docker compose restart`
4. Zkontroluj soubory v `docs/` adresáři pro detailní dokumentaci

---

**Status:** 🟢 ГОТОВО K TESTŮM  
**Target:** TestNet Launch 31. prosince 2025  
**Poslední Update:** 19. prosince 2025, 18:00 CET

🚀 **LET'S GO TESTNET!** 🚀
