# ZION Roadmap

> **Účel tohoto dokumentu:** Kořenový navigační plán. Detailní 3.2 plán je v [`docs/3.2/ROADMAP.md`](./docs/3.2/ROADMAP.md), technická exekuce v [`V31/PLAN_TO_3.2.md`](./V31/PLAN_TO_3.2.md) a živý provozní stav v [`StatusV3.md`](./StatusV3.md) a [`V31/STATUS.md`](./V31/STATUS.md).
>
> **Aktuální live baseline:** 3.2.0 "One Love" (V31 Mainnet Alpha, protokol `zion-v3-node/3.1.0-alpha`) — ověřitelné na Edge a v `StatusV3.md`.
>
> **Vývojový horizont:** 3.3.0 "Nirvana" (Global Assimilation / Attention) — cíl, nikoli dosažený release; viz [`V33_NIRVANA_MASTER_PLAN.md`](./V33_NIRVANA_MASTER_PLAN.md) a [`docs/WP-Mainet/MiseAmenti/`](./docs/WP-Mainet/MiseAmenti/README.md).
>
> **Aspirativní veřejný horizont:** 31. 12. 2026 — není závazný datum launchi.
>
> **Naposledy upraveno:** 2026-08-31

---

## Jak číst tuto roadmapu

Každý úsek 3.2.1–3.2.9 obsahuje:

- **Co je v kódu** — konkrétní zdrojový strom, který lze zkontrolovat, nejen dokumentace.
- **Co ještě není / čeká na důkaz** — otevřené mezery, preview nebo post-3.2 věci.
- **Klíčové dokumenty** — soubory přesunuté do `docs/3.2/3.2.x/`, plus stávající plány v `docs/3.2/` a `V31/`.

Stavy: ✅ hotové / integrováno v kódu, 🔄 aktivně se testuje / běží, ❌ dosud nezačato nebo chybí evidence.

---

## 3.2.1 — L1 Core a konsensus

**Cíl:** stabilní, ověřitelný L1 blockchain s Ekam Deeksha v3.2, LWMA-60, nativním UTXO v2 a HTLC.

| Téma | Stav | Kód / evidence | Otevřené body |
|---|---|---|---|
| Ekam Deeksha v3.2 | ✅ | `V31/L1/cosmic-harmony/src/algorithm/ekam_deeksha.rs` — 512 KiB scratchpad, 2 AES passy, 128 random reads, Keccak256 | GPU KAT synchronizace mezi OpenCL/CUDA/Metal a CPU |
| LWMA-60 difficulty | ✅ | `V31/L1/core/src/difficulty.rs` (`MIN_SOLVE_TIME=6`, `MAX_SOLVE_TIME=360`, ±50 % clamp) | — |
| Nativní UTXO v2 | ✅ | `V31/L1/core/src/v3_wallet.rs`, `transaction.rs`, `utxo.rs` — BLAKE3 s `ZION_TX_V2\0` | — |
| SQLite tx/address index | ✅ | `V31/L1/core/src/storage.rs` — `tx_index`, `output_index`, `address_tx_index` | — |
| Node reward 1 % | 🔄 | `V31/L1/core/src/v3_template.rs`, `v3_state.rs`, `v3_rpc.rs` — 4-output coinbase, activation `u64::MAX` default | Konkrétní activation height a on-chain payout evidence |
| L1 HTLC lock/claim/refund | ✅ | `V31/L1/core/src/utxo.rs` + `v31_wallet.rs`; live E2E report | Failure-mode refund test v release evidence |

**Dokumenty:**

- [`docs/3.2/3.2.1-L1-Core/Deeksha512.md`](./docs/3.2/3.2.1-L1-Core/Deeksha512.md)
- [`docs/3.2/3.2.1-L1-Core/DeekshaAsicResistance.md`](./docs/3.2/3.2.1-L1-Core/DeekshaAsicResistance.md)
- [`docs/3.2/3.2.1-L1-Core/DeekshaTuning.md`](./docs/3.2/3.2.1-L1-Core/DeekshaTuning.md)
- [`docs/3.2/3.2.1-L1-Core/NATIVE_L1_HTLC_REPORT.md`](./docs/3.2/3.2.1-L1-Core/NATIVE_L1_HTLC_REPORT.md)

---

## 3.2.2 — Mining a Pool

**Cíl:** produkční `zion-miner`, `zion-pool`, Trinity (ZION + ZANO + VRSC), profit switching a veřejné buildy.

