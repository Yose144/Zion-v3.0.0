# Report: Nativní L1 HTLC podpora pro ZION WARP

**Datum:** 2026-08-22  
**Fokus:** V31/L1/core + V31/L2/multichain  
**Stav:** Dokončeno, testy procházejí, připraveno pro L2/E2E a UI integraci

## Shrnutí

Implementovali jsme plně nativní L1 HTLC skriptový engine v `zion-core` a propojili jsme ho s multichain `ZionL1Adapter` pro WARP atomické swapy. Místo memo-based přístupu nyní L1 přímo validuje HTLC hashlock/timelock ve `UtxoSet` a používá output `script` pole.

## Klíčové změny

### 1. Nativní HTLC formát (`zion-core`)

- `TransactionOutput` a `UtxoOutput` nyní nesou `script: Vec<u8>`.
- `Transaction::hash()` zahrnuje `output.script`.
- HTLC output layout: `[0x01] [32B hashlock] [8B timeout (LE)] [32B claimant pubkey] [32B refund pubkey]` (celkem 105 B).
- P2PKH zůstává jako prázdný `script`.

### 2. UTXO validace (`V31/L1/core/src/utxo.rs`)

- `UtxoSet::verify_input` rozlišuje prázdný vs. HTLC script.
- Claim input: `<32B preimage> <64B sig> <32B pubkey>` — kontroluje SHA-256(preimage), timeout, podpis a cílovou adresu.
- Refund input: `<64B sig> <32B pubkey>` — kontroluje vypršení timeoutu, podpis a refund adresu.
- Nové `UtxoError` varianty: `InvalidHtlcScript`, `HtlcPreimageMismatch`, `HtlcClaimExpired`, `HtlcRefundNotExpired`, `HtlcUnauthorizedKey`, `HtlcInvalidDestination`.

### 3. Wallet helpers (`V31/L1/core/src/v31_wallet.rs`)

- `build_htlc_lock`, `build_htlc_claim`, `build_htlc_refund`, `htlc_output_script`.
- `SpendableUtxo` nyní nese `script`.
- `build_batch_payout_inner` podporuje volitelný `output_script` pouze pro první output.

### 4. RPC a CLI

- `getUtxos` vrací `script_hex`/`memo_hex` jako 7. prvek.
- `V31/cli/src/main.rs` naplňuje `SpendableUtxo::script` z `script_hex`.

### 5. Multichain integrace (`V31/L2/multichain`)

- `ZionL1Adapter` nahradil memo-based HTLC volání nativními `build_htlc_*` funkcemi.
- `Transfer` má `source_pubkey` a `target_pubkey` pro refund/claimant klíče.
- `HtlcRecord` ukládá `refund_pubkey` a `claimant_pubkey` místo zastaralého `claimant_address`.
- `HtlcSwap::initiate` validuje pubkeys pro ZION L1; `claim`/`refund` kopírují pubkeys z recordu do `Transfer`.
- `server.rs` přijímá `source_pubkey_hex` a `target_pubkey_hex` v HTLC lock requestu.

## Testování

| Příkaz | Výsledek |
|---|---|
| `cargo test -p zion-core` | ✅ 316 passed |
| `cargo test -p zion-multichain` | ✅ 573 passed, 1 ignored |
| `cargo clippy --workspace` | ✅ bez chyb |
| `cargo test --workspace` | ✅ všechny crate prošly |

HTLC specifické testy ve `zion-core`:

- `htlc_lock_claim_native_succeeds`
- `htlc_refund_native_succeeds_after_timeout`
- `htlc_claim_fails_after_timeout`
- `htlc_refund_fails_before_timeout`
- `htlc_output_script_is_preserved_in_utxo`

## UI integrace

- `APP&WEB/website-v2.9/src/app/api/swap/[...path]/route.ts` proxy nyní přesměrovává `/api/swap/htlc/*` na `/v1/multichain/swaps/htlc/*`.
- `APP&WEB/website-v2.9/src/lib/swap-api.ts` aktualizováno:
  - `getHtlcStatus`, `getPendingHtlcs`, `getEscrowAddress`, `submitClaim`, `submitRefund` volají `/api/swap/htlc/...`.
  - Přidána `submitLock()` s parametry `from`, `to`, `amount`, `hashHex`, `timelock`, `sourcePubkeyHex`, `targetPubkeyHex`.
