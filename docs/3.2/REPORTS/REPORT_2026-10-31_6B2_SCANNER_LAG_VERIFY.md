# 6.B2 — Scanner-lag health check (L5 + L6): live verifikace

**Datum:** 2026-10-31 · **Audit item:** 6.B2 · **Verdikt: PASS (implementováno + live ověřeno)**

## Scope

> „Health check 'scanner lag' (last_block vs. tip > N bloků → alert) pro L5 i L6 — tento defekt 5 dní nikdo neviděl" (P0-1 lesson 2026-10-26)

## Stav: celá pipeline existuje a je LIVE

Implementováno při P0-1/P0-2 incident response (26. 10.) — verifikováno end-to-end 31. 10.:

| Komponenta | Artefakt | Live stav |
|---|---|---|
| Probe (60 s) | `V31/deploy/monitoring/zion-writepath-probe.py` + `.service`/`.timer` | `zion-writepath-probe.timer` **active** na EDGE2 |
| Metrika | `zion_scanner_lag_blocks{layer=l5,l6}` = tip(getStatus) − `last_block_height`(`/api/v1/fund/balance`) | **l5=6, l6=6** v prom scrapu |
| Alert | `ZionScannerLag`: `zion_scanner_lag_blocks > 30` for 15m | rule loaded `/etc/prometheus/rules/zion_writepath.rules.yml` na EDGE |
| Bonus api-down | `ZionScannerApiDown`: `zion_scanner_api_ok == 0` for 5m (critical) | stejný soubor |

## Live důkaz (31. 10.)

```
EDGE2: systemctl is-active zion-writepath-probe.timer → active
/var/lib/prometheus/node-exporter/zion_writepath.prom:
  zion_scanner_api_ok{layer="l5"} 1   zion_scanner_height{layer="l5"} 103805   zion_scanner_lag_blocks{layer="l5"} 6
  zion_scanner_api_ok{layer="l6"} 1   zion_scanner_height{layer="l6"} 103805   zion_scanner_lag_blocks{layer="l6"} 6
EDGE prometheus query zion_scanner_lag_blocks → oba série = 6 (job=edge2)
```

Lag 6 = normální režim (finality 6 bloků — scanner drží safe_height = tip−6); alert při >30 = ~5× outlier. Probe měří write-path (poslední zapsaný blok), ne `is-active` — přesně defekt, co 5 dní nikdo neviděl (scanner systemd-active, DB zaseklá).

## Poznámky

- `last_block_height` serializace: `FundBalance.last_block_height` → snake_case JSON v `/api/v1/fund/balance` — shoduje se s probe klíčem ✅
- API nedává lag v `/health` payloadu — záměrně: probe měří externě (služba nemůže reportovat vlastní zaseknutí); `/health` zůstává liveness check
- Firing test samotného alertu = 8.B9/8.S1 scope (sdílená alert-sink evidence)

## Verdikt

**PASS** — požadovaný health check + alert existují, běží v produkci na L5 i L6, a metrika je live scrapována. Žádný zbylý gap mimo sdílený alert-firing-test item.
