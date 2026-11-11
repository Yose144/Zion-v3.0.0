# REPORT 2026-11-11 — G8 `chain_live` RCA (read-only)

> **Datum:** 2026-11-11 · **Režim:** read-only (bez restartu, deploye, změny metrik i money-path)
> **Rozsah:** 5× `chain_live` incident 60 s v G8 run #7 + nový 6. incident (stratum) ze 11. 11.
> **Zdroje:** živé `/api/g8` (app, `G8_STATUS_URL` → dashboard na EDGE2), Prometheus `127.0.0.1:9090` na EDGE, `journalctl` na EDGE2, read-only SSH na EDGE1/EDGE2, kód `scripts/ops/g8_probe_exporter.py` + `g8_evidence.py` + `V31/L1/core/src/storage.rs`.
> **Návaznost:** [`REPORT_2026-11-07_EDGE_AUDIT_AUTONOMOUS.md`](REPORT_2026-11-07_EDGE_AUDIT_AUTONOMOUS.md) (RCA otevřená), [`DOC_VS_CODE_ANALYSIS_2026-11-10.md`](../../3.3/DOC_VS_CODE_ANALYSIS_2026-11-10.md) §3.1.

---

## 1. Závěr (TL;DR)

**Žádný z pěti `chain_live` incidentů nebyl výpadkem řetězu.** Všechny jsou 60s buckety, ve kterých **primary RPC (`9445` → EDGE2) vrátil starý tip**: height o **56–240 bloků nižší** a timestamp **1–4 hodiny starý**, často proto, že node byl ve stejnou chvíli restartován watchdogem. Chain byl celou dobu živý — followeři `9446/9447` odpovídali, bloky přibývaly, žádná mezera >900 s. Ostatní required služby (`pool_http`, `multichain`, `dao`, `zis`) měly v incidentu `1` a exporter byl scrapován (`up{job="zion_g8"}=1`).

Příčina je **na straně primary node / jeho block source (P2P z EDGE `:8336`)**, ne chainu, ne sítě a ne sondy. Sonda incident reportuje správně: „žádný node nemá čerstvý tip“ je pravda — primary měl starý tip a followeři se do výběru tipu nezapočítávají (viz §5.3).

**6. incident (11. 11. 14:27:25Z) je separátní:** jeden 60s TCP blip na stratum `8444`, `pool_http` po celou dobu `1`. Není to `chain_live`.

---

## 2. Živý stav v době analýzy (11. 11. ~14:35 UTC)

`GET https://app.zionterranova.com/api/g8`:

| Pole | Hodnota |
|---|---|
| run | `g8-20261106T145125Z` |
| start / cíl | 2026-11-06T14:51:25Z → **2026-12-06T14:51:25Z** |
| status / gate | `running` / `pending` |
| uptime | **99,916481 %** |
| evidence coverage | 100 % |
| incidentů / kritických | **6 / 0** |
| celkový downtime | 360 s |
| `chain_live` | 99,930401 % (5× 60 s) |
| `pool_stratum` | 99,98608 % (1× 60 s) |
| `pool_http`, `multichain`, `dao`, `zis` | 100 % |
| poslední evidence update | 2026-11-11T14:34:58Z |

> Plány a `StatusV3` mají v bloku z 11. 11. **99,9241 % / 5 incidentů** — to byl ranní snapshot (před 14:27Z). Aktuální čísla jsou výše; uptime je metrika v čase, ne konstanta.

---

## 3. Incidenty a důkazy

Časy jsou UTC, buckety jsou alignované na start runu (`:25 s`).

