# V31 Mainnet Alpha — Status

> **Verze:** 3.1.0-alpha.2 (post-Phase A+B partial)
> **Datum:** 2026-08-03
> **Stav:** workspace builduje, **1861 testů procházejí**, clippy bez warningů (core/pool). Fáze A hotová, Fáze B partial.

## Co je hotovo v `v3.1.0-alpha.2` (post-Phase A+B)

- L1/L2/L3/L4/L5/L6 crates existují a kompilují jako jeden workspace (18 crateů).
- **Všechny workspace testy pass: 1861** (bylo 1458 před Fází A)
  - `zion-core` 286 testů (bylo 89 — +197 z P2P infra + V3 core modules)
  - `zion-native-ffi` 21 testů (NOVÝ crate)
  - `zion-cosmic-harmony` 185 testů (bylo 28 — +157 z V3 modules)
  - `zion-cosmic-harmony-v3` 205 testů
  - `zion-ai-native` 337 testů
  - `zion-multichain` 554 testů
  - `zion-ncl` 42 testů
  - `zion-oasis` 124 testů
  - `zion-pool` 65 testů (bylo 21 — +44 z PPLNS+store+stratum_v1)
  - `zion-miner` 13 testů
  - `zion-dao` 12 testů
  - `zion-free-world` 3 testy
  - `zion-issobella` 3 testy
  - `zion-smoke` 3 cross-layer testy
  - `zion-sdk` 4 testy

### Fáze A — Critical Gap Closure (PLAN_TO_3.1.md) ✅

- **[A.4] native-ffi portován** — 411 souborů, 9 algoritmů. Feature-gated `native-hashers`.
- **[A.5] GPU csrc kernely portovány** — 158 souborů, CUDA/OpenCL/Metal. Feature-gated.
- **[A.6] P2P wire protocol fix** — AnnounceTx, message handling.
- **[A.6b] P2P infra moduly portovány** — security, propagation, discovery, IBD.

### Fáze B — L1 Completion (partial)

- **[B.1] V3 core modules** — 10/11 modulů enabled:
  - ✅ v3_tx, v3_chain, v3_mempool, v3_full_checkpoint, metrics, orphan
  - ✅ launch, v3_validation, v3_bridge, v3_wallet
  - ⏳ v3_node_builder (needs ChainState/NodeRuntime port)
  - Added: BlockCandidate, MiningJob, MiningSolution, SealedBlock types
  - Added: AccountTransaction::verify_signature(), crypto::sign_and_zeroize()
  - Added: migration::MIGRATION_DIVISOR, is_post_migration()

- **[B.2] Pool completion** — PPLNS+store+stratum_v1 ported:
  - ✅ v3_pplns.rs (1626 lines) — Advanced P7-P10 PPLNS engine
  - ✅ store.rs (850 lines) — SQLite persistence with migrations
  - ✅ stratum_v1.rs (398 lines) — Bitcoin-compatible stratum v1
  - ⏳ revenue_proxy.rs (469 lines) — copied but not enabled (needs V3 CoinProfile)

- **[B.3] Miner AuxPoW merge** — Infrastructure ported:
  - ✅ 14 V3 cosmic-harmony modules (9500+ lines)
  - ✅ 5 miner modules enabled: b3_verify, reconnect, cpu_features, thread_affinity, gpu_guard
  - ⏳ autonomous.rs, parallel.rs — need deeksha_lite, cosmic_harmony_with_height

### Původní alpha.2 features

- V3 checkpoint sync, height-aware PoW fork gating, P2P hardening
- Triple-stream mining (ZION + AuxPoW GPU + CPU fallback)
- Custom AMM, WARP API, cross-layer smoke, HTLC persistence

## Co zůstává otevřené

1. **V3 ChainState + NodeRuntime port** — v3_node_builder.rs čeká (~4500 řádků)
2. **revenue_proxy.rs** — needs V3 CoinProfile fields (ticker, pool_host, pool_port)
3. **autonomous.rs, parallel.rs** — need deeksha_lite, cosmic_harmony_with_height
4. **Realné non-EVM WARP kontrakty** — Tron, Solana, Cosmos, atd.
5. **30d continuous run / mainnet beta** — vyžaduje nasazený Edge node
6. **Production cut-over V3 → V31** — viz PLAN_TO_3.1.md Fáze D
7. **Security audit a chaos testy** — naplánováno v 3.0.9 / 3.1.0-beta

## Další krok

- **Fáze B.1 complete:** Portovat ChainState + NodeRuntime z V3 lib.rs (~4500 řádků)
- **Fáze B.2 complete:** Enable revenue_proxy.rs (needs CoinProfile adapt)
- **Fáze B.3 complete:** Enable autonomous.rs, parallel.rs (needs deeksha_lite)
- Pak Fáze C (binaries + edge-deploy) a Fáze D (cutover)
