# WARP Beta — Status / Gap analýza

> Snapshot: 2026-09-18 (update: **R3 dedicated wallet** — `WARP_BTC_SWAP_ZION_SECRET`/`_MNEMONIC` → vlastní keyring+adapter+coordinator pro btc-swap; coordinator restart hydration fix; +5 testů → 646 zelených). Klasifikace: ✅ HOTOVO · 🟡 ROZPRACOVÁNO · ❌ CHYBÍ · ⛔ BLOCKER

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
| BTC P2WSH HTLC modul | `warp/btc_htlc.rs` | kanonický witness script (13 ops), strict parser + byte-exact round-trip, `lock_htlc`/`claim_htlc`/`refund_htlc` na `BtcSigner`, `extract_preimage`, `cltv_from_zion_timeout` + `cltv_before_zion_timeout` — 10 unit testů zelených, vč. sighash verifikace |
| Per-swap BTC detekce | `warp/adapter/bitcoin.rs` | `detect_htlc_lock` (funding output → `BtcHtlcLock` s confs) + `detect_htlc_spend` (vin outpoint match → Claim/Refund, preimage z witnessu ověřena proti scriptu i hashlocku) — 5 unit testů |
| Swap orchestrátor | `warp/btc_swap.rs` | `BtcSwapFlow` — oba směry (BTC→ZION, ZION→BTC), čistá `decide()` tranzitivní tabulka, `poll_once` loop, wiring do `HtlcSwap` (`initiate`, `claim_source`, `register_external_lock`, `revealed_preimage`) — 9 unit testů |
| BTC swap service + API | `service.rs`, `server.rs`, `bin/warpd.rs` | env-gated (`WARP_BTC_SWAP_ENABLED=1` + `WARP_BTC_RELAY_KEY`), `build_btc_swap` v `from_parts`, `start_btc_swap_loop` poll v `warpd` (default 30 s, min 5 s, `WARP_BTC_SWAP_POLL_SECS`), endpointy `/v1/multichain/swaps/btc/{offer,list,:id}`, SQLite persistence `btc_swap_records` |
| Hardening guardrails | `warp/btc_swap.rs`, `service.rs` | `min_btc_sats`/`max_btc_sats`/`max_active` (env `WARP_BTC_SWAP_{MIN,MAX}_SATS`, `WARP_BTC_SWAP_MAX_ACTIVE`), duplicate-hashlock rejection, amount check v `offer_*`, admission check v `_live` — 3 unit testy |
| Raw-key ZION keyring | `wallet/mod.rs` | `Keyring::from_zion_secret(hex)` — imported Ed25519 secret override pro ZION (0,0); pro relay/pool hot wallets bez BIP39 |
| **LIVE-ZION E2E (mainnet)** | `tests/btc_swap_flow.rs` `e2e_flow_zion_to_btc_live_zion` | ✅ **SETTLED 2026-09-18** — user ZION HTLC lock `d77f837a` (blok ~47635) → orchestrátor BTC lock → user BTC claim (preimage) → orchestrátor ZION claim `8c60d064` confirmed; celá produkční cesta `HtlcSwap`+`ZionL1Adapter`+`BtcSwapFlow` na reálném mainnet konsensu |
| Bugfix: immature coinbase | `chain/adapters/zion_l1.rs` | `get_spendable_utxos` filtruje coinbase `< COINBASE_MATURITY` (100 blk) — jinak largest-first selection bere unspendable inputy → tx přijata do mempoolu, zamítnuta v template, tichá eviction. Nalezeno live testem (pool wallet, 100 immature coinbase z 9146 UTXOs) |
| Bugfix: `confirmations()` | `chain/adapters/zion_l1.rs` | `getTransaction` param `hash`→`txid` — node vracel "invalid address: txid required", confirmations vždy Err → žádný confirm nikdy neviditelný |
| **Audit P1: on-chain verifikace user ZION locku** | `warp/btc_swap.rs`, `service.rs` | `offer_zion_to_btc` dřív přešel `AwaitingUserLock→LockBtc` jen na přítomnosti txid — fake txid = ztráta BTC. Nově `verify_user_zion_lock` před každým `LockBtc`: `getUtxos` (confirmed+unspent), parse 105B HTLC scriptu, kontrola hashlock/claimant=operator/refund=user/timeout/amount + `min_zion_lock_confs` depth check (env `WARP_ZION_LOCK_MIN_CONFS`, default 2). `NotFound→Wait`, `Invalid→Fail`, offer-time reject na `Invalid` — 5 unit testů |
| Audit: fail-closed auth na offer API | `server.rs` | `POST /swaps/btc/offer` → 403 když není nakonfigurována ani ZIS auth ani `ZION_MULTICHAIN_API_KEY` (offer může odysílat reálné BTC locky) |
| **Audit P2: crash-recovery / double-lock** | `warp/btc_swap.rs`, `swap/htlc.rs` | Crash mezi broadcast a persist → restart znovu broadcastoval. Fix: `initiate` má entry-dedupe (record existuje → adopt po conf checku, jinak "awaiting confirmation"), record se persistuje PŘED conf checkem; `poll_one` adoptuje `view.btc_lock` místo re-locku; `register_external_lock` idempotentní (stejný txid=Ok, konflikt=Err); `decide` respektuje `coordinator_claimed`/`coordinator_refunded` → Mark* bez re-claim/re-refund — +2 testy |
| **R3: dedikovaný WARP ZION wallet** | `service.rs`, `wallet/mod.rs`, `warpd.rs` | `WARP_BTC_SWAP_ZION_SECRET` (raw Ed25519 hex) / `WARP_BTC_SWAP_ZION_MNEMONIC` → dedikovaný keyring → vlastní `ZionL1Adapter` + registry + `HtlcSwap::with_db` coordinator pro btc-swap (žádný shared UTXO race s bridge/pool wallet); bez env → fallback na bridge keyring + warn; operator pubkey/address z téhož keyringu (identity=signer konzistence) — 5 unit testů. **Zbývá ops: vygenerovat+nabít klíč na Edge při enable** |
| Bugfix: coordinator restart hydration | `warpd.rs`, `warp/btc_swap.rs` | `HtlcSwap::load_from_db` se nikdy nevolal → po restartu prázdná coordinator memory → `claim_source`/`refund` na in-flight swapu = `TransferNotFound` stuck. Fix: `warpd` volá `service.htlc().load_from_db()` při startu + `BtcSwapFlow::load_from_db` hydratuje `self.swaps` |
| LN stack připraven | `warp/adapter/lightning.rs`, `docker/lightning/`, `scripts/lightning/` | LND REST klient, BOLT11, docker-compose, invoice/channel scripty |
| warp.toml kostra | `warp.example.toml` | `[chains.bitcoin]` + `[chains.lightning]` definovány, `enabled=false` s `disabled_reason` |

