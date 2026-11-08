# Firing testy a runbook pro všech 36 alertů (8.S1)

> **Datum:** 2026-11-08
> **Zadání:** 8.S1 — „každý kritický alert má firing test a runbook (DoD 9)".
> **Režim:** dokumentace, testy a skripty. **Žádná změna pravidel na produkci, žádný restart,
> žádný deploy.** Alerty se needitovaly — jen se popsaly a otestovaly.

## 1. Co bylo hotové a co chybělo

Po 2026-11-07 měly firing testy jen **host alerty** (3). Zbylých 33 alertů v pěti souborech
nemělo ani test, ani runbook — a dva soubory **nebyly vůbec v repu**.

| Rule file | alertů | stav před | teď |
|---|---|---|---|
| `g8.rules.yml` | 5 | bez testu | test 5/5 |
| `zion-pool.rules.yml` | 7 | bez testu | test 7/7 |
| `zion_writepath.rules.yml` | 14 | bez testu | test 14/14 |
| `zis.rules.yml` | 4 | **jen na hostu** | v repu + test 4/4 |
| `warp_btc_swap.yml` | 3 | **jen na hostu** | v repu + test 3/3 |
| `zion-host.rules.yml` | 3 | test ✅ | beze změny |

**Celkem 36 alertů, 36× firing case** (a u většiny i quiet case, aby test neprošel na výraz,
který nikdy nic nezachytí).

## 2. Dvě věci, které to odhalilo

### 2a. Dva rule soubory žily jen na EDGE1

`warp_btc_swap.yml` a `zis.rules.yml` nebyly v gitu — rebuild boxu nebo obnova z repa by
**tiše ztratila** BTC-swap a ZIS alerting. Zkopírovány do `V31/deploy/monitoring/` s hlavičkou
a datem; obsah beze změny (jen testy nad nimi).

### 2b. Repo má dva alerty, které na produkci záměrně nejsou

`zion_writepath.rules.yml` v repu obsahuje navíc:

- `ZionPoolPayoutMeasurementMissing` — `zion_pool_payout_measurement_ok == 0 or absent(…)`
- `ZionWritepathProbeStale` — `time() - zion_writepath_probe_success_timestamp_seconds{job="edge2"} > 180 or absent(…)`

Ověřeno na EDGE2: textfile `/var/lib/prometheus/node-exporter/zion_writepath.prom` **neobsahuje**
`zion_pool_payout_measurement_ok` ani `latest_recorded_ts` a pool API pořád vrací queued řádek
s `ts:null`. Oba alerty mají `absent()` → **samostatný deploy by okamžitě zapálil**.

Proto: **testy nad nimi existují** (chování je definované a ověřené), ale v runbooku je
výslovné pravidlo „ship with probe + pool, nikdy samostatně".

### 2c. Drobnost: text v `g8.rules.yml`

Repo má u `G8ChainStale` novější `description` (quorum fallback), na EDGE1 běží starší formulace.
Rozdíl je **jen v textu**; testy proto čtou repo verzi a runbook rozdíl dokumentuje v §8.

## 3. Jak se to testuje

`promtool test rules` na každém souboru: vstupní série → očekávané alerty (labels + přesné
annotations, včetně renderovaných `{{ $labels.* }}` a `{{ $value }}`) nebo prázdno. Testy
nejsou „threshold“ — kontrolují i **`for:` zpoždění** (např. `ZionPoolAcceptRateDrop` se
s `rate()` zvedne už ve druhé minutě, ale 15m `for` ho drží).

```bash
bash scripts/ops/test-alert-rules.sh            # vše, exit 0 = zelené
bash scripts/ops/test-alert-rules.sh --list     # pokrytí po souborech
```

Lokálně promtool není, takže se suite pustila na EDGE1 (kde promtool je):

```
test_warp_btc_swap_rules.yml       OK
test_zion_g8_rules.yml             OK
test_zion_host_rules.yml           OK
test_zion_pool_rules.yml           OK
test_zion_writepath_rules.yml      OK
test_zis_rules.yml                 OK
```

Poznatky ze stavby testů (aby se na ně nešlapalo znovu):

- `rate()` zachovává labely série (`status`, `route`, `job`) — `exp_labels` je musí obsahovat;
  `sum()` je naopak zahodí.
- Alert s `for:` se v `eval_time` musí trefit do okna, kdy série ještě existuje (5min lookback);
  jinak test „neprošel“, i když je pravidlo správné.
- `exp_annotations` se porovnávají **přesně**; vynechání = očekávaná prázdná mapa.

## 4. Runbook

[`docs/3.2/ops/ALERT-RUNBOOK.md`](../ops/ALERT-RUNBOOK.md) — topologie doručení
(Prometheus → Alertmanager `:9093` → G8 sink `:9094` → JSONL), jak poznat, že jsou pravidla
načtená (past: soubor v `rules/` je inertní bez `rule_files`), severity politika a u každého
alertu **co znamená → první kontrola (konkrétní příkazy) → co nedělat**.

Nejdůležitější „co nedělat“ z dnešního pohledu:

- `systemctl reload prometheus-node-exporter` **zabije** exporter (SIGHUP) — týden bez metrik 31. 10.–7. 11.
- chybějící `ts` u payoutu se **nenahrazuje** `now()`; chybějící G8 vzorky jsou downtime.
- pool se nerestartuje preventivně kvůli `/stats` nebo RAM — nejdřív měření.
- dva repo-only writepath alerty nejdou na produkci bez probu.

## 5. Změny v repu

- `V31/deploy/monitoring/warp_btc_swap.yml`, `zis.rules.yml` — nově verzované (kopie z hostu)
- `V31/deploy/monitoring/test_{zion_g8,zion_pool,zion_writepath,zis,warp_btc_swap}_rules.yml` — nové
- `scripts/ops/test-alert-rules.sh` — runner (`--list` = pokrytí)
- `docs/3.2/ops/ALERT-RUNBOOK.md` — nový runbook (36 alertů)
- `docs/3.2/3.2.1-3.2.9_PLAN.md` — 8.S1 uzavřeno

## 6. Co zůstává

- **Deploy rules na EDGE1** (text `g8` + dva writepath alerty) — čeká na probu/ pool release, ne na kód.
- **8.S2** (provenance manifest binárek) a **8.S3** (rollback skript pro každý deploy) navazují.
- Alerty samotné se needitovaly: cílem bylo dokázat, že to, co běží, opravdu zapálí.
