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

- [ ] **T1 — `btc_htlc.rs` builder** (`V31/L2/multichain/src/warp/`)
  - `build_htlc_script(hashlock, claimant_pk, refund_pk, cltv_height) -> (witnessScript, p2wsh_address)`
  - unit testy: známý script → známá adresa (test vector)
- [ ] **T2 — BTC spend paths** (`btc_signer.rs`)
  - `claim_htlc(utxo, preimage, sig)` — witness `[sig, preimage, witnessScript]`
  - `refund_htlc(utxo, sig)` — witness `[sig, OP_FALSE, witnessScript]`, `nLockTime = cltv`
  - BIP143 sighash, fee pro větší witness
- [ ] **T3 — Per-swap detekce** (`warp/adapter/bitcoin.rs`)
  - `watch_p2wsh(address)` — poll mempool.space `/address/:addr/txs`, parse witnessScript → verify `H` a pubkey odpovídají dohodě
  - confirmations ≥ 1 (signet) / ≥ 2 (mainnet) před pokračováním
- [ ] **T4 — Preimage propagation**
  - BTC claim tx witness → preimage → `HtlcSwap` feed → ZION claim (nebo naopak dle směru)
- [ ] **T5 — Timeout policy**
  - `T_btc_blocks = ceil((T_zion_ts - now + Δ) / 600)`; `Δ = 6 h` default, konfigurovatelné
- [ ] **T6 — E2E signet**
  - test: Bob lock BTC (signet) → Alice lock ZION → Bob claim ZION → Alice claim BTC
  - refund test: expire → oba refundují
  - cíl: skript `scripts/warp_beta_e2e_signet.sh`

### Kritéria dokončení 0.1

- 2× úspěšný swap (oba směry) na signet + ZION mainnet s malou částkou
- 1× úspěšný refund na každé straně
- `cargo test -p zion-multichain` zelené + nové unit testy btc_htlc
- žádné secrets v repo; `warp.toml` dokumentované

## WARP 0.2 — Automated swap

- `BtcSwapFlow` state machine v `warpd` (autonomní: detect → lock → claim/refund)
- CLI: `zion warp offer --btc 0.001 --zion 10000`, `zion warp accept <id>`, `zion warp status`
- Offer discovery: minimálně sdílený JSON (manuálně/paste), později solver network (`/v1/swap/intent` už existuje pro EVM — znovupoužít pattern)
- Keyring: `WARP_BTC_WIF` env, per-swap key derivation

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
