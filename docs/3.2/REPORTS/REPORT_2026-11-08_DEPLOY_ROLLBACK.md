# Rollback pro každý produkční deploy (8.S3)

> **Datum:** 2026-11-08
> **Zadání:** 8.S3 — „každý produkční deploy má rollback skript a ověřenou zálohu (pool dnes
> nemá binární rollback — jen rebuild ze zálohovaných zdrojů)".
> **Režim:** nástroj + snapshoty běžících verzí (aditivní zápis do `/opt/zion/backups/services`).
> **Žádný restart, žádný deploy, žádná změna unit/env/DB.** `restore` na produkci neproběhl —
> jen dry-run.

## 1. Výchozí stav

| Povrch | Rollback před |
|---|---|
| Pool (`zion-v31-pool`) | **žádný** — jen rebuild ze zdrojů (desítky minut, závisí na commitu) |
| Node/pool followeři (EDGE1) | ad-hoc `/root/*backup*` složky, nejasné stáří |
| Rust služby na EDGE2 | ad-hoc `node-deploy-backup-*` u některých, ne u všech |
| Website / MarketPlace | `.next.bak-*` vznikaly ručně; **dnes na hostu žádná** |
| Ostatní (DAO, oasis, free-world, issobella, multichain, ZIS…) | nic systematického |

DoH požadavek „ověřená záloha" tedy nešel splnit u ničeho kromě náhodných ručních kopií.

## 2. Nástroj

`scripts/ops/service-snapshot.sh` — jeden soubor, tři+ jeden režim, běží přes SSH z repa:

| Režim | Co dělá |
|---|---|
| `snapshot` | uloží binárku / `.next` artefakt + unit + manifest do `/opt/zion/backups/services/<unit>/<UTC>/`, retence N (default 5, nejnovější se nikdy nemaže) |
| `list` | co je k dispozici (unit, čas, sha12, velikost, druh) |
| `verify` | **read-only**: běží ke každé běžící službě snapshot a sedí sha256? `MISSING`/`DRIFT`/`BROKEN` = exit 1 |
| `restore` | **dry-run default**, `--confirm` provede: safety snapshot → stop → výměna → start → `is-active`/`--health-url` → při neúspěchu automatický návrat safety snapshotu |

Druhý služeb: `binary` (jeden soubor), `tree` (adresář), `nextapp`
(`.next/standalone` + `.next/static` + `package.json`, protože u Nextu je „binárka" node).
Auto-detekce přeskočí interprety (`node`, `python3`, …), shell skripty a cizí software
(`bitcoind`, `quantus`, `pearl`, `llama`).

## 3. Co je teď skutečně pokryté

**14 binárek** — pool, node2, node3, miner, fallback-miner (EDGE1); node, dao, free-world,
issobella, ncl, oasis, ai-native, multichain (warpd), hiran-gateway (EDGE2).
U všech ověřeno, že **sha256 snapshotu == sha256 běžícího procesu** (`verify` → 14× OK).

**2 Next aplikace** — website (128 MB) a marketplace (133 MB) jako `nextapp` tarbally.

Disk: EDGE1 ~38 MB, EDGE2 ~350 MB (volno 59 G / 78 G).

## 4. Dvě chyby, které odhalil až self-test

Nástroj se nedá bezpečně otestovat na produkci (restore = stop/start), takže vznikl
`scripts/ops/test-service-snapshot.sh` s **fake `systemctl`** a fake binárkou. Prošel
snapshot → list → dry-run → restore → retence → **selhání health checku**.

Self-test chytil dvě reálné chyby, které by se na produkci projevily až v nejhorší chvíli:

1. **Kolize timestampu.** Dvě operace v jedné sekundě (safety snapshot + restore) sdílely
   adresář → safety snapshot **přepsal** snapshot, který se měl obnovit, a „rollback" vrátil
   rozbitou verzi. Řešeno suffixem `-1`, `-2`.
2. **Špatně určený safety snapshot.** Adresář se dopočítával přes `sort | tail -1`, ale
   `…Z/` vs `…Z-1/` řadí jinak (v `ls` je za názvem lomítko) → návratová větev by obnovila
   původní (chtěný) snapshot místo předchozího stavu. Nyní se bere adresář, který snapshot
   reálně vytvořil.

## 5. Postup, který se tím zavádí

```
1. snapshot --service <unit>        # před deployem
2. deploy
3. health check
4. verify                            # běžící == snapshot? (DRIFT = udělat snapshot nové verze)
5. restore --confirm                 # když nová verze neprojde
```

`verify` je read-only a vrací exit 1 → vhodné jako denní timer. **Timer jsem nezakládal**,
instalace systemd unitu je produkční změna a patří 👤.

## 6. Změny v repu

- `scripts/ops/service-snapshot.sh` — nový nástroj (snapshot / list / verify / restore)
- `scripts/ops/test-service-snapshot.sh` — self-test bez produkce (fake `systemctl`)
- `docs/3.2/ops/DEPLOY-ROLLBACK.md` — runbook + checklist + meze
- `docs/3.2/3.2.1-3.2.9_PLAN.md` — 8.S3 uzavřeno

## 7. Co zůstává

- **`zion-kingdom`, `zion-zis`, `zion-nirvana(-net)`, `zion-l1-watcher`** — app tree rollback
  jde stejnou cestou (`--kind nextapp --path …`), ale není nasazený; u ZIS to chce navíc
  DB migraci řešit zvlášť.
- **Denní `verify` timer** — návrh, ne instalace.
- **Restore drill** — nástroj je otestovaný proti fake systemctl; ostrý restore (např. DAO
  na EDGE2) by měl proběhnout v plánovaném okně, ne při incidentu.
