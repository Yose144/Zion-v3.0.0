# REPORT — Payout monitoring deploy: probe + rules + pool rebuild (M2 uzavřeno)

> **Datum:** 2026-11-11 (~03:45–05:45 UTC)
> **Kontext:** navazuje na [`REPORT_2026-11-07_EDGE_AUDIT_AUTONOMOUS.md`](REPORT_2026-11-07_EDGE_AUDIT_AUTONOMOUS.md) — autonomní fronta P1 „Payout monitoring" (slepé místo M2). 👤 schválil: „nasad patch a over, oprav, optimalizuj, a zdokumentuj code vs docs".
> **Rozsah:** read-only sondy → deploy monitoringu + rebuild pool binárky. **Žádné změny konsenzu, env, DB schématu, DNS, klíčů ani financial akce.** QTC payouts OFF / PRL dry-run / BTC swap OFF beze změny.

## 1. Co bylo slepé (M2, stav do deploye)

- `zion-writepath-probe.py` na EDGE2 (`/usr/local/sbin/`, verze 31. 10.) četl `payouts[0].ts` z `?limit=1` → první řádek je **queued QTC položka s `ts:null`** → `zion_pool_payouts_api_ok=0`, `zion_pool_last_payout_age_seconds` chyběla → `ZionPoolPayoutStale` (age > 3600) na prázdnou sérii **nemohl fired** = payout freshness nehlídaná.
- Repo obsahovala opravu ve **třech částech**, produkce měla **žádnou**: (a) probe čte `latest_recorded_ts` z `?source=recorded&coin=zion`, (b) pool API ho emitovalo (`V31/L1/pool/src/api.rs`, commit `1ce5b5eb2`), (c) rules měly alert `ZionPoolPayoutMeasurementMissing` + `ZionWritepathProbeStale` — **záměrně nenasazené** (poznámka ze StatusV3 9. 11.: „ship probe together with the pool that emits the field").
- Běžící pool `d786449b5-g8fix` tyto commity **neobsahoval** (`latest_recorded_ts` v API chyběl — ověřeno živým HTTP).

## 2. Co se nasadilo

| Vrstva | Akce | Výsledek |
|---|---|---|
| Probe | `V31/deploy/monitoring/zion-writepath-probe.py` (repo HEAD) → EDGE2 `/usr/local/sbin/zion-writepath-probe.py` + `/opt/zion/V31/deploy/monitoring/` synchronizováno; staré `.bak-20261111`; `py_compile` OK; `pytest test_writepath_probe.py` 9+16 ✅ | `Result=success` |
| Rules | `zion_writepath.rules.yml` → EDGE1 `/etc/prometheus/rules/`; diff = **čistě aditivní** (+2 alerty); `promtool check rules` SUCCESS 14 rules; `systemctl reload prometheus` | 5 writepath alertů loaded |
| Pool | snapshot HEAD `ece8b6965` → rsync 65 MB → EDGE1 `/root/build/pool-payoutfix/V31` → `docker rust:1.97-bullseye` `--memory=3g --memory-swap=4g` `CARGO_BUILD_JOBS=3` `ZION_GIT_SHA=ece8b6965…` `cargo build --release --locked -p zion-pool` (**31m 11s**) → swap `/opt/zion/V31/target/release/zion-pool` (bak `.bak-20261111-g8fix`) → restart ~10 s | build id `ece8b6965…` v `--version` i `/health` |
| Parita | týž binární soubor → EDGE2 `/opt/zion/V31/target/release/zion-pool` (inactive unit `zion-v31-pool.service`, standby běží z `/opt/zion/bin/zion-pool-standby` — ten **netřeba**, separátní binárka) | `--version` shoda |

**Pool restarty detaily:** stop 04:36:56Z → mv → start, `active` za ~10 s. **G8 dopad: 0 incidentů** — 5× `chain_live` zůstává, uptime **99,9241 %** (repo vzrostlo, restart nechytil žádný 60s bucket). RSS poolu **3,6 GiB → 0,91 GiB** (restart splácl růst; nová baseline pro memory-watch). Pool hned našel blok **118 730**, `payout_confirmed` tx v journalu, shares 0 rejected.

## 3. Ověření (živě, po deployi)

```
GET :8080/public/v1/payouts?source=recorded&coin=zion&limit=1
→ {"ok":true,"source":"recorded","latest_recorded_ts":1794371830,
   "payouts":[{status:"sent", coin:"zion", height:118726, ts:1794371830, tx_id:"bc72ddaf…"}]}

writepath textfile + :9100/metrics:
  zion_pool_payouts_api_ok            1   (bylo 0)
  zion_pool_payout_measurement_ok     1   (chyběla / 0)
  zion_pool_last_payout_age_seconds   11  (chyběla)
```

- **Alert pipeline end-to-end ověřena:** `ZionPoolPayoutMeasurementMissing` (warning) **firing** v mezidobí mezi probe/rules a pool deployem (pravdivý stav — pole chybělo) → **automaticky resolved** po `measurement_ok=1`. 0 firing alertů teď.
- `ZionPoolPayoutStale` je nově **odjištěn**: série `last_payout_age_seconds` existuje a měří skutečnou ledger plochu.
- Edge2 probe timer (60 s) + rules reload — žádný restart node/multichain/dao/zis.

## 4. Souběhy a vedlejší nálezy

- **Stale watcher na EDGE1:** `bash -c while pgrep -f "cargo build --release" …` (PID 769239, z ~6. 11. g8fix build) — **self-matching pgrep → nemohl nikdy skončit**, spal smyčku; zabit. Pattern pro pgrep uvnitř `bash -c` nikdy dávat holý string.
- **Docker na EDGE1 neměl žádné image** — `rust:1.97-bullseye` pullnuto (~1,5 GB). Build cache persistuje v `/root/build/cargo-cache` (`CARGO_HOME=/cargo` — **POZOR:** mount na `/usr/local/cargo` shadowne image cargo → `executable not found`; cache dávat na jinou cestu + `-e CARGO_HOME`).
- **Build profil:** `lto=fat` + `codegen-units=1` → finální binárka ~10 min sama; celkem 31 min na 4jáDrovém boxu sdíleném s miningem. `--memory=3g` držen, pool/netrhán.
- **EDGE2 `/opt/zion/V31/target/release/zion-pool`** byl artefakt z 21. 10. (inactive unit) — synchronizován pro paritu; produkční pool žije **jen na EDGE1** (stratum 8444, API 8080; EDGE2 :8080 = tunnel).
- Pool `--version` nově hlásí **`build ece8b6965…`** (provenance `506570ea5` funguje — `ZION_GIT_SHA` env do build.rs).

## 5. Zbývá / open

- **G8 run #7** běží dál (cíl 6. 12. 14:51Z, 99,9241 %, 5×60 s `chain_live`, RCA otevřená — probing-side zatížení). Nový pool binary **nemění** probe ani evidence path.
- **Pool binary provenance:** `d786449b0-g8fix` → `ece8b6965` — skok o ~40 commitů (pool-affected: `d2ca3c774` g8fix admission, `b17b870b5` audit api.rs +114/−31, `506570ea5` build-id, `1ce5b5eb2` payout freshness, `142e95da8` p2p seed-ban/record_good — node-side, `4b6914c9f` wallet input cap). `api.rs` unit testy v commitu zelené; živé ověření viz §3.
- **Miners sessions=2** po restartu (předtím 3) — jeden klient se zatím nevrátil; sledovat, není to alarm (shares jdou, bloky padají).
- **`zion-pool-standby` na EDGE2** (`/opt/zion/bin/zion-pool-standby`, 31. 10.) — separátní binárka pro HA standby; deployment nového pool kódu do ní = samostatný build `-p` variant, zatím netřeba (inactive, promote = operátorské rozhodnutí).
- **M1 (EDGE1 node-exporter)** — vyřešeno dříve (7. 11.), dnes potvrzeno `up{job="node",instance="edge1"}=1`.

## 6. Důkazy

- Lokálně: `pytest V31/deploy/monitoring/test_writepath_probe.py` → 9 passed, 16 subtests.
- EDGE1: `/root/build/pool-payoutfix/build.log` (`Finished release … 31m 11s`), `build id ece8b6965…`.
- EDGE2: textfile `/var/lib/prometheus/node-exporter/zion_writepath.prom`, `:9100/metrics`.
- Prometheus: `/api/v1/rules` (5 writepath alertů), `/api/v1/alerts` (0 firing).
- G8: `/opt/zion/data/g8_run.json` (EDGE1) + `app.zionterranova.com/api/g8`.
