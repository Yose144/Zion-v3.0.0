# Alert runbook — ZION ops

> **Platí od:** 2026-11-08. Pokrývá **všech 37 alertů** v šesti rule souborech na EDGE1
> (`/etc/prometheus/rules/`). Repo kopie: `V31/deploy/monitoring/`.
> **DoD 9 / 8.S1:** každý alert má **firing test** (`promtool`) i tento runbook.

## 0. Jak alerting teče a jak ho otestovat

```
Prometheus (EDGE1 127.0.0.1:9090)
  ├── rules: g8 · zion-pool · zion_writepath · zis · warp_btc_swap · zion-host
  └── alerting → Alertmanager 127.0.0.1:9093
                    └── webhook → G8 sink 127.0.0.1:9094/alerts
                          ├── /opt/zion/data/g8_alert_events.jsonl   (historie)
                          └── /opt/zion/data/g8_alert_state.json     (aktivní)
```

Grafana má vlastní pravidla jen pro WARP (stejné jako Prometheus) a **doručuje je do téhož
Alertmanageru** — od 2026-11-07. E-mail v Grafaně nakonfigurovaný není a není potřeba.

**Testy (firing + quiet case pro každý alert):**

```bash
bash scripts/ops/test-alert-rules.sh            # lokálně, potřebuje promtool
bash scripts/ops/test-alert-rules.sh --list     # která rules file má test

# bez promtoolu lokálně (EDGE1 ho má):
ssh zion-v6 'rm -rf /tmp/rules && mkdir -p /tmp/rules'
scp V31/deploy/monitoring/*.yml zion-v6:/tmp/rules/
ssh zion-v6 'cd /tmp/rules && for f in test_*_rules.yml; do promtool test rules "$f"; done'
```

**Kontrola, že pravidla jsou vůbec načtená:**

```bash
ssh zion-v6 'promtool check config /etc/prometheus/prometheus.yml | head -3'
ssh zion-v6 'curl -s localhost:9090/api/v1/rules | python3 -c "import sys,json;[print(g[\"name\"],g[\"file\"].split(\"/\")[-1]) for g in json.load(sys.stdin)[\"data\"][\"groups\"]]"'
ssh zion-v6 'curl -s localhost:9090/api/v1/alerts'   # co právě hoří
```

> **Past, která se už stala:** soubor nakopírovaný do `/etc/prometheus/rules/` je **inertní**,
> dokud není v `rule_files` v `prometheus.yml`. `zion-host.rules.yml` takhle ležel měsíce.

## 1. Severity

| | Význam | Reakce |
|---|---|---|
| `critical` | služba/peníze/konsenzus slepé nebo mrtvé | řešit hned, i v noci |
| `warning` | degradace nebo slepé místo, které se samo nespraví | do hodin, v pracovní době |

`DatasourceNoData` v Grafaně = chybějící data, ne incidident (řešeno 2026-11-07).

---

## 2. G8 evidence gate (`g8.rules.yml`)

G8 je 30denní důkaz dostupnosti pro Stable. Alerty nad ním znamenají **ztrátu důkazu**, ne
nutně výpadek. Aktivní run: `g8-20261106T145125Z`, cíl `2026-12-06T14:51:25Z`.

| Alert | Co znamená | První kontrola | Co nedělat |
|---|---|---|---|
| `G8ExporterDown` (critical, 2 m) | Prometheus nescrapuje `:9105`, evidence je slepá | `ssh zion-v6 'systemctl status zion-g8-probe; ss -tlnp \| grep 9105'`, `journalctl -u zion-g8-probe -n 50` | neresetovat run kvůli díře v datech — chybějící vzorky se počítají jako downtime |
| `G8ChainStale` (critical, bez `for`) | tip je starší 15 min **nebo** žádný node nehlásí tip | `curl -s localhost:9090/api/v1/query?query=zion_g8_chain_tip_age_seconds`, výška na nodech (`:9445/:9446/:9447`) | nemazat state ani „opravovat" G8 skript, dokud nevíš, jestli je mrtvý chain nebo probe |
| `G8RequiredServiceDown` (critical, 2 m) | jedna z required služeb (`pool_http`, `pool_stratum`, `multichain`, `dao`, `zis`) neprošla probem | `zion_g8_probe_success{service="<x>"}`, pak `systemctl status` příslušné služby + její port | nespouštět `reset-failed` bez pohledu do journalu — maskuje příčinu |
| `G8PrimaryNodeDown` (critical, 2 m) | `node_primary` RPC neodpovídá (EDGE2 :9445) | `curl -s -m 3 http://207.180.217.100:9445 -X POST -d '{"jsonrpc":"2.0","id":1,"method":"getChainInfo"}'`, pak `systemctl status zion-v31-node` na EDGE2 | nepovyšovat followery na primary bez fencing procedury (`POOL-HA-RUNBOOK.md`) |
| `G8PrimaryTipStale` (warning, 5 m) | primary **odpovídá**, ale jeho tip je starší 15 min; `chain_live` může být 1 přes followera | `zion_g8_node_tip_age_seconds{service="node_primary"}`, `zion_g8_node_chain_height{service="node_primary"}`, P2P logy `P2P sync from …:8336 failed`, `systemctl status zion-v31-node` | nerestartovat node „pro jistotu" — nejdřív zjisti, jestli je starý tip nebo jen chybí metrika (starý probe). Rule vyžaduje probe ≥ 2026-11-11 |
| `G8NodeQuorumLow` (warning, 5 m) | méně než 2 ze 3 node RPC odpovídají | `zion_g8_node_quorum`, `ss -tlnp` na 9445/9446/9447 | neignorovat — s jedním nodem není fallback |

