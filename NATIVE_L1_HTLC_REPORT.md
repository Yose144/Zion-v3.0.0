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

## Co ještě zbývá / další kroky

1. **L2 / E2E testy:** Spustit plný multichain e2e flow (lock → claim → refund) mezi ZION L1 a dalšími chainy (BTC, ETH, Base).
2. **UI integrace:** Aktualizovat Next.js bridge UI, aby odesílalo `source_pubkey_hex` a `target_pubkey_hex` při HTLC lock volání na multichain API.
3. **Dokumentace API:** Popsat nové HTLC endpoint request/response schémata v multichain serveru.
4. **Mainnet Alpha deploy:** Připravit binárky `zion-node`, `zion-multichain` a restartovat Edge služby.

## Soubory změněné v této session

- `V31/L1/core/src/utxo.rs`
- `V31/L1/core/src/v31_wallet.rs`
- `V31/L1/core/src/transaction.rs`
- `V31/L1/core/src/rpc.rs`
- `V31/L1/core/src/node.rs`
- `V31/L1/core/src/storage.rs`
- `V31/L1/core/src/genesis.rs`
- `V31/L1/core/src/migration.rs`
- `V31/L1/core/src/bin/wallet.rs`
- `V31/L2/multichain/src/chain/adapters/zion_l1.rs`
- `V31/L2/multichain/src/swap/htlc.rs`
- `V31/L2/multichain/src/server.rs`
- `V31/L2/multichain/src/db.rs`
- `V31/L2/multichain/src/types.rs`
- `V31/cli/src/main.rs`
- `V31/L1/miner/src/runtime.rs`
- `V31/L1/pool/src/payout.rs`
- `V31/L1/pool/src/deferred_payout.rs`

## Poznámky

- V3 (`public/V3`) zůstává nezměněn; tato práce je čistě V31.
- Clippy warnings v `zion-miner` a `zion-pool` jsou pre-existing a nejsou spojeny s HTLC změnami.
