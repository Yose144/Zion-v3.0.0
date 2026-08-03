# V31 Mainnet Alpha — Status

> **Verze:** 3.1.0-alpha.2 (post-Phase A)
> **Datum:** 2026-08-03
> **Stav:** workspace builduje, **1596 testů procházejí**, clippy bez warningů. Fáze A PLAN_TO_3.1.md hotová — native-ffi, GPU kernely, P2P infra portovány.

## Co je hotovo v `v3.1.0-alpha.2` (post-Phase A)

- L1/L2/L3/L4/L5/L6 crates existují a kompilují jako jeden workspace (18 crateů).
- **Všechny workspace testy pass: 1596** (bylo 1458 před Fází A)
  - `zion-core` 226 testů (bylo 89 — +137 z P2P infra + V3 core modules)
  - `zion-native-ffi` 21 testů (NOVÝ crate)
  - `zion-cosmic-harmony-v3` 205 testů
  - `zion-cosmic-harmony` 28 testů
  - `zion-ai-native` 337 testů
  - `zion-multichain` 554 testů
  - `zion-ncl` 42 testů
  - `zion-oasis` 124 testů
  - `zion-pool` 21 testů
  - `zion-miner` 13 testů
  - `zion-dao` 12 testů
  - `zion-free-world` 3 testy
  - `zion-issobella` 3 testy
  - `zion-smoke` 3 cross-layer testy
  - `zion-sdk` 4 testy

### Fáze A — Critical Gap Closure (PLAN_TO_3.1.md)

- **[A.4] native-ffi portován** — RandomX, Ghostrider, VerusHash, Autolykos, kHeavyHash, Blake3, Ethash, KawPow, Cosmic Harmony. 411 souborů, 11 MB. Feature-gated `native-hashers` v zion-miner.
- **[A.5] GPU csrc kernely portovány** — CUDA (12 kernelů), OpenCL (30+ kernelů), Metal (14 kernelů). 158 souborů z AuXpow + V3. Feature-gated `gpu-opencl`, `gpu-cuda`, `gpu-metal`.
- **[A.6] P2P wire protocol fix** — AnnounceTx přidán do P2pMessage enum, sync client gracefully skips non-block messages, block_to_accepted() počítá fee fields.
- **[A.6b] P2P infra moduly portovány** — p2p_security.rs (350 řádků, rate limiting + escalating bans), propagation.rs (628 řádků, flood-fill relay), discovery.rs (675 řádků, UDP peer discovery), ibd.rs (483 řádků, IBD state machine).
- **[B.1 partial] V3 core modules portovány** — v3_tx.rs (476), v3_chain.rs (535), v3_mempool.rs (535), v3_full_checkpoint.rs (522), metrics.rs (529), orphan.rs (282). 5 modulů čeká na ChainState/NodeRuntime (v3_validation, v3_bridge, v3_wallet, launch, v3_node_builder).

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

1. **V3 ChainState + NodeRuntime port** — 5 modulů čeká (v3_validation, v3_bridge, v3_wallet, launch, v3_node_builder). Vyžaduje port V3 `lib.rs` ChainState (~3400 řádků) a NodeRuntime (~1170 řádků).
2. **Realné non-EVM WARP kontrakty** — Tron, Solana, Cosmos, Stellar, Cardano, Aptos, Sui, TON, NEAR, Bitcoin.
3. **PoC algoritmus** — `PocAlgorithm` vrací nyní bezpečně `Hash::default()`; aktivace až po governance.
4. **30d continuous run / mainnet beta** — vyžaduje nasazený Edge node a monitoring.
5. **Production cut-over V3 → V31** — viz [`PLAN_TO_3.1.md`](../PLAN_TO_3.1.md) Fáze D.
6. **Security audit a chaos testy** — naplánováno v 3.0.9 / 3.1.0-beta.

## Edge staging E2E

- **2026-07-31:** V31 runtime smoke spuštěn na Edge na izolovaných portech. `zion-node` + `zion-pool` + `zion miner` vytěřily a přijaly kanonický block height 1.
- **V31 ↔ V3 sync:** P2P sync se zkouší. Po [A.6] fixu (AnnounceTx + message handling) by měl handshake fungovat — další test na Edge potřebný.

## Další krok

- **Fáze B.1 complete:** Portovat ChainState + NodeRuntime z V3 lib.rs (~4500 řádků)
- **Fáze B.2:** Pool completion (stratum, 24 coinů, share forwarding)
- **Fáze B.3:** Miner AuxPoW merge (6808 řádků client + hashers)
- Pak Fáze C (binaries + edge-deploy) a Fáze D (cutover)