**Watchdog stale-tip (od 2026-11-11):** `scripts/ops/node-tip-age.sh` čte
`zion_g8_node_tip_age_seconds` z lokálního probe a je zapojený do `check_health`
(mode `edge2`) **log-only** — chybějící metrika (starý probe) je no-op, ne falešný
alarm. Restart na stale tip je opt-in `ZION_WATCHDOG_STALE_RESTART=1`; každý
restart stojí jeden 60s G8 vzorek, takže se nezapíná paušálně. Test:
`bash scripts/ops/test_node_tip_age.sh`.

## 3. Pool (`zion-pool.rules.yml`)

| Alert | Co znamená | První kontrola | Co nedělat |
|---|---|---|---|
| `ZionPoolApiDown` (critical, 5 m) | `/metrics` na `:8080` nescrapeable → proces nebo HTTP API mrtvé | `systemctl status zion-v31-pool`, `curl -s -m 3 localhost:8080/health`, `journalctl -u zion-v31-pool -n 80` | nerestartovat pool bez drainu, pokud běží (`systemctl stop` = drain přes SIGTERM; `restart` je tolerovaný, ale zdokumentuj proč) |
| `ZionPoolNoMiners` (warning, 15 m) | nula stratum sessions | `zion_pool_active_sessions`, `ss -tlnp \| grep 8444`, log stratum handshake | neměnit vardiff ani targety „aby se minery připojily" — nejdřív síť/firewall |
| `ZionPoolAcceptRateDrop` (warning, 15 m) | >15 % rejectů 15 min v kuse | `/miners` → `reject_reasons` buckety (`duplicate`, `low_difficulty`, `stale`, `malformed`), `rate(zion_pool_coin_shares_*)` | nezasahovat do validace podle jednoho burstu; vardiff retarget dělá krátké špičky |
| `ZionPoolLegDisconnected` (warning, 10 m) | zapnutý upstream leg nemá spojení | `zion_pool_leg_connected{leg="…"}`, `journalctl -u zion-v31-pool \| grep -i <leg>` | nevypínat leg jako „opravu" — příjmy z něj jdou do poolu; nejdřív upstream endpoint |
| `ZionPoolJobStale` (warning, 10 m) | z upstreamu nepřišel nový job 3 min+ | `zion_pool_leg_job_age_ms`, log upstream handshake | neposílat staré share „na zkoušku" — uvidíš jen rejecty |
| `ZionPoolPPLNSPersistFailing` (critical, 1 m) | zápis `pool-pplns.json` selhává → po restartu se okno vrátí a minery přijdou o nevyplacené | `zion_pool_pplns_persist_failures_total`, `ls -l /opt/zion/data/pool-pplns.json`, `df -h /`, `journalctl … \| grep pplns` | neuklízet/mazat PPLNS soubor; disk a práva opravit, ne obcházet |
| `ZionPoolPPLNSPersistStale` (warning, 5 m) | 30 min bez úspěšného snapshotu | `zion_pool_pplns_persist_success_timestamp_seconds`, stáří souboru | nespouštět ruční snapshot skript bez zálohy |

## 4. Write path (`zion_writepath.rules.yml`)

Vzniklo proto, že služba může být `active`, a přesto její zápisovou cestu nikdo nepíše
(L5 scanner 5 dní, db-sync PG auth 5 dní). **Nikdy nezaměňuj `is-active` za důkaz.**

