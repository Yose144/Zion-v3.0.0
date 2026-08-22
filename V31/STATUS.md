# V31 Mainnet Alpha — Status

> **Update 2026-08-22 (V31 premine / coinbase maturity fix):** Implementována V31 soft-fork validace pro `Node::submit_block`, `Node::submit_utxo_transaction` a `Node::block_template`: kontroluje `COINBASE_MATURITY=100` a `PREMINE_OUTPUTS` admin/time locky pro každý input. Přidán config `soft_fork_activation_height` (CLI `--soft-fork-activation-height`, env `ZION_SOFT_FORK_ACTIVATION`, default `u64::MAX` = disabled), aby se nová pravidla neaplikovala zpětně na už přijatý block 12837 s premine spendem. Výchozí aktivace je `u64::MAX` — operátor ji musí explicitně nastavit pro mainnet (doporučená hodnota >= aktuální tip + bezpečná rezerva). Testy `cargo test -p zion-core` procházejí včetně nových unit testů `submit_block_rejects_immature_coinbase`, `submit_block_accepts_mature_coinbase` a `validate_premine_lock_rejects_spend`. Detaily a postup nasazení: [`docs/3.1/REPORTS/REPORT_2026-08-22_PREMINE_LOCK_BYPASS.md`](../docs/3.1/REPORTS/REPORT_2026-08-22_PREMINE_LOCK_BYPASS.md).
>
> **Update 2026-08-22 (L2 multichain E2E smoke test + desktop agent UTXO builder):** Local end-to-end smoke test of `zion-multichain` (`warpd`) completed. WARP health, `/v1/multichain/chains`, `/v1/multichain/height`, and `/v1/multichain/contracts` are green. DEX `/v1/swap/quote`, `/v1/swap/quote/multi`, `/v1/swap/execute`, and `/v1/bridge/submit` (burn base → zion-l1) return 200. Intent lifecycle `create` → `solver/register` → `bid` → `settle` is green; `execute` returns 400 locally because real bridge signing keys are not configured. HTLC `lock` works in offline fallback mode; `claim`/`refund` fail because the EVM and zion-l1 adapters do not yet implement `TransferDirection::Htlc`. Full report: [`docs/3.1/REPORTS/REPORT_2026-08-22_L2_MULTICHAIN_E2E_SMOKE_TEST.md`](../docs/3.1/REPORTS/REPORT_2026-08-22_L2_MULTICHAIN_E2E_SMOKE_TEST.md). Desktop agent UTXO builder was aligned with the V31 native transaction format (`7dfd279f0`).
>
> **Update 2026-08-22 (ZIS deployment + UTXO v2 wallet/CLI fixes + WARP test stability):** `zion-zis.service` je `active` na Edge; `/health` vrací OK na `https://auth.zionterranova.com` po opravě `@fastify/rate-limit` (`^9.1.0` pro Fastify 4) a systemd `ExecStart` cesty. Wallet SDK (`APP&WEB/zion-wallet-sdk`) nyní počítá v2 UTXO hash odpovídající `V31/L1/core/src/v3_tx.rs` a odesílá transakce přes `submitUtxoTransaction`. CLI `wallet send` používá `zion_core::v3_wallet::build_and_sign` s aktuálním chain tip height. NEAR env-var testy v `V31/L2/multichain/src/warp/adapter/near.rs` jsou serializovány mutexem, `cargo test -p zion-multichain` prochází 573 testy (1 ignored) bez flaky selhání.
>
> **Update 2026-08-22 (WARP G2 — non-EVM `disabled_reason` + config-driven registry):** Implementována podpora `disabled_reason` ve WARP: `ChainConfig`/`ChainRegistry`/`WarpError` nyní nesou důvod vypnutí; `WarpRuntime` a `/chains` API staví registry z `warp.toml` místo hardcoded `with_defaults()`. `/chains` vrací `name`, `family`, `enabled` a `disabled_reason`. `warp.example.toml` aktualizován: pro 3.2.0 jsou aktivní pouze `base` (EVM pilot) a `zion-l1`; všechny nedeployované non-EVM chainy (aptos, sui, cardano, cosmos, near, lightning) mají `enabled = false` s explicitním `disabled_reason`. Gate **G2** v [`docs/3.2/ROADMAP.md`](../docs/3.2/ROADMAP.md) označen jako ✅ Complete. Testy `cargo test -p zion-multichain` (574 testů) a `cargo clippy -p zion-multichain` prošly bez nových warningů.
>
> **Update 2026-08-22 (public subtree G4 closed):** `public/` subtree je plně synchronizovaný s `github.com/Zion-TerraNova/v3-Mainnet:main`. `git subtree split --prefix=public` vrací `fbc5e02f2`, identický s `public/main`; `git push public public-split:main --dry-run` hlásí "Everything up-to-date". Gate **G4** v [`docs/3.2/ROADMAP.md`](../docs/3.2/ROADMAP.md) označen jako ✅ Complete.
>
> **Update 2026-08-21 (v3.2.0 release prep):** Veřejné buildy Terminal Miner, CLI a Desktop Agent připraveny pro v3.2.0 — opraveny build skripty a CI workflow tagy/verze/názvy. Desktop miner defaultně používá `public_build` pro Boost TUI masking. Download metadata přepnuta na `v3.2.0-miner` / `v3.2.0-cli`. Čeká se na push tagů a spuštění GitHub Actions release workflow.

