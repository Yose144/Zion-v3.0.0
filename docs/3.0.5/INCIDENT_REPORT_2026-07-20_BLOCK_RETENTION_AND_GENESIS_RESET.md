# Incident Report — Block Retention Bug + Genesis State Reset

> **Datum:** 2026-07-20
> **Autor:** Devin (automated agent session)
> **Server:** Edge `62.171.141.136` (Contabo VPS, IPv6 `2a02:c207:2342:5821::1`)
> **Genesis hash:** `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` (nezměněn)
> **Status:** RESOLVED — chain resetována od genesis, všechny služby běží, backup systém kompletně přebudován

---

## 1. Souhrn

Během auditu Edge serveru byla objevena kritická chyba v block retention logice. Bug způsoboval, že všechny uzly ořezávaly chain historii na posledních 1000 bloků i přes `ZION_BLOCK_RETENTION=0` v env. Následkem byly trvale ztraceny bloky 0–~10913. Po fixu binárky bylo rozhodnuto provést state reset od genesis, aby chain začala čistě s unlimited retention. Současně byl kompletně přebudován backup systém s off-site replikací.

---

## 2. Block Retention Bug

### 2.1 Root cause

Soubor: `V3/L1/core/src/bin/node.rs:179`

```rust
// BUG: > 0 guard přeskočil set_block_retention(0)
if config.block_retention > 0 {
    rt.set_block_retention(config.block_retention);
}
```

`ChainState` default je `DEFAULT_BLOCK_RETENTION=1000`. Když `config.block_retention=0` (unlimited), podmínka `> 0` byla false, takže `set_block_retention(0)` se nikdy nezavolala a default 1000 zůstal aktivní.

### 2.2 Fix

```rust
// FIX: vždy zavolat set_block_retention — 0 znamená unlimited
rt.set_block_retention(config.block_retention);
```

Odstraněn `> 0` guard — `rt.set_block_retention(config.block_retention)` se volá vždy.

### 2.3 Následek

- Bloky 0–~10913 trvale ztraceny (bug v kódu od genesisu)
- Všechny historické zálohy obsahovaly jen ~1000 pruned blocks
- Žádná DB s plnou historií neexistuje nikde
- Od fixu (height ~10914+) se všechny bloky uchovávají

### 2.4 Nasazení fixu

- Nová binárka buildnuta: `cargo build --release -p zion-core`
- Nasazena na Edge: `/opt/zion/V3/target/release/node`
- Nasazena na lokální backup: `target/release/node`
- Verifikováno v logách: `set_block_retention: retention=0` + `block_retention=unlimited` na všech 3 uzlech

---

## 3. Legacy `zion-node.service` deaktivace

Stará service `zion-node.service` běžela s binárkou `/usr/local/bin/zion-node` (build z Jul 15, bez retention fixu). Držela port 8333 a blokovala `zion-edge-node1.service`.

- Service file přesunut na `.DISABLED-legacy-2026-07-20`
- Drop-in `memory-limit.conf` také přesunut na `.DISABLED-legacy-2026-07-20`
- `zion-edge-node1.service` nyní běží korektně na portu 8333

---

## 4. fail2ban ignoreip aktualizace

Při spuštění lokálního backup node fail2ban vyhodnotil rychlé P2P connect/disconnect jako port scan a zabanoval IPv4.

`/etc/fail2ban/jail.d/zion-p2p.conf` ignoreip rozšířeno:
```
127.0.0.1/8 ::1 109.81.31.210 109.81.27.87 109.81.20.92 109.81.89.176 109.81.83.205
```

- `109.81.89.176` — lokální backup node IPv4
- `109.81.83.205` — Mac (Yose144)

---

## 5. Dashboard fixes

Soubor: `ZION_OS/dashboard/app.py`

- `atomic_swap` port opraven z `8888` na `8452` v `_edge_ports`
- `atomic-swap` a `dex` přidány do `SERVICE_REGISTRY_EDGE_PRIMARY`
- `web-next` port opraven z `3001` na `3000`
- `svc_names` v `get_edge_server_health()` aktualizováno na 16 korektních `zion-edge-*` jmen
- `dex` přidán do `SERVICE_WEIGHTS` (weight 4)
- `edge-backup` checklist: cesta pro backup lookup opravena (`/opt/zion/backups/{daily,weekly}/`)
- Výsledek: 81/81 API endpointů HTTP 200, checklist 14/14 OK, readiness 75%

---

## 6. Backup systém — kompletní přebudování

### 6.1 Audit L1-L6 (před přebudováním)