- `V31/L2/multichain/src/server.rs` rozšířen o `GET /v1/multichain/swaps/htlc/pending` a `GET /v1/multichain/swaps/htlc/escrow`.
- `npm run build` v `website-v2.9` prochází.

## Co ještě zbývá / další kroky

1. **L2 / E2E testy:** ✅ **Dokončeno 2026-08-23.** Plný multichain e2e flow (lock → claim → refund) na ZION L1 proběhl úspěšně s lokálním `zion-node` (port 9555) a `warpd` (port 9335/9336). Viz sekce "E2E Test Results" níže.
2. **UI formulář lock:** ✅ **Dokončeno.** `src/app/swap/page.tsx` generuje hashlock/preimage a nabízí pole pro `source_pubkey_hex` / `target_pubkey_hex` před voláním `submitLock()`.
3. **Dokumentace API:** ✅ **Dokončeno.** `docs/3.0.8/HTLC_API_REFERENCE.md` dokumentuje všech 6 HTLC endpointů.
4. **Mainnet Alpha deploy:** ✅ **Dokončeno 2026-08-23.** Nové binárky `zion-node`, `warpd`, `zion-pool` nasazeny na Edge serveru (`62.171.141.136`). Služby restartovány, chain healthy (height 13416+). E2E HTLC lock→claim test úspěšný na live Edge.

## E2E Test Results (2026-08-23)

Plný end-to-end test nativního L1 HTLC protokolu proběhl úspěšně:

### Lock → Claim
- **Lock:** `POST /v1/multichain/swaps/htlc/lock` s `from=zion`, `to=zion`, `amount=100000000` (100 ZION), `timelock=4077782400` (2099), `source_pubkey_hex` a `target_pubkey_hex` → HTTP 200, `status:"executing"`, `transfer_id:"htlc-lock-<hash>"`.
- **Block confirmation:** `quick_mine` na lokálním uzlu → lock TX potvrzen.
- **Query:** `GET /v1/multichain/swaps/htlc/<hash>` → `state:"pending"`, `lock_tx_id` naplněno, `refund_pubkey`/`claimant_pubkey` uloženy.
- **Claim:** `POST /v1/multichain/swaps/htlc/claim` s `secret_hex` (32B preimage), `to=zion`, `target_address` → HTTP 200, `status:"completed"`.
- **Query po claimu:** `state:"claimed"`, `release_tx_id` a `preimage_hex` naplněny.

### Lock → Refund
- **Lock:** `POST /v1/multichain/swaps/htlc/lock` s `timelock=now+5s` → HTTP 200.
- **Block confirmation:** `quick_mine` → lock TX potvrzen.
- **Wait 10s** pro vypršení timelocku.
- **Refund:** `POST /v1/multichain/swaps/htlc/refund` s `hash_hex`, `from=zion` → HTTP 200, `status:"refunded"`.
- **Query po refundu:** `state:"refunded"`, `release_tx_id` a `release_recipient` naplněny.

### Bug fixes v této session
1. **`HtlcSwap::claim`** — `transfer.preimage` nyní obsahuje 32B preimage (ne SHA-256 hash) pro native L1 target; `transfer.timelock` se nastavuje z `record.expires_at` (on-chain timeout).
2. **`HtlcSwap::refund`** — `transfer.timelock` se nastavuje z `record.expires_at` před voláním adapteru.
3. **`UtxoSet::validate_transaction`** — mempool validace nyní používá current wall-clock time místo `block_timestamp=0`, takže HTLC refund TX mohou projít mempoolem po vypršení timelocku.
4. **`server.rs` HTLC endpoints** — error responses nyní vrací JSON `{"message":"..."}` místo prázdného 400, což usnadňuje debugging.
5. **Test `htlc_claimant_pubkey_enforced`** — aktualizován na 32B preimage (native L1 vyžaduje 32B).
6. **Minimální lock amount** — 100 ZION (100_000_000 flowers) je funkční minimum (fee = 1 ZION = 1_000_000 flowers, claim/refund vyžaduje `lock_utxo.amount > fee`).