| Alert | Co znamená | První kontrola | Co nedělat |
|---|---|---|---|
| `ZionScannerApiDown` (critical, 5 m) | fund-balance API L5/L6 neodpovídá | `curl -s -m 3 localhost:8095/api/v1/health` (L5) / `:8097` (L6), `systemctl status zion-v31-free-world zion-v31-issobella` | nespouštět rescan bez zjištění, jestli je mrtvý proces, DB soubor nebo inode (viz níže) |
| `ZionScannerLag` (warning, 15 m) | scanner za tipem o >30 bloků (norma ~7) | `zion_scanner_lag_blocks{layer}`, `systemctl status`, `ls -l /data/zion/free_world.db` | **nemaž DB.** Když proces drží smazaný inode (rsync pod běžící službou), řešením je restart služby, ne DB |
| `ZionDbSyncAuthFailed` (critical, 5 m) | `DATABASE_URL` credentials neprojdou proti PG | `psql "postgresql://…" -c 'select 1'` na EDGE2, `journalctl -u zion-db-sync \| grep -i auth` | neměnit heslo role bez srovnání **všech** konzumentů (`/opt/zion/shared/.env`) |
| `ZionDbSyncStale` (warning, 30 m) | 4 h bez zápisu `MiningWorker.lastShareAt` | `zion_dbsync_worker_last_share_age_seconds`, poslední upsert v PG | neinterpretovat jako „všichni idle" bez pohledu na pool sessions |
| `ZionWritepathServiceDown` (warning, 5 m) | systemd hlásí službu neaktivní | `systemctl status <service>`, `journalctl -u <service> -n 60` | neopravovat `reset-failed`; smyslem je vidět, že zápis neběží |
| `ZionWritepathProbeMissing` (warning, 10 m) | textfile metriky zmizely → probe neběží | `ssh zion-edge2 'systemctl status zion-writepath-probe.timer; ls -l /var/lib/prometheus/node-exporter/zion_writepath.prom'` | nedoplňovat metriky ručně; chybějící data = downtime |
| `ZionPoolStatsApiUnresponsive` (warning, 10 m) | `/stats` visí >8 s (typicky `pool.lock()`), zatímco `/metrics` je OK | `time curl -s -m 10 localhost:8080/stats`, `journalctl -u zion-v31-pool` | nerestartovat pool preventivně — nejdřív změř, jestli se lock uvolnil (2026-10-26 se to samo neuzdravilo, ale restart bez důkazu ztrácí drain) |
| `ZionPoolStatsApiSlow` (warning, 15 m) | `/stats` >3 s 15 min | `zion_pool_stats_api_latency_seconds`, trend `rate` | neignorovat, je to předzvěst wedgi |
| `ZionPoolPayoutStale` (warning, 15 m) | nejnovější payout řádek >1 h | `public/v1/payouts?limit=5`, `journalctl -u zion-v31-pool \| grep payout` | **nenahrazuj chybějící `ts` aktuálním časem** a nedělej ruční resubmit bez kontroly UTXO |
| `ZionPoolBlockProductionStale` (warning, 10 m) | žádný pool blok 15 min (medián 44 s, p99 269 s) | `zion_pool_last_block_age_seconds`, sessions, reject buckety | neměň target; chain mezitím žije z fallback minerů |
| `ZionPoolBlockProductionHalted` (critical, 5 m) | 30 min bez bloku (~40× medián) → PPLNS kola stojí | totéž + `journalctl \| grep -i template` (fetch z node RPC) | nepovyšuj to na „chain je mrtvý" — chain je jiný alert (`G8ChainStale`) |
| `ZionPoolBlocksApiDown` (warning, 10 m) | `/public/v1/blocks` nevrací řádky | `curl -s localhost:8080/public/v1/blocks?limit=1`, `store.db` health | nemaž store.db; nejdřív zjisti, jestli selhává API nebo produkce bloků |
| `ZionPoolPayoutMeasurementMissing` (warning, 10 m) ⚠️ **repo only** | probe nepřečetl `latest_recorded_ts` | `grep zion_pool_payout_measurement_ok /var/lib/prometheus/node-exporter/zion_writepath.prom` | **nenasazovat samostatně** — viz §7 |
| `ZionWritepathProbeStale` (warning, 5 m) ⚠️ **repo only** | textfile je starý/chybí (node_exporter drží stará zelená data) | stáří `.prom` souboru vs `time()` | **nenasazovat samostatně** — viz §7 |

## 5. ZIS (`zis.rules.yml`)

ZIS drží SSO celého ekosystému; `ZisDown` je nejdražší alert v sadě.

