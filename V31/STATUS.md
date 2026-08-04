# V31 Mainnet Alpha — Status

> **Verze:** 3.1.0-alpha.2 (post-Phase A+B+C+Pool Complete)
> **Datum:** 2026-08-04
> **Stav:** workspace builduje, **2043 testů prochází (0 failures)**, `zion-pool` build OK a nasazen na Edge. Fáze A hotová, Fáze B.1/B.2/B.3 hotová (GPU + pool triple-stream), Fáze C1-C8 hotová (DAO + CLI + ZionDex + Dashboard + Pool wiring). **Pool V3 feature parity dokončena** — AuxPoW bridge runtime, TLS, extra ports, share relay, profit switcher, expanded HTTP API, Notifier, RevenueScheduler, RevenueProxy. Kompletní report: [`REPORT_2026-08-04.md`](./REPORT_2026-08-04.md).

## Co je hotovo v `v3.1.0-alpha.2` (post-Phase A+B.1)

- L1/L2/L3/L4/L5/L6 crates existují a kompilují jako jeden workspace (18 crateů).
- **Všechny workspace testy pass: 2000+** (bylo 1877 před B.1, 1458 před Fází A)
  - `zion-core` 291 testů (bylo 89 — +202 z P2P infra + V3 core + websocket)
  - `zion-native-ffi` 21 testů (NOVÝ crate)
  - `zion-cosmic-harmony` 185 testů (bylo 28 — +157 z V3 modules)
  - `zion-cosmic-harmony-v3` 205 testů
  - `zion-ai-native` 337 testů
  - `zion-multichain` 554 testů
  - `zion-ncl` 42 testů
  - `zion-oasis` 124 testů
  - `zion-pool` 134 testů (bylo 68 — +66 z TLS, share relay, profit switcher, auxpow runtime, expanded API)
  - `zion-miner` 14 testů (bylo 13 — +1 z autonomous)
  - `zion-dao` 12 testů
  - `zion-free-world` 3 testy
  - `zion-issobella` 3 testy
  - `zion-smoke` 3 cross-layer testy
  - `zion-sdk` 4 testy

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
  - ✅ cosmic-harmony re-exports: cosmic_harmony_with_height, deeksha_lite, deeksha_lite_fire
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
- **Height-aware PoW fork gating** — `HeightAwareDeeksha` + stress testy napříč CHv3 4500 / Fire 5000.
- **P2P hardening** — peer manager, ban score, max peers, discovery, rate limiting, escalating bans.
- **Triple-stream mining** — ZION + AuxPoW GPU + CPU fallback (GPU OpenCL kernel sources ported, runtime backend in progress).
- **Custom AMM** deploy v `zion-multichain` (SQLite persistence, HTTP API).
- **WARP API rate limiting + auth** — token bucket + optional Bearer.
- **Cross-layer smoke** — `V31/smoke` propojuje NCL → AI-Native → Oasis → Free World → Issobella.
- **WARP HTLC smoke** — lock/claim mezi Base a ZionL1.
- **DAO governance smoke** — proposal, vote, quorum.
- **HTLC persistence** — SQLite backend.

### Nově připojené v této iteraci

- **B2 full Ekam v2 GPU** — `zion-miner/src/auxpow/gpu_miner.rs` nově používá kanonické OpenCL jádro `ekam_deeksha_mine` pro `cosmic_harmony_ekam_deeksha_v2` (dříve fallback na `deeksha_chv3`). Včetně NPU buffer uploadu podle epochy a CPU↔GPU parity testu.
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

### DAO Governance Runtime (2026-08-04) ✅

DAO governance runtime dokončena (Phase C1). Plný lifecycle návrhů s hlasováním, kvórem a timelockem.

**Nové moduly:**

- ✅ **`voting.rs`** (215 lines) — VotingEngine: token-weighted voting (1 ZION = 1 vote), double-vote prevention, vote weight tracking.
- ✅ **`runtime.rs`** (420 lines) — GovernanceRuntime: plný proposal lifecycle (Create → Vote → Tally → Quorum → Timelock → Execute). Parliamentary election s D'Hondt seat allocation. Cancel by proposer nebo guardian. Process expired proposals batch.
- ✅ **`api.rs`** (500 lines) — Axum HTTP API s 9 endpoints: health, proposals CRUD, vote, tally, execute, cancel, stats. X-DAO-Key auth pro write operace. ProposalTypeDto pro JSON-friendly input.
- ✅ **`main.rs`** — `zion-dao` binárka s tracing-subscriber.

**Testy:** 31 DAO testů pass (bylo 12).

