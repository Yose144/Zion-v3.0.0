# Provenance manifest — produkční binárky (2026-10-26)

> Baseline pro 8.B3 / B-EXIT-3. Metoda: `sha256sum /proc/<MainPID>/exe` — hash **běžícího** inode, ne souboru na disku (lekce P0-1: proces může držet jiný inode). Mapování na commit je **best-effort odhad** podle build mtime → nejbližší commit v `git log --until`; binárky NEMAJÍ vložený git sha a build stromy na EDGE/EDGE2 nejsou čisté checkouty (viz mezery).

## EDGE2 (`207.180.217.100`) — primary + app stack

| Služba | Binárka (`/proc/PID/exe`) | sha256 (16) | Build mtime | Nejbližší commit ≤ build |
|---|---|---|---|---|
| zion-v31-node | `/opt/zion/V31/target/release/zion-node` | `22cecc8828f5e342` | 2026-10-05 16:41 | `c8cdf8561` docs(3.2): remediation deploy record |
| zion-v31-free-world | `…/zion-free-world` | `70dae98d87b02d0d` | 2026-09-30 07:45 | `a741ee5ae` feat(oasis-web): G1 dual GPU backend |
| zion-v31-issobella | `…/zion-issobella` | `342ef3580ccd7d09` | 2026-10-22 06:18 | `20ed28abe` docs(vast): inference kapacita runbook |
| zion-v31-oasis | `…/zion-oasis` | `a2a3ecaa0ca95897` | 2026-10-22 06:18 | `20ed28abe` (stejný build batch jako issobella) |
| zion-v31-dao | `…/zion-dao` | `38e1481513ca6c4f` | 2026-09-25 17:28 | `bed100a91` fix(pool): VRSC upstream failover |
| zion-v31-ncl | `…/zion-ncl` | `a3f141338c3aaf97` | 2026-10-21 08:57 | `edb7ddbaf` N0: G8 stall RCA fixes |
| zion-v31-multichain | `…/warpd` | `bbc353c32bdf3820` | 2026-10-25 20:30 | `6c8165d4a` docs(audit): pin recheck evidence — **= audit deploy z 25. 10.** ✅ |
| zion-v31-ai-native | `…/zion-ai-native-api` | `242d6ca16b45d93e` | 2026-10-22 03:10 | `1b6fdfc54` fix: vastctl probe |
| zion-bitcoind | `/opt/zion/bitcoin/bin/bitcoind` | `986e63b3c8770f08` | 2026-07-06 15:09 | vendor binárka (mimo repo) |
| zion-db-sync | `/opt/zion/shared/db-sync.ts` (tsx) | `a181a07b73b3776d` | 2026-09-28 11:45 | script provenance — porovnat s `shared/db-sync.ts` v repu |

## EDGE (`62.171.141.136`) — ops + pool + followeři

| Služba | Binárka | sha256 (16) | Build mtime | Nejbližší commit ≤ build |
|---|---|---|---|---|
| zion-v31-pool | `/opt/zion/V31/target/release/zion-pool` | `d988bcad90898758` | **2026-10-26 15:16** | `1e992a9cf` feat(pool): A1.5 — working-tree build (viz mezery) |
| zion-v31-miner | `…/zion-miner` | `9e925a3fecb9d410` | 2026-10-11 21:32 | `b722b534b` feat(app): found blocks + CPU stream |
| zion-v31-node2 / node3 | `…/zion-node` | `22cecc8828f5e342` | 2026-10-05 16:41 | `c8cdf8561` — **identický hash jako EDGE2** = jeden artefakt distribuovaný na oba boxy ✅ |
| zion-fallback-miner | `/opt/zion/bin/zion-fallback-miner` | `9e925a3fecb9d410` | 2026-10-11 21:33 | `b722b534b` — identický hash jako zion-miner |

## Pozitivní nálezy

- `zion-node` (primary + oba followeři) sdílí jeden hash — jeden ověřitelný artefakt.
- `warpd` hash odpovídá audit deploy záznamu z 25. 10. (waves 1–7 fail-closed) — konzistentní s `AUDIT-REPORT` deploy recordem.
- `zion-miner` a `zion-fallback-miner` jsou jeden artefakt — kopie, ne build drift.

## Mezery provenance (otevřené pro RC)

1. **Žádný embedded git sha** — `--version` hlásí jen `zion-core 3.2.0`. Mapování výše je odhad podle času, ne důkaz. Fix: build.rs `cargo:rustc-env=GIT_COMMIT` + `--version --verbose`. (8.B3 residual)
2. **EDGE `/opt/zion/V31` working tree ≠ HEAD** — pool `d988bcad…` je working-tree build; obsahuje `1e992a9cf` + lokální diffy (per AGENTS.md ~8k řádků). Sticky-confirmed fix z repa (`record_block` CASE) v něm **není** — deploy pending.
3. **EDGE2 `/opt/zion/V31` není git checkout** — nelze ověřit zdroj; binárky jsou rsync artefakty bez manifestu.
4. **db-sync je tsx script** — provenance = hash souboru; porovnat `a181a07b…` s repo kopií při RC.
5. **bitcoind/quantus/pearl = vendor binárky** — zaznamenat verze vendorů, ne repo commity.

## Doporučení pro RC (8.S2)

- Regenerovat tento manifest **na RC commitu** po čistém `git archive` buildu — pak tabulka commit↔hash přejde z odhadu na důkaz.
- Přidat build.rs git-sha embedding do `zion-node`, `zion-pool`, `warpd`, `zion-miner` (priority pořadí).
- Manifest generovat skriptem: `for u in $(systemctl list-units 'zion-*' --no-legend | awk '{print $1}'); do …` — reusable v `infra/ops/`.