| Vrstva | Data | Zálohováno před? |
|--------|------|-------------------|
| L1 | `state`, `state-node2`, `peers.json`, `pplns-state.json`, `pplns-state-test.json` | částečně (chybělo peers.json, test state) |
| L2 | `bridge-mainnet.db`, `dao-mainnet.db`, `atomic-swap.db` (+WAL/SHM), `ziondex-router.db` | částečně (chyběly WAL/SHM) |
| L3 | `warp-mainnet.db`, `chains.toml` | částečně (chyběl chains.toml) |
| L4 | `oasis.db` + game state JSONs | částečně (chyběly game JSONs) |
| L5 | `free_world.db` | ano |
| L6 | `issobella.db` | ano |
| Ops | env files, systemd, nginx, fail2ban, Let's Encrypt | částečně (chyběl node2 env, nginx, fail2ban, LE) |
| App | `dashboard/state.json` (884K), `revenue_journal/*.jsonl` (3.6M) | **NE** |

### 6.2 `backup-edge.sh` — přepsán

Soubor: `ZION_OS/infra/scripts/backup-edge.sh`

Nově zálohuje:
- **L1:** `state`, `state-node2`, `peers.json`, `pplns-state.json`, `pplns-state-test.json`
- **L2-L6:** všechny `*.db` s `sqlite3 .backup` (konzistentní snapshot i s WAL), včetně `ziondex-router.db`
- **L4 OASIS:** game state JSONs (`golden_egg`, `avatars`, `world`, `prize_tiers`)
- **App:** `dashboard/state.json`, `revenue_journal/*.jsonl`
- **Config:** `edge-environment.sh`, `edge-node2-environment.sh`, `test-pool-environment.sh`, `xmr-pool-environment.sh`, `edge-env-no-auxpow.sh`, `/etc/zion/config/*.toml`, repo TOMLs včetně `chains.toml`
- **Systemd:** 28 service + timer souborů
- **nginx:** `sites-enabled/`, `nginx.conf`
- **fail2ban:** `jail.d/`, `jail.conf`
- **Let's Encrypt:** `live/` + `archive/` (včetně private keys)

Retence na Edge: 14 daily + 4 weekly. Timer: `zion-edge-backup.timer` (každé 4h).

### 6.3 Off-site rsync — nový script

Soubor: `ZION_OS/infra/scripts/sync-edge-backups.sh`

- rsync přes SSH IPv6 (reliable, není affected fail2ban IPv4 bany)
- Edge `/opt/zion/backups/{daily,weekly}/` → lokál `~/2.9.6-main/backups/edge/{daily,weekly}/`
- Retence lokál: 30 daily + 8 weekly (delší než Edge)
- Integrity check: `tar tzf` na nejnovější backup
- Systemd user timer: `zion-offsite-sync.timer` (každé 4h, offset :30)

### 6.4 Systemd user units

- `~/.config/systemd/user/zion-offsite-sync.service`
- `~/.config/systemd/user/zion-offsite-sync.timer` (every 4h: 00:30, 04:30, 08:30, 12:30, 16:30, 20:30)

---

## 7. Genesis State Reset

### 7.1 Rozhodnutí

Po fixu retention bugu bylo zjištěno, že existující chain (height 11914) má trvale ztraceny bloky 0–10913. Bylo rozhodnuto provést state reset od genesis pro čistý start s unlimited retention.

**Typ:** State reset (stejný genesis hash, klíče, premine adresy — pouze smazání DBs a restart od bloku 0).

### 7.2 Pre-reset verifikace

| Kontrola | Výsledek |
|----------|----------|
| 14 premine adres v `genesis.rs` vs `PUBLIC_ADDRESSES.txt` | ✅ shoda |
| 5 canonical adres (humanitarian, issobella, pool fee, miner, payout) | ✅ shoda |
| GPG podpis `genesis.md` | ✅ Good (Yose, `9018F94ACE7C93CF549612E225557B7072678D25`) |
| Genesis hash v kódu vs RPC vs dokumentace | ✅ `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` |
| PREMINE_01 balans | ✅ 1,650,000,000 ZION |
| DAO Treasury balans | ✅ 2,500,000,000 ZION |
| Bridge Vault balans | ✅ ~100,000,000 ZION |
| Klíče na ploše (`~/Desktop/ZionKeys/`) | ✅ přítomny, GPG verified |
| Pre-reset backup (2x off-site) | ✅ 21:56 + 22:17, integrity OK |

### 7.3 Provedení

1. **Stop L2/L3/L4-L6/pool/dashboard** na Edge (9 služeb)
2. **Stop node2, pak node1** na Edge
3. **Smazání DBs na Edge** (`/data/zion/`):
   - `state`, `state-node2`
   - `bridge-mainnet.db` (+WAL/SHM), `dao-mainnet.db` (+WAL/SHM), `atomic-swap.db` (+WAL/SHM)
   - `atomic-swap-mainnet.db`, `warp-mainnet.db`, `ziondex-router.db`
   - `oasis.db`, `free_world.db`, `issobella.db`
   - `peers.json`, `pplns-state.json`, `pplns-state-test.json`
4. **Smazání lokální backup node state** (`V3/data/zion-node-state.db`)
5. **Start node1** — vytvořil genesis blok 0 (height=0, tip_hash=genesis hash)
6. **Verifikace genesis** — height=0, 13 account TXs + 1 UTXO, premine balansy OK
7. **Start node2** — syncnul genesis z node1
8. **Start pool + L2/L3/L4-L6** (bridge, dao, atomic-swap, warp, dex, oasis)
9. **Start dashboard** (Rust + Python)
10. **Start lokální backup node** — P2P sync s Edge (node1:8333 + node2:8334)