> **Verze:** 3.1.0-beta (workspace) / protokol `zion-v3-node/3.1.0-alpha` (post-Phase A+B+C+D — E2E mining + web health green) / směřujeme k **3.2.0 "One Love" (Mainnet Stable)**
> **Datum:** 2026-08-17
> **Stav:** workspace builduje, `cargo test --workspace` prochází (0 failures), `cargo clippy --workspace` čisté (pouze pre-existing warnings). **Fáze A i Fáze B jsou kompletní** — `EkamDeeksha` v3.2 běží na všech výškách (konstanty: 512 KiB scratchpad, 2 passy, 128 random reads, 2 AES rounds), CPU KAT vektory a GPU OpenCL/CUDA/Metal kernely jsou synchronizovány, `zion-miner` mapuje `ekam_deeksha` na kanonické `deeksha_lite`/`deeksha_chv3` GPU backendy. **V31 je nasazen na Edge** (public RPC, pool, multichain, DAO, OASIS, web, marketplace, dashboard; všechny služby active). **Lokální GPU OpenCL build + benchmark GO na NVIDIA GTX 1070 Ti (~132 kh/s, 2026-08-06); reálný rig E2E stále pending.** Fáze C1-C8 hotová (DAO + CLI + ZionDex + Dashboard wiring). **Pool FULL V3 feature parity + payout confirmation sweep s UTXO fallback nasazena**. **Dashboard UI/UX update do V31 hotov, `/health` OK. V31 banner KPIs + V31 Production panel (metriky, logy, Grafana) + pool metrics port 8080 + Prometheus/Grafana provisioning nasazeny na Edge. V31 cutover proveden: V3 služby zastaveny a maskovány, `zion-v31-node` osamostatněn od V3. **Fáze D E2E: cargo test --workspace pass, V31 miner našel a odevzdal pool share, web `/api/health` `ok`, e2e API scénáře zelené. Git tag `v3.1.0-alpha.2-phase-D`.
>
> **Update 2026-08-17 (LWMA difficulty fix + CPU-only miner enumeration fix):** Chain height 7000+, difficulty kleslo z ~21k na ~16k a block time se ustálil kolem 60s po nasazení nových LWMA konstant v `V31/L1/core/src/difficulty.rs` (`MIN_SOLVE_TIME=6`, `MAX_SOLVE_TIME=360`, ±50% per-block clamp). `zion-v31-node` byl přestavěn a redeploynut na Edge s novými konstantami. Současně opraven `zion-miner` v `V31/L1/miner/src/gpu/mod.rs` — `detect_gpus()` a `query_gpu_details()` nyní short-circuitují OpenCL/CUDA/Metal když `ZION_GPU_BACKEND=cpu`, takže miner nepanicuje při `ocl::Platform::list()` na CPU-only serveru. `zion-v31-miner` běží v CPU-only režimu s 100% ZION accept rate. Všechny V31 služby (node, pool, multichain, DAO, OASIS, dashboard, web, marketplace) jsou active. Historické reporty archivovány v [`docs/3.1/REPORTS/`](../docs/3.1/REPORTS/).
>
> **Update 2026-08-11 (Edge audit přes IPv6):** Edge IPv6 fallback funkční. Chain height 1595. `zion-v31-node`, `zion-v31-pool`, `zion-v31-dao`, `zion-v31-oasis`, web, marketplace a dashboard běží. `zion-v31-multichain` je `inactive (dead)` od 10. 8. 10:19 CEST. `zion-v31-miner` je v restart smyčce — `zion-miner` s `gpu-opencl` padá na `ocl::Platform::list` na CPU-only serveru; `zion-universal-miner` CPU-only test OK. Aktuální operátorská IP byla přidána do `V31/AGENTS.md`. Podrobný audit: [`docs/3.1/REPORTS/REPORT_2026-08-10_EDGE_V31_AUDIT.md`](../docs/3.1/REPORTS/REPORT_2026-08-10_EDGE_V31_AUDIT.md).
>
> **TRINITY STREAM 1 (ZION) — BLOCK PRODUCTION GREEN (2026-08-09):** Tři kritické bugy opraveny, ZION chain rostoucí na Edge (height 1000+). Pool payout confirmation sweep potvrzuje výplaty on-chain (37+ confirmed on-chain). Viz detaily níže.
>
> **PLAN_TO_3.2 audit 2026-08-07:** CLI (`zion`) má 28 subcommandů (včetně `dao`, `atomic-swap`, `warp`, `monitor`, `topology`, `explorer`, `onboard`, `deploy`, `update`, `compose`, `auxpow`), některé jsou stále stub; miner TUI (`ui.rs`, `interactive.rs`, `setup_menu.rs`, `banner.rs`) je zapojená pod `tui` feature a Cargo.toml obsahuje `full`/`native-all`/`gpu-all`/`public_build`; EVM a ZionDex Solidity kontrakty jsou přítomny v `V31/L2/multichain/contracts/`, ale chybí Foundry/Hardhat projektová konfigurace pro `zion deploy`. **Otevřené zůstává:** OASIS `output: 'export'` blokuje server-side ZIS route, `deploy-edge.sh` neinstaluje `zion-zis` službu (i když `APP&WEB/identity/` existuje), reálný GPU rig E2E a 30d continuous run. **Vyřešené 2026-08-22:** non-EVM WARP placeholdery — `disabled_reason` implementováno v registry/config/API a `warp.example.toml` explicitně vypíná nedeployované non-EVM chainy (G2 uzavřen); sync `public/` subtree — `public/` je nyní plně synchronizovaný s `Zion-TerraNova/v3-Mainnet:main` (G4 uzavřen).

> **3.2.0 "One Love" genesis reset (2026-08-06):** Kanonická sada klíčů `V31_PREMINE_V2_KEYS_2026-08-06.json` (38 klíčů: 14 premine, 5 canonical, 3 admin, 7 DAO guardian, 5 EVM validator, 1 escrow). Všechny adresy byly aktualizovány v `zion-core`, `zion-dao`, CLI a deploy konfiguracích. Genesis hashe: V31 native `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb`, V3 compat `4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71`.
>
> **Genesis reset postup:** Viz [`HARD_RESET_PLAYBOOK.md`](../HARD_RESET_PLAYBOOK.md). Klíče jsou uloženy v `~/Desktop/ZION_KEYS_GENESIS_V2_2026-08-06/` (chmod 700, owner-only).

## Update 2026-08-07 (Trinity session) — Stream 1 ZION block production GREEN, 3 critical bug fixes

Tři kritické bugy blokovaly produkci ZION bloků na Edge. Všechny opraveny, chain roste (height 51+ v ~5 minutách).

### Bug 1: Pool `current_chain_height` četl V3 height místo native height (`c7b9980a5`)

- **Symptom:** Pool odmítal každý mined block jako `stale block height=2 (tip=0), treating as orphan`
- **Root cause:** `current_chain_height()` v `stratum.rs` volala `getStatus` RPC metodu, která vrací V3 chain height (0 při běhu s `--v3-no-genesis`). Pool ale submituje native L1 bloky.
- **Fix:** Přepnuto na `getChainInfo` RPC metodu a čten `native_chain_height` (s fallback na `chain_height` pro starší node)

### Bug 2: Pool vardiff env var names neodpovídaly edge-environment.sh (`e6af816dc`)

- **Symptom:** Pool vždy používal default `start_difficulty=1` (trivially easy target), nonce=0 vždy prošel
- **Root cause:** Kód četl `ZION_VARDIFF_START` ale env file používá `ZION_VARDIFF_START_DIFF`. Tři env var names se neshodovaly: START, MIN, MAX.
- **Fix:** Kód nyní čte obě varianty s `*_DIFF` prioritou

### Bug 3: `difficulty_to_target` bit shift direction invertovaný (`fbde94996`) — ROOT CAUSE nonce=0

- **Symptom:** I s `ZION_VARDIFF_START_DIFF=100` nonce=0 vždy prošel share target, ale nikdy nesplnil block target → žádné bloky
- **Root cause:** Big-endian right-shift loop v `vardiff.rs` iteroval z least-significant do most-significant byte (i=31..0), což je ve skutečnosti LEFT shift. Target pro difficulty 100 byl `0xFF...FF03` místo `0x03FF...FF`.
- **Fix:** Iterace obrácena na i=0..31 (most-significant → least-significant), carry se nyní propaguje správně pro right shift
- **Testy:** Přidány 2 nové testy (`test_difficulty_to_target_100_has_correct_leading_bits`, `test_difficulty_to_target_10_first_byte`) ověřující správné leading bytes

### Edge deployment výsledky

- **Pool + miner přestavěny** na Edge s nejnovějším kódem (`fbde94996`)
- **ZION_VARDIFF_START_DIFF=100** nastaveno v `/etc/zion/edge-environment.sh`
- **Block production GREEN:**
  - `submitBlock response: {"id":1,"jsonrpc":"2.0","result":{"accepted":true}}`
  - `notify_block_found miner=zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8 height=51 worker=edge-cpu`
  - `native_chain_height: 51` (z 1 na 51 v ~5 minutách, ~5s/blok)
  - Nonce nyní non-zero (0x0e, 0xa4, 0x10, 0x0f, ...)
- **Pool test suite:** 165 tests pass (0 failures)
- **Commits pushed:** `c7b9980a5`, `e6af816dc`, `fbde94996`

### Trinity Stream status

| Stream | Coin | Pool | Status |
|--------|------|------|--------|
| Stream 1 (ZION) | ZION | localhost:8444 | ✅ GREEN — blocks mined + accepted, height 51+ |
| Stream 2 (GPU AuxPoW) | ZANO | de.zano.herominers.com:1110 | ✅ GREEN — `eth_submitLogin` + `eth_getWork` polling ověřené runtime; pool posílá joby (height 3805131+) |
| Stream 3 (CPU AuxPoW) | VRSC | eu.luckpool.net:3956 | ✅ GREEN — `mining.authorize` s `d=0.01` + `mining.extranonce.subscribe` ověřené runtime; pool posílá joby |