| Alert | Co znamená | První kontrola | Co nedělat |
|---|---|---|---|
| `ZisDown` (critical, 2 m) | `up{job="zis"} == 0` | `curl -s -m 3 https://auth.zionterranova.com/health`, `systemctl status zion-zis`, `ss -tlnp \| grep 8096` | neresetovat DB ani klíče; nejdřív proces/port/env |
| `ZisHighErrorRate` (warning, 5 m) | >0.5 5xx/s | `rate(zis_http_requests_total{status=~"5.."}[5m])`, `journalctl -u zion-zis \| tail -80` | ne `npm ci` na produkci bez zálohy `.next` |
| `ZisPendingChallengesHigh` (warning, 15 m) | >500 pending challenges | `zis_pending_challenges`, prune job v logu, DB dotaz na tabulku challenges | nemaž challenge tabulku ručně — rozbiješ právě probíhající loginy |
| `ZisAuthFailureSpike` (warning, 10 m) | >1 selhané verify/s | `rate(... route=~"/api/auth/verify.*", status="401")`, zdrojové IP v nginx logu | nebanuj IP plošně; nejdřív zjisti, jestli nejde o rozbitého klienta |

## 6. WARP BTC swap (`warp_btc_swap.yml`)

**Swap je záměrně vypnutý** (`WARP_BTC_SWAP_ENABLED=0`), takže swapové série neexistují a
pravidla mlčí — to je správný stav, ne výpadek. `WarpBtcSwapMetricsDown` hlídá endpoint.

| Alert | Co znamená | První kontrola | Co nedělat |
|---|---|---|---|
| `WarpBtcSwapStuck` (warning, 10 m) | swap stojí přes `offer_ttl` | `curl -s localhost:8454/v1/multichain/swaps/btc` | nezapínej swap kvůli alertu |
| `WarpBtcSwapNearDeadline` (critical, 5 m) | swap je <1 h od ZION refund deadline | seznam swapů + `zion_timeout_ts`, stav koordinátoru | nerezervuj/neodesílej refund ručně bez second pair of eyes — jde o peníze |
| `WarpBtcSwapMetricsDown` (warning, 5 m) | `up{job="warp_btc_swap"} == 0` | `systemctl status zion-v31-multichain`, `curl -s localhost:8454/health` | nezaměňuj s „swap nefunguje" — swap je OFF |

## 7. Host (`zion-host.rules.yml`)

| Alert | Co znamená | První kontrola | Co nedělat |
|---|---|---|---|
| `ZionHostExporterDown` (warning, 5 m) | `up{job="node"}` nebo `job="edge2"` = 0 | `systemctl status prometheus-node-exporter` (EDGE1/EDGE2), `curl -s localhost:9100/metrics \| head -1` | **nikdy `systemctl reload prometheus-node-exporter`** — balíček posílá SIGHUP, který exporter zabije (stalo se 31. 10., týden bez metrik). Drop-in `zz-restart-always.conf` to už hlídá |
| `ZionHostMetricsMissing` (warning, 15 m) | série pro host vůbec neexistuje (cíl zmizel ze scrape configu) | `curl -s localhost:9090/api/v1/targets \| grep 9100`, `promtool check config /etc/prometheus/prometheus.yml` | nepřidávej `instance` label „aby to sedělo" — tím se maskuje odstraněný cíl |
| `ZionHostMemoryLow` (warning, 10 m) | <10 % dostupné RAM 10 min | `free -m`, `ps -eo rss,comm --sort=-rss \| head`, swap | nerestartuj pool preventivně kvůli RAM; leak nebyl prokázán a restart maže drain |

---

## 8. Známé rozdíly repo ↔ produkce (stav 2026-11-08)

1. **`zion_writepath.rules.yml`:** repo obsahuje **2 alerty navíc**
   (`ZionPoolPayoutMeasurementMissing`, `ZionWritepathProbeStale`), které na EDGE1 **nejsou**.
   Oba používají `absent()`/`== 0` na pole, která běžící probe ještě neemituje
   (`zion_pool_payout_measurement_ok`, `latest_recorded_ts`) → samostatný deploy by okamžitě
   zapálil. **Nasazovat společně s probem a poolem, které ta pole vydávají.**
2. **`g8.rules.yml`:** na EDGE1 je starší text `description` u `G8ChainStale` (věta o primary
   node probe). Repo má novější formulaci (quorum fallback). Rozdíl je **jen v textu**, chování
   je stejné — srovná se při příštím deployi rules.
3. **`warp_btc_swap.yml` a `zis.rules.yml`** existovaly **jen na hostu**; od 2026-11-08 jsou
   v repu. Rebuild boxu by je dřív tiše ztratil.
4. **Grafana** má duplikát tří WARP alertů; doručuje je do stejného Alertmanageru. Duplikovat
   další alerty do Grafanu nemá smysl — kanonické jsou Prometheus rules.
