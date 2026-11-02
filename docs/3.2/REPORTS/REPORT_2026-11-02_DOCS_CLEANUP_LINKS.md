# REPORT 2026-11-02 — ÚKLID ROOT DOKUMENTACE: OPRAVA ODKAZŮ + SYNC EDGE1

> **Co to je:** dokončení úklidu root dokumentace. Při přesunu 21 plánovacích `.md`
> z rootu do `docs/3.3/` (commit `ee1503423`) zůstaly odkazy na starých cestách.
> Tenhle report dokumentuje, co bylo rozbité, co se opravilo, jak se to ověřilo
> a co zůstalo na serverech.
>
> **Výchozí stav:** přesun hotový, ale `docs/3.3` mělo 106 rozbitých odkazů,
> root dokumenty dalších 9, `docs/3.2` 34 a `canon/` 78. Na EDGE1 dokumentace
> zastaralá ~3 měsíce a `docs/3.3` tam neexistovalo vůbec.

---

## 1. Co přesun rozbil (a proč)

Tři různé příčiny, snadno zaměnitelné:

| # | Příčina | Příklad | Kde |
|---|---|---|---|
| A | **Cíl se přesunul** — odkaz zůstal na staré cestě | `](NIRVANA-V3.3-MAP.md)` v rootu | `AGENTS.md`, `README.md`, `ROADMAP.md`, `docs/3.2`, `canon/books` |
| B | **Zdroj se přesunul** — soubor si nechal cesty psané od rootu | `](docs/3.2/StatusV3.md)` uvnitř `docs/3.3/` | 11 souborů v `docs/3.3` |
| C | **Opačný extrém** — `../../` tam, kde mělo být `./` | `](../../NIRVANA-V3.3-KAPITOLA.md)` v `ENGINE-SRDCE.md` | `docs/3.3/ENGINE-SRDCE.md` |

Případ B je nejzrádnější: soubor se přesunul o dvě úrovně hloub, ale odkazy
vypadají pořád „správně", protože v rootu fungovaly.

## 2. Co bylo opraveno

**Celkem 256 rozbitých odkazů → 0** v živém stromu.

| Oblast | Před | Po | Poznámka |
|---|---:|---:|---|
| `docs/3.3/` | 106 | 0 | prefix `../../`, `ENGINE-SRDCE` naopak `./` |
| `canon/` | 78 | 0 | knihy, L2/L6; `public/` → `archive/PUBLIC/` |
| `docs/3.2/` | 34 | 0 | `StatusV3`, `3.2.1-3.2.9_PLAN`, `REPORTS/`, `ops/` |
| `V31/` | 17 | 0 | `STATUS.md`, issobella (`L6data/` → `canon/l6/`) |
| root `.md` | 10 | 0 | `AGENTS`, `README`, `ROADMAP` → `docs/3.3/…` |
| `docs/ops/` | 5 | 0 | `HiranV2.1` → `archive/HiranV2.1` |
| `docs/WP-Mainet/`, `docs/plans/` | 4 | 0 | |
| `docs/mainnet/`, `docs/oasis/` | 19 | 0 | cesty psané od rootu |
| `infra/`, `ZION_OS/`, `scripts/` | 4 | 0 | |

Dva commity:

- **`df14aa145`** — 59 souborů, `+289 / −207`, 201 unikátních cílů (hlavní dávka)
- **`4b6cb514d`** — 7 souborů (dočištění `V31/L6/issobella`, `docs/oasis`,
  `docs/mainnet`, `scripts/finetune`) + nový link-checker

## 3. Nové a aktualizované dokumenty

| Soubor | Co přibylo |
|---|---|
| `docs/3.3/README.md` | **nový rozcestník** všech 24 dokumentů v5 sekcích (plánování / render / Hiran / ops / handoffy), pravidlo „kam co patří" a návod, jak při dalším přesunu nerozbít odkazy |
| `REPO-MAP.md` | doplněn `docs/3.3/` (24 souborů), počty re-měřeny (`docs` = 3122 tracked), hlavička na 2026-11-02 |
| `scripts/ops/check-doc-links.py` | **nový nástroj** — najde rozbité relativní odkazy v markdownu; výchozí rozsah = živý strom, `--all` = i archiv; exit 1 při nálezu (vhodné do CI) |
| `AGENTS.md` | oprava textu „v1.1 **v rootu**" → „v `docs/3.3/` (do 2. 11. v rootu)" |