### Zbývající úkoly

- **Stream 2 (ZANO):** ✅ `revenue_proxy`/`AuxPowClient` handshake a `eth_getWork` parsing opraveny a ověřeny proti HeroMiners
- **Stream 3 (VRSC):** ✅ `AuxPowClient` posílá `d=0.01` a `mining.extranonce.subscribe`; ověřeno proti LuckPool
- **VRSC reconnect storm způsobil fail2ban SSH ban** — reconnect smyčka generuje rychlé TCP connect/disconnect, fail2ban vyhodnotil jako port scan. Nutno přidat Edge IP do ignoreip nebo zpomalit reconnect.
- **Sdílení práce:** `cargo test --workspace` prochází po opravách. Desktop-agent binárky (`zion-miner`, `zion-universal-miner`, `node`, `zion`) aktualizovány na lokálním Ubuntu.

## Update 2026-08-07 (session) — u128 JSON serde hardening, Edge binary redeploy, block production green

- **Root cause `invalid number at line 1 column 1024` fixed:** `serde_json` 1.x cannot represent `u128`/`i128` as JSON numbers, which broke P2P block sync and pool block-template parsing (`Amount` is a transparent `u128`; `PplnsSnapshot`, `Transaction` and `MintInstruction` contain `u128` fields). `V31/Cargo.toml` keeps `serde_json = "1"` without the `arbitrary_precision` feature; the canonical fix is the shared `zion_l1_types::u128_str` string serde helper, which serializes `u128`/`Amount` as decimal strings and deserializes from strings or `u64` numbers.
- **Shared `u128` serde helper in `zion_l1_types`:** new `V31/L1/types/src/u128_str.rs` with `serialize`/`deserialize` plus `u128_str::map` for `HashMap<String, u128>`. It round-trips `u128` as decimal strings and still accepts legacy `u64` numbers. Covered by unit tests in the same file.
- **Helper applied to all relevant V31 `u128` fields:**
  - `zion_pool::v3_pplns::PplnsSnapshot` — `window_total_difficulty`, `paid_per_miner` (map), `total_paid_flowers`.
  - `zion_core::node_runtime::Transaction::amount_zion`.
  - `zion_core::v3_compat::V3Transaction::amount_zion`.
  - `zion_core::v3_checkpoint::{Checkpoint, CheckpointAccount}` balances.
  - `zion_multichain::warp::protocol::MintInstruction::amount_dest_atomic`.
  - `zion_oasis::prize_tiers::{PrizeTier, PrizeConfig}` flower amounts (added `zion-l1-types` dep to `zion-oasis`).
- **Local helpers replaced by shared one:** `v3_compat.rs`, `v3_checkpoint.rs`, `node_runtime.rs` now re-export/use `zion_l1_types::u128_str`, removing duplicated string-or-number logic.
- **Verification:** `cargo check --workspace`, `cargo clippy -p zion-l1-types -p zion-core -p zion-pool -p zion-multichain -p zion-oasis` and `cargo test --workspace` all pass (workspace tests green). New `zion-l1-types` unit tests for `u128_str` pass.
- **Edge binary redeploy:** stopped and masked `zion-v31-node`/`zion-v31-pool`/`zion-v31-miner`, copied fresh `zion-node`, `zion-pool`, `zion-miner`, `zion-universal-miner` to `/opt/zion/V31/target/release/`, unmasked and restarted all three services. Running `zion-node` no longer blocks the binary file; new `zion-pool` is `cc69b6cc...`, `zion-node` is `17d2acd4...`.
- **Edge live results:**
  - `systemctl is-active zion-v31-node zion-v31-pool zion-v31-miner` → `active active active`.
  - Node accepted blocks height 2, 3 and 4 (`zion_core::node: accepted block height=...`).
  - Pool broadcasting `mining.notify job=zion_68` and `share accepted — job=zion_68, worker=..., nonce=...`.
  - Dashboard `/api/health` returns `{"v31-node":"up","v31-pool":"up","v31-miner":"up",...}`.
  - No more `invalid number at line 1 column 1024` errors in pool logs.
- **Unified watchdog verification:** `scripts/watchdog.sh` v31 mode correctly treats `native_chain_height=0` as valid fresh-chain; both `zion-v31-watchdog.timer` and `zion-watchdog.timer` re-enabled; logs show `OK: v31=1 version=3.1.0-alpha`.
- **Remaining open tasks:**
  - Verify local backup node P2P sync with Edge (`getPeerInfo` peers, `native_chain_height` match).
  - Verify PPLNS payouts and configure `pool_wallet_key` / pool fee wallet.
  - Run longer smoke test to confirm stable block production and share acceptance.

## Update 2026-08-06 — DEX HTTP solver client, GPU OpenCL build, Desktop Agent V31 binaries

- **DEX solver network — GO**:
  - Implementován `HttpSolverClient` v `V31/L2/multichain/src/swap/dex/solver_network.rs` (používá `reqwest` s timeoutem, posílá `SwapIntent` JSON na `{solver.url}/v1/swap/solve`, očekává `SolverBid` JSON, `204 No Content` znamená odmítnutí, HTTP/parse chyby se mapují na `MultichainError::Internal`).
  - Do `V31/L2/multichain/src/server.rs` přidány endpointy `POST /v1/swap/solve` (solver strana běží `DexRouter::quote` a vrací `SolverBid` s `PathHop` cestou) a `POST /v1/swap/intent/:id/broadcast` (buyer rozesílá pending intent všem registrovaným solverům a automaticky submitne vítězný bid).
  - `AppState` rozšířena o `solver_name` a `solver_fee_bps` z env proměnných `ZION_DEX_SOLVER_NAME` a `ZION_DEX_SOLVER_FEE_BPS`.
  - Testy: `http_solver_endpoint_returns_bid_for_valid_intent` v `tests/server.rs` a end-to-end `solver_network_http` v `tests/solver_network_http.rs` procházejí. `cargo test -p zion-multichain` je čisté.

- **GPU OpenCL build — GO (lokálně)**:
  - `zion-miner` se buildne s featurami `auxpow,gpu-opencl,native-hashers,native-kheavyhash,native-blake3-algo,native-verushash` (+ `gpu-cuda`, pokud je přítomen NVRTC runtime). `zion-miner --help` potvrzuje triple-stream volby.
  - Přidán test `V31/L1/miner/tests/gpu_opencl_detect.rs` (ignored by default). Spuštění:
    `cargo test -p zion-miner --features gpu-opencl --test gpu_opencl_detect -- --ignored --nocapture`
  - Výsledek na lokálním stroji: **GO** — NVIDIA GeForce GTX 1070 Ti detekována, Deeksha jádro zkompilováno a spuštěno, benchmark ~132 kh/s.

- **Desktop Agent V31 binaries — GO**:
  - `prepare-rust-miner.js` (volaný přes `npm run prepare:rust-miner` v `APP&WEB/desktop-agent/`) zkopíruje V31 binárky `zion-miner`, `zion-universal-miner`, `zion-node` (alias `node`) a `zion` do `APP&WEB/desktop-agent/resources/`.
  - `npm test` a `npm run build:linux` procházejí; v `APP&WEB/desktop-agent/dist/` vzniknou:
    - `zion-desktop-agent-v3.1.0-linux-x86_64.AppImage`
    - `zion-desktop-agent-v3.1.0-linux-amd64.deb`
  - Verifikace: `zion-miner --help`, `node --help`, `zion --help` vracejí V31 volby.

- **Přehled verifikace**: `cargo test --workspace` pass, `cargo clippy --workspace` clean, `npm test` pass, `npm run build:linux` pass. Commit `23e4fbd8e` obsahuje zdrojové změny.

