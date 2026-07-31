# V31 Mainnet Alpha — Status

> **Verze:** 3.1.0-alpha.2  
> **Datum:** 2026-07-30  
> **Stav:** workspace builduje, všechny testy procházejí, clippy bez warningů (až na záměrně potlačené), runtime paniky odstraněny.

## Co je hotovo v `v3.1.0-alpha.2`

- L1/L2/L3/L4/L5/L6 crates existují a kompilují jako jeden workspace.
- **Všechny workspace testy pass:**
  - `zion-cosmic-harmony-v3` 205 testů
  - `zion-core` 89 testů (včetně `stress_mine_across_fork_boundaries`)
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
- **V3 checkpoint sync** — L1 umí načíst V3 stav jako genesis checkpoint.
- **Height-aware PoW fork gating** — `HeightAwareDeeksha` + stress testy napříč CHv3 4500 / Fire 5000.
- **P2P hardening** — peer manager, ban score, max peers, discovery.
- **Triple-stream mining** — ZION + AuxPoW GPU + CPU fallback.
- **Custom AMM** deploy v `zion-multichain` (SQLite persistence, HTTP API).
- **WARP API rate limiting + auth** — token bucket + optional Bearer.
- **Cross-layer smoke** — `V31/smoke` propojuje NCL → AI-Native → Oasis → Free World → Issobella.
- **WARP HTLC smoke** — lock/claim mezi Base a ZionL1.
- **DAO governance smoke** — proposal, vote, quorum.
- **HTLC persistence** — SQLite backend.
- **`v3.1.0-alpha.2` tag** vytvořen a pushnut.

## Co zůstává otevřené / vyžaduje externí krok

Tyto položky nelze v kódu „dokončit“ bez nasazení nebo rozhodnutí; jsou dokumentovány a konfigurovatelné:

1. **Realné non-EVM WARP kontrakty** — Tron, Solana, Cosmos, Stellar, Cardano, Aptos, Sui, TON, NEAR, Bitcoin. Kód a testy existují, placeholder kontraktových adres se nahrazují env proměnnými (`WARP_*_CONTRACT`, `WARP_*_ZION_*`).
2. **PoC algoritmus** — `PocAlgorithm` vrací nyní bezpečně `Hash::default()`; aktivace až po governance.
3. **30d continuous run / mainnet beta** — vyžaduje nasazený Edge node a monitoring.
4. **Production cut-over V3 → V31** — viz [`V31/CUTOVER_PLAN.md`](./CUTOVER_PLAN.md); vyžaduje ops rozhodnutí.
5. **Security audit a chaos testy** — naplánováno v 3.0.9 / 3.1.0-beta.

## Edge staging E2E

- **2026-07-31:** V31 runtime smoke (`scripts/smoke-runtime.sh`) spuštěn na Edge (`62.171.141.136`) na izolovaných portech (`9445/8446/8335`), mimo V3 služby. `zion-node` + `zion-pool` + `zion miner` vytěřily a přijaly kanonický block height 1.
- `cargo test -p zion-smoke` prošel na Edge (L3–L6 cross-layer, WARP HTLC, DAO governance).
- **Dashboard page:** `/v31/` na `https://dashboard.zionterranova.com` zobrazuje live stav V31, ovládání start/stop, logy a výšky řetězce.
- **V31 ↔ V3 sync:** Dashboard umí importovat V3 state (`/opt/zion/data/state`) jako checkpoint. V31 node po importu hlásí V3 výšku 9712+ a canonical výšku 0 (migration block). P2P sync se zkouší, ale V3 mainnet peer zatím odpojuje spojení (handshake/protokol není plně kompatibilní).

## Další krok

- Vytvořit `v3.1.0-beta` release s binárkami (Linux, Windows, macOS) + SHA256SUMS, pak spustit 30d continuous run.