| # | Start | Služba | Trvání | `node_primary` | `chain_height` před → v incidentu | `tip_age` v incidentu | Poznámka |
|---|---|---|---|---|---|---|---|
| 1 | 2026-11-08 23:17:25 | chain_live | 60 s | success 0, retried 1 | 115 583 → **115 406** (−177) | **10 307 s** (tip 20:25:29) | bez restartu; starý tip se vrátil sám |
| 2 | 2026-11-09 00:17:25 | chain_live | 60 s | success 0, retried 1 | 115 644 → **115 406** (−238) | **13 846 s** | stejný starý tip 115 406 |
| 3 | 2026-11-09 00:21:25 | chain_live | 60 s | success 0, retried 1 | 115 646 → **115 406** (−240) | **14 087 s** | restart primary 00:20:45Z |
| 4 | 2026-11-09 01:17:25 | chain_live | 60 s | success 0, retried 1 | 115 702 → **115 646** (−56) | **3 481 s** | watchdog restart 01:17:27Z |
| 5 | 2026-11-09 16:38:25 | chain_live | 60 s | success 0, retried 1 | 116 621 → **116 434** (−187) | **11 780 s** (tip 13:22:10) | watchdog restart 16:38:18Z |
| 6 | 2026-11-11 14:27:25 | pool_stratum | 60 s | — | — | — | 3 scraper `0` (14:27:15–14:27:45), `retried=1`; `pool_http` stále `1`; 14:28:00 zpět `1` |

**Co bylo vždy `1`:** `up{job="zion_g8"}`, `pool_http`, `multichain`, `dao`, `zis`; followeři `node_follower_2/3` (`probe_success=1`) kromě okna kolem restartu, kdy jeden follower krátce vypadl.

**Klíčový důkaz (Prometheus, krok 15 s):** `chain_height` se v incidentu přepíná mezi aktuálním a starým stavem, ale starý stav je **zamrzlý**:

```
# incident 1 (23:16–23:19 UTC)
23:16:15  height 115583  tip 23:15:14   (fresh)
23:17:15  height 115406  tip 20:25:29   (stale, −177 bloků)
23:18:15  height 115406  tip 20:25:29   (stale)
23:18:30  height 115585  tip 23:17:25   (fresh)
23:18:45  height 115406  tip 20:25:29   (stale)
23:19:30  height 115586  tip 23:18:21   (fresh)
```

Stejný vzorec u incidentů 2–5; hodnota `115406` se opakuje od 23:17 do 00:21 (>1 h) — to není lagging follower, který by mezitím postoupil, ale **zamrzlý starý stav**.

---

## 4. Co dělá sonda (a co z toho plyne)

`scripts/ops/g8_probe_exporter.py`:

1. Každý scrape (15 s) otevře **nové TCP spojení** na `9445/9446/9447`, zavolá `getStatus`, a pokud vrátí `native_chain_height`, ještě `getBlockByHeight` pro timestamp.
2. `chain_live = 1` jen když **nějaký** node vrátí `0 <= now − tip_ts <= 900`. `tip_res` = node s **nejvyšším** timestampem; **`success` se při výběru tipu nekontroluje**.
3. `probe_node` nastaví `success=True` po `getStatus`; pokud selže druhý RPC, vnější `except` dá `success=False`, ale **`chain_height`/`tip_timestamp` z prvního volání zůstanou** v outcome. Proto `node_primary success=0` může mít `chain_height` a ovlivnit `tip_res`.
4. `g8_evidence.py` bere jeden vzorek na 60s bucket; `missing_samples = downtime`; žádné druhé potvrzení na vrstvě evidence. Jeden špatný vzorek = 60s incident.
5. Followeři: `zion_g8_node_tip_fresh` je **0 v celém okně** (i když `probe_success=1`). `storage.rs::tip()` čte jediný `chain_state` singleton přes `Mutex<Connection>`, takže **jeden proces nemůže mít dva různé tipy**.

**Důsledek:** „starý tip“ nemůže vzniknout kombinací jednoho procesu a jednoho DB spojení. Buď na `9445` odpovídaly **dva procesy/backEndy s různými DB**, nebo existuje cesta, která vrací odpověď z jiného stavu (druhá instance, jiný `--db-path`, starý proces po restartu). To je hlavní nález.