## Update 2026-08-07 — PLAN_TO_3.2 audit (CLI, miner TUI, contracts, ZIS)

Rekonciliace `V31/PLAN_TO_3.2.md` s aktuálním kódem ukazuje, že řada položek označených v plánu jako chybějící je již v kódu. Zároveň se objevily nové mezery, které musíme dořešit před `3.2.0 "One Love"`.

**Potvrzeno v kódu:**

- **CLI (`V31/cli/src/main.rs`)** — 28 subcommandů: `menu`, `status`, `wallet`, `bridge`, `swap`, `pool`, `miner`, `doctor`, `api`, `node`, `service`, `dao`, `atomic-swap`, `warp`, `monitor`, `topology`, `explorer`, `onboard`, `deploy`, `update`, `compose`, `auxpow`, `completions` a migrační `agent`/`hiran`/`issobella`/`free-world`/`ncl`. Některé subcommandy (např. `deploy`, `topology`, `explorer`, L4/L5/L6 migrační) jsou stále částečně stub nebo vyžadují dořešení.
- **Miner TUI** — `V31/L1/miner/src/ui.rs`, `interactive.rs`, `setup_menu.rs`, `banner.rs` zapojeny za `tui` feature. `Cargo.toml` obsahuje featury `full`, `native-all`, `gpu-all`, `public_build`.
- **Ekam Deeksha v3.2 ASIC-hardening** — `V31/L1/cosmic-harmony/src/algorithm/ekam_deeksha.rs` používá 512 KiB scratchpad, 2 passy, 128 random reads, 2 AES rounds. Dokumentační komentáře v kódu byly aktualizovány na v3.2.
- **EVM + ZionDex kontrakty** — `V31/L2/multichain/contracts/evm/` má 8 Solidity kontraktů (`wZION.sol`, `ZIONBridge.sol`, `ZIONAtomicSwap.sol`, ...), `contracts/dex/` má 7 ZionDex kontraktů (`ZionDexRouter.sol`, `ZionDexPoolManager.sol`, ...).
- **ZIS (ZION Identity Service)** — `APP&WEB/identity/` Fastify auth server existuje, má vlastní `deploy-zis.sh`, `nginx-zis.conf` a `zion-zis.service`. `APP&WEB/shared/prisma/schema.prisma` obsahuje unified ZIS schema; dashboard používá `zis_auth.py` a webové projekty `zis.ts`.

**Zůstává otevřené / blokuje `zion deploy` a plnou integraci:**

- **Chybí Foundry/Hardhat projektová konfigurace** v `V31/L2/multichain/contracts/` — `zion deploy` nemá jak kompilovat/deployovat EVM kontrakty.
- **Non-EVM WARP adaptery jsou placeholdery** — 31 TODO/placeholder markerů v `solana.rs`, `tron.rs`, `stellar.rs`, `bitcoin.rs`, `cardano.rs`, `cosmos.rs`, `aptos.rs`, `sui.rs`, `near.rs`.
- **OASIS Web `output: 'export'`** v `APP&WEB/OasisWeb/next.config.ts` blokuje server-side ZIS routes (např. `/api/...`).
- **Edge deploy neinstaluje ZIS** — `V31/deploy/deploy-edge.sh` nezapíná `zion-zis.service`.
- **Public subtree sync** — `public/` není zero-diff; potřebuje audit a push.
- **Reálný GPU rig E2E** — lokální OpenCL benchmark GO, ale Edge pool s referenčními rigy (≥90 % accept rate) je stále pending.
- **30d continuous run** — není zahájen.

## Co je hotovo v `3.1.0-beta` (post-Phase A+B.1, protokol `3.1.0-alpha`)

- L1/L2/L3/L4/L5/L6 crates existují a kompilují jako jeden workspace (18 crateů).
- **Všechny workspace testy pass: 2178** (včetně doc-testů; bez doc-testů 2165). Hlavní příspěvky: `zion-ai-native` 337, `zion-multichain` 579, `zion-core` 303, `zion-cosmic-harmony-v3` 205, `zion-cosmic-harmony` 195, `zion-pool` 165, `zion-oasis` 125, `zion-miner` 101, `zion-dao` 76, `zion-ncl` 42, `zion-native-ffi` 13, `zion-l1-types` 11, `zion-smoke` 3, `zion-free-world` 3, `zion-issobella` 3, `zion-sdk` 4.
  - `zion-core` 303 testů
  - `zion-native-ffi` 13 testů
  - `zion-cosmic-harmony` 195 testů
  - `zion-cosmic-harmony-v3` 205 testů
  - `zion-ai-native` 337 testů
  - `zion-multichain` 579 testů (včetně integračních testů)
  - `zion-ncl` 42 testů
  - `zion-oasis` 125 testů
  - `zion-pool` 165 testů
  - `zion-miner` 101 testů
  - `zion-dao` 76 testů (lib + integrační smoke)
  - `zion-free-world` 3 testy
  - `zion-issobella` 3 testy
  - `zion-smoke` 3 cross-layer testy
  - `zion-sdk` 4 testy
  - `zion-l1-types` 11 testů

### Fáze A — Critical Gap Closure (PLAN_TO_3.1.md) ✅

- **[A.4] native-ffi portován** — RandomX, Ghostrider, VerusHash, Autolykos, kHeavyHash, Blake3, Ethash, KawPow, Cosmic Harmony. 411 souborů, 11 MB. Feature-gated `native-hashers` v zion-miner.
- **[A.5] GPU csrc kernely portovány** — CUDA (12 kernelů), OpenCL (30+ kernelů), Metal (14 kernelů). 158 souborů z AuXpow + V3. Feature-gated `gpu-opencl`, `gpu-cuda`, `gpu-metal`.
- **[A.6] P2P wire protocol fix** — AnnounceTx přidán do P2pMessage enum, sync client gracefully skips non-block messages.
- **[A.6b] P2P infra moduly portovány** — p2p_security.rs (350 řádků), propagation.rs (628 řádků), discovery.rs (675 řádků), ibd.rs (483 řádků).

### Fáze B — L1 Completion (B.1 hotová, B.2/B.3 partial)

- **[B.1] V3 core modules** — **12/12 modulů enabled** (L1 core complete):
  - ✅ v3_tx.rs (476 lines) — UTXO transaction model
  - ✅ v3_chain.rs (545 lines) — Chain entry, Outpoint, SpendableUtxo
  - ✅ v3_mempool.rs (535 lines) — Enhanced mempool with UTXO support
  - ✅ v3_full_checkpoint.rs (522 lines) — Signed checkpoint verification
  - ✅ metrics.rs (529 lines) — Node metrics with atomic counters
  - ✅ orphan.rs (282 lines) — Orphan block pool
  - ✅ launch.rs (364 lines) — Genesis ceremony & launch readiness
  - ✅ v3_validation.rs (1260 lines) — Full block/UTXO validation
  - ✅ v3_bridge.rs (566 lines) — Bridge unlock multisig (k256 ECDSA)
  - ✅ v3_wallet.rs (746 lines) — Ed25519 wallet with account+UTXO tx
  - ✅ websocket.rs (310 lines) — WebSocket subscriptions server (trait-based handler)
  - ✅ v3_node_builder.rs — rewritten as V31-native async composition layer (no V3 lib.rs dependency)
  - ✅ chain_state.rs (2762 lines) — ChainState ported from V3 (block store, UTXO set, reorg, pruning)
  - ✅ node_runtime.rs (1775 lines) — NodeRuntime ported from V3 (event loop, P2P, RPC, mempool wiring)
  - **All 12 L1 core modules now enabled:** launch, v3_validation, v3_bridge, v3_wallet, websocket, v3_node_builder, chain_state, node_runtime, rpc, v3_compat, v3_chain, v3_p2p
  - Added: BlockCandidate, MiningJob, MiningSolution, SealedBlock types
  - Added: AccountTransaction::verify_signature(), crypto::sign_and_zeroize()
  - Added: DifficultyTarget::allows(), migration::MIGRATION_DIVISOR/is_post_migration()

