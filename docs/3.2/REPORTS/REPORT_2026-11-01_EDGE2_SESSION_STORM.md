# REPORT — EDGE2 sshd storm → falešné G8 incidenty (2026-11-01)

> **TL;DR:** Dashboard na EDGE otevíral **jedno SSH spojení na každou EDGE2 službu při každém refreshi**.
> Naměřeno **4 361 root sessions / 100 min**, sshd na EDGE2 začal throttlovat (`MaxStartups`, auth.log **09:06 CET**),
> a protože G8 sonda na EDGE dosahuje na `multichain` / `dao` / `zis` **jen přes chain tunnel**, výpadky sshd
> se projevily jako **5 „výpadků" služeb mezi 08:02–08:18 UTC**, i když služby běžely celou dobu.
> **Fix nasazen:** muxované SSH (`ControlMaster` + `ControlPersist`) a **jeden dávkový `systemctl is-active`**
> pro všechny EDGE2 unity místo jednoho dotazu na unit. **Výsledek: 43,6 → ~1–2 session/min, 0× MaxStartups.**

## 1. Co se stalo

`docs/3.2/StatusV3.md` k 31. 10. evidoval u G8 runu #6 **jeden** incident (240 s, pool) a uptime **99,7976 %**.
Živý stav 1. 11. 19:00 CET byl jiný: uptime **99,673 %** a **6 incidentů**:

| Start (UTC) | Trvání | Služby |
|---|---:|---|
| 2026-10-30T21:00:17 | 240 s | pool_http, pool_stratum |
| 2026-10-31T10:00:17 | 60 s | chain_live (plánovaný restart primary) |
| 2026-11-01T08:02:17 | 60 s | multichain, dao, zis |
| 2026-11-01T08:04:17 | 180 s | multichain, dao, zis |
| 2026-11-01T08:08:17 | 120 s | multichain, dao, zis |
| 2026-11-01T08:14:17 | 60 s | multichain, dao, zis |
| 2026-11-01T08:17:17 | 60 s | multichain, dao, zis |

Kritické (≥900 s) = **0**, takže gate #6 (cíl 28. 11. 23:46Z) zatím drží, ale spotřeboval se prostor.

## 2. Root cause

Tři služby padly **současně a opakovaně** → neselhaly ony, selhala **cesta k nim**.

- G8 exporter běží na **EDGE** (`G8_NODE_RPC_PORTS=9445,9446,9447`, health URL `8453/8456/8096`).
  `multichain` (8453), `dao` (8456) a `zis` (8096) jsou **jen na EDGE2** → sonda je čte přes **chain tunnel**.
- Dashboard (`zion-edge-python-dashboard`, `ZION_OS/dashboard/app.py`) v `/api/services` volal
  `_run_edge2_cmd("systemctl is-active <unit>")` **pro každou EDGE2 službu zvlášť** a bez SSH muxu.
  Refresh s ~15 EDGE2 unitami = ~15 nových TCP+SSH sessions, každých pár sekund.
- Naměřeno na EDGE2: **4 361 root sessions za 100 minut** (`systemctl` session scopes), **2 043** výskytů
  `error: beginning MaxStartups throttling` v `/var/log/auth.log`, zdroj `62.171.141.136` (= EDGE).
- V okně incidentů: throttle záznamy **09:06 CET** (3 dropy) → sshd přestal přijímat nová spojení → tunelové
  legs na 8453/8456/8096 v tom okně nedostaly odpověď → G8 zapsal „výpadek".
- Služby samotné byly zdravé: `zion-zis` v 09:12 CET běžně obsluhoval requesty, `NRestarts=0`
  u ZIS/DAO i multichain, `chain_live` v okně nespadl (sonda má i lokální followery 9446/9447).

Stejná třída chyby, jakou už G8 run #4 řešil u `chain_live` (probe přes tunel = single point of failure),
jen o patro výš: **monitoring si vyrobil vlastní výpadek**.

## 3. Fix (nasazeno 2026-11-01 19:09 CET)

`ZION_OS/dashboard/app.py`:

1. **Mux:** `_run_edge2_cmd` i `_run_edge_cmd_remote` dostaly
   `-o ControlMaster=auto -o ControlPath=/tmp/zion-dash-*%r@%h:%p -o ControlPersist=120`
   → jedno SSH spojení se reusuje, sshd vidí jednu session.
2. **Batch:** nový `_edge2_systemd_states()` + `_edge2_units()` — všechny EDGE2 unity se ptají
   **jedním** `systemctl is-active <unit…>` na jeden round-trip, výsledek se cachuje na
   `ZION_EDGE2_SYSD_TTL` (default 8 s). Když dávka nesedí (počet řádků ≠ počet unitů),
   spadne se zpět na single probe — žádná tichá „unknown" služba.
3. Konstanty `_EDGE2_SYSTEMD_MAP` (dřív duplikovaná mapa uvnitř větve) — jeden zdroj pravdy.

