# POST-MORTEM — „rsync pod běžící službou" (P0-1 + P0-2, 2026-10-21)

**Audit item:** 8.B2 · **Incident window:** 2026-10-21 ~14:00 CEST → detekce/fix 2026-10-26 12:49–12:51 UTC (~5 dní)
**Severity:** P0 — produkční data path stála, veřejné API servírovalo zamrzlá data.

## Co se stalo

Během migrace/datového přesunu 21. 10. proběhl rsync nahrazení datových souborů **pod běžícími
službami**, bez stop → sync → start cyklu a bez write-path verifikace:

### P0-1 — L5 Free World scanner (EDGE2, `zion-v31-free-world`)

- `free_world.db` byl přepsán rsyncem → proces držel **smazaný inode** → SQLite `attempt to
  write a readonly database` na každém bloku.
- API `/api/v1/fund/balance` servírovalo zamrzlá data (`last_block_height 90 334` po 5 dní).
- `systemctl is-active` hlásilo `active` celou dobu — **stav služby ≠ zápisová cesta**.
- **Detekce:** až manuální audit 26. 10. (žádný lag alert tehdy neexistoval — viz 6.B2).
- **Fix:** dump smazaného inode → `free_world.db.recovery-20261026` (obsah identický, 0 ztráta),
  restart → catch-up **6 732 bloků na tip 97 064 za ~75 s**, žádné write errory.

### P0-2 — db-sync → PostgreSQL (EDGE2)

- Stejné okno: `.env` desync → `PrismaClientInitializationError: Authentication failed`
  ~240 err/h, `MiningWorker.lastShareAt` se nezapisoval.
- **Fix:** heslo role `zion` sjednoceno s funkčním z MarketPlace env (`.env.bak-dbfix-20261026`),
  0 chyb od restartu.

## Root cause

| Vrstva | Selhání |
|---|---|
| Procedura | rsync datových souborů pod běžící službou — žádný stop→sync→start |
| Verifikace | post-deploy check kontroloval `is-active`, ne **write path** |
| Monitoring | žádný `scanner lag` / freshness alert → 5 dní bez detekce |

## Co už je vyřešeno

- P0-1 ✅ 26. 10. (catch-up ověřen, `zion_free_world_blocks_scanned=6732`)
- P0-2 ✅ 26. 10. (credentials sjednoceny, fresh writes)
- 6.B1 scanner stall fix ✅ · 6.B2 lag monitoring ✅ (`zion_scanner_lag_blocks` + `ZionScannerLag`
  alert >30 bloků / 15 min — live ověřeno 31. 10., lag=6)
- Runbook rule `stop → sync → start → write-path test` přidáno do `infra/RUNBOOK.md` §deploy

## Preventivní pravidlo (nyní v runbooku)

1. **Nikdy** nersyncovat `.db`/`.env`/ledger soubory pod běžící službou.
2. Pořadí: `stop → sync → start → write-path test` (metrika/pole roste, fresh DB write,
   share accepted v journalu — ne jen `is-active`).
3. `lsof +D <datadir> | grep deleted` po každém datovém deployi = 0 výstupů.
4. Každá služba se zápisovou cestou má freshness metriku + lag alert (6.B2 vzor).

## Lekce

`systemd` aktivita dokazuje jen že proces žije — ne že zapisuje. Jediný spolehlivý health
signál pro datové služby je **pozorovatelný posun jejich výstupu** (block height, timestamp
posledního zápisu, counter). Alert na lag/freshness je povinný doplněk, ne nice-to-have.