---

## 5. Root cause

### 5.1 Prokázané

- **Primary RPC `9445` vracel dva různé tipy** (aktuální a starý) v rámci jedné minuty; starý tip byl zamrzlý (115406 po >1 h), ale v čase se posouval (115406 → 115646 mezi 23:17 a 01:17 = +240 bloků/2 h, tj. rychlost chainu).
- **Watchdog restarty:** `journalctl -u zion-v31-node` (CET → UTC): stop/start **00:20:45Z**, **01:17:27Z**, **16:38:18Z**; `journalctl -u zion-edge-watchdog` u 01:17:27Z říká `RESTART: zion-v31-node — V31 RPC on tcp://127.0.0.1:9445 not reachable`. Watchdog kontroluje jen **dostupnost RPC**, ne čerstvost tipu.
- **Chronické P2P chyby** před incidenty i během nich: `P2P sync from 62.171.141.136:8336 failed: IO error: Connection reset by peer` a `no status response from 62.171.141.136:8336`, plus opakované `P2P peer 62.171.141.136:… rejected`. Peer `8336` = node2 na EDGE.
- **Po restartu 11-10 19:17Z žádný `chain_live` incident** (poslední 11-09 16:38Z) — konzistentní s tím, že restart odstranil druhý/zaseknutý backend nebo špatný stav.
- **Chain nebyl mrtvý:** followeři odpovídali, bloky přibývaly, block-timestamp sampling neukázal >900s mezeru; `chain_live` je metrika „má někdo čerstvý tip“, ne „chain produkuje bloky“.

### 5.2 Hypotézy (seřazené)

| # | Hypotéza | Pro | Proti | Stav |
|---|---|---|---|---|
| H1 | **Druhá (stará/zaseknutá) instance `zion-node` na `9445` s jinou DB**; kernel/load-balancing střídá spojení | Alternující tipy, zamrzlá hodnota, dva DB stavy; restart to odstranil; jeden proces + jedno `Mutex<Connection>` jinak dva tipy neumí | Přímý důkaz (dva PIDs) už není, proces je pryč; `ss` dnes ukazuje jen jeden listener | **nejpravděpodobnější** |
| H2 | Stale read snapshot v DB vrstvě (pooled/pinned connection) | Alternující odpovědi | `storage.rs::tip()` má jeden `Mutex<Connection>` a jeden `chain_state` řádek; pool není | nepravděpodobné bez druhého procesu |
| H3 | Primary jen ztratil sync a servíroval vlastní starý tip (jeden backend) | P2P chyby, watchdog restarty | Nevysvětluje střídání aktuální/starý **v jedné minutě** | částečné, ne hlavní |

### 5.3 Přispívající faktory

1. **P2P single-peer:** primary peeruje na EDGE `node2:8336`; EDGE je dlouhodobě CPU-vytížený (~230 % mining na 4 jádrech), P2P handshake/sync dostává `reset`/`no status response`. Když primary přestane dostávat bloky, jeho tip stárne.
2. **Watchdog nerozpozná „stale-but-reachable“:** restartuje jen když RPC neodpovídá; starý tip, který odpovídá, nechá běžet.
3. **Sonda má jeden efektivní zdroj tipu:** followeři mají `node_tip_fresh=0` v celém okně; „any node“ fallback fakticky nefunguje (pravděpodobně future-dated timestampy — `0 <= tip_age` je odmítne — nebo chybějící `native_chain_height`). Primary je tak SPOF pro `chain_live`.
4. **Sonda si nechá staré `chain_height`/`tip_timestamp`** z částečně selhaného probe a `tip_res` nevyžaduje `success`.
5. **60s bucket = jeden vzorek:** i krátký blip (nebo restart 4 s) se počítá jako 60 s.

### 5.4 Co to není

