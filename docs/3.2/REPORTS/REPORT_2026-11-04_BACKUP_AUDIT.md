# REPORT — kontrola lokálního node + zálohy EDGE1/EDGE2 (2026-11-04)

> Zadání 👤: „udelej git pull a zkontrolujeme lokalni node a vsechny zalohy edge1,2".
> Prostředí: lokální stanice `zionserver-144` (reboot ~14:57), EDGE1 `62.171.141.136`,
> EDGE2 `207.180.217.100`. Vše ověřeno živě přes SSH/RPC, nic nedomyšleno.

## 1. `git pull`

Fast-forward `main` → `f9998ef37` (dávka commitů z 3.–4. 11. + aktualizovaný `AGENTS.md`:
QTC payout leg vypnutý, avataři na web2.9, audit app/web/edge).

## 2. Lokální node — restart-smyčka (OPRAVENO)

`zion-backup-node.service` = lokální V31 node (`RPC 127.0.0.1:8446`, P2P `0.0.0.0:8333`,
DB `V31/data/v31-backup-node.db`).

**Symptom:** node pořád začínal znovu a byl ~1 500 bloků za tipem.

**Příčina (měřená, nikoli odhad):** `scripts/watchdog.sh` → `check_sync` (mode=backup)
restartoval node při každém běhu, kdy `gap > 20` bloků — bez ohledu na to, jestli node
mezi kontrolami povyrostl. Bulk P2P sync jede ~0,5–1,4 bloku/s, takže uzavřít 1,5k gap
trvá 20–45 min souvisle; watchdog (timer 5 min) ho ale vždy zabil dřív:

```
15:13:44 watchdog: INFO: ... within 300s startup grace; skipping health checks
15:13:46 watchdog: RESTART: zion-backup-node — sync gap 1651 > 20 (edge=109464 local=107813)
```

**Fix** (`scripts/watchdog.sh`, commit `fa0af7edd`): výška se ukládá do
`${XDG_STATE_HOME:-$HOME/.local/state}/zion/backup-node-height`; restart proběhne jen když
se výška mezi dvěma kontrolami **nezměnila** (skutečně stojící node). První běh jen
zapíše baseline, aby se node hned nezabil.

**Ověřeno živě:**

```
run 1: INFO: sync gap 1343 (edge=109471 local=108128) — baseline recorded
run 2: INFO: catching up +86 blocks since last check (edge=109472 local=108214 gap=1258) — not restarting
```

Po ~20 min: `local 109497` vs `edge 109497` — node na tipu, žádný restart.

**Past pro příště:** `127.0.0.1:9445` na lokální stanici **není** lokální node, ale
`zion-ssh-tunnel` `-L` forward na EDGE1. Lokální node poslouchá na **8446**.

## 3. EDGE1 (`62.171.141.136`) — zálohy ✅

- 14 `zion-*` unitů active, **0 failed**, disk 70 %.
- Followeři `9446/9447` = 109 507 / 109 508 (= tip), pool + stratum běží.
- `zion-edge-backup.timer` (4 h): poslední běh 14:13, **41 daily + 4 weekly, 21 G**,
  retence 42/4. Archiv `zion-edge-20261104_141341.tar.gz` (494 M) — `gzip -t` OK,
  180 položek, obsahuje `node_state`, `v31_data`, `app_state`, `config`, `systemd`,
  `nginx`, `fail2ban`, `letsencrypt` **+ mirror PG dumpů z EDGE2** (14 M / 10 dumpů).

## 4. EDGE2 (`207.180.217.100`) — služby ✅, záloha configu chyběla (DOPLNĚNO)

- 24 unitů active, 0 failed, disk 59 %, primary chain 109 508, DR standby pool state
  sync každých 15 min (poslední 14:58 OK).
- `zion-pg-backup.timer` (denně 03:21): poslední dnes, `pg_restore --list` = 166 objektů.
- **Mezera:** PG dumpy byly jediná záloha EDGE2. Mimo ni zůstávalo `/etc/zion`
  (env, klíče, `*.toml`, 1,1 M), `/etc/nginx` (296 K), 65+ systemd unitů,
  `/opt/zion/data` (app SQLite/JSON) a `.env` Next aplikací — tedy vše, bez čeho
  primár nejde znovu zprovoznit.