### 7.4 Post-reset verifikace

```
EDGE NODE 1 (RPC 9443):
  height:          0
  accepted_blocks: 1
  tip_hash:        4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e
  protocol:        zion-v3-node/3.0.6

EDGE NODE 2 (RPC 8448):
  height:          0
  accepted_blocks: 1
  tip_hash:        4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e

PREMINE BALANCES:
  [OK] PREMINE_01 (OASIS 1):       1,650,000,000 ZION
  [OK] PREMINE_06 (DAO Treasury):  2,500,000,000 ZION
  [OK] PREMINE_09 (Core Dev):      1,000,000,000 ZION
  [OK] PREMINE_12 (Children):      1,440,000,000 ZION
  [OK] BRIDGE_VAULT:                 100,000,000 ZION

EDGE SLUŽBY: 11/11 running
  ✓ atomic-swap  ✓ bridge       ✓ dao
  ✓ dashboard    ✓ dex          ✓ node1
  ✓ node2        ✓ oasis        ✓ pool
  ✓ python-dashboard ✓ warp

LOKÁLNÍ BACKUP NODE: active (P2P sync s Edge)

PUBLIC RPC (rpc.zionterranova.com:8443):
  height: 0
  tip_hash: 4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e
```

---

## 8. Cleanup starých backupů

Po resetu byly smazány všechny pre-reset backupy (obsahovaly pruned chain data):

**EDGE (smazáno ~39M):**
- `/data/zion/*.bak*` — 2 staré DB backup soubory
- `/opt/zion/backups/daily/*.tar.gz` — 13 pre-reset backupů (13M)
- `/opt/zion/backups/weekly/*.tar.gz` — 1 pre-reset weekly
- `/root/zion-backups/` — celá stará lokace (26M)

**LOKÁL (smazáno ~13M):**
- `backups/backup_*.tar.gz` — 7 starých chain backupů
- `backups/backup_edge_*.tar.gz` — 5 starých edge backupů
- `backups/backup_local_*.tar.gz` — 7 starých local backupů
- `backups/edge/daily/*.tar.gz` — 12 pre-reset sync backupů
- `backups/edge/weekly/*.tar.gz` — pre-reset weekly
- `backups/auto/` — prázdná složka

**Fresh post-reset backup vytvořen a syncnut:**
- Edge: `zion-edge-20260720_223517.tar.gz` (552K, 79 souborů, genesis state height=0)
- Lokál: syncnuto via rsync, integrity OK

---

## 9. Změněné soubory

| Soubor | Změna |
|--------|-------|
| `V3/L1/core/src/bin/node.rs` | Block retention fix — odstraněn `> 0` guard (1 řádka) |
| `ZION_OS/dashboard/app.py` | Dashboard fixes — porty, service registry, backup checklist (37 insertions, 11 deletions) |
| `ZION_OS/infra/scripts/backup-edge.sh` | Kompletní přepsání — L1-L6 backup s sqlite3 .backup, WAL, OASIS, app state, nginx, fail2ban, LE |
| `ZION_OS/infra/scripts/sync-edge-backups.sh` | Nový script — off-site rsync Edge → lokál přes SSH IPv6 |
| `AGENTS.md` | Přidány incident notes (BLOCK RETENTION FIX + BACKUP SYSTEM OVERHAUL) |

---

## 10. Current state (2026-07-20 22:35)

- **Chain height:** 0 (fresh genesis, čeká na minování)
- **Genesis hash:** `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` (nezměněn)
- **Block retention:** unlimited (fix nasazen)
- **Edge služby:** 11/11 running
- **Lokální backup node:** active, P2P sync s Edge
- **Backup timer (Edge):** active, každé 4h
- **Off-site sync timer (lokál):** active, každé 4h
- **Off-site backup:** 1 daily (552K, genesis state), integrity verified
- **Public RPC:** `rpc.zionterranova.com:8443` odpovídá height=0

---

## 11. Lessons learned

1. **`> 0` guard na retention je past** — 0 je validní hodnota znamenající "unlimited", ne "disabled". Guard přeskočil nastavení a nechal default.
2. **Backup bez WAL je nekonzistentní** — `cp` na SQLite DB s WAL mode může produkovat poškozené snapshoty. `sqlite3 .backup` je jediný bezpečný způsob.
3. **Off-site backup není optional** — všechny pre-reset backupy byly na stejném serveru jako chain data. Kdyby server shořel, ztratili bychom vše.
4. **Watchdog restartuje node** — `Restart=always` na service znamená že kill procesu nestačí, musí se service `stop` + `disable`.
5. **fail2ban je agresivní** — P2P connect/disconnect pattern může být vyhodnocen jako port scan. `ignoreip` pro vlastní IP je nutnost.
