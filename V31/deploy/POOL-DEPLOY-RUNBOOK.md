# Pool Deploy Runbook — zion-v31-pool (EDGE)

> Deploy procedura pro `zion-v31-pool` na EDGE (62.171.141.136, ssh alias `zion-new`).
> Vychází z provozních deployí 2026-10-26 (schema v6–v9, drain, dedup-queue, wedge RCA).
> Gate: **2.B2 canary accept-rate** — povinná část je §5.

## 0. Pravidla (z incidentů)

- **Build JEN na EDGE** — glibc EDGE 2.39 < local ~2.43; lokální binárka nenasaditelná.
- **Žádná synchronní I/O pod `pool.lock()`** — per-share SQLite write způsobil ~1 h `/stats` wedge + SIGKILL (commit `1157fcfb3`). Persist přes queue/interval vlákno.
- **Working tree ≠ HEAD** — `/opt/zion/V31` obsahuje lokální diffy; binárka = working-tree build. Před syncem zjistit, jestli jiná session nesahá do týchž souborů (viz kolize 21:47 → "schema already at v7" místo v8).
- **SSH:** ControlMaster (`-o ControlMaster=auto -o ControlPersist=10m`), minimum handshakeů — fail2ban banuje IP při častém spojování.
- **SSH port:** `2222` (přes EDGE2 jumphost: `ssh -J zion-edge2 -p 2222 root@62.171.141.136`).

## 1. Pre-flight

```bash
ssh zion-new 'pgrep -f "cargo build|rustc.*zion_pool" | head -5'   # žádný cizí build
ssh zion-new 'systemctl is-active zion-v31-pool'                   # active
curl -s http://127.0.0.1:8080/stats | python3 -m json.tool | head  # baseline /stats
```

Zaznamenat **canary baseline**: accept-rate za posledních 15 min z `/miners`
(`accepted / (accepted + rejected)` agregátně) nebo z `reject_reasons` trendu.

## 2. Sync + build

```bash
# Jen změněné soubory (NE rsync celého src/ — může přepsat cizí WIP)
scp stratum.rs store.rs block_tracker.rs main.rs zion-new:/opt/zion/V31/L1/pool/src/
ssh zion-new 'sha256sum /opt/zion/V31/L1/pool/src/*.rs'  # porovnat s lokálními

ssh zion-new 'cd /opt/zion/V31 && systemd-run --uid=root --gid=root --wait --collect \
  --pipe -p WorkingDirectory=/opt/zion/V31 \
  -p Environment=PATH=/root/.cargo/bin:/usr/bin:/bin \
  bash -c "cargo build --release --locked -p zion-pool -j2 2>&1 | tail -3"'
# ~5–10 min; inkrementální ~4.5 min
```

Po buildu: `sha256sum target/release/zion-pool` — zaznamenat hash (provenance).

## 3. Backup (vždy před restartem)

```bash
ssh zion-new 'POOLPID=$(systemctl show -p MainPID --value zion-v31-pool) && \
  mkdir -p /root/pool-deploy-backup-$(date +%Y%m%d-%H%M) && cd $_ && \
  cp -a /proc/$POOLPID/exe ./zion-pool.running && \
  sqlite3 /opt/zion/data/v31/pool-store.db ".backup ./pool-store.db" && \
  cp -a /opt/zion/data/v31/pool-pplns.json . 2>/dev/null; ls -la'
```

Rollback = zkopírovat `zion-pool.running` přes `target/release/zion-pool` + restart (+ případně DB zpět).

## 4. Drain restart

```bash
ssh zion-new 'systemctl restart zion-v31-pool'
# Journal musí ukázat čistý drain:
ssh zion-new 'journalctl -u zion-v31-pool --since "-2 min" --no-pager | grep -iE "drain|schema|tracker|restored"'
```

Očekávané řádky: `drain: shutdown signal — refusing new sessions`, `tls/stratum: drain — listener stopped accepting`, `drain: final pplns flush persisted`, `drain: complete — exiting`, pak `share dedup restored`, `block tracker restored`, `schema migration` (pokud verze bump).

Pokud proces neexituje do ~35 s → SIGKILL je symptom wedge (viz 2.B3 RCA) — investigovat, ne jen restartovat dál.

## 5. CANARY GATE (2.B2) — povinné 15 min

Po restartu **15 minut** sledovat canary metriky; při porušení rollback (§3):

| Metrika | Práh | Zdroj |
|---|---|---|
| ZION accept-rate | **≥ baseline −5 procentních bodů** | `/miners` (accepted/(acc+rej)) — baseline z §1 |
| Sessions/miners reconnect | ≥ před-restart počet do ~2 min | `/stats` `sessions`, `/miners` |
| `/stats` latency | < 3 s trvale; OK=1 | `zion_pool_stats_api_*` (probe EDGE2) |
| Schema verze | očekávaná | `PRAGMA user_version` |
| Error rate v journalu | žádné opakované ERROR/panic | `journalctl -u zion-v31-pool` |