## Edge Mainnet Alpha E2E Test Results (2026-08-23)

Nasazeno na live Edge serveru (`62.171.141.136`):

### Deploy
- Nové binárky `zion-node`, `warpd`, `zion-pool` nahrány a aktivovány na Edge.
- `WARP_MNEMONIC` nastaven v `/etc/zion/edge-environment.sh` — warpd keyring derivuje L1 signing key pro HTLC operace.
- Keyring adresa `zion1n8r6f7j6z03426y6e2r8v344d7449526m6m08v6` fundingována 1000 ZION z pool walletu.
- `quick_mine` binary použit pro solo mining (pool měl stale template bug — merkle root mismatch mezi pool a node).

### Lock → Claim (live Edge)
- **Lock:** `POST http://127.0.0.1:8454/v1/multichain/swaps/htlc/lock` s `amount=100000000` (100 ZION), `timelock=4102444800` (2099), `source_pubkey_hex=target_pubkey_hex` (warpd keyring) → `status:"executing"`, `transfer_id:"htlc-lock-<hash>"`.
- **Block confirmation:** `quick_mine` → lock TX potvrzen v bloku.
- **Claim:** `POST /v1/multichain/swaps/htlc/claim` s `secret_hex` (32B preimage), `target_address` (warpd keyring adresa) → `status:"completed"`, `recipient` naplněno.
- **Query po claimu:** `state:"claimed"` ✅

### Poznámky k Edge deploy
- Pool `zion-v31-miner` (CPU-only) byl dočasně spuštěn pro mining, po testu zastaven a disabled.
- `quick_mine` binary je efektivnější pro solo mining na CPU-only serveru (přímý RPC, bypass pool template cache).
- Pool merkle root mismatch bug: pool používá stale block template po node restartu. Nový pool binary nasazen, ale bug přetrvává — pravděpodobně race condition v template caching. Pro production mining použít `quick_mine` nebo GPU miner.
- HTLC endpoint je na DEX API portu 8454 (ne 8453 WARP API port).

## Soubory změněné v této session

- `V31/L1/core/src/utxo.rs` (mempool timestamp fix)
- `V31/L1/core/src/v31_wallet.rs`
- `V31/L1/core/src/transaction.rs`
- `V31/L1/core/src/rpc.rs`
- `V31/L1/core/src/node.rs`
- `V31/L1/core/src/storage.rs`
- `V31/L1/core/src/genesis.rs`
- `V31/L1/core/src/migration.rs`
- `V31/L1/core/src/bin/wallet.rs`
- `V31/L2/multichain/src/chain/adapters/zion_l1.rs`
- `V31/L2/multichain/src/swap/htlc.rs` (claim preimage/timelock fix, refund timelock fix)
- `V31/L2/multichain/src/server.rs` (HTLC error responses with messages)
- `V31/L2/multichain/src/db.rs`
- `V31/L2/multichain/src/types.rs`
- `V31/L2/multichain/src/config.rs` (mnemonic field)
- `V31/L2/multichain/src/warp/config.rs` (mnemonic field)
- `V31/L2/multichain/src/service.rs` (load_keyring)
- `V31/L2/multichain/src/bin/warpd.rs` (pass mnemonic)
- `V31/L2/multichain/src/warp/watcher.rs` (test helper)
- `V31/cli/src/main.rs`
- `V31/L1/miner/src/runtime.rs`
- `V31/L1/pool/src/payout.rs`
- `V31/L1/pool/src/deferred_payout.rs`
- `APP&WEB/website-v2.9/src/app/swap/page.tsx`
- `APP&WEB/website-v2.9/src/lib/swap-api.ts`
- `APP&WEB/website-v2.9/src/lib/swap-helpers.ts` (new)
- `APP&WEB/website-v2.9/src/app/api/swap/[...path]/route.ts`

## Poznámky

- V3 (`public/V3`) zůstává nezměněn; tato práce je čistě V31.
- Clippy warnings v `zion-miner` a `zion-pool` jsou pre-existing a nejsou spojeny s HTLC změnami.
