# V31 Mainnet Alpha — Status

> **Verze:** 3.1.0-alpha.2 (post-Phase A+B partial)
> **Datum:** 2026-08-03
> **Stav:** workspace builduje, **1872 testů procházejí**, 0 failed. Fáze A hotová, Fáze B partial.

## Co je hotovo v `v3.1.0-alpha.2` (post-Phase A+B)

- L1/L2/L3/L4/L5/L6 crates existují a kompilují jako jeden workspace (18 crateů).
- **Všechny workspace testy pass: 1872** (bylo 1458 před Fází A)
  - `zion-core` 286 testů (bylo 89 — +197 z P2P infra + V3 core modules)
  - `zion-native-ffi` 21 testů (NOVÝ crate)
  - `zion-cosmic-harmony` 185 testů (bylo 28 — +157 z V3 modules)
  - `zion-cosmic-harmony-v3` 205 testů
  - `zion-ai-native` 337 testů
  - `zion-multichain` 554 testů
  - `zion-ncl` 42 testů
  - `zion-oasis` 124 testů
  - `zion-pool` 68 testů (bylo 21 — +47 z PPLNS+store+stratum_v1+revenue_proxy+v3_protocol)
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

### Fáze B — L1 Completion (partial)

- **[B.1] V3 core modules** — 10/11 modulů enabled:
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
  - ⏳ v3_node_builder.rs (375 lines) — needs ChainState/NodeRuntime port
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

- **[B.3] Miner AuxPoW merge** — 6/7 modules enabled:
  - ✅ 14 V3 cosmic-harmony modules (9500+ lines): algorithms_opt, scratchpad_ekam,
    algorithms_npu, deeksha, deeksha_lite, deeksha_lite_fire, hic, hugepages,
    ncl_integration, revenue, revenue_journal, sha3_fast, stream_layers, stream_profit
  - ✅ 6 miner modules enabled: b3_verify, reconnect, cpu_features, thread_affinity,
    gpu_guard, autonomous
  - ✅ cosmic-harmony re-exports: cosmic_harmony_with_height, deeksha_lite, deeksha_lite_fire
  - ✅ ExternalCoin methods: ticker(), is_gpu(), is_cpu(), estimated_*_power_watts()
  - ✅ ProfitRouter::default_estimates() (V3 fetch_live_profit_estimates compat)
  - ✅ pool_message.rs (65 lines) — local PoolMessage to avoid cyclic dep
  - ⏳ parallel.rs (328 lines) — needs zion_auxpow crate (feature-gated)

### Původní alpha.2 features

- **V3 checkpoint sync** — L1 umí načíst V3 stav jako genesis checkpoint.
- **Height-aware PoW fork gating** — `HeightAwareDeeksha` + stress testy napříč CHv3 4500 / Fire 5000.
- **P2P hardening** — peer manager, ban score, max peers, discovery, rate limiting, escalating bans.
- **Triple-stream mining** — ZION + AuxPoW GPU + CPU fallback (GPU kernely nyní portovány).
- **Custom AMM** deploy v `zion-multichain` (SQLite persistence, HTTP API).
- **WARP API rate limiting + auth** — token bucket + optional Bearer.
- **Cross-layer smoke** — `V31/smoke` propojuje NCL → AI-Native → Oasis → Free World → Issobella.
- **WARP HTLC smoke** — lock/claim mezi Base a ZionL1.
- **DAO governance smoke** — proposal, vote, quorum.
- **HTLC persistence** — SQLite backend.

## Co zůstává otevřené / vyžaduje externí krok

1. **V3 ChainState + NodeRuntime port** — v3_node_builder.rs čeká (~4500 řádků V3 lib.rs). Toto je nejkomplexnější port — ChainState (~3400 řádků) + NodeRuntime (~1170 řádků).
2. **parallel.rs** — needs zion_auxpow crate (feature-gated). Defer po ChainState port.
3. **websocket.rs** — needs NodeRuntime. Defer po ChainState port.
4. **Realné non-EVM WARP kontrakty** — Tron, Solana, Cosmos, Stellar, Cardano, Aptos, Sui, TON, NEAR, Bitcoin.
5. **PoC algoritmus** — `PocAlgorithm` vrací nyní bezpečně `Hash::default()`; aktivace až po governance.
6. **30d continuous run / mainnet beta** — vyžaduje nasazený Edge node a monitoring.
7. **Production cut-over V3 → V31** — viz [`PLAN_TO_3.1.md`](../PLAN_TO_3.1.md) Fáze D.
8. **Security audit a chaos testy** — naplánováno v 3.0.9 / 3.1.0-beta.

## Edge staging E2E

- **2026-07-31:** V31 runtime smoke spuštěn na Edge na izolovaných portech. `zion-node` + `zion-pool` + `zion miner` vytěřily a přijaly kanonický block height 1.
- **V31 ↔ V3 sync:** P2P sync se zkouší. Po [A.6] fixu (AnnounceTx + message handling) by měl handshake fungovat — další test na Edge potřebný.

## Další krok

- **Fáze B.1 complete:** Portovat ChainState + NodeRuntime z V3 lib.rs (~4500 řádků)
- **Fáze B.3 complete:** Enable autonomous.rs, parallel.rs (po ChainState port)
- Pak Fáze C (binaries + edge-deploy) a Fáze D (cutover)
