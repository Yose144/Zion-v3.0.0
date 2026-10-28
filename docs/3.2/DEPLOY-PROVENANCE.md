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
api-snapshot fixů). Spustit po každém deployi; diff proti baseline =
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

## Doporučené kroky (postupně)

1. ~~Embed build id do pool~~ ✅ `66d15bef4` — čeká na příští rebuild.
2. Zreplikovat `build.rs` pattern na `zion-node`, `zion-miner`, `warpd`,
   `zion-dao`, `zion-ncl` (crate-by-crate, stejný resolution order).
3. Deploy runbook: po každém rsync/binární výměně spustit collector a
   commitnout nový `DEPLOY-PROVENANCE-<date>.jsonl`.
4. EDGE dirty checkout (7 258 souborů) — rozhodnout 👤: zarovnat na
   main, nebo držet divergovanou větev s explicitním manifestem overlayů.
5. `--version` kontrakt pro daemon binárky, které dnes ignorují arg a
   startují (`zion-dao`, `zion-ncl`, `zion-free-world`, `zion-issobella`,
   `zion-oasis`, `zion-ai-native-api`) — collector je z bezpečnostních
   důvodů nesondí.