- **[B.2] Pool completion** — 5/5 modules enabled:
  - ✅ v3_pplns.rs (1626 lines) — Advanced P7-P10 PPLNS engine
  - ✅ store.rs (850 lines) — SQLite persistence with migrations
  - ✅ stratum_v1.rs (398 lines) — Bitcoin-compatible stratum v1
  - ✅ revenue_proxy.rs (469 lines) — External pool proxy for multi-coin
  - ✅ v3_protocol.rs (251 lines) — V3 pool wire protocol (PoolMessage, 16 variants)
  - Added: CoinProfile::ticker(), CoinProfile::pool_address() methods

- **[B.3] Miner AuxPoW merge** — 7/7 modules enabled:
  - ✅ 14 V3 cosmic-harmony modules (9500+ lines): algorithms_opt, scratchpad_ekam,
    algorithms_npu, deeksha, deeksha_lite, deeksha_lite_fire, hic, hugepages,
    ncl_integration, revenue, revenue_journal, sha3_fast, stream_layers, stream_profit
  - ✅ 6 miner modules enabled: b3_verify, reconnect, cpu_features, thread_affinity,
    gpu_guard, autonomous
  - ✅ cosmic-harmony re-exports: EkamDeeksha (canonical), CANONICAL_ALGORITHM
  - ✅ ExternalCoin methods: ticker(), is_gpu(), is_cpu(), estimated_*_power_watts()
  - ✅ ProfitRouter::default_estimates() (V3 fetch_live_profit_estimates compat)
  - ✅ pool_message.rs (65 lines) — local PoolMessage to avoid cyclic dep
  - ✅ parallel.rs (328 lines) — enabled under `auxpow` feature

- **[C.1] Operator binaries** — 19/19 enabled:
  - ✅ gen-keys, gen-all-keys-mnemonic, gen-canonical-wallets, gen-premine-wallets
  - ✅ gen-pool-wallet, gen-pool-payout-wallet, gen-dao-guardians, gen-evm-validators
  - ✅ gen-tithe-wallets, gen-admin-keys, get-canonical-addresses, get-genesis-hash
  - ✅ get-bridge-vault-address, zion-node, zion-migrate
  - ✅ wallet, core-util, fund-bridge-vault, burn-funds, migrate-escrow, canonical-operator-env (default feature `v3-binaries`)

- **[C.2] Edge-deploy infra** — 24 files created:
  - ✅ systemd/: 13 service files (node1, node2, pool, bridge, dao, warp, miner, watchdog, backup, maintenance) + 4 config files
  - ✅ config/edge-environment.sh — env vars for V31 node
  - ✅ scripts/edge-health-probe.sh — health check for V31 services
  - ✅ nginx/zion-nginx.conf — reverse proxy + TCP stream for RPC (8443→9443)
  - ✅ fail2ban/zion-p2p.conf + zion-p2p-filter.conf — P2P jail (maxretry=50, bantime=24h)
  - ✅ deploy-edge.sh — main deploy script (V31 paths, binary names)
  - ✅ README.md — deploy structure documentation

### Původní alpha.2 features

- **V3 checkpoint sync** — L1 umí načíst V3 stav jako genesis checkpoint.
- **Kanonický Ekam Deeksha PoW v3.2** — `zion-core`, `zion-miner` a `zion-pool` používají `EkamDeeksha` z `zion-cosmic-harmony` pro všechny výšky. Parametry: 512 KiB scratchpad, 2 passy (forward + backward), 128 random reads, 2 AES rounds. OpenCL/CUDA/Metal kernely synchronizovány na stejné konstanty. Historická V3 validace zůstává v `v3_compat`.
- **P2P hardening** — peer manager, ban score, max peers, discovery, rate limiting, escalating bans.
- **Triple-stream mining** — ZION + AuxPoW GPU + CPU fallback. GPU runtime backend port dokončen: OpenCL (`gpu-opencl`), CUDA (`gpu-cuda`), Metal (`gpu-metal`) a nativní CPU shims (`native-kheavyhash`, `native-blake3-algo`, `native-verushash`) kompilují pod `zion-miner`; `cargo clippy --workspace` čisté.
- **Custom AMM** deploy v `zion-multichain` (SQLite persistence, HTTP API).
- **WARP API rate limiting + auth** — token bucket + optional Bearer.
- **Cross-layer smoke** — `V31/smoke` propojuje NCL → AI-Native → Oasis → Free World → Issobella.
- **WARP HTLC smoke** — lock/claim mezi Base a ZionL1.
- **DAO governance smoke** — proposal, vote, quorum.
- **HTLC persistence** — SQLite backend.

### Nově připojené v této iteraci

- **B2 full Ekam Deeksha v3.2 GPU** — `zion-miner/src/auxpow/gpu_miner.rs` nově používá kanonické OpenCL jádro `ekam_deeksha_mine` pro `ekam_deeksha`. CPU↔GPU parity test synchronizován s `EkamDeeksha::hash_bytes`.
- **C3 HTLC HTTP endpoints** — `zion-multichain` má `/v1/multichain/swaps/htlc/lock`, `/claim`, `/refund` a `/:hash` query; handlers volají `HtlcSwap` v `MultichainService`.
- **C4 Live profit oracle** — `stream_profit.rs` má NiceHash `simplemultialgo/info` provider, `ProfitOracle` s cache a token-bucket rate limitem (max 10 req/60 s), fallback na statické odhady.
- **C5 Bridge validator consensus** — `multichain/src/bridge/consensus.rs` s `BridgeConsensus` (5/7 quorum), lokální threshold signing, integrace do `Bridge::submit`; `WarpValidatorSet` teď `Debug + Clone`.
- **B.2 Pool runtime triple-stream** — `zion-pool` má `auxpow_runtime`, `share_relay`, `tls`, `vardiff`, `template_cache`, `telemetry`, `revenue_scheduler`, `payout`, `notifications`, `block_tracker`; `main.rs` spouští MultiAuxPow bridge, extra stratum porty, TLS listener a payout sweeper.

### Pool V3 Feature Parity (2026-08-04) ✅

Dokončena plná V3 pool feature parity. Pool nasazen a běží na Edge (`62.171.141.136:8444`).

**Nové moduly:**

- ✅ **`auxpow_runtime.rs`** (420 lines) — AuxPoW bridge runtime: spawn tokio task per coin, connect to upstream pools via `AuxPowClient`, fetch jobs, forward shares. Exponential backoff reconnection (5s→600s). Env: `ZION_POOL_AUXPOW_COINS`, `ZION_POOL_AUXPOW_WALLET`, per-coin `ZION_POOL_AUXPOW_WALLET_<COIN>`.
- ✅ **`tls.rs`** (175 lines) — TLS support (`tokio-rustls 0.26` + `rustls 0.23` + `rustls-pemfile 2`). Non-fatal: pool continues without TLS if cert loading fails. Also includes `ExtraPortConfig` for difficulty-stratified extra port listeners. Env: `ZION_POOL_TLS_BIND/CERT/KEY`, `ZION_POOL_EXTRA_PORTS`.
- ✅ **`share_relay.rs`** (120 lines) — Fire-and-forget share relay for Edge→Core pool forwarding. 3s write timeout. Env: `ZION_UPSTREAM_POOL_ADDR`.
- ✅ **`profit_switcher.rs`** (210 lines) — Pool-side profit switcher with hysteresis. Uses `ProfitRouter` for estimates. Selects best GPU and CPU coins independently. Env: `ZION_POOL_PROFIT_HYSTERESIS`, `ZION_POOL_PROFIT_INTERVAL`.

