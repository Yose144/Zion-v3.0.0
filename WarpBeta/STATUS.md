# WARP Beta — Status / Gap analýza

> Snapshot: 2026-09-17 (update po implementaci `btc_htlc.rs`). Klasifikace: ✅ HOTOVO · 🟡 ROZPRACOVÁNO · ❌ CHYBÍ · ⛔ BLOCKER

## HOTOVO ✅

| Komponenta | Kde | Poznámka |
|---|---|---|
| L1 nativní HTLC konsensus | `V31/L1/core/src/utxo.rs` | script `0x01`, SHA-256 hashlock, timestamp timeout, claim/refund paths |
| L1 HTLC buildery | `V31/L1/core/src/v31_wallet.rs` | `build_htlc_lock/claim/refund`, unit testy v `utxo.rs` (lock→claim, refund po timeoutu, claim po timeoutu odmítnut) |
| Edge E2E | mainnet | lock→claim ověřeno 2026-08-23 (report `docs/3.2/NATIVE_L1_HTLC_REPORT.md`) |
| Swap koordinátor | `V31/L2/multichain/src/swap/htlc.rs` | `HtlcSwap` — initiate/claim/claim_source, `HtlcRecord` state machine, SQLite persistence, drift tolerance 120 s |
| ZION L1 adapter | `chain/adapters/zion_l1.rs` | `htlc_lock/claim/refund` přes `execute_outbound`, `TransferDirection::Htlc` |
| HTTP API | `server.rs` → :8454 | `/v1/multichain/swaps/htlc/{lock,claim,refund,pending,escrow,:hash}` — live na Edge |
| BTC deposit watcher | `warp/adapter/bitcoin.rs` | mempool.space REST, `WARP_INBOUND:` OP_RETURN parsing → `DepositProof` |
| BTC signer (plain send) | `warp/btc_signer.rs` | P2WPKH: WIF import, UTXO select, fee estimate, broadcast — 560 ř., testy |
| BTC P2WSH HTLC modul | `warp/btc_htlc.rs` | kanonický witness script (13 ops), strict parser + byte-exact round-trip, `lock_htlc`/`claim_htlc`/`refund_htlc` na `BtcSigner`, `extract_preimage`, `cltv_from_zion_timeout` — 10 unit testů zelených, vč. sighash verifikace |
| LN stack připraven | `warp/adapter/lightning.rs`, `docker/lightning/`, `scripts/lightning/` | LND REST klient, BOLT11, docker-compose, invoice/channel scripty |
| warp.toml kostra | `warp.example.toml` | `[chains.bitcoin]` + `[chains.lightning]` definovány, `enabled=false` s `disabled_reason` |

## ROZPRACOVÁNO 🟡

| Komponenta | Co chybí |
|---|---|
| BTC adapter | funguje jako *deposit watcher* na fixní adresu; pro atomic swap potřebuje per-swap P2WSH detekci — primitiva `BtcHtlc::from_witness_script` + `extract_preimage` jsou hotová, chybí napojení na watcher |
| `HtlcSwap` koordinátor | state machine + ZION leg hotové; cross-leg logika (BTC lock detekce → ZION lock → preimage propagation) zatím jen obecná |

## CHYBÍ ❌

| # | Task | Soubor(y) | Odhad |
|---|---|---|---|
| ~~C1~~ | ✅ **BTC P2WSH HTLC builder** — `BtcHtlc::new` / `build_witness_script` / `from_witness_script` | `warp/btc_htlc.rs` | hotovo |
| ~~C2~~ | ✅ **BTC HTLC spend** — claim `[sig, preimage, OP_TRUE, script]`, refund `[sig, Ø, script]`, BIP143 sighash, `lock_htlc`/`claim_htlc`/`refund_htlc` | `warp/btc_htlc.rs` + `btc_signer.rs` | hotovo |
| C3 | **Per-swap BTC lock detekce** — sledovat P2WSH adresu (derived z dohody), parsovat funding tx, confirm count | `warp/adapter/bitcoin.rs` | ~150 ř. |
| C4 | **Preimage propagace** — `extract_preimage` hotové; zbývá napojení watcher → `HtlcSwap::claim_source` | `warp/adapter/bitcoin.rs` + `swap/htlc.rs` | ~80 ř. |
| C5 | **Swap orchestrator** — `BtcSwapFlow`: create_offer → wait_btc_lock → zion_lock → wait_zion_claim → btc_claim (nebo refund paths) | nový `warp/btc_swap.rs` | ~300 ř. |
| ~~C6~~ | ✅ **Timeout konverze** — `cltv_from_zion_timeout` (ZION UNIX s → BTC height, safety margin Δ, konzervativní zaokrouhlení) | `warp/btc_htlc.rs` | hotovo |
| C7 | **warp.toml enable** — `bitcoin.enabled=true` s reálnými parametry (po C3–C5) | `/etc/zion/warp.toml`, `warp.example.toml` | config |
| C8 | **E2E signet test** — plný swap oběma směry + refund path | `V31/L2/multichain/tests/` | test + skript |
| C9 | CLI/API pro swap lifecycle (`warp swap offer|accept|status`) | `V31/cli` nebo `server.rs` | ~150 ř. |

## BLOCKER ⛔

| Blokér | Stav |
|---|---|
| BTC node/esplora — mempool.space public API je OK pro beta, pro produkci vlastní esplora/bitcoind | doporučeno, ne blocker pro testnet |
| LND node pro LN fázi | až WARP 0.3 |
| Žádný externí audit | před mainnet spuštěním povinný |

## Rizika / otevřené otázky

1. **Timestamp vs height timeouty** — ZION=u64 UNIX s, BTC=CLTV height. Převodní chyba → není atomická chyba, ale griefing window. Konvence `Δ ≥ 6 h` zmenšuje riziko na prakticky nulové (žádný chain reorg nedokáže „přeskočit" 6 h). `cltv_from_zion_timeout` implementováno.
2. **mempool.space rate limits** — polling každých ~15 s na veřejném API; pro beta OK, produkce potřebuje vlastní esplora nebo electrum.
3. **Key management** — BTC WIF + ZION Ed25519 klíče v `warpd` keyringu; secrets přes env (`WARP_BTC_WIF`, `/etc/zion` permissions) — nikdy do repo.
4. **Swap discovery** — v0.1 manuální/order book mimo scope; např. jednoduchý „swap offer" endpoint sdílející (H, amounts, timeouty) mezi dvěma warpd instancemi.
