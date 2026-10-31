# 8.B9 — Alert sink firing test + retence (G8 prerekvizita)

**Datum:** 2026-10-31 · **Verdikt: PASS**

## Evidence (live, EDGE)

| Položka | Stav |
|---|---|
| **Retence** | `storage.tsdb.retention.time = 40d` (+ size cap 8 GiB) ✅ |
| **Alert rules** | 31 rules v 5 skupinách načtené (`zion_g8`, `warp_btc_swap`, `zion_pool`, `zion_writepath`, `zis`) ✅ |
| **Sink** | Alertmanager → webhook `http://127.0.0.1:9094/alerts` = `zion-g8-alert-sink.service` (python, active; event log `/opt/zion/data/g8_alert_events.jsonl` + state `g8_alert_state.json`) ✅ |
| **Firing test** | `POST /api/v2/alerts` alertu `ZionAlertSinkFiringTest` → doručen na sink **12:30:56 UTC** (event log entry), resolved po testu ✅ |
| **Živý signál** | `G8ChainStale` alerty skutečně firingují a logují se (10:00:21/10:00:51 UTC — aktivní G8 run má stale eventy) ✅ |

## Poznámky

- Alertmanager route: `zion-g8-local` receiver, group_wait 5 s, repeat 4 h, `send_resolved: true`.
- Fail2ban poznámka: opakované SSH connecty z dev hostu způsobily dočasný `Connection refused` (self-DOS při ops práci) — ban vypršel. Stálo by za whitelist ops IP do `jail.d/zion-sshd.conf` (stejný pattern jako EDGE2 IP).
- Residuál 8.S1: per-alert firing testy pro každý kritický alert (tento test ověřil cestu AM→sink, ne jednotlivé rule expressiony).
