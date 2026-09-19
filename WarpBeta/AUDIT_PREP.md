# WARP Beta — Audit Prep & Findings Log

> Self-audit provedeý před externím security review. Rozsah: `BtcSwapFlow` orchestrátor (`V31/L2/multichain/src/warp/btc_swap.rs`), BTC HTLC (`btc_htlc.rs`, `btc_signer.rs`, `adapter/bitcoin.rs`), ZION leg (`swap/htlc.rs`, `chain/adapters/zion_l1.rs`), API (`server.rs`), persistence (`db.rs`).
>
> Datum: 2026-09-18 · Test baseline: 641 lib testů zelených + cross-leg/refund/restart E2E na regtestu + live ZION mainnet leg SETTLED.

## Findings — FIXED

### P1 — Unverified user ZION lock (ztráta BTC) ✅ `be2d8d52d`

`offer_zion_to_btc` přecházel `AwaitingUserLock → LockBtc` pouze na přítomnosti `user_zion_lock_txid`. Zlomyslný user mohl poslat fake/cizí txid → operator lockne BTC → user claimne s preimage → operator nemá co claimnout.

**Fix:** `verify_user_zion_lock` před každým `LockBtc`:
- `getUtxos(user_zion_address)` → UTXO hit = confirmed + unspent
- parse 105B HTLC scriptu `[0x01][hashlock][timeout LE][claimant][refund]`
- kontrola: hashlock == offer, claimant == operator pubkey, refund == user pubkey, timeout == agreed, amount >= agreed
- depth check `min_zion_lock_confs` (env `WARP_ZION_LOCK_MIN_CONFS`, default 2) proti shallow reorgu
- `NotFound → Wait`, `Invalid → Fail`; offer-time reject na `Invalid`; RPC error → retry
- `zion_rpc_url` wired z `l1_rpc_url`; `None` = jen offline testy (warn)

### P2 — Crash-recovery double-lock / stuck swap ✅ `842c88582`

Crash mezi broadcast a persist způsobil po restartu druhý broadcast (BTC lock na stejnou HTLC adresu, duplicitní ZION lock) nebo stuck (`claim_source`/`refund` → "already settled" error → nekonečný poll error).

**Fix:**
- `HtlcSwap::initiate` entry-dedupe: existující record s `lock_tx_id` → adopt po `confirmations ≥ 1`; unconfirmed → `Err(awaiting confirmation)` místo re-broadcastu
- record se persistuje **před** conf checkem (retry = resume, ne repeat)
- `register_external_lock` idempotentní (stejný `lock_tx_id`+amount → Ok; konflikt → Err)
- `poll_one` adoptuje `view.btc_lock` místo re-fundingu; `register_coordinator` re-runs idempotentně
- `decide` respektuje `coordinator_claimed → MarkSettled`, `coordinator_refunded → MarkRefunded`

### P2 — Open offer API bez auth ✅ `be2d8d52d`

`POST /swaps/btc/offer` vynucoval auth jen když ZIS enabled **nebo** `ZION_MULTICHAIN_API_KEY` nastaven — jinak otevřený endpoint, který umí odysílat reálné BTC locky.

**Fix:** fail-closed — 403 když není nakonfigurována ani jedna auth cesta.

### P1 — Immature coinbase UTXOs ✅ `452758b5c` (live test finding)

`get_spendable_utxos` vracel coinbase < 100 blk; largest-first selection → tx přijata do mempoolu, zamítnuta v template, tichá eviction. Filter přidán.

### P1 — `confirmations()` broken ✅ `7a74dd18b` (live test finding)

`getTransaction` param `hash` → node vyžaduje `txid` → vždy Err → `.ok()` swallow → nekonečný wait. Fixnuto.

### P2 — Coordinator restart hydration chyběla ✅ (R3 commit)

`HtlcSwap::load_from_db` existoval, ale `warpd` ho nikdy nevolal → po restartu byla coordinator memory prázdná → `claim_source`/`refund` na in-flight swapu = `TransferNotFound` → stuck swap. Restart E2E to nechytilo (coordinator zůstal in-memory sdílený).

**Fix:** `warpd` volá `service.htlc().load_from_db()` při startu + `BtcSwapFlow::load_from_db` hydratuje `self.swaps` (pokryje dedikovaný coordinator).

### R3 — Dedicated WARP ZION wallet ✅ (code)

`WARP_BTC_SWAP_ZION_SECRET` (raw Ed25519 hex) / `WARP_BTC_SWAP_ZION_MNEMONIC` → dedikovaný keyring → vlastní `ZionL1Adapter` + `ChainAdapterRegistry` + `HtlcSwap::with_db` coordinator pro btc-swap. Operator pubkey/address se derivuje ze stejného keyringu (identity = signer konzistence). Bez env → fallback na bridge keyring + warn. 5 unit testů (`service::tests::warp_operator_keyring_*`).

## Findings — OPEN / residual risk

