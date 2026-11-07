# EDGE1 host monitoring — from a week of silence to live series and a loud alert

> **Datum:** 2026-11-07 (večer, ~20:45–21:00 CET)
> **Zadání:** P1 položka „EDGE1 monitoring" z [`REPORT_2026-11-07_EDGE_AUDIT_AUTONOMOUS.md`](REPORT_2026-11-07_EDGE_AUDIT_AUTONOMOUS.md) §4 (M1: chybí host metriky, duplicitní scrape cíl, žádný down/missing alert).
> **Režim:** produkční změny jen v monitoringu. **Žádný restart poolu, node ani G8 služeb, žádná změna konsenzu, payoutů, DNS ani ﬁnanční akce.** Prometheus byl pouze přenačten (`reload`, ne restart).

## 1. Co bylo rozbité (tři nezávislé věci)

| # | Nález | Důkaz |
|---|---|---|
| 1 | EDGE1 node-exporter **mrtvý od 31. 10. 10:49 CET** | `Active: inactive (dead)`, `Main PID: 778 (code=killed, signal=HUP)`, předtím běžel 2 d 16 h |
| 2 | **Duplicitní scrape cíl** — `node`/`localhost:9100` a `node_exporter`/`127.0.0.1:9100` mířily na tentýž exporter | `avg_over_time(up[24h])` obou = **0**; u jednoho exporteru dva `up` targety = nejasné „měříme EDGE1?" |
| 3 | Pravidla `zion-host.rules.yml` **existovala v repu, ale nebyla zapojená** — soubor v `/etc/prometheus/rules/` je inertní, dokud není v `rule_files` | živé `rule_files` obsahovalo 5 souborů, `zion-host.rules.yml` mezi nimi nebyl |

**Root cause outage:** balíčkovaný unit má `ExecReload=/bin/kill -HUP $MAINPID`. `node_exporter` SIGHUP **neošetřuje** — ukončí se. Někdo 31. 10. spustil `systemctl reload prometheus-node-exporter`, exporter zemřel a `Restart=on-failure` ho nezvedl, protože unit zůstal v reload-failed stavu. Metriky pak týden nikdo neměl a žádný alert to neřekl.

## 2. Co je teď nasazené

**EDGE1 (`62.171.141.136`):**

1. `prometheus-node-exporter` **spuštěn** (`active`, listener `*:9100`, 1 846 `node_*` metrik, PSI `node_pressure_*` i CPU série).
2. Drop-in `prometheus-node-exporter.service.d/zz-restart-always.conf`:
   - `ExecReload=` (vyčištěno) → `systemctl reload` teď **selže nahlas** (`Job type reload is not applicable`), místo aby exporter tiše zabil;
   - `Restart=always` + `RestartSec=5s` → jakákoli smrt procesu se vrátí bez operátora.
   - Ověřeno reálně: `kill -HUP` na běžící PID → systemd zvedl nový proces (`NRestarts=1`, `MainPID` se změnil), `/metrics` 200.
3. `prometheus.yml`: zrušen duplicitní job `node_exporter`, hosty rozlišuje `instance` label:
   - `node` → `localhost:9100`, `instance=edge1`, `host=edge1`, 15 s;
   - `edge2` → `207.180.217.100:9100`, `instance=edge2`, `host=edge2`, 30 s.
4. `rules/zion-host.rules.yml` zkopírován **a zapsán do `rule_files`**.
5. `systemctl reload prometheus` (HUP, Prometheus ho umí) — žádný restart, TSDB bez přerušení.

**Bezpečnost:** UFW na EDGE1 nemá pravidlo pro 9100 a default je `deny incoming` — z internetu je `62.171.141.136:9100` **nedostupný** (ověřeno timeoutem zvenčí). EDGE2 má 9100 povolený jen z EDGE1 IPv4 + `2a02:c207:2342:5821::/64`. Exporter tedy nikde nevisí do světa.

## 3. Pravidla a jejich testy

`V31/deploy/monitoring/zion-host.rules.yml`:

| Alert | Výraz | Proč |
|---|---|---|
| `ZionHostExporterDown` | `up{job="node"} == 0 or up{job="edge2"} == 0` | exporter neodpovídá |
| `ZionHostMetricsMissing` | `absent(up{job="node",instance="edge1"}) or absent(up{job="edge2",instance="edge2"})` | **chybějící série** — přesně stav, který týden nikdo neviděl; `up == 0` sám o sobě mlčí, když cíl ze scrape configu zmizí |
| `ZionHostMemoryLow` | `MemAvailable/MemTotal < 10 %` po 10 min, `instance=~"edge1\|edge2"` | tlak na RAM na obou boxech |

Nový `V31/deploy/monitoring/test_zion_host_rules.yml` (promtool unit testy, 4 scénáře): EDGE1 down při zdravém EDGE2 (page jen za edge1), EDGE2 **cíl odstraněn** → `absent()` firing, oba zdravé → nic, EDGE1 RAM pod 10 % → jen paměťový alert.

```
promtool test rules test_zion_host_rules.yml   → SUCCESS
```

## 4. Živé ověření (po nasazení)

```
up{job="node", instance="edge1"}        = 1
up{job="edge2", instance="edge2"}       = 1
node_memory_MemAvailable_bytes{edge1}   = ~1 812 MiB
node_memory_MemAvailable_bytes{edge2}   = ~5 600 MiB
alerts firing                           = none
zion_host rules                         = ZionHostExporterDown inactive,
                                          ZionHostMetricsMissing inactive,
                                          ZionHostMemoryLow inactive
promtool check config                   = SUCCESS (6 rule files)
```

## 5. Změny v repu

- `V31/deploy/monitoring/zion-host.rules.yml` — přepsáno (dva joby, `absent()` varianta, komentář proč EDGE2 zůstává `job="edge2"`: jeho textfile nese `zion_writepath` série a tamější alerty na tom jobu visí).
- `V31/deploy/monitoring/test_zion_host_rules.yml` — nový promtool test.
- `V31/deploy/monitoring/node-hosts-scrape.yml` — srovnáno s živým stavem + postup nasazení.
- `V31/deploy/monitoring/prometheus-node-exporter.zz-restart-always.conf` — nový drop-in (sha256 `ff3e4c6f…`).

**Rollback:** `prometheus.yml.bak-nodehosts-20261107T204727Z`, `prometheus.yml.bak-hostrules-20261107T204957Z` v `/etc/prometheus/`; drop-in smazat + `daemon-reload`. Exporter lze nechat běžet — je to pouze čtení metrik.

## 6. Co zůstává otevřené

- **`systemd-networkd-wait-online.service` failed na EDGE2** (exit 1 z 6. 11., boot-time) — nesouvisí, ale je to jediná failed unit na boxech.
- **Grafana dashboard** (`v31-mainnet.json`) host panely nekreslí — dotazy řeší jen pool joby. Série pro `edge1`/`edge2` teď existují, panel je samostatná redakční práce.
- **Aliasy `node_exporter`**: stará série `up{job="node_exporter"}` doběhne stálostí sama (žádný zásah není potřeba); pokud by na ni někde visel dotaz, je to mrtvý odkaz.
- Historie měření EDGE1 před 2026-11-07 neexistuje — chybějící data se nedoplňují.
