# Deploy Provenance (8.B3)

> Jak poznat, co přesně kde běží. Vzniklo po incidentu 2026-10-26, kdy
> checkout na EDGE neodpovídal nasazené binárce (rsync overlay pod
> běžící službou) a provenance se odhadovala z mtime.

## Mechanismy

### 1. Build ID v binárce (`66d15bef4`, pool crate)

`V31/L1/pool/build.rs` embeduje `ZION_BUILD_ID` v tomto pořadí:
`ZION_GIT_SHA` env → `.git-archive-sha` (export-subst — čistý
`git archive` build nese commit i bez `.git`) → `git rev-parse` +
`-dirty` → `unknown`.

- `zion-pool --version` → `3.2.0 build <sha>`
- `GET /health` → `"build": "<sha>"`
- startup log

**Stav nasazení:** nasazený pool (sha `47b3136c`, build 28.10. 11:54)
je **pre-66d15bef4** → hlásí jen `zion-pool 3.2.0`. První příští build
+deploy ponese build id. Pattern je připravený k rozšíření na ostatní
produkční binárky (`zion-node`, `zion-miner`, `warpd`, `zion-dao`, …) —
zatím implementováno jen v `V31/L1/pool`.

### 2. Provenance collector — `scripts/ops/deploy-provenance.sh`

```bash
scripts/ops/deploy-provenance.sh            # EDGE + EDGE2, JSONL na stdout
scripts/ops/deploy-provenance.sh --edge-only
```

Pro každou produkční unit sbírá: `unit`, `state`, `exec`, `sha256`
(prvních 16), `mtime`, `version` (`--version` jen u binárek, které ho
umí — ostatní by spustily daemon), `since` (service start), plus repo
checkout sha a počet dirty souborů.

**Baseline:** `DEPLOY-PROVENANCE-2026-10-28.jsonl` (snapshot po deployi
api-snapshot fixů) · `DEPLOY-PROVENANCE-2026-10-28-evening.jsonl` (po
payoutfix deployi — pool `1c159d7b73cf`, `--version` nyní hlásí
`build 6fae7b60` = embedded build ID end-to-end) ·
**`DEPLOY-PROVENANCE-2026-10-31.jsonl`** = **aktuální baseline pro RC**
(W1.1; pool `3e7a44ab` build `c7b9a42e1`, node `02e83286`, warpd
`faedbabd`). Spustit po každém deployi; diff proti baseline =
přesný audit trail co se změnilo.

## Zjištění z baseline 2026-10-28

| Host | Repo | Poznámka |
|---|---|---|
| EDGE | checkout `6fae7b60d`, 7 258 dirty | divergovaný checkout + rsync overlay + build artefakty — viz AGENTS.md |
| EDGE2 | **žádný checkout** — `/opt/zion/V31` = jen `target/` | Rust binárky se buildí na EDGE a rsyncují; provenance EDGE2 = provenance EDGE v okamžiku kopírování |

| Unit (EDGE) | sha256 | mtime | Unit (EDGE2) | sha256 | mtime |
|---|---|---|---|---|---|
| zion-v31-pool | `47b3136c` | 10-28 11:54 | zion-v31-node | `22cecc88` | 10-05 |
| zion-node ×2 | `22cecc88` | 10-05 | warpd | `bbc353c3` | 10-25 20:30 |
| zion-miner | `fcf4adf9` | 10-27 00:56 | zion-dao | `f68e8662` | 10-27 01:08 |
| fallback-miner | `9e925a3f` | 10-11 | ncl/free-world/issobella/oasis/ai-native | viz jsonl | 09-30…10-22 |

`zion-node` sdílí stejný sha `22cecc88` na EDGE i EDGE2 (postaveno na
EDGE, rsync).

## Baseline 2026-10-31 (W1.1 — aktuální pro RC)