### Jak používat link-checker

```bash
python3 scripts/ops/check-doc-links.py            # živý strom — musí být 0
python3 scripts/ops/check-doc-links.py --all      # i archiv (~2600 historických)
python3 scripts/ops/check-doc-links.py --quiet    # jen souhrn + exit kód
```

Po každém přesunu dokumentu ho pusť. Chytí přesně případ B výše.

## 4. EDGE1 — dokumentace byla zastaralá ~3 měsíce

EDGE1 (`/opt/zion`, git checkout) neměl jen díru po přesunu. `docs/` tam byl
částečný a starý:

| | před | po |
|---|---:|---:|
| `docs/3.3/` | **0** | 25 |
| `docs/3.2/` (položek) | 27 | 124 |
| `docs/3.2/REPORTS/` | 7 | 111 |
| `docs/` celkem `.md` | — | 2915 |
| `docs/3.2/StatusV3.md` | **chyběl úplně** | 121 KB (aktuální) |
| `docs/3.2/3.2.1-3.2.9_PLAN.md` | 12 KB (srpen) | 61 KB |
| `AGENTS.md` | 198 KB | 278 KB |
| `PLAN.md`, `REPO-MAP.md` | neexistovaly | ✅ |

**Postup:** `tar czf` záloha → `tar | ssh` (jeden spoj, kvůli fail2ban) → extract.

**Záloha:** `/opt/zion/backups/docs-sync-20261102T104129Z/docs-pre.tar.gz` (27 MB).

**Ověření parity** (md5 všech 3123 souborů proti serveru):

- chybí na EDGE1: **0**
- obsahově rozdílné: **0**
- `docs/3.3/README.md`, `AGENTS.md`, `PLAN.md`, `REPO-MAP.md`, `README.md`,
  `ROADMAP.md` — bit po bitu shodné

**Služby po syncu** (dokumentace nic neovlivňuje, kontrolováno pro jistotu):

- EDGE1: `zion-v31-pool`, `node2`, `node3`, `miner`, `g8-probe`, `nirvana`,
  `nirvana-net` = **active**; pool `/health` → `{"status":"ok","uptime_s":40808}`
- EDGE2: `zion-v31-node`, `website`, `marketplace`, `zis`, `multichain`, `dao` = **active**
- disk beze změny: EDGE1 67 %, EDGE2 61 %

## 5. Co zůstalo (vědomě)

| Věc | Proč |
|---|---|
| **121 souborů navíc na EDGE1** | staré kopie knih v `docs/WP-Mainet/`, lokálně přesunuté do `canon/books/`. Duplikáty, neškodí; `rsync --delete` je destruktivní → čeká na rozhodnutí |
| **EDGE2 dokumentaci nemá** | je to web/app box, ne source checkout; runtime na dokumentaci nic nepotřebuje |
| **~2600 odkazů v `archive/`, `PUBLIC/`, `docs/docs2.9/`** | historické snapshoty, opravovat nemá smysl |
| **`/nirvana/cist`, `/maitreya/cist`** v `canon/books/SurtaSrdce/` | nejsou to soubory, ale routy webu; checker je správně ignoruje (absolutní cesta bez přípony) |

## 6. Ponaučení

1. **Přesun dokumentu = změna všech odkazů na něj.** `git mv` tiše rozbije
   odkazy; `git` to neumí odhalit, protože neparsuje markdown.
2. **Odkazy piš relativně k souboru, ne k rootu** — nebo si při každém přesunu
   vynásob hloubku. Případ B výše je přesně tenhle dluh.
3. **Po přesunu pusť `scripts/ops/check-doc-links.py`** — 2 s práce, odhalí obojí.
4. **Server nemá „skoro aktuální" dokumentaci.** EDGE1 měl 3 měsíce starý
   `StatusV3.md` a chybějící `PLAN.md`; kdo by se tam podle toho řídil, dělá
   rozhodnutí na zastaralých datech. Buď sync, nebo nic — ne půlka.
5. **`rsync`/`tar` přes jeden SSH spoj** — dávkové `ssh` na EDGE spouští
   fail2ban (viz `AGENTS.md` OPS PAST).

---

**Souvisí:** [`NIRVANA-V3.3-MAP.md`](../../3.3/NIRVANA-V3.3-MAP.md) ·
[`docs/3.3/README.md`](../../3.3/README.md) · [`REPO-MAP.md`](../../../REPO-MAP.md)
