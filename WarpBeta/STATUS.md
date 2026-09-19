# WARP Beta — Status / Gap analýza

> Snapshot: 2026-09-20 (**TESTNET rehearsal STALLED** — offer `dbc91da9…` pořád `awaiting_user_lock`; testnet3 faucety nedoručily nic — HTLC `tb1qwps3v5w…j4fp` ani operator wallet `tb1qmy6czt…` nemají jedinou tx; offer po 4h TTL přejde do `Failed`. Doporučená cesta: přeskočit testnet3 → **mainnet dust pilot** (~100k sats na `bc1q53gn9…5n6k`), regtest + live-ZION leg už pathy pokryly). Klasifikace: ✅ HOTOVO · 🟡 ROZPRACOVÁNO · ❌ CHYBÍ · ⛔ BLOCKER

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
| **R3: dedikovaný WARP ZION wallet** | `service.rs`, `wallet/mod.rs`, `warpd.rs` | `WARP_BTC_SWAP_ZION_SECRET` (raw Ed25519 hex) / `WARP_BTC_SWAP_ZION_MNEMONIC` → dedikovaný keyring → vlastní `ZionL1Adapter` + registry + `HtlcSwap::with_db` coordinator pro btc-swap (žádný shared UTXO race s bridge/pool wallet); bez env → fallback na bridge keyring + warn; operator pubkey/address z téhož keyringu — 5 unit testů. **Ops DONE:** wallet `/etc/zion/keys/warp-operator.json` + env var na Edge + **FUNDED 2026-09-19** — 500 ZION z canonical pool wallet, tx `abe521fcc1768d18bd8ebb6464e958d365a4a3ea6519942c5a65cab735ae1ff1` (blok 49544) |
| Bugfix: coordinator restart hydration | `warpd.rs`, `warp/btc_swap.rs` | `HtlcSwap::load_from_db` se nikdy nevolal → po restartu prázdná coordinator memory → `claim_source`/`refund` na in-flight swapu = `TransferNotFound` stuck. Fix: `warpd` volá `service.htlc().load_from_db()` při startu + `BtcSwapFlow::load_from_db` hydratuje `self.swaps` |
| **Edge redeploy na HEAD** | Edge `62.171.141.136` | 2026-09-19: rsync `V31/` → `/root/build/V31/` → `cargo build --release -p zion-multichain --bin warpd` (10m) → atomic swap do `/opt/zion/V31/target/release/warpd` (backup `warpd.bak-20260919`) → restart `zion-v31-multichain`. Smoke: `/health` ok, `/swaps/btc/list` = `{"enabled":false}` (nový kód běží, swap disabled), `NRestarts=0`, watchers aktivní. `warp.db` perms 644→640. Deployed = `50df05d54` (+ solvency fix) |
| **R4: multi-endpoint esplora failover** | `warp/adapter/bitcoin.rs`, `btc_signer.rs`, `btc_htlc.rs` | `WARP_BITCOIN_API` přijímá comma-list; adapter drží `api_urls: Vec<String>` + rotating primary (`AtomicUsize`, promote na první fungující). Všechny cesty failover: tip height, address txs, tx status, utxo fetch, broadcast (POST /tx sekvenčně). Defaults: mempool.space + blockstream.info (mainnet/testnet) — zero-config redundancy. 3 failover unit testy. Zbývá ops: vlastní esplora/bitcoind jako primary |
| **R2: offer TTL** | `warp/btc_swap.rs`, `service.rs` | `offer_ttl_secs` (env `WARP_BTC_SWAP_OFFER_TTL_SECS`, default 14 400 s = 4 h) — `decide` vrací `Fail` pro `AwaitingUserLock` bez lock evidence po `created_at + TTL`; platný lock evidence má přednost i po TTL (late-lock projde); `Failed` terminální → uvolňuje `max_active_swaps`; `poll_one` persistuje — 6 unit testů |
| **Testnet rehearsal — STALLED** | Edge env + `examples/gen_*` | 2026-09-19: BTC wallet vygenerován (`examples/gen_warp_btc_wallet.rs` — BIP39→BIP84, mnemonic na Desktopu `warp-btc-wallet.txt`, testnet `tb1qmy6czt…k0w6`, mainnet `bc1q53gn9…5n6k` ready). Edge: `WARP_BTC_RELAY_KEY` (testnet WIF) + `BITCOIN_NETWORK=testnet` + `WARP_BTC_SWAP_ENABLED=1` → `enabled — network Testnet` ✓. Test offer `dbc91da9…` (10k sats → 10 ZION) injectnut přes `gen_btc_swap_offer` do `warp_multichain.db` (ZIS-gated offer obchází — operator test), hydratován, `awaiting_user_lock`. HTLC `tb1qwps3v5wqj82k5j45wjan5gwfj4v8vx6xvrjkmqg25ehtavu0flgsjjz4fp` čekal na testnet3 funding. **2026-09-20: funding nedorazil — ani HTLC ani operator wallet nemají tx (ověřeno mempool.space testnet API); offer po TTL přejde do `Failed`. Testnet3 faucety jsou dead-end → doporučen mainnet dust pilot (~100k sats na `bc1q53gn9…5n6k`).** |
| LN stack připraven | `warp/adapter/lightning.rs`, `docker/lightning/`, `scripts/lightning/` | LND REST klient, BOLT11, docker-compose, invoice/channel scripty |
| warp.toml kostra | `warp.example.toml` | `[chains.bitcoin]` + `[chains.lightning]` definovány, `enabled=false` s `disabled_reason` |

## ROZPRACOVÁNO 🟡

*(prázdné — všechny komponenty BTC swapu jsou hotové; zbývají jen ops/enable kroky v BLOCKER)*

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
| BTC node/esplora — public failover (mempool.space + blockstream.info) je OK pro beta, pro produkci vlastní esplora/bitcoind | doporučeno před enable; Edge 93 G free → pruned bitcoind ~15 G feasible |
| Testnet3 rehearsal | **dead-end** — faucety nedoručily funding (ověřeno 2026-09-20, 0 tx na obou adresách); nahradit mainnet dust pilotem s cap |
| LND node pro LN fázi | až WARP 0.3 |
| Žádný externí audit | před mainnet spuštěním povinný |
| Produkční `WARP_BTC_RELAY_KEY` (mainnet WIF) | nenastaven — potřeba pro ZION→BTC směr |

## Rizika / otevřené otázky

1. **Timestamp vs height timeouty** — ZION=u64 UNIX s, BTC=CLTV height. Převodní chyba → není atomická chyba, ale griefing window. Konvence `Δ ≥ 6 h` zmenšuje riziko na prakticky nulové (žádný chain reorg nedokáže „přeskočit" 6 h). `cltv_from_zion_timeout` implementováno.
2. **mempool.space rate limits** — polling každých ~15 s na veřejném API; pro beta OK, produkce potřebuje vlastní esplora nebo electrum.
3. **Key management** — BTC WIF + ZION Ed25519 klíče v `warpd` keyringu; secrets přes env (`WARP_BTC_WIF`, `/etc/zion` permissions) — nikdy do repo.
4. **Swap discovery** — v0.1 manuální/order book mimo scope; např. jednoduchý „swap offer" endpoint sdílející (H, amounts, timeouty) mezi dvěma warpd instancemi.
