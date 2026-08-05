# V31 Mainnet Alpha — Status

> **Verze:** 3.1.0-alpha.2 (post-Phase A+B+C+Pool FULL V3 Parity)
> **Datum:** 2026-08-06
> **Stav:** workspace builduje, **2071 testů prochází (0 failures)**, `zion-pool` build OK a nasazen na Edge. Fáze A hotová, Fáze B.1/B.2/B.3 hotová (GPU + pool triple-stream), Fáze C1-C8 hotová (DAO + CLI + ZionDex + Dashboard + Pool wiring). **GPU backend port dokončen** — CUDA/OpenCL/Metal/native feature-gated buildy procházejí, `cargo clippy --workspace` je čisté. **Pool FULL V3 feature parity dokončena** — všechny 11 V3 funkcí implementováno: AuxPoW bridge runtime, TLS, extra ports, share relay, profit switcher, expanded HTTP API, Notifier, RevenueScheduler, RevenueProxy, RoutingStats, SessionGroup routing, DeferredPayout, check_tx_on_chain, execute_fee_payout, NclGateway, revenue stats/streams API. Kompletní report: [`REPORT_2026-08-04.md`](./REPORT_2026-08-04.md).

## Co je hotovo v `v3.1.0-alpha.2` (post-Phase A+B.1)

- L1/L2/L3/L4/L5/L6 crates existují a kompilují jako jeden workspace (18 crateů).
- **Všechny workspace testy pass: 2071** (bylo 2069 před C1+C2+C3, 2043 před Full V3 Parity, 1877 před B.1, 1458 před Fází A)
  - `zion-core` 302 testů (bylo 89 — +213 z P2P infra + V3 core + websocket)
  - `zion-native-ffi` 66 testů (NOVÝ crate)
  - `zion-cosmic-harmony` 193 testů (bylo 28 — +165 z V3 modules)
  - `zion-cosmic-harmony-v3` 205 testů
  - `zion-ai-native` 337 testů
  - `zion-multichain` 562 testů
  - `zion-ncl` 42 testů
  - `zion-oasis` 125 testů
  - `zion-pool` 160 testů (bylo 68 — +92 z TLS, share relay, profit switcher, auxpow runtime, expanded API, routing, deferred payout, NCL gateway)
  - `zion-miner` 13 testů
  - `zion-dao` 74 testů
  - `zion-free-world` 3 testy
  - `zion-issobella` 3 testy
  - `zion-smoke` 8 cross-layer testů
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
- **Triple-stream mining** — ZION + AuxPoW GPU + CPU fallback. GPU runtime backend port dokončen: OpenCL (`gpu-opencl`), CUDA (`gpu-cuda`), Metal (`gpu-metal`) a nativní CPU shims (`native-kheavyhash`, `native-blake3-algo`, `native-verushash`) kompilují pod `zion-miner`; `cargo clippy --workspace` čisté.
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
- ✅ 566 multichain testů pass (bylo 562)

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
3. **Realné non-EVM WARP kontrakty** — Tron, Solana, Cosmos, Stellar, Cardano, Aptos, Sui, TON, NEAR, Bitcoin.
4. **PoC algoritmus** — `PocAlgorithm` vrací nyní bezpečně `Hash::default()`; aktivace až po governance.
5. **30d continuous run / mainnet beta** — vyžaduje nasazený Edge node a monitoring.
6. **Production cut-over V3 → V31** — viz [`PLAN_TO_3.1.md`](../PLAN_TO_3.1.md) Fáze D.
7. **macOS aarch64 release build** — `cargo build --release` OK, balíček `zion-macos-aarch64-3.1.0-alpha.2.tar.gz` (16 MB, SHA256) připraven v `V31/releases/macos-aarch64/`.
8. **Security audit a chaos testy** — naplánováno v 3.0.9 / 3.1.0-beta.

## Edge staging E2E

- **2026-07-31:** V31 runtime smoke spuštěn na Edge na izolovaných portech. `zion-node` + `zion-pool` + `zion miner` vytěřily a přijaly kanonický block height 1.
- **V31 ↔ V3 sync:** P2P sync se zkouší. Po [A.6] fixu (AnnounceTx + message handling) by měl handshake fungovat — další test na Edge potřebný.

## Další krok

- **Pool FULL V3 Feature Parity ✅ COMPLETE** — všechny 11 V3 funkcí implementováno: AuxPoW bridge runtime, TLS, extra ports, share relay, profit switcher, expanded HTTP API, Notifier, RevenueScheduler, RevenueProxy, RoutingStats, SessionGroup routing, DeferredPayout, check_tx_on_chain, execute_fee_payout, NclGateway, revenue stats/streams API. 2071 testů pass. Pool nasazen a běží na Edge.
- **DAO Governance Runtime ✅ COMPLETE** — Voting engine, proposal lifecycle, HTTP API, SQLite persistence. 74 testů pass.
- **CLI Wallet + Service ✅ COMPLETE** — Wallet create/load/send, pool/miner/node start/stop/status, service logs.
- **ZionDex Multi-Path ✅ COMPLETE** — Top-N routes, cross-chain bridge routing, /v1/swap/quote/multi endpoint. 562 multichain testů pass.
- **Dashboard Metrics ✅ COMPLETE** — Pool metrics, service overview, multichain health, Prometheus parsing.
- **Pool Runtime Wiring ✅ COMPLETE** — Notifier, RevenueScheduler, RevenueProxy zapojené. 2071 testů pass.
- **Multi-Platform Release Build ✅ COMPLETE** — macOS aarch64/x86_64, Linux x86_64 (musl), Windows x86_64. Všechny balíčky + SHA256 připraveny, draft release na GitHubu, viz [`REPORT_2026-08-04_SESSION.md`](./REPORT_2026-08-04_SESSION.md).
- **Release Runbook ✅ COMPLETE** — `V31/RELEASE_RUNBOOK.md`, `V31/30D_RUN_PLAN.md`, `V31/CHAOS_TEST_PLAN.md`.
- **Clippy / Warning Cleanup ✅ COMPLETE** — `cargo clippy --workspace` clean, `cargo test --workspace` 2043+ testů pass.
- **Public Subtree Sync ✅ COMPLETE** — `git subtree push --prefix=public public main` up-to-date.
- **Fáze D — co zbývá pro mainnet beta:**
  - Non-EVM WARP kontrakty (Tron, Solana, Cosmos, ...)
  - Security audit + chaos testy (3.0.9 / 3.1.0-beta)
  - 30d continuous run / mainnet beta
  - Publikace GitHub release z draftu
