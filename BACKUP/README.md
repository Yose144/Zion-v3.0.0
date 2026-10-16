# BACKUP/

Snapshoty provozních databází držet i v repu — redundantní záloha vedle
`/opt/zion/backups` rotace na Edge a lokálního PC.

## edge-2026-10-16/

Snapshot z Edge (`/opt/zion/data`, `/opt/zion/multichain.db`,
`/opt/zion/btcunlock`) pořízený **2026-10-16 ~23:25 UTC** přes
`sqlite3 <db> ".backup …"` — konzistentní kopie i za běhu (WAL safe),
za chodu služeb, bez restartů.

Všechny soubory jsou `xz -T4 -3` komprimované. Obnova:

```bash
xz -dc pool-store.db.xz > pool-store.db
sha256sum -c ../SHA256SUMS.edge-2026-10-16.txt   # integrity před restore
```

Checksumy: `SHA256SUMS.edge-2026-10-16.txt` (o úroveň výš).

### Obsah

| Soubor | Zdroj na Edge | Popis | xz |
|---|---|---|---|
| `l1-node.db.xz` | `data/v31/node.db` | **V31 L1 chain DB** — kanonická replika (node.db/node2.db/node3.db jsou 3 totožné instance; zálohovaná 1×) | 92 MB |
| `pool-store.db.xz` | `data/v31/pool-store.db` | **Pool PPLNS stav** — shary, minery, payout fronty (kritická) | 14 MB |
| `warp_multichain.db.xz` | `data/warp_multichain.db` | Warp multichain stav | 11 MB |
| `warp-v31_multichain.db.xz` | `data/warp-v31_multichain.db` | | 1 KB |
| `bridge-mainnet.db.xz` | `data/bridge-mainnet.db` | Bridge coordinator stav | 2 KB |
| `btcunlock-coordinator-latest.db.xz` | `btcunlock/backups/coordinator-20261016T211930Z.db` | BTC-unlock work-unit distribuce (nejnovější z hodinové rotace) | 6 KB |
| `dao.db.xz`, `dao-v31.db.xz` | `data/` | DAO stav | ~2 KB |
| `warp.db.xz`, `warp-v31.db.xz` | `data/` | Warp | ~3 KB |
| `free_world.db.xz` | `data/` | L5 Free World | 4 KB |
| `issobella.db.xz` | `data/` | L6 Issobella | 1 KB |
| `oasis-v31.db.xz` | `data/` | L4 OASIS | 7 KB |
| `multichain.db.xz` | `/opt/zion/multichain.db` | L2 multichain | 1 KB |
| `zion-node-state.db.xz` | `data/zion-node-state.db` | JSON state (není sqlite — kopírovaný raw) | 2 KB |

### Ověření

- Secrets scan před commitem: žádné privátní klíče / mnemoniky / WIF
  (hity = schema `wif TEXT` s 0 řádky + false-positive hexy/adresy).
- `xz -t` OK všechny; `pool-store.db` → `PRAGMA quick_check` = ok.
- `l1-node.db.xz` 92 MB je pod GitHub 100MB limitem — nesplitovat.

## Co zálohováno NENÍ (schválně)

| Data | Proč |
|---|---|
| `/opt/zion/bitcoin` (31G), `/opt/quantus` (15G), `/opt/pearl/data` (11G) | Chain data — překročily by GitHub limit o řády; **resync-able ze sítě** |
| `node2.db`, `node3.db` (486M ×2) | Totožné repliky `node.db` — jeden snapshot stačí |
| `/etc/zion/*-environment.sh`, wallet seedy, RPC credentials | **NIKDY do repa** — zůstávají jen na Edge / offline záloha |
| prometheus, logs, target/ buildy | Dočasné/regenerovatelné |
| `Hiran/2.3/**/artifacts/` (5.8G model) | Rebuild-able z adapteru+base, mimo git |

## Konvence pro další snapshoty

- Nový adresář `edge-YYYY-MM-DD/` + `SHA256SUMS.<dir>.txt`, nemazat staré.
- Vždy `.backup` snapshot (ne `cp` živé DB — WAL by chyběl).
- Před commitem secrets-scan (`strings | grep -iE 'xprv|mnemonic|wif|…'`).
- Soubor >100MB → `split -b 95M` + návod v README; >10MB zvaž jestli vůbec patří do gitu.
