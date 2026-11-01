# REPORT — Zálohy: PostgreSQL na EDGE2 nebyl v žádné záloze (2026-11-01)

> **TL;DR:** denní archiv na EDGE vypadal zdravě (470 MB, `Result=success`, 22 záloh, retention OK),
> ale **ZIS a MarketPlace se po splitu přestěhovaly do PostgreSQL na EDGE2** — a ten se nebackupoval.
> V archivu byly jen **0bajtové zástupce** `zis.db` / `marketplace.db` zůstalé na EDGE.
> Dnes doplněno: `zion-pg-backup.timer` na EDGE2 (pg_dump `zion` + `zion_marketplace` + globals)
> a mirror do EDGE archivu. Restore ověřen do scratch DB (Artifact 463, Invoice 53, ShopOrder 52 řádků).

## 1. Jak se to našlo

Při kontrole „má EDGE2 vůbec zálohy?" (`systemctl list-timers | grep backup`) → na EDGE2 jen
`dpkg-db-backup.timer`. Zálohovací pipeline žije **jen na EDGE** (`zion-edge-backup.timer`, 4h kadence,
`/opt/zion/backups`, retention 42 daily + 4 weekly) a taruje **lokální cesty**.

Kontrola obsahu archivu `zion-edge-20261101_172914.tar.gz` (467 MB) ukázala sice `zis.db`,
`marketplace.db`, `oasis-v31.db`, `free_world.db`…, ale na EDGE:

```
0  /opt/zion/data/zis.db            (Sep 14)
0  /opt/zion/data/marketplace.db    (Aug 26)
0  /opt/zion/data/pool-store.db
```

Živá data jsou na EDGE2:

```
zion            PostgreSQL  30 MB   (ZIS identity — uživatelé, sessions, audit)
zion_marketplace PostgreSQL 9,4 MB  (objednávky, faktury, artefakty, listingy)
```

Oba `DATABASE_URL` v `/opt/zion/identity/.env` a `/opt/zion/APP&WEB/MarketPlace/.env` míří do PG.
Skript `backup-edge.sh` **neměl `pg_dump` ani jednu SSH/rsync větev** → 111 MB PG dat nebylo
v žádné záloze, zatímco dashboard záloh ukazoval zeleně. Klasická tichá díra.

## 2. Co je nasazené

**EDGE2 — `infra/scripts/backup-pg-edge2.sh` + `zion-pg-backup.{service,timer}`:**

- `pg_dumpall --globals-only` (role/hesla — bez toho restore neprojde),
- `pg_dump -Fc` pro `zion` a `zion_marketplace` (custom formát, sám komprimuje),
- **integrita:** každý dump projde `pg_restore --list`, jinak se zahodí a unit skončí `failed`,
- atomicky (`.tmp` → `mv`), retention 14 dní, běží jako `postgres`,
  sandbox: `ProtectSystem=strict` + `ReadWritePaths=/opt/zion/backups/pg`, `Nice=15`, `IOSchedulingClass=idle`,
- timer denně **03:20** s `RandomizedDelaySec=600`, `Persistent=true`.

**EDGE — `backup-edge.sh` nový krok 7b:**

- `rsync` z `root@207.180.217.100:/opt/zion/backups/pg/` (klíč `/etc/zion/keys/edge2-probe`, čitelný
  pro uživatele `zion`) do `daily/pg_<ts>/` a **do stejného tar.gz**, takže jeden archiv pořád nese
  celý obraz. Když mirror selže, zaloguje `⚠` a **pokračuje** (nezablokuje zálohu EDGE).
- Nové proměnné `ZION_EDGE2_HOST` / `ZION_EDGE2_SSH_KEY`.

## 3. Ověření

```text
[pg-backup] ✓ globals → globals-20261101T193206Z.sql
[pg-backup] ✓ zion → zion-20261101T193206Z.dump (2.5M)
[pg-backup] ✓ zion_marketplace → zion_marketplace-20261101T193206Z.dump (128K)
[pg-backup] dir=/opt/zion/backups/pg files=2 size=2.6M
[pg-backup] ✓ finished clean
```

- `systemctl start zion-pg-backup.service` → `Result=success`, `ExecMainStatus=0`.
- **Restore test:** `createdb zz_restore_test` → `pg_restore` dumpu → `pg_stat_user_tables`:
  `Artifact 463`, `Invoice 53`, `ShopOrder 52`, `ShopProduct 23`, `ShopSetting 19` → `dropdb`. Data jsou reálná.
- Timer: `zion-pg-backup.timer` → `enabled`, příští běh 2026-11-02 03:23 CET.
- EDGE backup end-to-end: `✓ PostgreSQL dumps mirrored (2.6M, 2 dumps)` a archiv
  `zion-edge-20261101_193324.tar.gz` (470 MB) obsahuje `pg_20261101_193324/{zion,zion_marketplace}.dump`,
  dočasný `pg_*` adresář se po taru uklidí.

## 4. Vedlejší nález — `/tmp` na EDGE nebyl world-writable

`stat /tmp` → `drwxr-xr-x UNKNOWN:root` (0755, vlastník uid 501). Cokoli, co si pod ne-root uživatelem
potřebuje vytvořit soubor v `/tmp`, selhalo (`mkdir: cannot create directory '/tmp/pgtest': Permission denied`
— narazil jsem na to při testu mirroru pod uživatelem `zion`). Opraveno na standardní `1777` (+sticky),
ověřeno zápisem pod `zion`.

## 5. Meze / co zůstává

- **Off-site:** PG dumpy jsou nyní ve stejném archivu jako zbytek = **stále jen na EDGE**.
  Skutečné off-site je `ZION_OS/infra/scripts/sync-edge-backups.sh` na operátorském stroji (rsync do
  `~/2.9.6-main/backups/edge/`), který PG dumpy dostane automaticky, protože jsou uvnitř taru.
- **Neřešeno (mimo rozsah):** `/opt/zion/bitcoin` (31 GB) a chain data se nezálohují — obnovitelné ze sítě,
  což je správně. `ncl/`, `oasis/` a `issobella` DB na EDGE jsou malé a v archivu jsou.
- **Doporučení:** přidat kontrolu „poslední PG dump není starší než 48 h" do write-path alertingu
  (stejný vzor jako `ZionPoolPayoutStale`), aby tichá díra nemohla vzniknout znovu.

## 6. Reprodukce

```bash
ssh zion-edge2 'systemctl start zion-pg-backup.service; journalctl -u zion-pg-backup -n 10 -o cat'
ssh zion-edge2 'ls -lah /opt/zion/backups/pg/'
ssh edge 'tar tzf $(ls -1t /opt/zion/backups/daily/*.tar.gz | head -1) | grep pg_'
```
