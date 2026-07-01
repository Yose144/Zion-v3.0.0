# Audit 3.0.3 + DeFi Run
zion1y0j484d5e8r49785d253e8w0c2x4t3n792m5724
Datum: 2026-06-29
Repo: ZION 2.9.6 (main)
Scope: root dokumentace, V3 configy, L1/L2 runtime mapovani, DeFi kontraktove adresy, recent git historie

## Executive Summary

Audit potvrdil, ze 3.0.3 decimal fix je v L1 runtime aktivni (RPC scale normalization + MIGRATION_HEIGHT=18850), ale existuje drift mezi casti dokumentace, casti klientu (mobile/desktop) a aktualnim produkcnim bridge stavem.

Nejvetsi riziko je address drift u bridge kontraktu mezi webem a dalsimi klienty.

## Findings (podle zavaznosti)

### P0-1: Bridge address drift napric klienty

- Problem: cast klientu stale ukazuje/stavi akce na stary bridge 0x895..., zatimco produkcni flow je uz na 0x72c8...
- Dukaz (stara adresa v klientu):
  - [APP&WEB/mobile-app/src/constants/config.js](APP&WEB/mobile-app/src/constants/config.js#L162)
  - [APP&WEB/desktop-agent/renderer.js](APP&WEB/desktop-agent/renderer.js#L3555)
  - [APP&WEB/desktop-agent/renderer.js](APP&WEB/desktop-agent/renderer.js#L3574)
  - [APP&WEB/desktop-agent/src/ui/index.html](APP&WEB/desktop-agent/src/ui/index.html#L3993)
  - [APP&WEB/desktop-agent/src/ui/index.html](APP&WEB/desktop-agent/src/ui/index.html#L3994)
- Dukaz (nova adresa v aktivnim web/L2 stacku):
  - [APP&WEB/website-v2.9/src/lib/bridge-api.ts](APP&WEB/website-v2.9/src/lib/bridge-api.ts#L44)
  - [V3/config/bridge-mainnet.toml](V3/config/bridge-mainnet.toml#L39)
  - [V3/L2/bridge/config/bridge-mainnet.toml](V3/L2/bridge/config/bridge-mainnet.toml#L40)
- Dopad: uzivatel v mobile/desktop muze jit na nekanonicky kontrakt nebo failnout write flow.
- Doporuceni: sjednotit vsechny klienty na 0x72c8... a doplnit jednotny centralni source-of-truth.

### P1-1: Root plan dokumentace drzi stare DeFi adresy jako aktivni

- Problem: canonical 3.0.3 plan stale uvadi stary bridge i stary WETH pool jako deployed/aktivni.
- Dukaz:
  - [ZION_3.0.3_DECIMAL_FORK_PLAN.md](ZION_3.0.3_DECIMAL_FORK_PLAN.md#L212)
  - [ZION_3.0.3_DECIMAL_FORK_PLAN.md](ZION_3.0.3_DECIMAL_FORK_PLAN.md#L215)
- Kontrast (aktualni canonical pooly v app stacku):
  - [APP&WEB/website-v2.9/src/lib/defi-contracts.ts](APP&WEB/website-v2.9/src/lib/defi-contracts.ts#L68)
  - [APP&WEB/website-v2.9/src/lib/defi-contracts.ts](APP&WEB/website-v2.9/src/lib/defi-contracts.ts#L69)
  - [APP&WEB/website-v2.9/src/lib/defi-contracts.ts](APP&WEB/website-v2.9/src/lib/defi-contracts.ts#L70)
- Dopad: ops/readme-driven run muze validovat spatny kontrakt.
- Doporuceni: prepsat 3b.1 v planu na aktualni bridge/pool mapping.

### P1-2: Drift status vs config u bridge start_block_height

- Problem: status tvrdi, ze start_block_height byl zvednut na 11700, ale oba mainnet TOML configy jsou stale 11300.
- Dukaz (status):
  - [StatusV3.md](StatusV3.md#L110)
  - [StatusV3.md](StatusV3.md#L134)
- Dukaz (config):
  - [V3/config/bridge-mainnet.toml](V3/config/bridge-mainnet.toml#L26)
  - [V3/L2/bridge/config/bridge-mainnet.toml](V3/L2/bridge/config/bridge-mainnet.toml#L27)
- Dopad: mozne znovuzpracovani historickych locku pri cold startu.
- Doporuceni: sjednotit dokumentaci a config na skutecne provozni cislo.

### P2-1: Mainnet bridge config ma zastaralou hlasicku a verzi

- Problem: v mainnet TOML stale zustava text "Mainnet contracts are NOT deployed yet" a version 3.0.2, i kdyz enabled=true + live bridge adresa.
- Dukaz:
  - [V3/config/bridge-mainnet.toml](V3/config/bridge-mainnet.toml#L5)
  - [V3/config/bridge-mainnet.toml](V3/config/bridge-mainnet.toml#L16)
  - [V3/L2/bridge/config/bridge-mainnet.toml](V3/L2/bridge/config/bridge-mainnet.toml#L5)
  - [V3/L2/bridge/config/bridge-mainnet.toml](V3/L2/bridge/config/bridge-mainnet.toml#L17)
- Dopad: onboarding a runbook confusion.
- Doporuceni: opravit hlavicku na deployed state + sjednotit verzi na 3.0.3.

### P2-2: L2Complete stale reportuje P0 vault mismatch, ale L1 konstanta uz odpovida live vault

- Problem: report uvadi blocker s adresou zion106..., ale fee.rs uz ma live zion1w0...
- Dukaz (report):
  - [L2Complete.md](L2Complete.md#L175)
  - [L2Complete.md](L2Complete.md#L188)
  - [L2Complete.md](L2Complete.md#L198)
- Dukaz (kod):
  - [V3/L1/core/src/fee.rs](V3/L1/core/src/fee.rs#L135)
- Dopad: falesny blocker v rozhodovani a zbytecne L1 zasahy.
- Doporuceni: uzavrit blocker v L2Complete jako resolved + doplnit commit odkaz.

### P2-3: Migration fallback je fail-open bez env

- Problem: pokud neni nastaven migration height, is_post_migration vraci true pro vsechny bloky.
- Dukaz:
  - [V3/L1/core/src/bin/node.rs](V3/L1/core/src/bin/node.rs#L59)
  - [V3/L1/core/src/migration.rs](V3/L1/core/src/migration.rs#L64)
  - [V3/L1/core/src/migration.rs](V3/L1/core/src/migration.rs#L66)
- Pozitivni stav edge deploye (env je nastaven):
  - [edge-deploy/systemd/zion-edge-node1.service](edge-deploy/systemd/zion-edge-node1.service#L16)
  - [edge-deploy/systemd/zion-edge-node2.service](edge-deploy/systemd/zion-edge-node2.service#L19)
  - [ZION_OS/infra/systemd/zion-edge-node1.service](ZION_OS/infra/systemd/zion-edge-node1.service#L16)
  - [ZION_OS/infra/systemd/zion-edge-node2.service](ZION_OS/infra/systemd/zion-edge-node2.service#L19)
- Dopad: mimo systemd edge profil hrozi tiche spatne skalovani.
- Doporuceni: pridat explicit warning/fatal guard pri migration_height==0 mimo test/dev.

## Co audit potvrzuje jako funkcni

1. L1 3.0.3 scale fix v RPC je pritomen (scaled_amount path) a je navazany na migration API.
2. Node startup cte ZION_MIGRATION_HEIGHT.
3. Edge service soubory jsou sjednocene na 18850.
4. Bridge DB TEXT migrace pro amount_flowers je ve zdrojaku pritomna.

## Git historie (relevantni milniky)

- 2f466a40: L1 RPC scale conversion
- a7d426b1: MIGRATION_HEIGHT=18850 v service files
- 61ddc587: 6-decimal migrace napric SDK/mobile/desktop
- 77776e48: getTransactionHistory obsahuje UTXO + coinbase
- 33a48151: PPLNS persistence
- fe3beed9: in-memory address TX index
- e1113f0c: bridge height-aware decimal conversion
- ffbe4a21: bridge config update na novy kontrakt

## Doporucony fix-order (prakticky runbook)

1. P0 adresy klientu:
- mobile + desktop-agent prepnout na bridge 0x72c8...

2. P1 docs drift:
- aktualizovat [ZION_3.0.3_DECIMAL_FORK_PLAN.md](ZION_3.0.3_DECIMAL_FORK_PLAN.md)
- aktualizovat [StatusV3.md](StatusV3.md) nebo bridge TOML (jednoznacny source-of-truth)

3. P2 hygiene:
- opravit warning/version v obou bridge-mainnet.toml
- uzavrit stale P0 blocker v [L2Complete.md](L2Complete.md)

4. Hardening:
- guard pro migration_height==0 mimo test/dev profil

## Verifikacni checklist po fixech

1. jednotna bridge adresa ve web/mobile/desktop
2. jednotna bridge adresa v obou mainnet TOML
3. jednotne start_block_height mezi status a config
4. stale validni MIGRATION_HEIGHT=18850 v edge services
5. smoke test API endpointu bridge/defi + manual write-flow dry run

## Poznamka ke stromu

Pri auditu byly lokalne detekovany necommitnute zmeny:
- [V3/L1/core/src/crypto.rs](V3/L1/core/src/crypto.rs)
- [V3/L1/core/src/fee.rs](V3/L1/core/src/fee.rs)

Tento audit je psany proti stavu workspace v case kontroly; pri finalnim merge doporuceno potvrdit diff proti origin/main.