**Aktualizované moduly:**

- ✅ **`stratum.rs`** — Triple-stream mining: `build_v3_job_message` now attaches `external_stream` (GPU) + `external_stream_cpu` (CPU) from AuxPoW bridge. `ExternalSubmit` forwards to bridge. `CoinPreference` logged. Share relay on accepted shares. TLS connection handler. Generic `write_v3_message`.
- ✅ **`api.rs`** — Expanded HTTP API: `Authorization: Bearer` support. New endpoints: `/api/v1/profit-switch`, `/api/v1/stream-profit`, `/api/v1/hashrate-history`, `/api/v1/miners/{id}`, `/admin/profit-switch`, `/admin/auxpow-status`, `/admin/ops`. Expanded Prometheus metrics with AuxPoW coin labels, TLS status, share relay status.
- ✅ **`main.rs`** — Wired AuxPoW bridge runtime, TLS listener, extra port listeners, share relay config.
- ✅ **`auxpow_bridge.rs`** — Added `push_job_for_coin`, `latest_job_for_coin`, `job_for_coin_and_id`, `forward_by_ticker`.

**Nasazení:**
- Pool binary buildnuty na Edge serveru (x86_64 Linux ELF, 4.8 MB stripped)
- `zion-v31-pool.service` aktivní na `0.0.0.0:8444`
- L1 RPC feed: `127.0.0.1:9445`
- HTTP API: `0.0.0.0:8080`
- External miner (IP 82.66.171.130) se připojuje — V3 Hello/Welcome handshake funguje

### DAO Governance Runtime (2026-08-06) ✅

DAO governance runtime rošířena a částečně integrována (Phase C1). Plný lifecycle návrhů s hlasováním, kvórem a timelockem + pokročilé moduly z V3, Prometheus metriky a L1 memo scanner.

**Nové moduly:**

- ✅ **`voting.rs`** (215 lines) — VotingEngine: token-weighted voting (1 ZION = 1 vote), double-vote prevention, vote weight tracking.
- ✅ **`runtime.rs`** (420 lines) — GovernanceRuntime: plný proposal lifecycle (Create → Vote → Tally → Quorum → Timelock → Execute). Parliamentary election s D'Hondt seat allocation. Cancel by proposer nebo guardian. Process expired proposals batch.
- ✅ **`api.rs`** (500 lines) — Axum HTTP API s 9 endpoints: health, proposals CRUD, vote, tally, execute, cancel, stats. X-DAO-Key auth pro write operace. ProposalTypeDto pro JSON-friendly input.
- ✅ **`treasury.rs`** — multi-sig treasury (5-of-7) s denním limitem a operacemi Spend / HumanitarianGrant / Rebalance / GoldenEggPrize.
- ✅ **`humanitarian.rs`** — 7 humanitárních kategorií s alokacemi a fondem.
- ✅ **`db.rs`** — SQLite persistence pro návrhy, hlasy, treasury operace a scanner cursor.
- ✅ **`l1_scanner.rs`** — sledování L1 blockchainu pro DAO governance mema (`DAO:vote:42:yes`).
- ✅ **`metrics.rs`** — Prometheus metriky pro návrhy, hlasy, treasury a scanner.
- ✅ **`executor.rs`** — final execution passed + timelocked návrhů (parameter/treasury/humanitarian).
- ✅ **`consent.rs`**, **`co_admin.rs`**, **`cross_layer.rs`**, **`prizes.rs`** — guardian / consent / cross-layer / prize engine.
- ✅ **`main.rs`** — `zion-dao` binárka s tracing-subscriber.

**Testy:** 74 DAO testů pass (bylo 31).

**Integrace:** `zion-dao` binárka otevírá `DaoDb` na `DAO_DB_PATH`, načítá existující návrhy a hlasy do `GovernanceRuntime`, persistuje všechny změny (nové návrhy, hlasy, tally, execute, cancel) zpět do SQLite a spouští `L1Scanner` pro governance mema. Scanner nyní předává validované hlasy přímo do runtimeu přes `Arc<TokioMutex<GovernanceRuntime>>`. `/metrics` endpoint vystavuje live DAO metriky.

### CLI Wallet + Service Management (2026-08-04) ✅

CLI rozšířeno o wallet file management, service lifecycle a Dashboard V31 env/metriky (Phase C6 + C7 + C8).

**Wallet commands:**
- ✅ `wallet create` — generuje Ed25519 keypair, ukládá do JSON souboru (~/.zion/wallet.json), --force pro overwrite
- ✅ `wallet load` — načte wallet ze souboru, zobrazí address + public key
- ✅ `wallet send` — fetch UTXOs z L1 RPC, build+sign tx, broadcast přes submitTransaction JSON-RPC. --dry-run, --memo, --rpc, --fee flags.

**Service lifecycle commands:**
- ✅ `node start|stop|status|restart`, `pool start|stop|status|stats`, `miner start|stop|status` — přímé systemctl příkazy pro každý V31 service
- ✅ `service logs <service> [--lines N]` — journalctl log viewer

**Dashboard V31 env + metrics (Phase C8):**
- ✅ `nodes.json` a `services.json` převedeny na V31 porty (node RPC 9445/P2P 8335, pool stratum 8444/metrics 8455, multichain 8453).
- ✅ `v31.py` načítá porty a systemd jednotky z JSONů — žádné hardcoded porty.
- ✅ Nové endpointy `/api/v31/miner-metrics`, `/api/v31/pool-metrics`, `/api/v31/pool-prometheus`.
- ✅ `control()` a `logs()` podporují parametr `service` pro libovolnou V31 službu.

### ZionDex Multi-Path + Dashboard Metrics (2026-08-04) ✅

ZionDex ported do V31 multichain + dashboard metrics rozšířeny (Phase C2 + C8).

**ZionDex (Phase C2):**
- ✅ `quote_multi` — top-N routes via DFS path enumeration (až max_hops)
- ✅ `add_bridge_pool` — syntetické 1:1 pooly pro WARP bridge edges (cross-chain routing)
- ✅ `service.dex_quote_multi` — async wrapper
- ✅ `POST /v1/swap/quote/multi` — HTTP endpoint s `n` + `max_hops` parametry
- ✅ `swap/dex/intent.rs` — začátek intent layer (SwapIntent, SolverBid, PathHop, IntentStatus, IntentAuction) portovaný z archive/ZionDex/intent
- ✅ `swap/dex/intent_engine.rs` — `IntentEngine` a `SolverRegistry`; lifecycle open/bid/settle/execute proti `DexRouter`
- ✅ HTTP API pro intent engine: `POST /v1/swap/intent`, `GET /v1/swap/intent/:id`, `POST .../bid`, `POST .../settle`, `POST .../execute`, `POST .../solver/register`
- ✅ `ApiServer::router()` — testovatelný Axum router pro HTTP integrační testy
- ✅ SQLite persistence pro intenty, bidy a solvery; `load_intent_engine()` pro obnovu při startu
- ✅ Cross-chain bridge execution v `MultichainService::execute_intent` — AMM hops via `DexRouter`, bridge hops via `Bridge::submit` (`LockMint`/`BurnRelease`)
- ✅ Solver discovery/network: `SolverInfo` (URL + reputation), `SolverClient` trait, `HttpSolverClient` placeholder, `MockSolverClient`, `SolverNetwork` pro concurrent broadcast, `MultichainService::broadcast_intent`
- ✅ Integrační test v `tests/service.rs` pro plný intent lifecycle
- ✅ HTTP integrační test v `tests/server.rs` pro `POST /v1/swap/intent/.../bid/execute` přes tower/oneshot
- ✅ `tests/service.rs` restart test: vytvoření servisu, zavření DB, nový servis, `load_intent_engine()`, execute
- ✅ `tests/service.rs` cross-chain bridge intent test s `MockAdapter` pro `ZionL1` a `Base`
- ✅ `tests/service.rs` solver broadcast test — `MockSolverClient` vrací bid, `broadcast_intent` ho auto-submitne a následně se vykoná
- ✅ 574 multichain testů pass (bylo 562)
- ✅ `swap/dex/aggregator.rs` — cross-chain `Aggregator` nad `DexRouter` + `BridgeRegistry`, `find_best_path` pro AMM i bridge hops
- ✅ `swap/dex/executor.rs` — vyextrahovaný `Executor` pro AMM/bridge hop z `MultichainService::execute_intent`
- ✅ **Fáze C COMPLETE** — DAO governance runtime, ZionDex, HTLC, profit oracle, bridge consensus, CLI, dashboard; `cargo test --workspace` 2079 pass

