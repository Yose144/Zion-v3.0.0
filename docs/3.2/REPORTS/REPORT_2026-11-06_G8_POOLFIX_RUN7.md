# G8 fix — pool API admission + freshest-tip probe + run #7 (2026-11-06)

**Rozsah:** root-cause fix dvou zdrojů G8 incidentů ze run #6 (12 incidentů,
1 560 s downtime) + restart evidence runu. Nasazeno na EDGE/EDGE2.

## Změny

### `V31/L1/pool/src/api.rs` (build `d786449b0-g8fix`)

- **Path-aware admission:** starý jediný strop `API_MAX_IN_FLIGHT=64` shedoval
  VŠE (i `/health`/`/stats`) → watchdog viděl 503 na `/stats` a restartoval
  zdravý pool (`pool_api_shed_load`, incident 5. 11.). Teď:
  - `API_MAX_EXPENSIVE_IN_FLIGHT=64` — jen cesty, které blokují
    pool/PPLNS/SQLite locky, palí CPU nebo streamují state exporty
    (`is_expensive_api_path()` — whitelist cheap: `/health`, `/metrics`,
    `/stats`, `/`, `/pool`, `/public/v1/coins`, `/public/v1/pplns`).
  - `API_MAX_TOTAL_IN_FLIGHT=256` — absolutní strop handler threadů
    (connect-and-stall flood backstop).
- **Cached API/admin klíče:** `PoolApi` si klíče zkopíruje v `new()` —
  auth check `/api`+`/admin` už nesa hádá pool mutex.
- **`SnapshotEntry { body, refreshed_unix }`:** snapshot sloty nesou timestamp
  posledního úspěšného build Nailsledne úspěchu build (panic = staré body i
  starý timestamp). `/stats`, `/`, `/pool` vracejí **503 `stats snapshot
  stale`** když snapshot zestárne přes `snapshot_stale_limit_s`
  (default 90 s, `ZION_POOL_API_SNAPSHOT_STALE_S`, min 10 s) — wedge signál
  pro watchdog zůstává poctivý i když saturace levných cest už 503 nedává.
  `/health` nově hlásí `snapshot_age_s`.
- **DB export cooldown:** `/api/v1/state/db` (`VACUUM INTO`) má minimální
  interval `DB_EXPORT_MIN_INTERVAL_S=120` s — časové razítko se ukládá PŘED
  vacuumem, takže souběžné exporty se hned shedují místo stackování za
  SQLite mutexem (jediný klient = hourly standby sync).

### `scripts/ops/g8_probe_exporter.py`

- **Freshest-tip tip source:** `chain_live` bere tip node s **nejvyšším
  `tip_timestamp`** (port order jen tiebreak) — dříve primární node tahal
  primu i když follower hlásil čerstvější tip; stale primary nemůže maskovat
  živý řetězec. Nasazeno na EDGE (kanonický, krmí Prometheus→G8) i EDGE2
  (sekundární).
- EDGE2 unit: `G8_NODE_RPC_PORTS=9445` → `9445,9446,9447` (všechny tři porty
  tunelované na localhost, ověřeno `getStatus` — quorum 3).
- Součástí deploye je i dříve necommitnutý **confirm-retry** (`c6d298eaf`)
  — EDGE2 exporter byl starý (7f210c7dd), EDGE už retry měl.

### Tunely — bez změny

`zion-edge-tunnel` (EDGE2→EDGE) a `zion-chain-tunnel` (EDGE→EDGE2) už měly
`ServerAliveInterval=15`, `ServerAliveCountMax=3`, `Restart=always/5s` —
ověřeno, netřeba sahat.

## Nasazení

- **Zdroj:** `git archive d786449b0 V31` (přesná provenance deploynutého
  binárky — EDGE repo je shallow a `d786449b0` nemá; HEAD repo se mezitím
  posunul na `caf29d7`, ale `api.rs` je v `d786449b0..HEAD` beze změny).
- **Build:** EDGE `/root/build/pool-g8fix`, `CARGO_TARGET_DIR=/opt/zion/V31/target`,
  `ZION_GIT_SHA=d786449b0-g8fix`, `-j4`, fat LTO → 13 min.
- **Binary:** `/opt/zion/V31/target/release/zion-pool`,
  `zion-pool 3.2.0 build d786449b0-g8fix`, sha256 `2ba0d17a…`.
  Záloha `zion-pool.bak-pre-g8admission-20261106-150828`.
- **Testy:** `cargo check -p zion-pool` clean; `cargo test -p zion-pool --lib`
  435/437 — 2 failure jsou **pre-existing** (`pearl_stratum_end_to_end`
  timeout padá i na čistém HEAD, `disconnect_keeps_job` flaky pod zátěží,
  v izolaci OK). Nový test `snapshot_staleness_tracks_refresh_age` PASS.

## Ověření po restartu

- `/health` → `build:"d786449b0-g8fix"`, `snapshot_age_s` roste s refreshí.
- `/stats` 200 (~60 ms), `ok:true`, sessions 3, shares `accepted=true`.
- Stratum 8444/8445(TLS)/8446 solo naslouchá; `pool.zionterranova.com/public/v1/coins` 200.
- **0 `shed_load`** za 20+ min provozu.
- G8 probe (EDGE): 8/8 services=1, `node_quorum=3`, `chain_live=1`,
  tip age ~43 s.

## G8 run #6 → #7

- #6 `g8-20261029T234617Z`: `stop` → `status=stopped`,
  `gate_status=evidence_incomplete` (`stopped_before_window_end`),
  uptime 99.7629 %. Archiv `g8_run.g8-20261029T234617Z.json` (ne smazán).
- #7 `g8-20261106T145125Z`: `start --started-by devin-g8fix-d786449b0-g8fix`,
  target end **2026-12-06T14:51:25Z**,Evidence timerOK
  (11/11 samples good, coverage 100 %).
- **Past:** `start`/`stop` spuštěné jako root přepsaly `g8_run.json` na
  `root:root 600` → `zion-g8-evidence.service` (User=zion) state nečetl a
  update tiše returnovalo. Opraveno `chown zion:zion` + ověření automatického
  update cyklu. **Pro příště: g8 příkazy spouštět `sudo -u zion`.**

## Zbývající rizika / poznámky

- EDGE sshd/fail2ban opět zabanil moji IP na ~15 min (recurring, 3. výskyt) —
  commands batchovat, zvážit prodloužení `ignoreip` o ops IP.
- `pearl_stratum_end_to_end` test je rozbitý na HEAD (pre-existing, mimo scope).
- Run #7 je fresh 30denní evidence — výsledek uvidíme ~6. 12. 2026.
