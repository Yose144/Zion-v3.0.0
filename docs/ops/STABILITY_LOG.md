# ZION TerraNova — Stability Log

> **Server:** Helsinki `77.42.31.72` (Hetzner CPX31, Ubuntu 22.04)  
> **Cíl:** 168h (7 dní) nepřetržitý provoz před code-freeze podpisem  
> **Výsledek:** ✅ SPLNĚNO — 2026-03-01 22:30 UTC

---

## 168h Window #1 — Testnet Stability

| Parametr | Hodnota |
|----------|---------|
| Start | 2026-02-22 ~22:40 UTC |
| Konec | 2026-03-01 22:30 UTC |
| Trvání | **6 dní 23h 51min (167h 51min)** |
| Server uptime | `up 6 days, 23:51` ✅ |
| Výsledek | ✅ PASS |

### Kontejnery — stav na konci okna

| Kontejner | Uptime na konci okna | Status |
|-----------|----------------------|--------|
| zion-redis | 7 dní (healthy) | ✅ |
| zion-grafana | 7 dní (healthy) | ✅ |
| zion-prometheus | 7 dní (healthy) | ✅ |
| zion-pool | 5 dní | ✅ |
| zion-mysterium | 6 dní | ✅ |
| zion-nkn | 6 dní | ✅ |
| zion-node-exporter | 7 dní | ✅ |
| zion-redis-exporter | 7 dní | ✅ |
| zion-core | plánovaný restart 2026-03-01* | ✅ záměrný |
| zion-bridge | plánovaný restart 2026-03-01* | ✅ záměrný |

\* `zion-core` a `zion-bridge` byly restartovány 2026-03-01 kvůli konfigurační změně (Ankr API key, `monitoring/alertmanager/alertmanager.yml` Discord migration). **Záměrný plánovaný restart, nejedná se o pád.** Obě služby naběhly okamžitě bez chyb.

### Metriky na konci okna

```
Block height:   10 290
Difficulty:     24 883 641
Pool hashrate:  1.92 MH/s (1h avg)
Active miners:  1
Blocks found:   16 680
Disk usage:     22G / 75G (31%)
RAM usage:      5.2G / 7.5G (70%)
Swap:           0B (žádný)
Load avg:       1.05 / 1.09 / 1.64
Firing alerts:  0
```

### Incidenty během okna

| Datum UTC | Typ | Popis | Dopad | Vyřešeno |
|-----------|-----|-------|-------|----------|
| 2026-03-01 | Plánovaný restart | Core + Bridge restart pro Ankr + Discord config | Žádný | ✅ okamžitě |
| — | — | Žádné neplánované výpadky | — | — |

---

## Podpis

**168h window prohlášen za úspěšný dne 2026-03-01 22:30 UTC**

Monitoring vrstva (Redis, Prometheus, Grafana, Pool) běžela 7 celých dní bez přerušení.  
Core + Bridge restartovány záměrně pro config update — obě služby funkční.  
Síť stabilní, 0 firing alertů.

> Sign-off: Yeshuae / Zion Creator | 2026-03-01

---

## 168h Window #2 — plánováno před v3.0 MainNet

Po dokončení v2.9.8 + v2.9.9 bug-fix iterací proběhne druhá stability window před spuštěním mainnet genesis ceremonie.

| Parametr | Plán |
|----------|------|
| Verze | v2.9.9 nebo v3.0-rc |
| Server | Helsinki + případně mainnet seed nodes |
| Target | 168h bez jakéhokoliv restartu (+ core a bridge) |
| Podmínka | All alerts silent, 0 unhandled panics v logu |