```bash
# canary check (opakovat v ~5/10/15 min):
ssh zion-new 'curl -s -m5 http://127.0.0.1:8080/miners | \
  python3 -c "import json,sys; ms=json.load(sys.stdin)[\"miners\"]; \
  a=sum(m.get(\"accepted_shares\",0) for m in ms); r=sum(m.get(\"invalid_shares\",0) for m in ms); \
  print(f\"accept={a} reject={r} rate={a/(a+r)*100:.1f}%\" if a+r else \"no shares yet\")"'
```

Pozn.: share počty se počítají od restartu — baseline srovnat s hodinovým oknem
(`reject_reasons` v `/miners` drží per-worker breakdown).

## 6. Verify (po gate)

```bash
curl -s -o /dev/null -w '%{http_code}' https://pool.zionterranova.com/     # 200 (public UI přes EDGE2)
ssh zion-new 'curl -s http://127.0.0.1:8080/health'                      # {"status":"ok"}
ssh zion-new 'curl -s http://127.0.0.1:8080/public/v1/blocks?limit=2 | head -c200'
sha256sum /proc/$(systemctl show -p MainPID --value zion-v31-pool)/exe   # = build hash
```

> **pool-ui webroot (2026-10-28 lekce):** `pool.zionterranova.com` resolvuje na **EDGE2** — veřejné UI se servíruje z **`/var/www/pool` na EDGE2**, ne na EDGE. EDGE `/var/www/pool` je mirror pro failover vhost (tam taky nasazovat pro paritu). Deploy = `dist/` tarball → oba huby, verify `md5sum` vs lokální dist + `curl … | grep <marker>`.

- Prometheus: `zion_pool_stats_api_ok=1`, alerty nefiringují.
- Dedup `restored=N` + counter flush (`SELECT * FROM pool_state`) po ~30 s.
- G8 probe netknutá.

## 7. Dokumentace

- `V31/AGENTS.md` / root `AGENTS.md` chronologie: commit, build hash, exe hash, důkazy (restore řádky, /stats latence, sessions).
- `docs/3.2/3.2.1-3.2.9_PLAN.md` status položky.
- Push commitů na `main` (ne zapomenout — provenance baseline 8.B3).

## 8. Payout ledger ops (schema v11+, od 28. 10.)

- **Treasury:** canonical payout wallet `zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6` — env `ZION_POOL_WALLET` + `ZION_POOL_WALLET_KEY` (+`ZION_POOL_PAYOUT_SK_HEX` pro standby) v `/etc/zion/edge-environment.sh` na EDGE **i** EDGE2. Bývalý `zion1n4k…` (klíč v `*.bak-canonical-payout-*`) drží ~6.8k ZION — případný sweep = 👤.
- **Under-fee guard:** batch, kde required fee > 10 % cap, se NEBroadcastuje — requeue a čeká na větší payout value (loguje `under_fee`). Zamezuje dead-tx vznik.
- **Resurrect sweep:** tx starší `ZION_PAYOUT_STUCK_AGE_SECS` (default 7 d) bez chain i UTXO evidence → `void_payout_rows` (řádek dostane `superseded_tx_id='voided:stuck'` = evidence, `total_paid` rollback) + requeue entry → nový submit. Externí coin chainy se neresurrectují.
- **Monitoring:** `journalctl -u zion-v31-pool | grep -E 'payout_resurrect|voided|under_fee'`; backlog = `SELECT COUNT(*) FROM payouts WHERE confirmed=0 AND superseded_tx_id=''`; gauge `zion_pool_payouts_unconfirmed*`.
- **Schema:** v11 přidává `payouts.superseded_tx_id` (migrace tolerantní i bez tabulky — historické fixture db). v13 přidává `payouts.inclusion_height` — `height` = trvale reward height, `inclusion_height` = blok začlenění payout tx (dřív confirm přepisoval `height` → phantom dup páry, viz 2.S2 report). Legacy confirmed backfill = `inclusion_height=height` (původní reward height nenávratná). Exact-dup metrika nově klíčuje `inclusion_height`.
- **Lifecycle:** API `status` má 4 stavy — `queued|sent|confirmed|superseded` (voidnuté dead-tx řádky = evidence, UI šedá přeškrtnutá pilule „nahrazeno"). Deploy UI/API změny = příští pool build + pool-ui rsync.

## 9. Známé zákruty

- `pgrep -f 'cargo build.*zion-pool'` matchne i vlastní wait-loop bash — filtrovat `pgrep -f 'rustc.*main.rs'` nebo explicitní PID.
- SQLite `.backup` na cestu bez existujícího adresáře → prázdný soubor, ověřit `ls -la`.
- `/public/v1/overview` neexistuje — validní: `/coins`, `/history`, `/blocks`, `/payouts`, `/miner/{coin}/{wallet}`, `/api/v1/{auxpow,pplns}`.
- Paralelní sessions: před deployem ověřit `journalctl` stáří posledního restartu — cizí restart mezi syncem a buildem ⇒ re-verify hash zdrojů.