**Dashboard (Phase C8):**
- ✅ Pool port fix: 8446 → 8444 (production stratum)
- ✅ All V31 service status (node, pool, miner, multichain, dao) — systemd
- ✅ Pool metrics z HTTP API (/stats na :8455)
- ✅ Pool Prometheus metrics parsing
- ✅ Multichain health check (:8453/health)
- ✅ DAO metrics/health/stats integrovány — `/api/v31/dao-health`, `/api/v31/dao-stats`, `/api/v31/dao-metrics`
- ✅ `nodes.json` detekce portů doplněna o `dao_api: 8456`; `services.json` má `zion-v31-dao` jednotku
- ✅ Nové API endpoints: /api/v31/services, /api/v31/pool-metrics, /api/v31/pool-prometheus, /api/v31/multichain-health

### Pool Runtime Wiring (2026-08-04) ✅

Všechny V3 parity moduly zapojené do pool runtime (main.rs + stratum.rs).

**Notifier (Telegram/SMTP/OASIS/webhook):**
- ✅ `StratumServer` drží `Arc<Notifier>` inicializovaný z env vars
- ✅ `notify_block_found()` při nalezení bloku v `stratum.rs`
- ✅ `notify_orphan()` při selhání `submitBlock` RPC
- ✅ `PayoutSweeper.with_notifier()` — `notify_payout_failed()` při chybě sweep
- ✅ `main.rs` loguje při startu, které notifikační kanály jsou aktivní

**RevenueScheduler (multi-stream revenue routing):**
- ✅ `StratumServer` drží `Arc<Mutex<RevenueScheduler>>` z env
- ✅ `with_revenue_scheduler()` builder pro `main.rs`
- ✅ `main.rs` loguje multi-stream plán při startu

**RevenueProxy (external pool forwarding):**
- ✅ `main.rs` spouští `ExternalPoolClient` pro každý enabled coin s wallet
- ✅ `client_from_profile()` + `CoinProfile::for_coin()`
- ✅ `AuxPowRuntimeConfig::wallet_for_coin()` — per-coin wallet lookup

**Cosmic-harmony:**
- ✅ `CoinProfile::for_coin()` — najde default profile pro konkrétní coin

**Test fix:**
- ✅ `ENV_MUTEX` serializuje env-var-dependent testy (fix parallel pollution)

### Pool FULL V3 Feature Parity (2026-08-04) ✅

Dokončeny všechny 11 chybějících V3 pool funkcí. Pool je teď **FULL V3 feature parity**.

**Nové moduly (3):**

- ✅ **`routing.rs`** (370 lines) — RoutingStats (per-group/source submit tracking s periodic logging), `resolve_session_group`, `extract_group_hint`, `session_group_name`, `group_index`, `source_index`, `ALL_REVENUE_SOURCES`. 11 unit testů.
  - SessionGroup routing: minery se směrují do Zion/Revenue/NCL/Auto skupin podle `g=xxx` hint v worker name nebo miner ID
  - Env: `ZION_POOL_ROUTING_LOG_EVERY`, `ZION_POOL_BACKEND_MINER_IDS`, `ZION_POOL_BACKEND_WORKER_HINTS`, `ZION_POOL_DEFAULT_GROUP`
- ✅ **`deferred_payout.rs`** (570 lines) — DeferredPayout queue s retry processorem, `check_tx_on_chain`, `get_chain_height`, `get_chain_difficulty`, `execute_fee_payout`, `fee_payout_recipients`, `fetch_pool_utxos`, `spawn_deferred_payout_processor`, `spawn_payout_confirmation_sweep`. 5 unit testů.
  - Retry queue: failed payouts se retryují každé 2s až 300x (10 min), pak rollback + alert
  - Fee sweep: humanitarian + issobella + pool fee jako batch UTXO transakce
  - Confirmation sweep: periodic check submitted payouts against chain
  - Env: `ZION_PAYOUT_MAX_RETRIES`, `ZION_PAYOUT_RETRY_INTERVAL_MS`, `ZION_PAYOUT_SWEEP_INTERVAL_SECS`
- ✅ **`ncl_gateway.rs`** (703 lines, ported from V3) — NCL AI compute gateway client, pricing (`NclPricing`), task dispatcher (`NclDispatcher`), heartbeat config. Pool → AI layer revenue stream.
  - Env: `ZION_NCL_GATEWAY_URL`, `ZION_NCL_HEARTBEAT`, `ZION_NCL_QUEUE_SIZE`, `ZION_NCL_PRICE_IN_PER_1K`, `ZION_NCL_PRICE_OUT_PER_1K`

**Aktualizované moduly:**

- ✅ **`stratum.rs`** — `resolve_session_group()` na Hello (loguje group), `RoutingStats.record()` na každý submit s periodic snapshot logging, `Notifier.notify_block_found()` + `notify_orphan()` na block submission
- ✅ **`api.rs`** — 3 nové endpointy: `/api/v1/revenue-stats`, `/api/v1/revenue-streams`, `/api/v1/routing-metrics`
- ✅ **`main.rs`** — `spawn_deferred_payout_processor()`, `spawn_payout_confirmation_sweep()`, NCL gateway init z `ZION_NCL_GATEWAY_URL`
- ✅ **`cosmic-harmony/lib.rs`** — re-export `NclStats`, `RevenueCollector`, `RevenueSource`

**V3 funkce dokončené (11/11):**

| # | V3 funkce | V31 implementace |
|---|-----------|-----------------|
| 1 | SessionGroup routing | `resolve_session_group` + `extract_group_hint` v `routing.rs` |
| 2 | RoutingStats | `RoutingStats` struct s `record()`, `snapshot_line()`, `snapshot_json()` |
| 3 | DeferredPayout | `DeferredPayout` queue + `spawn_deferred_payout_processor` |
| 4 | check_tx_on_chain | `check_tx_on_chain()` v `deferred_payout.rs` |
| 5 | execute_fee_payout | `execute_fee_payout()` + `fee_payout_recipients()` |
| 6 | SessionCtx | per-connection state v `handle_v3_client` (group, vardiff, telemetry) |
| 7 | handle_stratum_v1_client | `handle_request` sync + `handle_v3_client_generic` async |
| 8 | handle_external_share | `ExternalSubmit` forwarding v `handle_v3_client` |
| 9 | NiceHashRateEntry | `profit_switcher.rs` s `ProfitRouter` estimates |
| 10 | NclGateway | `ncl_gateway.rs` (ported z V3, 703 lines) |
| 11 | Revenue stats API | `/api/v1/revenue-stats` + `/api/v1/revenue-streams` + `/api/v1/routing-metrics` |

