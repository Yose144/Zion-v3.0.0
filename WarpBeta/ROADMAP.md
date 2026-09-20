# WARP Beta — Roadmap

> Strategie z ChatGPT výzkumu: **jedna konkrétní věc dobře** — ZION ↔ BTC atomic swap. Ne celé L2, ne 13 chainů, ne DEX. WARP 0.1 → testnet-ready → mainnet, pak teprve LN a další chainy.

## Přehled fází

| Fáze | Cíl | Závislosti |
|---|---|---|
| **WARP 0.1** | ZION ↔ BTC **on-chain HTLC**, manuální koordinace, signet E2E | C1–C6, C8 |
| **WARP 0.2** | Automated swap — `warpd` orchestrace obou legů, CLI/API, per-swap adresy | C9, WARP 0.1 |
| **WARP 0.3** | BTC **Lightning** ↔ ZION (LND, hold invoice / HODL-swap pattern) | LND node, LN adapter enable |
| **WARP 1.0** | „ZION Native WARP" — produkční, auditované, order book / solver discovery | audit, mainnet, ops |
| **WARP 1.x** | EVM / Solana / TON / další chainy přes stejný HTLC pattern | 1.0 |

## WARP 0.1 — On-chain HTLC (aktuální sprint)

**Výstup:** dvě strany provedou kompletní swap na signetu + ZION mainnet/testnet, včetně refund path. Manuální koordinace (CLI parametry), `warpd` jen sleduje a podepisuje.

### Tasky

- [x] **T1 — `btc_htlc.rs` builder** (`V31/L2/multichain/src/warp/`) ✅ hotovo
  - `build_htlc_script` → kanonický 13-op witness script + P2WSH adresa; strict parser + byte-exact round-trip; 10 unit testů vč. sighash verifikace
- [x] **T2 — BTC spend paths** (`btc_signer.rs` + `btc_htlc.rs`) ✅ hotovo
  - `lock_htlc`/`claim_htlc`/`refund_htlc` na `BtcSigner`; BIP143 sighash; claim `[sig, preimage, OP_TRUE, script]`, refund `[sig, Ø, script]`
- [x] **T3 — Per-swap detekce** (`warp/adapter/bitcoin.rs`) ✅ hotovo
  - `detect_htlc_lock` (funding output → `BtcHtlcLock` s confs) + `detect_htlc_spend` (Claim/Refund + preimage z witnessu ověřena proti scriptu i hashlocku); multi-endpoint failover (`WARP_BITCOIN_API` comma-list)
- [x] **T4 — Preimage propagation** ✅ hotovo
  - `extract_preimage` → `revealed_preimage`/`claim_source` v `BtcSwapFlow` orchestrátoru
- [x] **T5 — Timeout policy** ✅ hotovo
  - `cltv_from_zion_timeout` + `cltv_before_zion_timeout`; `Δ` margin konvence
- [x] **T6 — E2E** ✅ regtest (bitcoind+rpc backend) + live-ZION / ❌ signet dead-end
  - regtest docker esplora na Edge (2026-09-17): cross-leg oba směry, refund paths, restart recovery — PASS
  - **live mainnet ZION leg SETTLED 2026-09-18** (`d77f837a` lock → `8c60d064` claim)
  - **regtest re-run 2026-09-20 přes nativní `bitcoind+rpc://` backend** (`zion-bitcoind-regtest` na Edge): 6/6 testů PASS — oba směry SETTLED, oba refund paths, restart recovery; live-ZION leg znovu SETTLED (`fa193379…` lock → `72abda00…` claim)
  - signet/testnet3: faucety nedoručily funding (ověřeno 2026-09-20) → nahrazeno **mainnet dust pilotem**

### Kritéria dokončení 0.1 — stav 2026-09-20

- [x] 2× úspěšný swap (oba směry) — regtest E2E + live ZION mainnet leg SETTLED
- [x] 1× úspěšný refund na každé straně — regtest (ZionToBtc: RefundBtc po CLTV; BtcToZion: RefundZion + user BTC refund)
- [x] `cargo test -p zion-multichain` zelené (666 testů) + unit testy btc_htlc
- [x] žádné secrets v repo; `warp.toml` dokumentované
- [x] Edge redeploy na HEAD — `warpd` @ `9af96f6ae` (R2 TTL + R4 failover + bitcoind backend + metrics), Prometheus alerting zapnuto
- [ ] **mainnet dust pilot** (náhrada za signet) — čeká na produkční `WARP_BTC_RELAY_KEY` + ~100k sats funding `bc1q53gn9…5n6k` + externí audit + dokončení mainnet bitcoind IBD (~5%)

## WARP 0.2 — Automated swap — ✅ hotovo (2026-09-19)

- ✅ `BtcSwapFlow` state machine v `warpd` (autonomní: detect → lock → claim/refund, `poll_once` loop, offer TTL, admission guards)
- ✅ CLI: `zion warp btc-swap offer|list|status` (`--zis-api-key` auth)
- ✅ HTTP API: `POST /swaps/btc/offer` (fail-closed auth), `GET /list`, `GET /:id`
- ✅ Keyring: `WARP_BTC_RELAY_KEY` (WIF) + dedikovaný `WARP_BTC_SWAP_ZION_SECRET` keyring (funded 500 ZION)
- ⏳ Offer discovery: zatím manuální (API inject), později solver network (`/v1/swap/intent` pattern existuje pro EVM)

## WARP 0.3 — Lightning

- LND node (docker stack je připraven v `docker/lightning/`)
- Flow: HODL invoice pattern — ZION HTLC ↔ LN invoice se stejným `H`; settle invoice = reveal S
- `warp/adapter/lightning.rs` rozšířit o hold invoices (`/v2/invoices` + `AddHoldInvoice`, `SettleInvoice`, `CancelInvoice`)
- `warp.toml`: `lightning.enabled=true`, `WARP_LN_NODE_URL`, `WARP_LN_MACAROON`

## WARP 1.0 — Produkce

- Externí security audit (HTLC scripty + koordinátor)
- Vlastní esplora/bitcoind nebo placené API (odstranit mempool.space rate-limit závislost)
- Watchtower hardening: crash-recovery ze SQLite, reconnect, alert na near-timeout swapy
- Docs: operator runbook, user guide, slippage/fee policy
- Governance: DAO ratifikace mainnet parametrů (min/max swap, Δ, fee policy)

## Co explicitně odložit (z chatu)

Staking · vlastní DEX · 13 chainů · nové tokeny · DAO frontend polishment · OASIS rozvoj · L6 · Proof-of-Care redesign — **vše až po WARP 1.0**.

## Poznámka k „bullrun" framingu

Netermínovat podle trhu — termínovat podle engineering gate: *„signet E2E zelený" → „mainnet pilot s cap" → „audit"*. Když bull run přijde dřív, máme připravený bezpečný základ místo spěšného bridgeware.