## ROZPRACOVÁNO 🟡

| Komponenta | Co chybí |
|---|---|
| BTC adapter | fixní deposit watcher + **nové** per-swap `detect_htlc_lock`/`detect_htlc_spend`; orchestrátor napojen přes `BtcSwapFlow::poll_once` |
| `HtlcSwap` koordinátor | cross-leg logika napojena přes `BtcSwapFlow`; service/HTTP expozice i `BtcSwapRecord` persistence hotové |

## CHYBÍ ❌

| # | Task | Soubor(y) | Odhad |
|---|---|---|---|
| ~~C1~~ | ✅ **BTC P2WSH HTLC builder** — `BtcHtlc::new` / `build_witness_script` / `from_witness_script` | `warp/btc_htlc.rs` | hotovo |
| ~~C2~~ | ✅ **BTC HTLC spend** — claim `[sig, preimage, OP_TRUE, script]`, refund `[sig, Ø, script]`, BIP143 sighash, `lock_htlc`/`claim_htlc`/`refund_htlc` | `warp/btc_htlc.rs` + `btc_signer.rs` | hotovo |
| ~~C3~~ | ✅ **Per-swap BTC lock detekce** — `detect_htlc_lock`/`detect_htlc_spend` na `BitcoinAdapter` | `warp/adapter/bitcoin.rs` | hotovo |
| ~~C4~~ | ✅ **Preimage propagace** — `extract_preimage` + `BtcHtlcSpend::Claim` → `claim_source` v orchestrátoru | `warp/adapter/bitcoin.rs` + `swap/htlc.rs` + `btc_swap.rs` | hotovo |
| ~~C5~~ | ✅ **Swap orchestrator** — `BtcSwapFlow` s čistou `decide()` tabulkou + `poll_once` | `warp/btc_swap.rs` | hotovo |
| ~~C6~~ | ✅ **Timeout konverze** — `cltv_from_zion_timeout` + `cltv_before_zion_timeout` | `warp/btc_htlc.rs` | hotovo |
| C7 | **warp.toml enable** — `bitcoin.enabled=true` s reálnými parametry | `/etc/zion/warp.toml`, `warp.example.toml` | config |
| ~~C7b~~ | ✅ **Persistence `BtcSwapRecord`** — `btc_swap_records` tabulka (snapshot JSON, witness-script round-trip), `set_db`/`load_from_db`/`persist`, reload v `warpd` startu — 3 testy | `db.rs`, `warp/btc_swap.rs`, `warpd.rs` | hotovo |
| ~~C7c~~ | ✅ **HTTP expozice** — `POST /swaps/btc/offer` (auth), `GET /swaps/btc/list`, `GET /swaps/btc/:id` + `start_btc_swap_loop` v `warpd` | `server.rs`, `service.rs`, `bin/warpd.rs` | hotovo |
| ~~C8~~ | ✅ **E2E ověřen na regtestu** (docker `blockstream/esplora` na Edge, 2026-09-17) — BTC-leg: claim + refund path; **cross-leg flow: `tests/btc_swap_flow.rs` OBA směry PASS** — BtcToZion (user BTC lock → orchestrátor ZION lock → user ZION claim → on-chain BTC claim, 13s) + ZionToBtc (on-chain BTC lock → user claim → `claim_source` ZION claim, 11s) včetně preimage propagace přes produkční `HtlcSwap` cestu; **refund paths PASS** — ZionToBtc: orchestrátor RefundBtc on-chain po CLTV, BtcToZion: RefundZion + user BTC refund; **restart recovery PASS** — mid-swap kill → `Db::open` reload → dokončení do Settled; zbývá jen signet/mainnet run | `tests/btc_swap_signet.rs`, `tests/btc_swap_flow.rs` | hotovo |
| ~~C9~~ | ✅ **CLI lifecycle** — `zion warp btc-swap offer|list|status` (DEX port = warp+1, `--zis-api-key` auth) | `V31/cli/src/commands/warp.rs`, `rpc/agent_rpc.rs` | hotovo |

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