**Edge server ověřeno:**
- `deferred_payout_processor: enabled max_retries=300 interval_ms=2000` ✅
- `payout_confirmation_sweep: enabled interval_secs=30` ✅
- `ncl_gateway_enabled=false (set ZION_NCL_GATEWAY_URL to enable)` ✅
- `/api/v1/revenue-stats` → 200 OK ✅
- `/api/v1/revenue-streams` → 200 OK ✅
- `/api/v1/routing-metrics` → 200 OK ✅
- `broadcasting mining.notify job=zion_1` ✅

## Co zůstává otevřené / vyžaduje externí krok

1. ~~GPU miner backend~~ — `zion-miner/src/auxpow/gpu_miner.rs` OpenCL backend ported; CPU/GPU match test ready (Phase B2).
2. ~~4 feature-gated binaries~~ — completed; `v3-binaries` is default.
3. **Realné non-EVM WARP kontrakty** — Tron, Solana, Cosmos, Stellar, Cardano, Aptos, Sui, TON, NEAR, Bitcoin. V kódu je 31 placeholder/TODO markerů.
4. **PoC algoritmus** — `PocAlgorithm` vrací nyní bezpečně `Hash::default()`; aktivace až po governance.
5. **30d continuous run / mainnet beta** — vyžaduje nasazený Edge node a monitoring.
6. ~~**Production cut-over V3 → V31**~~ — ✅ COMPLETE (2026-08-05, Fáze D E2E green).
7. **macOS aarch64 release build** — `cargo build --release` OK, balíček `zion-macos-aarch64-3.1.0-alpha.2.tar.gz` (16 MB, SHA256) připraven v `V31/releases/macos-aarch64/`.
8. **Security audit a chaos testy** — naplánováno v 3.0.9 / 3.1.0-beta.
9. **Foundry/Hardhat projektová konfigurace** — chybí v `V31/L2/multichain/contracts/`, blokuje `zion deploy` pro EVM/ZionDex kontrakty.
10. **OASIS Web static export** — `next.config.ts` má `output: 'export'`, což blokuje server-side ZIS routes.
11. **ZIS Edge deploy** — `APP&WEB/identity/` existuje, ale `V31/deploy/deploy-edge.sh` neinstaluje `zion-zis.service`.
12. **Public subtree sync** — `public/` není zero-diff; potřeba audit a push do veřejného repa.
13. **Reálný GPU rig E2E** — lokální OpenCL benchmark GO, ale Edge pool E2E s referenčními rigy (≥90 % accept rate) pending.

## Edge staging E2E

- **2026-07-31:** V31 runtime smoke spuštěn na Edge na izolovaných portech. `zion-node` + `zion-pool` + `zion miner` vytěřily a přijaly kanonický block height 1.
- **V31 ↔ V3 sync:** P2P sync se zkouší. Po [A.6] fixu (AnnounceTx + message handling) by měl handshake fungovat — další test na Edge potřebný.

## Další krok

- **Pool FULL V3 Feature Parity ✅ COMPLETE** — všechny 11 V3 funkcí implementováno: AuxPoW bridge runtime, TLS, extra ports, share relay, profit switcher, expanded HTTP API, Notifier, RevenueScheduler, RevenueProxy, RoutingStats, SessionGroup routing, DeferredPayout, check_tx_on_chain, execute_fee_payout, NclGateway, revenue stats/streams API. 2075 testů pass. Pool nasazen a běží na Edge.
- **DAO Governance Runtime ✅ COMPLETE** — Voting engine, proposal lifecycle, HTTP API, SQLite persistence. 74 testů pass.
- **CLI Wallet + Service ✅ COMPLETE** — Wallet create/load/send, pool/miner/node start/stop/status, service logs.
- **ZionDex Multi-Path ✅ COMPLETE** — Top-N routes, cross-chain bridge routing, /v1/swap/quote/multi endpoint. 562 multichain testů pass.
- **Dashboard Metrics ✅ COMPLETE** — Pool metrics, service overview, multichain health, Prometheus parsing.
- **Pool Runtime Wiring ✅ COMPLETE** — Notifier, RevenueScheduler, RevenueProxy zapojené. 2075 testů pass.
- **Multi-Platform Release Build ✅ COMPLETE** — macOS aarch64/x86_64, Linux x86_64 (musl), Windows x86_64. Všechny balíčky + SHA256 připraveny, draft release na GitHubu, viz [`REPORT_2026-08-04_SESSION.md`](./REPORT_2026-08-04_SESSION.md).
- **Release Runbook ✅ COMPLETE** — `V31/RELEASE_RUNBOOK.md`, `V31/30D_RUN_PLAN.md`, `V31/CHAOS_TEST_PLAN.md`.
- **Clippy / Warning Cleanup ✅ COMPLETE** — `cargo clippy --workspace` clean, `cargo test --workspace` 2043+ testů pass.
- **Public Subtree Sync 🔄 IN PROGRESS** — `public/` není zero-diff; potřebuje audit a `git subtree push --prefix=public public main`.
- **Fáze D ✅ COMPLETE** — E2E mining (`zion-v31-miner` → pool → `share accepted`, block height 50+), web `/api/health` green, **Playwright UI E2E 3/3 pass**, **30min smoke test PASS**, **Edge backup + off-site sync COMPLETE**, **dashboard `https://dashboard.zionterranova.com` komplexně napojen na V31 služby** (`/api/services`, `/api/health`, `/api/readiness`, `/api/v2/status` ukazují V31 node/pool/miner/multichain/DAO/OASIS zelené, readiness 100 %). Git tag `v3.1.0-alpha.2-phase-D`.
- **Co zbývá pro mainnet beta / 3.2.0 "One Love":**
  - Non-EVM WARP kontrakty (Tron, Solana, Cosmos, ...) — 31 placeholderů v kódu
  - Foundry/Hardhat projekt pro `zion deploy` EVM/ZionDex kontraktů
  - OASIS Web `output: 'export'` → statický export blokuje ZIS server routes
  - ZIS Edge deploy — přidat `zion-zis.service` do `deploy-edge.sh`
  - Public subtree sync
  - Reálný GPU rig E2E (≥90 % accept rate) a 30d continuous run
  - Security audit + chaos testy (3.0.9 / 3.1.0-beta)
  - Publikace GitHub release z draftu

## 2026-08-07 (HISTORICAL) — PPLNS persistence deployed; payout verification blocked by V31 UTXO gap

- `zion-pool` PPLNS state is now persisted every 30s to `--state-path` (`/opt/zion/data/v31/pool-pplns.json`) after redeploy.
- `cargo test --workspace` and `cargo clippy --workspace` pass; updated binary `zion-pool` is live on Edge.
- **Resolved 2026-08-10+**: V31-native payout path is implemented and active. `PayoutSweeper` in `V31/L1/pool/src/payout.rs` uses `zion_core::v31_wallet::build_batch_payout` and calls `getUtxos` / `submitUtxoTransaction` on the V31 node RPC. `deferred_payout.rs` was also ported to `v31_wallet` so fee/deferred payouts no longer fall back to V3. Live Edge blocks (e.g. height 12831+) show `transfer` payout transactions from the pool wallet to miner addresses.
- Original blocker (kept for reference): the pool sweeper previously called `getUtxos` and `submitUtxoTransaction` on the V3 compatibility RPC while live V31 mining produced UTXO coinbase outputs on the V31 native chain. The V3 chain remained at height 0, so the pool wallet had no visible UTXOs.
