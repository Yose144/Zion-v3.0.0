# E-07 — 72h Canary Revenue Run

**Status:** 🔄 RESET & RESTARTED — started `2026-03-03T21:00:00Z`, ends `2026-03-06T21:00:00Z`  
**Reset důvod:** Chain reset 2026-03-03 večer (nový genesis `bacd6027`, CHv4 od genesis, Redis FLUSHDB)  
**Blocker pro:** Fáze 2 sign-off, E-07 completion → Fáze 3 (server upgrade)  
**Server:** Helsinki (77.42.31.72) — `ssh zion-helsinki`  
**Předpoklady:** E-06 ✅ (wallet adresy) + E-08 ✅ (PerMiner scheduler)

---

## Cíl

Ověřit, že revenue systém na Helsinki:
1. Generuje reálné příjmy (≥ 1 payout cyklus za 72h)
2. 50/25/25 PerMiner scheduler správně rozděluje minery do skupin
3. BuyBack auto-execution proběhne bez chyby
4. Audit ledger je kompletní (žádné chybějící záznamy)
5. Žádný incident (pool downtime > 5 min nebo revenue výpadek > 30 min)

---

## Předstart checklist

```bash
ssh zion-helsinki

# 1. Ověřit, že mainnet stack běží s novým compose (E-06/E-08 env vars)
docker compose -p zion-mainnet -f docker/docker-compose.mainnet.yml ps

# 2. Ověřit env vars v pool kontejneru
docker inspect zion-pool | grep -E 'ZION_HAS_GPU|PERMINER|REVENUE'
# Musí vrátit: ZION_HAS_GPU=1, ZION_SCHEDULER_PERMINER_MIN_MINERS=2

# 3. Ověřit pool API
curl -sf http://localhost:8080/stats | jq .
curl -sf http://localhost:8080/api/revenue/status | jq .

# 4. Ověřit MoneroOcean dashboard dostupnost
curl -sf "https://api.moneroocean.stream/miner/42m86RBWf4PeuRf8P5rwA96XvmCKAfF77doWYJRv3KKAKrT8GTb5b3pbHTtaZsbJ4BERW1NHgh8WQgpAxAoEiXF82skcKsK/stats" | jq .
```

---

## Deploy (pokud ještě není aktuální compose)

```bash
ssh zion-helsinki

cd ~/zion
git pull origin main

# Restart pool s aktualizovaným compose (rolling, max 30s downtime)
docker compose -p zion-mainnet -f docker/docker-compose.mainnet.yml up -d --force-recreate pool

# Ověřit startup
docker logs zion-pool --tail 50 -f | grep -E 'PerMiner|50/25/25|GPU|Revenue'
```

Očekávaný výstup v logu:
```
║  ZION (CosmicHarmony):   50.0% compute                ║
║  Multi-Algo Revenue:     25.0% compute                ║
║  NCL AI Inference:       25.0% compute                ║
📊 Mode: auto (TimeSplit <2 miners, PerMiner ≥2 miners)
```

---

## Zahájení canary run

```bash
# Zaznamenat start čas
START_UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "E-07 Canary start: $START_UTC" | tee ~/zion/audit/e07_canary_log.txt

# Spustit revenue stack (pokud ještě neběží)
COMPOSE_PROFILES=helsinki docker compose -p zion-revenue \
  -f docker/docker-compose.revenue.yml up -d

# Ověřit scheduler mode po připojení prvních minerů
watch -n 30 'curl -sf http://localhost:8080/api/scheduler/status | jq .'
```

---

## Monitoring po dobu 72h

### Pool revenue status (každých 6h zkontrolovat)
```bash
curl -sf http://localhost:8080/api/revenue/status | jq '{
  mode: .scheduler_mode,
  streams: .active_streams,
  zion_hashrate: .streams.zion.hashrate_mhs,
  revenue_hashrate: .streams.revenue.hashrate_mhs,
  ncl_hashrate: .streams.ncl.hashrate_mhs
}'
```

### Scheduler mode check
```bash
curl -sf http://localhost:8080/api/scheduler/status | jq '{mode, miner_count, group_distribution}'
# Očekáváno: mode="PerMiner" po dosažení ≥2 minerů
```

### Revenue earnings check
```bash
curl -sf http://localhost:8080/api/revenue/earnings | jq '{
  total_btc_earned, 
  pending_buyback_btc, 
  last_payout_at,
  payout_count
}'
```

### Log analýza (denně)
```bash
docker logs zion-pool --since 24h 2>&1 | grep -E 'ERROR|WARN|buyback|payout|Revenue|switch' | tail -50
docker logs zion-revenue-dero-miner --since 24h 2>&1 | grep -E 'ERROR|speed|accepted|rejected' | tail -20
```

---

## Audit záznamy (vyplnit ručně)

| Čas (UTC) | Akce | Výsledek | Poznámka |
|-----------|------|---------|----------|
| 2026-03-03T21:00:00Z (T+0h) | Canary RESET & restart | ✅ | Chain reset (genesis `bacd6027`, CHv4 od genesis). Pool restart, Redis FLUSHDB. Mineurs reconnected: helsinki/usa2-miner/asia2-miner. |
| T+6h | Pool status check | ⬜ | Scheduler mode PerMiner? |
| T+12h | Revenue earnings check | ⬜ | BTC/XMR earned? |
| T+24h | First payout cycle? | ⬜ | min_buyback_btc = 0.001 BTC |
| T+48h | Mid-run status | ⬜ | Incidenty? |
| T+72h (2026-03-06T21:00:00Z) | Canary end | ⬜ | 72h splněno bez incidentu? |

---

## Kritéria úspěchu

- [ ] PerMiner scheduler aktivní (≥2 minerů přiřazeno do skupin)
- [ ] ≥ 1 payout cyklus za 72h (MoneroOcean stránka ukazuje výdělky)
- [ ] BuyBack auto-execution proběhla bez chyby (`pause_on_slippage_breach` neaktivován)
- [ ] Pool downtime < 5 min celkem za 72h
- [ ] Revenue výpadek < 30 min celkem za 72h  
- [ ] Žádné `ERROR` v logu poolu (WARN akceptovatelné)
- [ ] Audit tabulka výše kompletně vyplněna

---

## Rollback plán

```bash
# Pokud revenue systém způsobuje problémy:
# 1. Deaktivovat revenue stack
docker compose -p zion-revenue -f docker/docker-compose.revenue.yml down

# 2. Vrátit pool do ZION-only mode (odstranit E-08 env vars)
docker compose -p zion-mainnet -f docker/docker-compose.mainnet.yml \
  exec pool env | grep ZION_HAS_GPU  # ověřit stav

# 3. Dočasný restart bez revenue
ZION_HAS_GPU=0 docker compose -p zion-mainnet \
  -f docker/docker-compose.mainnet.yml up -d pool
```

---

## Sign-off

Po úspěšném dokončení vyplnit:
- Start: ___________
- Konec: ___________
- Celkový uptime poolu: _______%
- Celkový BTC/XMR earned: ___________
- Incidenty: ___________
- Podpis: ___________

**E-07 hotovo → povol Fázi 3 (Server upgrade Helsinki → Usa → Asia)**