| Host | Repo | Poznámka |
|---|---|---|
| EDGE | checkout **`c14f1e4d9`**, **8 628** dirty | dirty roste (7 258 → 8 628) — rsync overlaye + cizí paralelní práce; checkout se posunul, ale nesedí na `main` |
| EDGE2 | **stále žádný checkout** (`checkout:"none"`) | jediná cesta k provenance EDGE2 = sha256 zde + zaznamenaný `ZION_GIT_SHA` z buildu |

| Unit (EDGE) | sha256 | mtime | `--version` |
|---|---|---|---|
| zion-v31-pool | `3e7a44abd9b2b0b1` | 10-31 00:38 | `zion-pool 3.2.0 build c7b9a42e1` ✅ |
| zion-v31-node2 / node3 | `02e83286e369b856` | 10-29 21:25 | `zion-core 3.2.0` |
| zion-v31-miner | `fcf4adf98045ccdc` | 10-27 00:56 | `zion-miner 3.2.0` |
| zion-fallback-miner | `9e925a3fecb9d410` | 10-11 21:33 | — (collector nesondí) |

| Unit (EDGE2) | sha256 | mtime | `--version` |
|---|---|---|---|
| zion-v31-node | `02e83286e369b856` | 10-29 21:31 | `zion-core 3.2.0` |
| **zion-v31-multichain (warpd)** | **`faedbabda974c2c3`** | **10-31 10:35** | `warpd 3.2.0` ⚠️ **bez build id** |
| zion-v31-dao | `f68e86628887c6f0` | 10-27 01:08 | — |
| zion-v31-ncl | `a3f141338c3aaf97` | 10-21 08:57 | — |
| zion-v31-free-world | `70dae98d87b02d0d` | 09-30 07:45 | — |
| zion-v31-issobella | `342ef3580ccd7d09` | 10-22 06:18 | — |
| zion-v31-oasis | `a2a3ecaa0ca95897` | 10-22 06:18 | — |
| zion-v31-ai-native | `242d6ca16b45d93e` | 10-22 03:10 | — |

**Nový nález (W1.1, 31. 10.):** `warpd` dnes rebuildnut s
`ZION_GIT_SHA=ac22f4261`, ale **`--version` hlásí jen `warpd 3.2.0`** —
`V31/L2/multichain` nemá `build.rs`, takže `ZION_BUILD_ID` se
neembeduje. Σ poznámka z 29. 10. („embeduje jen `zion-pool`") byla
nepřesná: `build.rs` dnes mají pool, node, cli, miner — **ne**
multichain, dao, nirvana. Pro RC audit = mezera, viz krok 4 níže.

**Zbývající mezery pro RC audit package:** `zion-v31-dao`, `-ncl`,
`-free-world`, `-issobella`, `-oasis`, `-ai-native` — provenance jen
sha256+mtime (žádné `--version`, žádný build id). To je akceptovatelné
pro W1.5 **jen** pokud audit package pinuje sha256 manifest jako
důkaz, ne commit.


## Doporučené kroky (postupně)

1. ~~Embed build id do pool~~ ✅ `66d15bef4` — **live od 31. 10.** (pool hlásí `build c7b9a42e1`).
2. Zreplikovat `build.rs` pattern na `warpd` (**nově prioritní** — 31. 10. build bez id), `zion-dao`, `zion-ncl` (crate-by-crate, stejný resolution order).
3. Deploy runbook: po každém rsync/binární výměně spustit collector a
   commitnout nový `DEPLOY-PROVENANCE-<date>.jsonl`.
4. EDGE dirty checkout (7 258 → **8 628** souborů k 31. 10.) — rozhodnout 👤: zarovnat na
   main, nebo držet divergovanou větev s explicitním manifestem overlayů.
5. `--version` kontrakt pro daemon binárky, které dnes ignorují arg a
   startují (`zion-dao`, `zion-ncl`, `zion-free-world`, `zion-issobella`,
   `zion-oasis`, `zion-ai-native-api`) — collector je z bezpečnostních
   důvodů nesondí.