Deploy: `bash ZION_OS/dashboard/deploy-dashboard.sh` (záloha do `.deploy-backups/20261101T190912Z`,
`py_compile`, restart, self-verify na dočasné instanci :8798).
Ověřeno: `/api/ops/health` OK, `/api/ops/overview` OK (pool 2/12 workers, accept 99,9 %, 3 066 bloků),
`/api/services` = **0 služeb ve stavu stopped/unknown**, všech 15 EDGE2 unitů `active` přes batch.

## 4. Měření

| Metrika | Před | Po |
|---|---:|---:|
| Root sessions na EDGE2 | **43,6 / min** (4 361 / 100 min) | **~1–2 / min** |
| `MaxStartups throttling` | 2 043 (auth.log), 09:06 CET v incidentu | **0** od 19:09 CET |
| `/api/services` refresh (5×) | ~15 SSH sessions každý | **0 nových** (mux + cache) |
| Latence refresh | — | 1 491 ms (cold), pak 195–396 ms |
| Služby stopped/unknown | — | **0** |

## 5. Meze / co zbývá

- **Retry ve sondě nestačil:** `G8_PROBE_CONFIRM_ATTEMPTS=2` s `G8_PROBE_CONFIRM_DELAY_MS=400` je
  v `g8_probe_exporter.py` už nasazený (platí i pro HTTP služby), ale oba pokusy spadly uvnitř stalling
  tunelové cesty — 400 ms odstup je kratší než skutečná prodleva. Zvýšení retry by jen maskovalo
  root cause; proto se šlo po sshd stormu.
- Zbylé ~1–2 session/min = ControlPersist expiry (120 s) + ostatní nástroje (health checky, deploye,
  `zion-rig-output`), ne fan-out dashboardu.
- **G8 run #6 si incidenty 08:02–08:18 UTC nechává** — jsou to reálné vzorky monitoringu, jen s falešnou
  příčinou. Pokud je 👤 chce anulovat, musí se to udělat explicitně v `g8_run.json` (a zdůvodnit v evidenci);
  do té doby platí, že uptime 99,673 % **není** výpadek produkce, ale výpadek pozorovatelnosti.
- **Doporučení do budoucna:** pasivní health endpointy (bez SSH) pro EDGE2 služby v dashboardu, ideálně
  přes HTTP/TCP přes tunel, aby monitoring nikdy nesdílel cestu s řídicí rovinou.
- Samotný `MaxStartups` limit na EDGE2 není potřeba zvyšovat — root cause byl počet spojení, ne limit.

## 6. Reprodukce

```bash
# 1) důkaz stormu (před fixem)
ssh zion-edge2 'journalctl --since "2 hours ago" | grep -c "Started session-.*of User root"'
ssh zion-edge2 'grep -c MaxStartups /var/log/auth.log'
# 2) kdo to dělá
ssh zion-edge2 'grep "past MaxStartups" /var/log/auth.log | tail -3'   # SRC=62.171.141.136 = EDGE
# 3) po fixu
ssh zion-edge2 'journalctl --since "-5 min" | grep -c "Started session-.*of User root"'
```

## 7. Navazující fix — `/api/health` z 12,3 s na 0,18 s

Při ověřování dashboardu po deployi vyšlo najevo, že `/api/health` (endpoint pro watchdog a externí
monitoring) trval **8,7–12,3 s**. Dvě příčiny, obě opravené:

1. **`build_status()` stahoval celý UTXO set.** `_get_utxo_balance()` volalo `getUtxos` bez pagingu;
   pool/payout peněženka má **96 435 UTXO = 20 MB JSON** na jedno volání (změřeno: 0,83 s na nodu,
   ~4 s přes tunel + parsování v Pythonu). Node přitom od 29. 10. umí `limit: 0` → odpověď má
   **198 B** a nese hotový `total_amount`. Fix: objektové parametry `{"address":…, "limit":0}`,
   čtení `total_amount`, fallback na plný set (kompatibilita se starším nodem / v3 cestou).
   Pozor: parametry musí být **objekt**, ne `[{…}]` — node čte `params.get("address")` až pak `params.get(0)`.
2. **`_build_health_map()` probíral 18 TCP portů sériově** (0,3 s timeout každý) → 5–9 s, když bylo
   několik portů zavřených. Teď jeden paralelní průchod (`ThreadPoolExecutor(12)`) — sémantika stejná.

| Endpoint | Před | Po |
|---|---:|---:|
| `build_status()` cold | 12,6–18,6 s | **4,8 s** |
| `_build_health_map()` | 8,7–12,3 s | **0,04–0,18 s** |
| `/api/health` (HTTP) | 8,7 s / 12,3 s cold | **0,18 s / 0,10 s** |
| `/api/services`, `/api/ops/overview`, `/api/status` | — | 0,18 s / 0,49 s / 0,003 s |

Zbylé ~4,8 s cold `build_status()` = 9 sekvenčních HTTP dotazů (0,28 s každý) + ~2 s subprocess.
Cachuje se, takže request path je rychlá; paralelizace těch 9 dotazů je další, menší optimalizace.