| Téma | Stav | Kód / evidence | Otevřené body |
|---|---|---|---|
| Trinity mining E2E | ✅ | Edge pool `62.171.141.136:8444`; GTX 1070 Ti 99,1 %, SMOS rig 99,4 % accept rate | — |
| AuxPoW (ZANO + VRSC) | ✅ | `V31/L1/miner/src/auxpow/`; CPU VerusHash, GPU ProgPoW; 100 % accept rate | — |
| XMR / RandomX path | ✅ | `V31/L1/miner/src/` CryptonoteStratum; MoneroOcean reachable; 103 unit testů pass | — |
| Profit switching 15 % hysteresis | 🔄 | `V31/L1/miner/src/autonomous.rs`; `ZION_PROFIT_HYSTERESIS` env | Live E2E switching log s reálnými rigy |
| CUDA DAG disk cache | ✅ | `V31/L1/miner/src/gpu/cuda_external.rs` | — |
| Pool payout confirmation sweep | ✅ | `V31/L1/pool/src/deferred_payout.rs`, payout confirmation on-chain | — |
| Public v3.2.0 buildy | 🔄 | `V31/release/build-*.sh`, CI `miner-release.yml` / `cli-release.yml` | Tag push a GitHub Actions run |

**Dokumenty:**

- [`docs/3.2/3.2.2-Mining-and-Pool/REPORT_2026-08-21_ZION_MINER_V3.2_PUBLIC_BUILD.md`](./docs/3.2/3.2.2-Mining-and-Pool/REPORT_2026-08-21_ZION_MINER_V3.2_PUBLIC_BUILD.md)
- [`docs/3.2/3.2.2-Mining-and-Pool/WINDOWS_11_MINER_GUIDE.md`](./docs/3.2/3.2.2-Mining-and-Pool/WINDOWS_11_MINER_GUIDE.md)
- Detail: [`docs/3.2/AUTONOMOUS_PROFIT_ROUTER.md`](./docs/3.2/AUTONOMOUS_PROFIT_ROUTER.md)

---

## 3.2.3 — Wallet, HTLC a ZIS

**Cíl:** suverénní identita a peněženka — ZIS, UTXO v2 wallet/CLI/SDK, L1 HTLC, API klíče.

| Téma | Stav | Kód / evidence | Otevřené body |
|---|---|---|---|
| ZIS server | ✅ | `APP&WEB/identity/` Fastify 4; `https://auth.zionterranova.com/health` 200 | — |
| Ed25519 / SIWE / EVM link | ✅ | `APP&WEB/identity/src/routes/auth.ts`, `challenge.ts`; `siwe` knihovna | — |
| Cross-domain cookie SSO | ✅ | `zion_session` cookie na `.zionterranova.com`, httpOnly, secure | — |
| UTXO v2 wallet/CLI/SDK | ✅ | `V31/cli/src/main.rs`, `APP&WEB/zion-wallet-sdk/src/core/transaction.ts`, `zion_core::v3_wallet` | — |
| API keys | 🔄 | `APP&WEB/identity/src/routes/apikey.ts` implementováno | Veřejné CLI/script flow a evidence |
| Web/Marketplace/OASIS/Dashboard → ZIS | ❌ | — | J1–J7 v [`docs/3.2/ROADMAP.md`](./docs/3.2/ROADMAP.md) |

**Dokumenty:**

- [`docs/3.2/3.2.3-Wallet-HTLC-and-Identity/ZIS_INTEGRATION_PLAN.md`](./docs/3.2/3.2.3-Wallet-HTLC-and-Identity/ZIS_INTEGRATION_PLAN.md)
- [`docs/3.2/3.2.3-Wallet-HTLC-and-Identity/REPORT_2026-08-18_DOCS_WALLET_DEPLOY.md`](./docs/3.2/3.2.3-Wallet-HTLC-and-Identity/REPORT_2026-08-18_DOCS_WALLET_DEPLOY.md)
- [`docs/3.2/3.2.3-Wallet-HTLC-and-Identity/REPORT_2026-08-23_ZIS_AUTH_INTEGRATION_COMPLETE.md`](./docs/3.2/3.2.3-Wallet-HTLC-and-Identity/REPORT_2026-08-23_ZIS_AUTH_INTEGRATION_COMPLETE.md)

---

## 3.2.4 — Multichain a DEX

**Cíl:** WARP bridge, Base↔ZION round-trip, solver síť, DEX quote/settlement.

| Téma | Stav | Kód / evidence | Otevřené body |
|---|---|---|---|
| Base↔ZION bridge round-trip | ✅ | `V31/L2/multichain/`; 100 ZION lock → mint → burn → unlock on-chain (`b7f227a6...`, `0xa5148c44...`, `9f3e654e...`) | Opakovatelný audit a monitoring |
| Non-EVM `disabled_reason` | ✅ | `V31/L2/multichain/src/warp/config.rs`, `ChainRegistry`; `warp.example.toml` | — |
| Solver network E2E | ✅ | `V31/L2/multichain/src/swap/dex/solver_network.rs`; 574 `zion-multichain` testů pass | Nezávislí solvéři v produkci |
| DEX quote API / widget | ✅ | `/v1/swap/quote`, `/v1/swap/quote/multi`; web widget live | — |
| DEX settlement pro běžného uživatele | 🔄 | kód v `V31/L2/multichain/src/multichain_wallet/` | Funded E2E deposit → swap → withdraw |
| Passkeys / WebAuthn | ❌ | nenalezeno v `APP&WEB/identity/src` | Post-3.2 / 3.3 |