| # | Severity | Item | Poznámka |
|---|---|---|---|
| R1 | low | Broadcast-window residual | Crash přesně mezi submit a persist bez jakéhokoliv záznamu — ms-scale okno, duplicitní lock refundovatelný. Uzavřít vyžaduje persistovaný txid před submit (adapter internals). |
| R2 | low | `AwaitingUserLock` bez TTL | Swap může čekat donekonečna (user nikdy nezavře lock). Slot spotřebuje kapacitu — mitigováno `max_active_swaps` + auth na offer. Zvážit offer TTL → `Failed`. |
| R3 | med | Shared hot wallet UTXO race | Largest-first selection koliduje s pool payout builderem na sdílené peněžence (live test: double-spend race). **FIXED (code):** `WARP_BTC_SWAP_ZION_SECRET`/`_MNEMONIC` → dedikovaný keyring + vlastní `ZionL1Adapter` + vlastní `HtlcSwap` coordinator pro btc-swap; fallback na bridge keyring s warn. **Zbývá: nasadit key na Edge při enable.** |
| R4 | med | Public esplora | mempool.space rate limits + availability. **ČÁSTEČNĚ FIXED (code):** multi-endpoint failover — `WARP_BITCOIN_API` comma-list, rotating primary (`AtomicUsize`), defaults mempool.space + blockstream.info; broadcast/utxo fetch také failover. **Zbývá ops: vlastní esplora/bitcoind jako primary při enable.** |
| R5 | low | `getUtxos` reorg hloubka | UTXO set hit ≠ finalita; mitigováno `min_zion_lock_confs=2`. |
| R6 | info | BTC dust/change | `lock_htlc` UTXO select — zkontrolovat dust-limit change output (auditor: ověřit v `btc_signer.rs`). |
| R7 | info | Deterministic claim rebroadcast | Identický claim tx → stejný txid → esplora dup-submit error → adopt path přes `detect_htlc_spend` to kryje (mempool detekce). |

## Auditor checklist (per area)

- [ ] **HTLC script correctness** — ZION `[0x01][H][ts][pk_c][pk_r]` (105B) vs BTC P2WSH 13-op script; branch semantics claim/refund obě chainy; `parse_htlc_script` byte-exact vs `htlc_output_script`
- [ ] **Hashlock/preimage konzistence** — SHA-256 na obou chainech; `do_claim` ověřuje `sha256(secret)==hashlock` před broadcastem; `extract_preimage` validuje proti scriptu i hashlocku
- [ ] **Timeout ordering** — BTC→ZION: BTC expiry POZDNĚJŠÍ než ZION; ZION→BTC: BTC CLTV DŘÍVE než ZION ts; `cltv_from/before_zion_timeout` + margin; griefing window analýza
- [ ] **Confirmation requirements** — `min_btc_confs` (user lock), `min_zion_lock_confs` (user lock), `initiate` conf≥1; mempool spend detection záměrně bez confs (preimage race)
- [ ] **Reorg/mempool assumptions** — depth checky, mempool-evicted tx handling, `detect_htlc_lock` conf filter
- [ ] **UTXO selection** — largest-first + coinbase maturity filter + R3 (shared wallet race)
- [ ] **Native ZION tx** — `build_htlc_*` konstrukce, sighash, `submitUtxoTransaction` response validation (`accepted` check)
- [ ] **Refund safety** — obě direction: refund až po vlastním timeoutu; user refund po CLTV; operator refund paths testovány E2E
- [ ] **Restart/recovery** — `load_from_db`, snapshot round-trip, adopt paths (P2 fix), SQLite corruption → error handling
- [ ] **Idempotency** — initiate dedupe, register_external_lock, claim/refund Mark* paths, offer admission
- [ ] **Admission/limits** — duplicate hashlock, `min/max_btc_sats`, `max_active_swaps`, dust
- [ ] **Secrets** — WIF/mnemonic/Ed25519 key jen env, žádný log; `preimage_hex` encrypted at rest (`enc:` prefix), `to_json` preimage neleakne
- [ ] **API authz** — fail-closed na offer; rate limiting per-IP/per-user; read endpoints (list/get) public — obsah OK (žádné secrets)
- [ ] **Error/retry** — `poll_once` outcome capture, žádný panic, error classification; `.ok()` swallows (viz confirmations bug — hledat další instance!)
- [ ] **Observability** — audit log (`record_audit`), warn/info na transitions, metrics endpoint?
- [ ] **External deps** — esplora availability (R4), zion-node RPC (TCP line protocol), ZIS auth service
- [ ] **Mainnet config safety** — `WARP_BTC_SWAP_ENABLED` gate, WIF network match (`signer.network()` vs cfg), relay vs operator address separation

## Pre-mainnet checklist (Edge enable)

Blokuje `WARP_BTC_SWAP_ENABLED=1`:

1. ☐ Externí audit tohoto dokumentu + kódu
2. ☑ R3 (code): dedikovaný WARP ZION wallet implementován — ☐ zbývá vygenerovat + nasadit `WARP_BTC_SWAP_ZION_SECRET` na Edge a nabít jej
3. ☐ R4 (ops): vlastní esplora/bitcoind jako primary v `WARP_BITCOIN_API` comma-list (failover code hotový, defaults = 2 public backends)
4. ☐ Edge binary = HEAD (všechny audit fixy), verify `git log`
5. ☐ `WARP_BTC_RELAY_KEY` = produkční WIF (ne test), network match
6. ☐ `ZION_MULTICHAIN_API_KEY` nebo ZIS auth pro offer endpoint
7. ☐ SQLite path/permissions/backup + `load_from_db` enabled v `warpd`
8. ☐ `WARP_ZION_LOCK_MIN_CONFS` + `WARP_BTC_MIN_CONFS` + margin review pro mainnet parametry
9. ☐ Monitoring/alerting: stuck swaps, failed submissions, refund deadlines, RPC outages, DB load failures
10. ☐ Rollback procedura (disable env → restart → in-flight swaps dožijí/refundují)
11. ☐ Signet E2E run (doporučeno, ne hard blocker — regtest+live-ZION pokrývají pathy)
