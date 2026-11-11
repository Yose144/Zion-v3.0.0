# REPORT 2026-11-11 — G8 primary-tip alert + inventura node listenerů

> **Datum:** 2026-11-11 · **Režim:** autonomní, kód/testy/dokumentace (bez deploye, restartu, money-path)
> **Zadání 👤:** „po pokracuj" po [`REPORT_2026-11-11_G8_PROBE_HARDENING.md`](REPORT_2026-11-11_G8_PROBE_HARDENING.md).
> **Kontext:** doplněk k [`REPORT_2026-11-11_G8_CHAIN_LIVE_RCA.md`](REPORT_2026-11-11_G8_CHAIN_LIVE_RCA.md) — P0 body 1 (duplicitní listenery) a 4 (alert na stale-but-reachable primary).

---

## 1. Alert `G8PrimaryTipStale` (připraven + ověřen)

RCA ukázala slepé místo: `G8PrimaryNodeDown` pokrývá jen `probe_success=0`, ale primary, který **odpovídá a má starý tip**, žádný alert nemá — dokud followers drží `chain_live=1`.

Přidáno do [`V31/deploy/monitoring/g8.rules.yml`](../../../V31/deploy/monitoring/g8.rules.yml):

```yaml
- alert: G8PrimaryTipStale
  expr: zion_g8_node_tip_age_seconds{service="node_primary"} > 900
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "G8 primary node tip is stale"
    description: "…RPC may still answer; chain_live can remain 1 via a follower,
      but the primary is not syncing — check P2P from EDGE :8336 and node restarts."
```

- Nová metrika `zion_g8_node_tip_age_seconds` je z hardeningu sondy (commit `6719fb115`); **rule se nasazuje spolu s probem**. Na starém probe série chybí → alert zůstává neaktivní (bezpečné, ale slepé).
- Firing + quiet testy v [`test_zion_g8_rules.yml`](../../../V31/deploy/monitoring/test_zion_g8_rules.yml): (a) primary 100 → 1000 s po 5 min → firing, (b) primary fresh + stale follower → **žádný** alert (label selector).
- Ověřeno **promtool 3.16.0** (stažen lokálně do `/tmp`, bez zásahu do repa):
  - `promtool check rules g8.rules.yml` → **SUCCESS: 6 rules found**
  - `promtool test rules test_zion_g8_rules.yml` → **SUCCESS**

## 2. Inventura node listenerů (H1 z RCA)

| Host | Port | Co tam je |
|---|---|---|
| EDGE2 | `9445` | jediný `zion-node` (pid 2260416, `0.0.0.0:9445`, cgroup `zion-v31-node.service`) |
| EDGE2 | `9446/9447` | SSH reverse tunely (`zion-edge-tunnel`) na EDGE followery |
| EDGE | `9445` | SSH tunel (`zion-chain-tunnel`, pid 909889) → EDGE2:9445 |
| EDGE | `9446/9447` | lokální `zion-node` followeři (`node2`, `node3`) |

**Nález:** v `V31/L1/core` **není `SO_REUSEPORT`** ani `reuse_port`; Rust `TcpListener::bind` ho nenastavuje. Aktuálně tedy **nejde** o dva listenery na jednom portu — hypotéza H1 (druhá instance) **nemá v dnešním stavu oporu**. Historickou duplicitu před restarty nelze vyloučit bez process accountingu (ten není k dispozici); po restartu 10. 11. 19:17Z se `chain_live` incidenty neopakovaly.

**Vedlejší nález — repo vs. produkce:** běžící primary má `--rpc 0.0.0.0:9445 --peer 62.171.141.136:8336`, ale repo base unit má `127.0.0.1:9445` a žádný `--peer`. Produkce to řeší drop-inem `zz-primary.conf`, který v repu chyběl. Doplněno:

- [`V31/deploy/systemd/zion-v31-node.service.d/zz-primary.conf`](../../../V31/deploy/systemd/zion-v31-node.service.d/zz-primary.conf) — 1:1 z živého EDGE2
- [`…/service.d/README.md`](../../../V31/deploy/systemd/zion-v31-node.service.d/README.md) — proč 0.0.0.0, UFW, nepřenášet na loopback-only host
- komentář v base unitu s odkazem na drop-in

**Chování se nemění** — jde o repo provenance; deploy skript drop-in nekopíruje, takže se nic automaticky nenasadí.

## 3. Ověření

| Kontrola | Výsledek |
|---|---|
| `promtool check rules g8.rules.yml` | SUCCESS (6 rules) |
| `promtool test rules test_zion_g8_rules.yml` | SUCCESS |
| `python3 scripts/ops/test_g8_probe_exporter.py` | 21/21 OK (z předchozí dávky) |
| `git diff --check` | OK |
| `check-doc-links.py` | 0 rozbitých |

## 4. Co zůstává

| # | Položka | Stav |
|---|---|---|
| 1 | Deploy probe + `G8PrimaryTipStale` rule na EDGE | ⏸️ mimo run #7 / po schválení; probe restart může minout scrape |
| 2 | Watchdog stale-tip check (dnes jen „RPC not reachable") | ⬜ návrh; restart až poslední možnost |
| 3 | P2P robustnost EDGE `:8336` (resety, druhý peer, priorita miningu) | ⬜ kód/konfigurace |
| 4 | Stratum blip 14:27Z (11. 11.) | ⬜ observability |
| 5 | Došetřit H1 retrospektivně (process accounting / auditd) | ⬜ pokud se má uzavřít jako důkaz, ne jen „neprokázáno" |

## 5. Limity

- Žádný deploy, restart ani změna produkce; alert rule je jen v repu.
- `promtool` byl použit lokálně z `/tmp`; do repa se necommituje.
- Historické dva listenery nelze dnes prokázat; závěr je „current state single, H1 nepodložená".