- **Fix** (`ZION_OS/infra/scripts/backup-edge.sh`, nová sekce 7d, nasazeno na EDGE1):
  jeden `ssh + tar` stream z EDGE2 → `edge2_<ts>.tar.gz` uvnitř denního archivu
  (best-effort: při nedostupném EDGE2 se archiv vytvoří bez něj, nikdy neshodí běh).
  Záměrně **vyloučen chain** (`v31/node*.db*` ~1,7 G, standby kopie ~0,5 G) — followeři
  na EDGE1 chain drží a re-sync z peerů je levnější než +2 G v každém 4h archivu.
- **Ověřeno end-to-end** (manuální běh 15:54–15:59): `✓ EDGE2 config + app state (63M)`
  → archiv `zion-edge-20261104_155436.tar.gz` (557 M) obsahuje `edge2_*.tar.gz`
  (63 M, gzip OK, 498 položek: nginx 67, systemd 78, data 60, `.env` 17 včetně
  `MarketPlace/.env`, `identity/.env`, `shared/.env`).

## 5. Lokální (off-site) zálohy

- **Off-site sync EDGE1 → lokál byl rozbitý od bootu** (poslední úspěch 2. 11.).
  Příčina: EDGE1 má `2222/tcp LIMIT` (naše IP `109.81.25.90` není v allow listu) →
  více nových SSH spojení za sebou = reset. Dnešní běh spadl po 2,4 GB
  (`Connection reset by peer`, exit 255).
  **Fix** (`ZION_OS/infra/scripts/sync-edge-backups.sh`, commit `16bd53be2`):
  ControlMaster/ControlPersist (jedno spojení pro pre-flight + oba rsync) a nový
  `rsync_retry()` (4 pokusy, backoff, `--partial`). Dohnáno: **30 daily + 5 weekly,
  16 G**, poslední archiv (14:13) prošel `tar tzf` (180 souborů).
- **`zion-backup.service` (kompletní archiv na externí 2 TB disk) neběží** — disk
  `UUID=0868B18B68B17850` **není připojen** (`/mnt/data` prázdný, UUID není v `blkid`).
  Unit měl `StandardOutput=append:/mnt/data/...`, takže padal na `209/STDOUT`
  **dřív, než se skript spustil** (jeho vlastní mount guard se tak nikdy neprojevil).
  Fix: drop-in `~/.config/systemd/user/zion-backup.service.d/10-log-to-journal.conf`
  → log do journalu. **Bez připojeného disku záloha neproběhne** (čeká na 👤).
- Unity v nekonečné restart-smyčce (neopravováno, jen záznam): `zion-3d-nirvana`,
  `zion-3d-web` (chybí `/tmp/zion-3d*`), `vast-inference-tunnel` (vast rig už
  neexistuje), `zion-hiran-cuda` (OOM — GPU drží `zion-coder-cuda`).

## 6. Otevřené pro 👤

1. Připojit 2 TB archivní disk (`/mnt/data`) nebo přesměrovat `DEST` v `~/bin/zion-backup.sh`
   na interní disk (232 G volných).
2. Přidat `109.81.25.90` do UFW allow listu na EDGE1 (jinak platí `2222 LIMIT` a SSH
   dávkové operace padají na resetech; dnes to řeší retry + multiplex).
3. Rozhodnout osud rozbitých lokálních unitů (§5) — zastavit/opravit.
4. Volitelně: `ZION_BACKUP_INCLUDE_BINARIES=1` na EDGE1 (sekce 7e, +~2 GB) pro DR
   obnovu bez Rust toolchainu.

## Změny v repu

| Commit | Soubor | Co |
|---|---|---|
| `fa0af7edd` | `scripts/watchdog.sh` | nerestartovat backup node, který aktivně dohání tip |
| `16bd53be2` | `ZION_OS/infra/scripts/sync-edge-backups.sh` | SSH multiplexing + rsync retry |
| (tento) | `ZION_OS/infra/scripts/backup-edge.sh` | nová sekce 7d — EDGE2 config + app state |