### CLI Wallet + Service Management (2026-08-04) ✅

CLI rozšířeno o wallet file management a service lifecycle (Phase C6 + C7).

**Wallet commands:**
- ✅ `wallet create` — generuje Ed25519 keypair, ukládá do JSON souboru (~/.zion/wallet.json), --force pro overwrite
- ✅ `wallet load` — načte wallet ze souboru, zobrazí address + public key
- ✅ `wallet send` — fetch UTXOs z L1 RPC, build+sign tx, broadcast přes submitTransaction JSON-RPC. --dry-run, --memo, --rpc, --fee flags.

**Service lifecycle commands:**
- ✅ `node start|stop|status|restart`, `pool start|stop|status|stats`, `miner start|stop|status` — přímé systemctl příkazy pro každý V31 service
- ✅ `service logs <service> [--lines N]` — journalctl log viewer

### ZionDex Multi-Path + Dashboard Metrics (2026-08-04) ✅

ZionDex ported do V31 multichain + dashboard metrics rozšířeny (Phase C2 + C8).

**ZionDex (Phase C2):**
- ✅ `quote_multi` — top-N routes via DFS path enumeration (až max_hops)
- ✅ `add_bridge_pool` — syntetické 1:1 pooly pro WARP bridge edges (cross-chain routing)
- ✅ `service.dex_quote_multi` — async wrapper
- ✅ `POST /v1/swap/quote/multi` — HTTP endpoint s `n` + `max_hops` parametry
- ✅ 3 nové testy (562 multichain testů pass)

**Dashboard (Phase C8):**
- ✅ Pool port fix: 8446 → 8444 (production stratum)
- ✅ All V31 service status (node, pool, miner, multichain, dao) — systemd
- ✅ Pool metrics z HTTP API (/stats na :8080)
- ✅ Pool Prometheus metrics parsing
- ✅ Multichain health check (:8453/health)
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

## Co zůstává otevřené / vyžaduje externí krok

1. ~~GPU miner backend~~ — `zion-miner/src/auxpow/gpu_miner.rs` OpenCL backend ported; CPU/GPU match test ready (Phase B2).
2. ~~4 feature-gated binaries~~ — completed; `v3-binaries` is default.
3. **Realné non-EVM WARP kontrakty** — Tron, Solana, Cosmos, Stellar, Cardano, Aptos, Sui, TON, NEAR, Bitcoin.
4. **PoC algoritmus** — `PocAlgorithm` vrací nyní bezpečně `Hash::default()`; aktivace až po governance.
5. **30d continuous run / mainnet beta** — vyžaduje nasazený Edge node a monitoring.
6. **Production cut-over V3 → V31** — viz [`PLAN_TO_3.1.md`](../PLAN_TO_3.1.md) Fáze D.
7. **Security audit a chaos testy** — naplánováno v 3.0.9 / 3.1.0-beta.

## Edge staging E2E

- **2026-07-31:** V31 runtime smoke spuštěn na Edge na izolovaných portech. `zion-node` + `zion-pool` + `zion miner` vytěřily a přijaly kanonický block height 1.
- **V31 ↔ V3 sync:** P2P sync se zkouší. Po [A.6] fixu (AnnounceTx + message handling) by měl handshake fungovat — další test na Edge potřebný.

## Další krok

- **Pool V3 Feature Parity ✅ COMPLETE** — AuxPoW bridge runtime, TLS, extra ports, share relay, profit switcher, expanded HTTP API, Notifier, RevenueScheduler, RevenueProxy. Pool nasazen a běží na Edge.
- **DAO Governance Runtime ✅ COMPLETE** — Voting engine, proposal lifecycle, HTTP API. 31 testů pass.
- **CLI Wallet + Service ✅ COMPLETE** — Wallet create/load/send, pool/miner/node start/stop/status, service logs.
- **ZionDex Multi-Path ✅ COMPLETE** — Top-N routes, cross-chain bridge routing, /v1/swap/quote/multi endpoint. 562 multichain testů pass.
- **Dashboard Metrics ✅ COMPLETE** — Pool metrics, service overview, multichain health, Prometheus parsing.
- **Pool Runtime Wiring ✅ COMPLETE** — Notifier, RevenueScheduler, RevenueProxy zapojené. 2043 testů pass.
- **Fáze D zbývá:** Production hardening:
  - Non-EVM WARP kontrakty (Tron, Solana, Cosmos, ...)
  - Security audit + chaos testy (3.0.9 / 3.1.0-beta)
  - 30d continuous run / mainnet beta