**Dokumenty:**

- [`docs/3.2/3.2.4-Multichain-and-DEX/ZionDex-OnChain-Settlement-Plan.md`](./docs/3.2/3.2.4-Multichain-and-DEX/ZionDex-OnChain-Settlement-Plan.md)
- [`docs/3.2/3.2.4-Multichain-and-DEX/ZionDexZis.md`](./docs/3.2/3.2.4-Multichain-and-DEX/ZionDexZis.md)

---

## 3.2.5 — OASIS, Web a Marketplace

**Cíl:** web, OASIS backend, marketplace, e-shop workflow a vizuální identita.

| Téma | Stav | Kód / evidence | Otevřené body |
|---|---|---|---|
| V31 web | ✅ | `APP&WEB/website-v2.9/`; homepage ISR, CZ/EN, explorer E2E | — |
| OASIS backend | ✅ | `V31/L4/oasis/` Axum server, `worlds.json`, websocket, metrics | — |
| OASIS Web / Marketplace | ✅ | `APP&WEB/OasisWeb/`, `APP&WEB/MarketPlace/` | — |
| E-shop workflow | 🔄 | `ESHOP_WORKFLOW_PLAN.md` | Implementace a E2E checkout |
| Rasta theme / logo / branding | ✅ | `RastaTheme.md`, `logo.md` nasazeny | — |

**Dokumenty:**

- [`docs/3.2/3.2.5-OASIS-Web-and-Marketplace/oasis.md`](./docs/3.2/3.2.5-OASIS-Web-and-Marketplace/oasis.md)
- [`docs/3.2/3.2.5-OASIS-Web-and-Marketplace/ESHOP_WORKFLOW_PLAN.md`](./docs/3.2/3.2.5-OASIS-Web-and-Marketplace/ESHOP_WORKFLOW_PLAN.md)
- [`docs/3.2/3.2.5-OASIS-Web-and-Marketplace/RastaTheme.md`](./docs/3.2/3.2.5-OASIS-Web-and-Marketplace/RastaTheme.md)
- [`docs/3.2/3.2.5-OASIS-Web-and-Marketplace/logo.md`](./docs/3.2/3.2.5-OASIS-Web-and-Marketplace/logo.md)

---

## 3.2.6 — Free World a Issobella

**Cíl:** aktivace L5 humanitárního a L6 vědeckého fondu jako čitelných, auditovatelných trackerů.

| Téma | Stav | Kód / evidence | Otevřené body |
|---|---|---|---|
| L5 Free World daemon | ✅ | `V31/L5/free-world/`; `zion-free-world.service`; scan coinbase; API `127.0.0.1:8095` | Veřejný portál, grant UI, dopadová evidence |
| L6 Issobella daemon | ✅ | `V31/L6/issobella/`; `zion-issobella.service`; API `127.0.0.1:8097` | DeSci workflow, peer review, open data |
| 5 % + 5 % coinbase split | ✅ | `V31/L1/core/src/v3_template.rs`, `V31/L1/cosmic-harmony/src/revenue.rs` | — |
| DAO disbursement path | 🔄 | DAO runtime a proposal bridge | DAO UI/UX pro spend |

**Dokumenty:**

- [`docs/3.2/L5_L6_ACTIVATION_PLAN.md`](./docs/3.2/L5_L6_ACTIVATION_PLAN.md)

---

## 3.2.7 — Bezpečnost a audit

**Cíl:** vnitřní a vnější review L1/L2, chaos/load testy, DR, runbooky.

| Téma | Stav | Kód / evidence | Otevřené body |
|---|---|---|---|
| Chaos / load testy | ✅ | 10 000-miner handshake 100 %, Edge connect storm, DEX overload 1 972 req/s, bridge overload 1 793 req/s | Plný 24h transaction fuzz (F2) |
| 1 000+ miner simulace | ✅ | lokální i Edge storm; pool memory flat | — |
| Backup / DR drill | ❌ / 🔄 | skripty existují, restore drill ještě není zveřejněna | DR drill report |
| Externí bezpečnostní audit | ❌ | naplánován před public launch | Audit findings + mitigations |
| Security policy | ✅ | `SECURITY.md` + `docs/3.2/SECURITY_AUDIT_3.2.md` | — |