- **Není to chain stall.** Žádná >900s mezera; followeři a těžba jely.
- **Není to výpadek sondy/exporteru.** `up{job="zion_g8"}=1` a ostatní signály `1`.
- **Není to clock skew hostitele sondy.** Ostatní služby a timestampy jsou normální; `tip_age` je obrovský kladný, ne záporný.
- **Není to pool/DAO/ZIS.** Ty měly 100 %.

---

## 6. Nový 6. incident: stratum 11. 11. 14:27Z

- `pool_stratum` = `0` ve třech scrapích (14:27:15, :30, :45), `retried=1`, pak `1` (14:28:00).
- `pool_http` = `1` celou dobu; pool API tedy odpovídalo, jen TCP connect na `8444` selhal (accept queue / krátký listener blip / CPU).
- 60s bucket → incident. Uptime 99,9241 → **99,916481 %**.
- Není to `chain_live`; s RCA výše nesouvisí. Doporučeno došetřit pool accept backlog a load v 14:27Z, případně přidat metriku listeneru.

---

## 7. Doporučení (bez deploye během run #7)

### P0 — po runu / s rollbackem
1. **Vyloučit duplicitní node listenery:** inventura `ss -ltnp` + `pgrep -a zion-node` + kontrola `SO_REUSEPORT`; startovní guard/health check, který odmítne druhou instanci nebo jiný `--db-path` na stejném portu; zapsat do runbooku.
2. **P2P robustnost:** došetřit `reset`/`no status response` z EDGE `:8336` pod ~230 % mining zátěží; přidat retry/backoff, druhý peer (nebo lokální EDGE2 peer), případně snížit prioritu těžby. Bez toho bude primary tip stárnout dál.
3. **Watchdog:** přidat stale-tip check (`tip_age > 900` po N po sobě jdoucích kontrolách) s alertem/annotací, ne jen reachability. Restart je až poslední možnost (každý restart = 60s incident).

### P1 — hardening sondy (nejdřív testy, pak deploy)
4. Při výběru tipu **vyžadovat `success`**; při selhání **vyčistit** `chain_height`/`tip_timestamp` (dnes zůstávají z prvního RPC).
5. Povolit malý **negativní `tip_age`** (např. −120 s) pro future-dated block timestampy; exportovat **per-node** tip age/height/hash (dnes jen `node_tip_fresh`).
6. Došetřit, proč mají followeři `node_tip_fresh=0` (future timestamp vs. chybějící pole), aby „any node“ fallback skutečně fungoval.
7. Zvážit druhé potvrzení na vrstvě evidence (schema change → mimo aktivní run).

### P2 — dokumentace/ops
8. Pojmenovat sémantiku: `chain_live` dnes fakticky znamená „primary má čerstvý tip“. Do `StatusV3`/runbooku doplnit, že incident `chain_live` ≠ chain outage.
9. Stratum blip došetřit jako samostatnou observability položku.

---

## 8. Verifikace navržených oprav

- Unit testy `g8_probe_exporter`: fake node vrátí (a) starý tip, (b) future timestamp, (c) timeout, (d) dva postupné tipy; ověřit `chain_live`, `node_tip_fresh`, `retried`.
- Replay zaznamenaných sérií (Prometheus) přes `g8_evidence.evaluate` — beze změny schématu.
- Po deployi (mimo run) sledovat `zion_g8_probe_retried`, `node_tip_fresh`, počet incidentů; cílem je, aby stale tip primary nezhasl `chain_live`, pokud follower má čerstvý tip.

---

## 9. Limity této analýzy

- Žádný restart, deploy ani změna metrik; vše read-only.
- Prometheus retence + journaly; **process accounting před restartem není k dispozici**, takže H1 (druhá instance) je silná, ale retrospektivně neprokazatelná.
- Nebyl proveden zásah do aktivního run #7; jeho čísla se mohou mezi sepsáním a přečtením změnit.