**Dokumenty:**

- [`docs/3.2/3.2.7-Security-and-Audit/SECURITY.md`](./docs/3.2/3.2.7-Security-and-Audit/SECURITY.md)
- [`docs/3.2/SECURITY_AUDIT_3.2.md`](./docs/3.2/SECURITY_AUDIT_3.2.md)

---

## 3.2.8 — Reset, migrace a tooling

**Cíl:** přechod V3→V31, genesis reset, CLI, deploy, public subtree.

| Téma | Stav | Kód / evidence | Otevřené body |
|---|---|---|---|
| Genesis reset 2026-08-06 | ✅ | 38 BIP39 klíčů, nové genesis hashe; `V31/L1/core/src/v3_template.rs` | — |
| V3→V31 migration | ✅ | `V31/PLAN_TO_3.2.md` Phase H; Foundry 43 testů; `zion deploy` / `zion update now` | — |
| CLI tooling | ✅ | `V31/cli/src/main.rs`; wallet send E2E | — |
| Public subtree sync | ✅ | `git subtree split --prefix=public` = `fbc5e02f2`; dry-run "Everything up-to-date" | — |
| Hard reset playbook | ✅ | `HARD_RESET_PLAYBOOK.md` | Udržovat aktuální s každým resetem |

**Dokumenty:**

- [`docs/3.2/3.2.8-Reset-Migration-and-Tooling/HARD_RESET_PLAYBOOK.md`](./docs/3.2/3.2.8-Reset-Migration-and-Tooling/HARD_RESET_PLAYBOOK.md)

---

## 3.2.9 — Release, launch a komunita

**Cíl:** v3.2.0 release, 30-denní běh, komunitní kanály a "One Love" narativ.

| Téma | Stav | Kód / evidence | Otevřené body |
|---|---|---|---|
| 30-denní kontinuální běh | 🔄 | spuštěn 2026-08-23 07:00 CET; cíl 2026-09-22; status UI `https://app.zionterranova.com/g8` | Uptime ≥99,9 %, žádné kritické incidenty |
| GitHub v3.2.0 release | 🔄 | workflow a build skripty připraveny, tagy čekají | Multi-platform binárky, SHA256SUMS, SMOS package |
| One Love marketing / komunita | 🔄 | `OneLoveV3.2.md`, `DEEKHAONELOVE.md` | Veřejné kanály a bounty |
| CONTRIBUTING / CODE_OF_CONDUCT | ✅ | přesunuty do `docs/3.2/3.2.9/` | Propojit s webem |

**Dokumenty:**

- [`docs/3.2/3.2.9-Release-Launch-and-Community/OneLoveV3.2.md`](./docs/3.2/3.2.9-Release-Launch-and-Community/OneLoveV3.2.md)
- [`docs/3.2/3.2.9-Release-Launch-and-Community/DEEKHAONELOVE.md`](./docs/3.2/3.2.9-Release-Launch-and-Community/DEEKHAONELOVE.md)
- [`docs/3.2/3.2.9-Release-Launch-and-Community/CODE_OF_CONDUCT.md`](./docs/3.2/3.2.9-Release-Launch-and-Community/CODE_OF_CONDUCT.md)
- [`docs/3.2/3.2.9-Release-Launch-and-Community/CONTRIBUTING.md`](./docs/3.2/3.2.9-Release-Launch-and-Community/CONTRIBUTING.md)

---

## 3.3.0 — Nirvana (Global Assimilation & Attention)

**Cíl:** dlouhodobý horizont L1–L6, nikoli závazný release.

- **Plán:** [`V33_NIRVANA_MASTER_PLAN.md`](./V33_NIRVANA_MASTER_PLAN.md)
- **Kanon / ústava / evidence:** [`docs/WP-Mainet/MiseAmenti/`](./docs/WP-Mainet/MiseAmenti/README.md)
- **Narativní kniha a filosofická vrstva:** [`docs/WP-Mainet/nirvana/`](./docs/WP-Mainet/nirvana/00-README.md) a [`docs/WP-Mainet/NirvanaCloud/`](./docs/WP-Mainet/NirvanaCloud/00-README.md)

> **Pravidlo:** 3.3 nároky se vždy ověřují podle kódu, on-chain dat a `StatusV3.md`. Horizont se nesmí prodávat jako hotový produkt.

---

## Historické verze

- 3.1 (V31 Mainnet Alpha): [`docs/3.1/PLAN_TO_3.1_RECONCILED.md`](./docs/3.1/PLAN_TO_3.1_RECONCILED.md) a [`docs/3.1/REPORTS/`](./docs/3.1/REPORTS/)
- 3.0.x: [`docs/3.0.9/`](./docs/3.0.9/), [`docs/3.0.8/`](./docs/3.0.8/) atd.
