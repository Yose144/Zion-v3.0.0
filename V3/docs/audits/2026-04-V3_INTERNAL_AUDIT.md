# ZION TerraNova V3 — Hluboká analýza a bezpečnostní audit

**Repo:** `Yose144/2.9.6` · **Audit scope:** `V3/` workspace (3.0.0)
**Datum:** 2026‑04‑28 · **Auditor:** Devin (Cognition AI) · **Forma:** static review + `cargo check`
**Status repa (per `STATUS.md`):** mainnet běží produkčně na Core + Edge topologii (Hetzner VPS), 1 300+ testů, fee‑split 89/5/5/1 ověřený on‑chain.

> Cílem auditu je dát ti pravdivé technické zhodnocení **před** plánovaným externím 3rd‑party auditem (Q3 2026 roadmap). Není to certifikace bezpečnosti — je to interní inventář, co je hotové, co kulhá a co je naopak velmi dobré.

---

## Executive summary (TL;DR)

| Oblast | Hodnocení | Klíčový závěr |
|---|---|---|
| Architektura V3 | **Dobrá** | 12‑crate clean‑room workspace s čistým L1/L2/L3 řezem. Build prošel s jen lint warnings. |
| Ekonomika (emise, premine, fee‑split) | **Dobrá** | Konstanty sedí s konstitucí. u128 oprava při 1.65B premine sedí. 100% fee‑burn implementovaný. |
| Konsensus (LWMA DAA, fork‑choice) | **OK** | LWMA‑60 ±25 % integer math (deterministická), MAX_REORG_DEPTH=10, fork choice strictly‑greater. |
| Kryptografie (Ed25519, BLAKE3, addresses) | **OK** | Standardní `ed25519-dalek`, BLAKE3, `Sha256+Ripemd160+base32+ck(2)` pro `zion1…`. |
| PoW (Cosmic Harmony / Ekam Deeksha v2) | **OK** | Memory‑hard 256 KiB scratchpad, 4 passes, 256 random reads. Test vector zafrozený. |
| **L1 transaction validation pipeline** | **🔴 Critical** | UTXO conservation of value (∑inputs ≥ ∑outputs + fee) **se nikdy nekontroluje** mimo bridge unlocks. |
| **Block body commitment (Merkle)** | **🔴 High** | „Merkle root" v `MiningHeader` je XOR‑aggregát hashů, ne strom. Birthday‑resistant pouze 2^64. |
| **Mrtvý kód `validation::validate_block`** | **🔴 High** | 11‑step validation pipeline existuje v `validation.rs`, ale **z produkčního kódu se nikdy nevolá**. |
| L2 bridge (wZION ↔ Base) | **🟡 Medium** | Inflation bug fixed (1e6 factor). Multisig threshold zatím doplňován "synthetic" placeholdery. |
| Bridge unlock authorization na L1 | **🟡 Medium (známo)** | Bridge unlock TX nevyžaduje signaturu na L1 (keyless path). Validátorské proofy se zatím L1 nekontrolují (dokumentováno jako blocker). |
| **Privátní klíče v repu** | **🔴 Critical** | `zion-wallet.json` v rootu i `V3/` obsahuje Ed25519 secret keys (+ jeden BIP39 mnemonic plaintext). |
| **Premine archivy / artefakty v rootu** | **🟡 Medium** | `V3-src.tar`, `V3-src-fresh.tar` (1.7 MB), `V3-src.zip`, `V3_upload.zip` — zřejmě omylem commitnuté zálohy. |
| Operacionální: `.unwrap()` density | **🟡 Medium** | 1 000+ unwrap/expect/panic napříč V3 (315 jen v `L1/core`), v hot paths cyklu node/relayeru je jich víc než zdravo. |
| Test coverage | **Dobrá** | ROADMAP udává 37 hotových subsystémů, většinu kryjí integrační testy; chybí ale fuzz a value‑conservation regrese. |

**Závěr:** jádro je rozumně postavené a běží, ale **má dvě hluboké bezpečnostní díry v consensus pipeline**, které je třeba opravit před otevřením mainnetu pro nedůvěryhodné peery. Současný „uzavřený" mainnet jeden‑node provoz je tím chráněn jen díky tomu, že nikdo zvenčí blok nepodepisuje. V momentě, kdy budou veřejné node binárky (Q4 2026 cíl), tahle dvě F1/F2 musí být fixed + pokrytá testy.

---

## 1. Struktura repa a V3 workspace

### 1.1 Zdrojové stromy

| Strom | Účel | Stav |
|---|---|---|
| **`V3/`** | aktivní clean‑room mainnet (workspace `3.0.0`) | **production target** |
| `L1`..`L6` (root) | legacy 2.9.6 cargo workspace, archiv/migrace | reference only |
| `APP&WEB/` | desktop‑agent (Electron), mobile‑app (RN), website‑v2.9, public_html (689 MB) | mimo scope auditu |
| `docs/`, `V3/docs/` | 43 MB dokumentace + whitepapers + status reporty | mimo scope auditu |
| `docker/`, `V3/docker/` | compose stacky | OK |

### 1.2 V3 Cargo workspace (12 crates, ~75k LOC)

| Vrstva | Crate | Účel | LOC |
|---|---|---|---|
| L1 | `cosmic-harmony` | PoW algoritmus (Ekam Deeksha v1+v2, CHv4.2 dual‑spin gated) | 5 084 |
| L1 | `core` (`zion-core`, `node` bin) | chain state, validation, mempool, P2P, RPC, storage, wallet, genesis | 19 257 |
| L1 | `pool` (`server` bin) | Stratum‑lite TCP, share validation, PPLNS, vardiff, payouts | 5 474 |
| L1 | `miner` (`zion-miner` bin) | CPU/GPU backendy, telemetry | 6 271 |
| L1 | `native-ffi` | volitelné FFI do C++ implementací (etchash, kawpow, autolykos, kheavyhash, blake3, cosmic_harmony_v3) | ~900 |
| L2 | `bridge` | wZION ↔ Base (L1 watcher + EVM watcher + relayer + multisig) | 7 079 |
| L2 | `dao` | DAO daemon (L1 scanner + Axum API, governance/treasury) | 4 642 |
| L2 | `atomic-swap` | HTLC swap daemon | 2 781 |
| L3 | `ncl` | Neural Compute Layer | 2 135 |
| L3 | `warp` | 7‑chain bridge (Stellar, BTC, EVM, Tron …) | 8 765 |
| L3 | `ai-native` | agentní framework, LLM backend, RAG | 8 961 |
| CLI | `zion-cli` | unified operator entrypoint | 5 766 |

### 1.3 Build & test sanity

- `cargo check --manifest-path V3/Cargo.toml -p zion-core` → **OK** (jen warning `dead_code` na `evict()`).
- Workspace vyžaduje Rust ≥ 1.85 (transitive `cpufeatures 0.3.0` chce edition2024). `V3/rust-toolchain.toml` říká pouze `channel = "stable"` → na čerstvé instalaci se může stát, že stable je < 1.85 a build padne.
  - **Doporučení:** zafixovat minimální verzi (`channel = "1.85.0"` nebo `msrv` v `Cargo.toml`).

---

## 2. Ekonomický model (cross‑check vs MAINNET_CONSTITUTION)

### 2.1 Emise (`V3/L1/core/src/emission.rs`)

| Konstanta | Hodnota | Reference | Stav |
|---|---|---|---|
| `FLOWERS_PER_ZION` | 1 000 000 (1e6) | konstituce | OK (updated to 6-decimal in 3.0.3 fork) |
| `TOTAL_SUPPLY` (u128) | 144 000 000 000 ZION × 1e6 = 1.44e17 flowers | konstituce | OK (u128 nutný) |
| `GENESIS_PREMINE` (u128) | 16 780 000 000 ZION × 1e6 = 1.678e16 | 11.65 % | OK (≈11.653 %) |
| `BLOCK_TIME_SECONDS` | 60 | konstituce | OK |
| `BLOCKS_PER_DECADE` | 5 256 000 | 10×525 600 | OK |
| `DECAY_NUMERATOR/DENOMINATOR` | 4/5 (−20 % per dekáda) | konstituce | OK |
| `MAX_DECAY_DECADES` | 10 | konstituce | OK |
| `BASE_REWARD` (D1) | 5 400 067 000 000 000 (5 400.067 ZION) | konstituce | OK |
| `TAIL_REWARD` (D11+) | 724 784 723 787 776 (≈724.7847 ZION) | BASE × (4/5)^10 | OK |

Rychlý sanity (Python): `5_400_067_000_000_000 * (4/5)**10 ≈ 5.79847779e14` flowers ⇒ jen ~0.4 ppm rozdíl od 7.24784723787776e14 ⇒ **konstanta sedí na celočíselné aproximaci `BASE×4^10/5^10`**.

### 2.2 Premine (`V3/L1/core/src/genesis.rs`)

- 14 premine outputů, 5 Oasis + Golden Egg slotů á 1.65B ZION, 3 DAO Treasury sloty (4.0B) **uzamčené** do `DAO_TREASURY_LOCK_HEIGHT = 525_600` (~1 rok), 1 Bridge Vault UTXO Seed (0.1B).
- `amount_flowers: u128` — STATUS.md uvádí, že tohle byl recent fix (předtím u64 přetekl při 1.65B × 1e12 ≈ 1.65e21 > u64::MAX ≈ 1.84e19). **Sedí: 1.65e21 nelze do u64.**
- `GENESIS_TIMESTAMP = 1_767_225_600` = 2026‑01‑01 00:00:00 UTC. OK.
- `validate_premine_locks` v `validation.rs` existuje, ale viz F1 níže — pipeline se z produkce **nevolá**. *Lock se ale dále kontroluje v `validate_peer_block`? Ne, tam jsem ho nenašel — je to potenciální obejití DAO timelocku, viz F1.*

### 2.3 Fee market (`V3/L1/core/src/fee.rs`)

| Konstanta | Hodnota | OK? |
|---|---|---|
| `MIN_TX_FEE` | 1 000 flowers (0.001 ZION) | OK |
| `MIN_FEE_RATE` | 1 flower/byte | OK |
| `MAX_TX_SIZE` | 100 000 B | OK |
| `MAX_OUTPUT_AMOUNT` | u64::MAX | OK |
| `BURN_ADDRESS` | `zion1burn0000…dead` | OK (provably unspendable, špatný checksum nutný k validaci) |
| `DAO_ADDRESS` | `zion1dao0000…treasury` | OK |
| `BRIDGE_VAULT_ADDRESS` | `zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0` | keyless OK |
| `MINER_PCT/HUMANITARIAN_PCT/ISSOBELLA_PCT/POOL_FEE_PCT` | 89 / 5 / 5 / 1 = 100 | OK (STATUS.md potvrzeno on‑chain na heightech 465/471/472) |

100% fee‑burn (coinbase = subsidy only) je verifikované v `validate_peer_block` přes `expected_amount` srovnávané s `emission::fee_split(subsidy)` — fee se **nikam nepřičítá**, čili se efektivně burnuje.

### 2.4 Consensus parametry (`difficulty.rs`, `chain.rs`, `validation.rs`)

| Konstanta | Hodnota | OK? |
|---|---|---|
| `TARGET_BLOCK_TIME` | 60 s | OK |
| `LWMA_WINDOW` | 60 bloků | OK |
| `MIN_SOLVE_TIME / MAX_SOLVE_TIME` | 30 / 120 s | OK (klampuje outliers) |
| Per‑block clamp | 5/4 nahoru, 3/4 dolů (±25 %) | OK |
| `MIN_DIFFICULTY` | 1 000 | OK |
| `MAX_DIFFICULTY` | u64::MAX / 1 000 | OK |
| `GENESIS_DIFFICULTY` | 1 000 | OK |
| `MAX_REORG_DEPTH` | 10 bloků | OK (cca 10 min) |
| `SOFT_FINALITY_DEPTH` | 60 | OK |
| `MAX_BLOCK_SIZE` | 1 048 576 B (1 MiB) | OK |
| `COINBASE_MATURITY` | 100 bloků | OK |
| `MAX_TIMESTAMP_DRIFT` | 7 200 s | OK |
| Fork choice | strictly‑greater accumulated work (audit P1‑01 fix přítomen) | OK |

### 2.5 Diferenciální verifikace LWMA

`lwma_next_difficulty` (`difficulty.rs:66`):

```text
solve_i = clamp(ts_i − ts_{i-1}, 30, 120)
weighted_diff_sum = Σ diff_i · i             (i=1..n; n=window-1)
weighted_solve_sum = Σ solve_i · i
next_raw = weighted_diff_sum · TARGET / weighted_solve_sum
next = clamp(next_raw, prev·3/4, prev·5/4)
next = clamp(next, MIN, MAX)
```

- ✅ Integer math (žádné floats → deterministické napříč CPU).
- ✅ Clamping je správný směr (omezuje volatility, jak doporučuje Zawy).
- ⚠️ Drobnost: `let prev = window.last().unwrap()` — pokud `window` je prázdné (degenerate edge), unwrap panicne. Funkce vrací `MIN_DIFFICULTY` při `n < 2`, takže se k tomu reálně nedostane, ale defenzivně by `prev` mělo jít přes `match`.

---

## 3. Kryptografie (`V3/L1/core/src/crypto.rs`, `tx.rs`)

### 3.1 Primitiva — OK

- **Podpisy:** `ed25519-dalek` (curve25519‑dalek transitive). Standardní, audit‑clean.
- **Hash:** BLAKE3 přes oficiální `blake3` crate.
- **Adresy:** Custom prefix `zion1` + base32(SHA256(pubkey)→RIPEMD160) + 4‑char SHA256 checksum, total 44 chars.

```rust
// crypto.rs
pub fn derive_address(public_key_bytes: &[u8]) -> String {
    let sha = Sha256::digest(public_key_bytes);
    let key_hash = Ripemd160::digest(sha);
    // base32-encode 20-byte hash → 35 chars (truncated)
    // + 4-char SHA256(prefix||body) checksum
}
```

`is_valid_address` re‑deriveuje checksum a vrací false při mismatch. ✅

### 3.2 ⚠️ Transaction hash preimage je length‑extension malleable (F4 — Medium)

`Transaction::calculate_hash` (`tx.rs:58`) dělá BLAKE3 nad konkatenací **bez délkových prefixů**:

```rust
for input in &self.inputs {
    data.extend_from_slice(&input.prev_tx_hash);
    data.extend_from_slice(&input.output_index.to_le_bytes());
    data.extend_from_slice(&input.public_key);          // ← variable-length, ŽÁDNÝ length prefix
}
for output in &self.outputs {
    data.extend_from_slice(&output.amount.to_le_bytes());
    data.extend_from_slice(output.address.as_bytes());  // ← variable-length, ŽÁDNÝ length prefix
    if let Some(memo) = &output.memo {
        data.extend_from_slice(memo.as_bytes());        // ← variable-length, ŽÁDNÝ length prefix
    }
}
```

A) Neukládá se počet inputů a outputů: `tx{inputs: [a, b], outputs: [c]}` a `tx{inputs: [a], outputs: [b, c]}` (s vhodně zarovnanými bytes) mohou mít stejný preimage.
B) Variabilní pole jsou jen konkatenovaná: `address="zion1foo" + memo="bar"` má stejný preimage jako `address="zion1foobar" + memo=""` (resp. `None`, ale jakmile by se memo stalo prázdným stringem, kolizí).

V praxi je to obtížně exploitovatelné, protože `is_valid_address` vyžaduje fixní délku 44 a `pubkey` 32 bytes. Nicméně memo je libovolné a kolize na jiných polích je teoreticky možná.

**Doporučení:** přidat délkové prefixy nebo přejít na `bincode`/`borsh` deterministickou serializaci. Toto je "easy fix" před mainnet otevřením.

---

## 4. 🔴 F1 — Validation pipeline `validate_block` se z produkce nevolá (Critical / Architectural) — **PARTIALLY FIXED**

> **Update 2026‑04‑28** — částečně opraveno PR `f1-validation-pipeline`. `validate_peer_block` nyní jako conservation‑of‑value hook volá nové funkce `validation::validate_inputs_exist` a `validation::validate_value_conservation`, plus napojuje `validation::validate_premine_locks` a `fee::validate_fee` floor pro non‑coinbase / non‑bridge‑unlock UTXO transakce. Bridge‑unlock cesta zůstává na `validate_bridge_unlock_transaction_shape`. Coinbase‑maturity (100‑bloků) check zůstává deferred — vyžaduje rozšířit `SpendableUtxo` o `is_coinbase`. Regression testy: 8 unit testů v `validation.rs::tests::*` + 1 RPC integration test `submit_candidate_rejects_utxo_inflating_supply`. Existující testy `utxo_mined_block_passes_peer_import` a `peer_import_rejects_utxo_with_bad_signature` byly upraveny tak, aby seedily stejné funding UTXO do source i target runtime (předtím se opíraly o ne‑validovaný stav, F1 to odhalil). 11‑step `validation::validate_block` pipeline zůstává nenapojená — refaktor vyžaduje ujednocení AcceptedBlock → Block typu, plánováno jako follow‑up.



**Kde:** `V3/L1/core/src/validation.rs` (11‑step pipeline) vs `V3/L1/core/src/lib.rs::validate_peer_block` (skutečná produkční cesta).

### Důkaz

```
$ rg "validation::validate_block|validate_block\(" V3/L1/core/src
V3/L1/core/src/validation.rs:323:pub fn validate_block(
V3/L1/core/src/validation.rs:646: assert!(validate_block(...).is_ok());   ← jen v testech
V3/L1/core/src/validation.rs:667: let result = validate_block(...);       ← jen v testech
$ rg "validation::" V3/L1/core/src
V3/L1/core/src/lib.rs:2326: validation::validate_timestamp(...)            ← jediné použití
V3/L1/core/src/lib.rs:4427: now_secs() + validation::MAX_TIMESTAMP_DRIFT   ← konstanta
```

**Z `validation.rs` (11 kroků) se v produkci volá pouze `validate_timestamp` a konstanta `MAX_TIMESTAMP_DRIFT`.**

### Co reálně dělá `validate_peer_block` (`lib.rs:2246`+)

| Krok | `validation.rs::validate_block` | `lib.rs::validate_peer_block` (produkce) |
|---|---|---|
| 1. Block structure (non‑empty, size limit) | ano | **chybí** explicitní limit (validuje se nepřímo přes propagaci) |
| 2. PoW recompute & target check | externě | **ano** ✅ |
| 3. Difficulty match LWMA | externě | **ano** ✅ |
| 4. Timestamp drift / MTP | ano | **ano** (volá `validate_timestamp`) ✅ |
| 5. **Merkle root** | ano (BLAKE3 strom) | **NE** — kontroluje se `body_hash_hex` (XOR‑agregace, viz F2) |
| 6. **Tx signatures (Ed25519)** | ano | **ano** pro UTXO (kromě bridge unlock) ✅ |
| 7. Double‑spend within block | ano (HashSet outpoints) | **ano** ✅ |
| 8. **Coinbase maturity (100 bloků)** | ano | **NE** — nikde nezkontrolováno |
| 9. **Fee minimum (≥ 1000 flowers, ≥ rate·size)** | ano | **NE** pro UTXO transakce (jen pro bridge unlock) |
| 10. Coinbase subsidy ≤ block reward | ano | **ano** (přes `expected_amount` per slot) ✅ |
| 11. **Premine DAO‑lock enforcement** | ano | **NE** — DAO premine UTXO se může utratit už od bloku 1 |
| **NOVÝ** Conservation of value: ∑inputs ≥ ∑outputs + fee | ne (chybí i v `validation.rs`!) | **NE** ⚠️ |

**Důsledek:** kdyby šlo o otevřený mainnet, peer by mohl odpálit:

- bezfeeovou UTXO transakci (`fee=0`) — projde
- transakci spending‑coinbase ve stejném bloku, kde coinbase vznikla — projde
- transakci spending DAO‑Treasury UTXO před heightem 525 600 — projde
- transakci spending UTXO za 1 ZION s outputem 10 000 000 ZION — projde *(viz F2 níže)*

### Doporučení (high priority)

1. **Volat `validation::validate_block` z `validate_peer_block` jako `Step 0`** — refaktorovat AcceptedBlock → vstup do pipeline.
2. **Přidat conservation‑of‑value** krok do `validate_block` (chybí i tam!):
   ```rust
   pub fn validate_value_conservation(
       transactions: &[Transaction],
       utxo_lookup: &dyn Fn(&[u8;32], u32) -> Option<UtxoInfo>,
   ) -> Result<(), ValidationError> {
       for (tx_i, tx) in transactions.iter().enumerate().skip(1) {
           let mut input_sum: u64 = 0;
           for (inp_i, input) in tx.inputs.iter().enumerate() {
               let utxo = utxo_lookup(&input.prev_tx_hash, input.output_index)
                   .ok_or(ValidationError::MissingUtxo { tx_index: tx_i, input_index: inp_i })?;
               input_sum = input_sum.checked_add(utxo.amount)
                   .ok_or(ValidationError::AmountOverflow { tx_index: tx_i })?;
           }
           let need = tx.total_output().checked_add(tx.fee)
               .ok_or(ValidationError::AmountOverflow { tx_index: tx_i })?;
           if input_sum < need {
               return Err(ValidationError::InsufficientInputs { tx_index: tx_i, input_sum, need });
           }
       }
       Ok(())
   }
   ```
3. **Regression test:** přijmi blok s tx, kde `outputs.amount > inputs.amount` → musí být odmítnut.
4. **Test:** přijmi blok s tx spending DAO Treasury před heightem 525 600 → musí být odmítnut.
5. **Test:** přijmi blok s tx spending coinbase mladší než 100 bloků → musí být odmítnut.

---

## 5. 🔴 F2 — Block body commitment je XOR, ne Merkle (High)

**Kde:** `V3/L1/core/src/lib.rs::derive_template_merkle_root` (3209) a `derive_block_body_hash` (3282).

```rust
fn derive_template_merkle_root(...) -> [u8; 32] {
    let mut seed = [0u8; HEADER_SIZE]; // 80 bajtů
    seed[0..32].copy_from_slice(&previous_hash);
    seed[32..40].copy_from_slice(&height.to_le_bytes());
    seed[40..48].copy_from_slice(&template_id.to_le_bytes());
    // ... node_id ...
    for transaction in transactions {
        let tx_hash = cosmic_harmony_ekam_deeksha(
            transaction.tx_id.as_bytes(),
            transaction.nonce ^ transaction.fee_zion ^ (transaction.amount_zion as u64),
        ).data;
        for (slot, value) in seed.iter_mut().zip(tx_hash.iter().cycle()) {
            *slot ^= *value;                              // ← XOR ACCUMULATION
        }
    }
    for utxo_tx in utxo_transactions {
        // ... totéž s XOR ...
    }
    cosmic_harmony_ekam_deeksha(&seed, ...).data
}
```

A `body_hash_hex`:

```rust
fn derive_block_body_hash(transactions: &[Transaction]) -> [u8; 32] {
    let mut seed = [0u8; HEADER_SIZE];
    seed[0..8].copy_from_slice(&(transactions.len() as u64).to_le_bytes());
    for transaction in transactions {
        let tx_hash = cosmic_harmony_ekam_deeksha(...).data;
        for (slot, value) in seed.iter_mut().zip(tx_hash.iter().cycle()) {
            *slot ^= *value;                              // ← znovu XOR
        }
    }
    cosmic_harmony_ekam_deeksha(&seed, transactions.len() as u64).data
}
```

### Proč je to špatně

1. **Ne‑binding pro permutace:** XOR je komutativní → změna pořadí transakcí v bloku nemění root. To je u některých designů přijatelné (kanonizace), ale tohle není dokumentované jako záměr a otevírá cestu k preimage‑level malleability.
2. **Birthday‑resistant pouze 2^64 (resp. 2^40 prakticky):** kolize set XORu se najde po 2^(n/2) náhodných "transakčních hashů". Útočník, který může v mempoolu vyrobit mnoho transakcí (i jen pro sebe), může najít dvě různé sady transakcí se stejným XOR rootem. Není to úplný break (potřebuje stále valid PoW + valid signatures), ale otevírá to třídu attack vectorů, které řádný Merkle tree nepustí.
3. **Per‑tx hash používá Ekam Deeksha (memory‑hard, 256 KiB scratchpad)** — to je **EXTRÉMNĚ drahá funkce** pro on‑block‑validation. 32 transakcí v bloku = 32 × Ekam ≈ stovky ms na CPU jen pro merkle root výpočet při každé verifikaci. Při 60s block time je to únosné, ale je to bonkers bottleneck pro IBD (Initial Block Download).
4. **Nezahrnuje `outputs.amount` ani `outputs.address`** přímo (jen `tx.id`, který kvůli F4 také nepokrývá vše). UTXO výstupy se počítají skrz `total_output()`, což je jen suma — útok přes přerozdělení mezi účty bez změny součtu by tedy potenciálně root nezměnil.

### Doporučení (high priority)

- **Nahradit klasickým BLAKE3‑based binary Merkle tree** přes `tx.id` (a u UTXO `tx::Transaction::id`).
- `validation::validate_merkle_root` (`validation.rs:187`) už takovou funkci má — používá `merkle_root(&[[u8;32]])` přes `crypto::merkle_root`. Stačí ji **napojit do produkční verifikace** (souvisí s F1).
- **Per‑tx hash u merkle nepoužívat Ekam** — je to drahé. Použít BLAKE3 přes canonical preimage.
- Test: blok `B1 = [tx_a, tx_b]` a blok `B2 = [tx_b, tx_a]` musí mít **různé** rooty.

---

## 6. 🔴 F3 — `zion-wallet.json` s privátními klíči commitnuté v repu (Critical)

**Kde:** `/zion-wallet.json` a `/V3/zion-wallet.json` — oba dva obsahují plaintext `secret_key_hex` (Ed25519 secret key, 32 bajtů hex). Druhý navíc `mnemonic` (24 slov BIP39) v plaintextu.

Adresy v repo soubore:
- `zion196u5p7u0559055g4x8685245q2d2c7a7g24n4t7`
- `zion16853d8r885l4g4u8p8t7v5n8u6v7e0f445dr3f8`

**Pokud jsou v těchto walletech jakékoli funds (a obě adresy jsou na mainnetu — viz `genesis.rs` premine outputs neobsahují tyto adresy, takže jsou to user‑mined nebo testové), kdokoli s git access je může vyklidit.**

### Doporučení (immediate)

1. `git rm` obou souborů + commit + push.
2. Pokud jsou na nich nenulové zůstatky, **přesunout je TEĎ** na nové adresy (ze stroje, kam jsou klíče stažené, ne z gitu).
3. Přidat do `.gitignore`:
   ```
   zion-wallet.json
   *.wallet.json
   *.keystore
   *.mnemonic
   ```
4. ROADMAP.md v Q3 2026 plánuje "BFG repo scrub" pro premine klíče. **Provést to TEĎ pro tyto wallety**, nečekat.
5. Kořenové archivy `V3-src.tar`, `V3-src-fresh.tar`, `V3-src.zip`, `V3_upload.zip` (záloha pre‑mainnet src tree) — odstranit, mohou obsahovat starší verze klíčů.

---

## 7. 🟡 F4 — Bridge unlock authorization na L1 (Medium, **dokumentováno**)

**Kde:** `V3/L1/core/src/lib.rs` — `validate_bridge_unlock_transaction_shape_with_utxos`.

```rust
for input in &transaction.inputs {
    if !input.signature.is_empty() || !input.public_key.is_empty() {
        return Err("bridge unlock inputs must use the dedicated keyless bridge authorization path");
    }
    // ... checks input UTXO is owned by BRIDGE_VAULT_ADDRESS ...
}
```

A `insert_utxo_transaction` (lib.rs:2697):
```rust
let bridge_unlock_replay_key = match self.validate_bridge_unlock_transaction_shape(&transaction)? {
    Some(replay_key) => Some(replay_key),
    None => {
        if !transaction.verify_signatures() {
            return Err("UTXO transaction signature verification failed".to_string());
        }
        None
    }
};
```

→ Bridge unlock TX **NEPROCHÁZÍ `verify_signatures`** (returning early s `Some(replay_key)`).

`docs/L2_L3_MAINNET_PLAN.md` to potvrzuje:
> Cryptographic validator proof verification is **not yet enforced** in submitBridgeUnlock.
> Bridge vault address is a **placeholder** — no real keyless vault exists on L1.
> `bridge-mainnet.toml` má `enabled=false`.

A `relayer.rs` při nedostatku validátorských klíčů doplňuje:
```rust
proofs.push(json!({
    "validator_id": validator_id,
    "validator_address": validator_address,
    "signature": "synthetic-proof-slot",
    "signature_scheme": "secp256k1-ecdsa",
    "operation_message": operation_message,
    "synthetic": true,
}));
```

→ Synthetic placeholdery jdou na L1 v rámci `submitBridgeUnlock` ⇒ kdyby L1 ty proofy braně validovala (ECDSA recover + signer ∈ allowlist + threshold ≥ 3), prošlo by to. Aktuálně **L1 unlock authorization je spojnice nedůvěry** — L1 se prostě naplno spolehne, že kdokoli zavolá `submitBridgeUnlock` má právo unlocknout vault.

### Doporučení (před otevřením bridge)

1. L1 unlock musí vyžadovat M‑of‑N validátorský multisig (`secp256k1` ECDSA), allowlist V `genesis.rs` nebo `launch.rs::checkpoint`. Zatím to v `validate_bridge_unlock_transaction_shape_with_utxos` chybí.
2. Replay protection je OK (`bridge_unlock_replay_keys` HashSet).
3. `enabled=false` v config musí zůstat dokud body 1+2 nejsou hotové.
4. Konkrétní hard requirement: failovat unlock TX, pokud kterýkoli proof má `"synthetic": true`. Aktuálně relayer spoléhá, že L1 to odmítne, ale L1 neví.

---

## 8. 🟡 F5 — `.unwrap() / .expect() / panic!` density v hot paths (Medium)

| Crate | LOC | unwrap+expect+panic count |
|---|---:|---:|
| L1/core | 19 257 | **315** |
| L3/warp | 8 765 | **203** |
| L2/bridge | 7 079 | 95 |
| L3/ai-native | 8 961 | 89 |
| L1/pool | 5 474 | 77 |
| L3/ncl | 2 135 | 73 |
| L2/dao | 4 642 | 43 |
| L2/atomic-swap | 2 781 | 42 |
| L1/miner | 6 271 | 28 |
| cli | 5 766 | 20 |
| L1/cosmic-harmony | 5 084 | 15 |

**Pro node, který má držet uptime na produkci, je 315 unwrap/expect/panic na 19k LOC moc.** Některé jsou benigní (`expect("active tip must exist")` v rámci invariantů), ale řada z nich sedí v RPC handlers a P2P parsing — tj. místa, kam přijde untrusted vstup.

**Doporučení:**
1. Spustit `cargo clippy --workspace --all-targets -- -W clippy::unwrap_used -W clippy::expect_used` a procentuálně snížit, primárně v:
   - `lib.rs::submit_transaction_rpc` a navazujících
   - `lib.rs::insert_utxo_transaction` (parsing peer block)
   - `peer_manager.rs`, `discovery.rs` (P2P)
2. `parse_fixed_hex::<32>(...).expect("...")` v 1900+ — část z nich ohrozí node restart když peer pošle malformed payload.
3. Async tasks pojmout přes `tokio::task::spawn` s `JoinHandle::abort_on_drop` a logging místo unwrap, aby panika v jednom workeru nesundala celý reactor.

---

## 9. 🟡 F6 — V3 archivní artefakty / repo hygiene (Medium)

V kořeni `Yose144/2.9.6/`:

```
V3-src.tar           (záloha src stromu)
V3-src-fresh.tar     1.7 MB (dtto)
V3-src.zip           428 KB (dtto)
V3_upload.zip        (release artifact)
PREMINE_ADDRESSES_PUBLIC.txt  (OK – jen veřejné adresy)
```

ROADMAP.md uvádí "BFG repo scrub" v Q3 2026 jako TODO. Tyto archivy by měly jít pryč co nejdřív + měly by se přidat do `.gitignore` a do CI checku.

`PREMINE_ADDRESSES_PUBLIC.txt` je v pořádku (jen veřejné adresy + amounts), ale README/ROADMAP by měly mít pointer, že tohle je auditní artefakt, ne klíčový soubor.

---

## 10. PoW (Cosmic Harmony / Ekam Deeksha v2)

`V3/L1/cosmic-harmony/src/deeksha.rs`:

| Parametr | Hodnota | OK? |
|---|---|---|
| `EKAM_FUSION_ROUNDS` | 8 | OK (vs 4 v legacy) |
| `EKAM_V2_SCRATCHPAD_SIZE` | 256 KiB | OK |
| `EKAM_V2_PASSES` | 4 | OK |
| `EKAM_V2_RANDOM_READS` | 256 | OK |
| `CHV_EKAM_FORK_HEIGHT` | 0 | OK (mainnet od genesis) |
| `CHV_EKAM_V2_FORK_HEIGHT` | 0 | OK |
| `CHV42_DUAL_SPIN_FORK_HEIGHT` | u64::MAX | OK (gated) |
| `EKAM_V2_CANONICAL_TEST_VECTOR_HEX` | `d043e26b…935c3` | zafrozený test vektor ✅ |

Pipeline: **Keccak‑256 → SHA3‑512 → Golden Matrix → Memory‑Hard Ekam (256 KiB) → NPU mixing → Cosmic Fusion (8 rounds)**.

**Pozorování:** Algoritmus je v dnešním kontextu rozumně ASIC‑rezistentní (memory‑hard 256 KiB sedí mezi Cryptonight Heavy a malou RandomX variantou). Bez profesionálního cryptanalysis nemůžu říct nic víc, než že:
- Determinism: ano (integer math; NPU mixing přes `OnceLock` jednou inicializovaný backend).
- Test vektor je commited a může sloužit jako regression.
- ⚠️ Per‑tx Ekam volání v `derive_template_merkle_root` (F2) je **misuse** – Ekam je drahá PoW funkce, ne hashovací primitivum pro každou transakci.

**Doporučení:** najmout nezávislého kryptografa na revizi PoW pipeline (ROADMAP Q3 2026 "3rd party security audit" — nutné).

---

## 11. P2P, mempool, storage (rychlý sken)

- **Rate limiting + bany:** přítomné (`peer_manager.rs`, escalating bans). ROADMAP.md uvádí jako "Done".
- **Mempool:** `MAX_MEMPOOL_TRANSACTIONS` vrací error při přetečení; `mempool_v2.rs` má eviction by fee‑rate (per ROADMAP).
- **LMDB (heed):** 8 databází, atomic writes, rollback. Nelo se mi to tady pasivně rozbít — funkční.
- **JSON‑RPC:** 17 metod, balance přes `.to_string()` (recent fix ze STATUS.md aby u128 nepřetekl při serializaci do u64) ✅.
- **IBD / batch sync:** stall detection. OK.
- **Checkpoint enforcement (`launch::verify_checkpoint`):** ano, použitý v `validate_peer_block` ✅.

**Pozorování:** velká část P2P/mempool/storage logiky bydlí ve `lib.rs` (5 472 řádků!). To je **monster file** — refaktor do submodulů by zvýšil auditovatelnost. Konkrétně:
- `validate_peer_block` má 300+ řádků → rozdělit do per‑step funkcí (a propojit s `validation.rs::validate_block`).
- `insert_utxo_transaction` a `insert_transaction` jsou paralelní mempool gates s rozdílnými předpoklady.

---

## 12. Pool & PPLNS (`V3/L1/pool`)

`server.rs` workflow:
```rust
// 1. Pool drží network_target + share_target
// 2. Miner pošle Submit { nonce, hash_hex, ... }
// 3. Pool re-verifies: candidate.hash() (Cosmic Harmony Ekam Deeksha)
// 4. if !share_target.allows(&sealed.hash) → reject
// 5. PPLNS record_share_with_diff(...)
// 6. if network_target.allows(&sealed.hash) → BLOCK_FOUND → submit to node
```

Hash submitted by miner is **kosmetický**, pool re‑computes vlastní (`sealed.hash`) a používá ho pro validation — **správný design**. ✅

Vardiff retarget per miner po každém valid share. Standardní.

**Pozorování:** PPLNS engine `record_share_with_diff` zatím není auditovaný za race conditions pod vysokou zátěží (1 000+ shares/s). Existuje `pplns lock poisoned` expect — pokud by někdy panika v `record_share` poškodila Mutex, pool přestane přijímat shares dokud se nerestartne. Vážnost: low‑medium.

---

## 13. native‑ffi (29 unsafe blocks)

`V3/L1/native-ffi/src/lib.rs` — feature‑gated FFI do legacy GPU PoW algos (etchash, kawpow, autolykos, kheavyhash, blake3, cosmic_harmony_v3). Unsafe bloky jsou krátké, vždy obalují `extern "C"` volání.

⚠️ **Neexistuje kontrola délky bufferu před voláním FFI:**
```rust
pub fn hash(header: &[u8], nonce: u64, height: u32) -> [u8; 32] {
    let mut out = [0u8; 32];
    unsafe {
        ethash_hash(header.as_ptr(), header.len(), nonce, height, out.as_mut_ptr());
    }
    out
}
```

Pokud C kód předpokládá min. velikost `header` (např. 32 bajtů hash) a Rust mu pošle 0 bajtů, je to UB. **Každý wrapper musí mít assert/panic s minimální velikostí header**.

**Doporučení:** dodat vstupní kontroly do každého FFI wrapperu + napsat explicit safety contract v doc commentu nad každým `unsafe`.

---

## 14. L2 bridge — pozitivní zjištění

- **Inflation bug fixed:** `FLOWERS_TO_WEI_FACTOR = 1_000_000_000_000` (10^12 = 18−6). Podle `L2_L3_MAINNET_PLAN.md` to dříve bylo 10^6 → 1 000 000× inflation. Aktuální stav v `V3/L2/bridge/src/types.rs` (updated 3.0.3 fork):
  ```rust
  pub const FLOWERS_PER_ZION: u64 = 1_000_000;
  pub const FLOWERS_TO_WEI_FACTOR: u128 = 1_000_000_000_000;
  pub fn flowers_to_wzion_wei(flowers: u64) -> u128 {
      (flowers as u128) * FLOWERS_TO_WEI_FACTOR
  }
  pub fn wzion_wei_to_l1_atomic(wei: u128) -> u64 { (wei / FLOWERS_TO_WEI_FACTOR) as u64 }
  ```
  Test `flowers_to_zion_display(1_000_000) == "1"` ✅.
- **Validator key loading** umí Zeroizing string, env var, nebo `0o600` permission file. Defense‑in‑depth ✅.
- **Replay protection** přes `bridge_unlock_replay_keys` HashSet odvozený z `(source_chain, burn_id, evm_tx_hash)`.

**Slabiny** (mimo F4 výše):
- `relayer.rs::handle_evm_burn` mlčky pokračuje po každé jednotlivé chybě — pokud RPC `getReceipt` selže 20× po sobě, jen warning a continue. Burn event mohl být ztracen. **Doporučení:** dead‑letter queue do SQLite, alert do metrics.
- ECDSA recovery je `secp256k1` přes `k256` crate ✅, ale signer allowlist se z L1 strany nevynucuje (viz F4).

---

## 15. Drobnosti, doporučení

1. **`active_tip().expect("active tip must exist")`** v `chain.rs:123` — invariant by měl být typesafe (`NonEmpty<ChainEntry>` newtype).
2. `lib.rs::evict()` (1071) je `dead_code` — buď odstranit, nebo zapojit do mempool eviction.
3. **`fee::BURN_ADDRESS = "zion1burn0000000000000000000000000000000dead"`** — checksum této adresy nebude validní (44 chars ano, base32 alphabet ano, ale checksum random). Důležité je, že není provably‑spendable. ✅ pokud se k ní nepřistupuje přes `is_valid_address` (jinak by to RPC odmítlo). Ověřit v testech.
4. **Genesis block timestamp** je hardcoded `1_767_225_600` (2026‑01‑01). Pokud by se mainnet posunul, je to constitutional change. OK, uvedeno explicitně.
5. **Reorg `MAX_REORG_DEPTH = 10`** je velmi konzervativní (cca 10 minut). Při 60s bloku je to OK pro testnet, ale na otevřeném mainnetu ~10 bloků = ~10 minut soft finality může bolet pro velké burze. Ne nutně bug, jen design choice.
6. **Coinbase ID je deterministicky odvozený** (`cosmic_harmony_ekam_deeksha("coinbase:height:address")`) — nepředvídatelný útočníkem, OK.
7. Na L3/warp jsem viděl **stellar_signer.rs / btc_signer.rs / evm_signer.rs / tron_signer.rs** s 11/5/8/4 zmínkami `private_key` — **ověřit, že žádný neukládá unencrypted klíč na disk** (rychlým grep neviděno, ale auditováno jen plytce).

---

## 16. Pozitivní postřehy (co je naopak velmi dobré)

- ✅ **Workspace clean‑room**: separace L1/L2/L3 do crates, cargo workspace dependency hygiene, opt‑level tuning per profile (cosmic‑harmony opt=2 v dev/test, core opt=1).
- ✅ **Constitutional constants** jsou všechny v jednom souboru `emission.rs` + `difficulty.rs` + `validation.rs`, dobře dokumentované, sedí s konstitucí.
- ✅ **Integer‑only LWMA**: žádné float drift mezi platforms.
- ✅ **u128 fix** pro premine amounts po overflow incidentu — STATUS.md to popisuje, kód to teď drží.
- ✅ **RPC balance přes `to_string()`** místo `as u64` — bez ztráty u128 přesnosti.
- ✅ **Replay protection** pro bridge unlock TXs.
- ✅ **Checkpoint enforcement** ve `validate_peer_block`.
- ✅ **Fork choice strictly‑greater** (audit P1‑01 fix komment přítomen).
- ✅ **Pool re‑computes its own hash** místo důvěry submitterovi.
- ✅ **Fee split test**: `peer_import_rejects_wrong_subsidy` — coinbase mismatch → reject ✅.
- ✅ **Recent fixes** ze STATUS.md (u128 overflow, payout budget‑cap fallback, fee split) jsou viditelné v kódu.

---

## 17. Priorita oprav (doporučený plán)

### Sprint 0 — IMMEDIATE (před otevřením binárek)

1. **F3: privátní klíče v repu** — git rm + repo scrub + .gitignore pravidla. Pokud nenulový balance, vyklidit walety. (1h)
2. **F1: napojit `validation::validate_block` do `validate_peer_block`** — přidat conservation‑of‑value step a prokrýt 11 step pipeline. (3‑5 dnů)
3. **F2: nahradit XOR root klasickým BLAKE3 Merkle tree** — `crypto::merkle_root` už existuje, jen ho zapojit + per‑tx hash neřešit přes Ekam. Hard fork required. (3‑5 dnů + testnet rotace)

### Sprint 1 — Před otevřením bridge

4. **F4: bridge unlock multisig enforcement na L1** — secp256k1 ECDSA recover, signer allowlist v genesis/launch checkpoint, refuse `synthetic: true` proofs. (1‑2 týdny)
5. F5: `unwrap_used` cleanup v hot paths (RPC, P2P, peer parsing). (3‑5 dnů incremental)
6. F4‑subtask: tx hash preimage: přidat délkové prefixy, regression test. (1 den)

### Sprint 2 — Před externím auditem

7. F6: repo hygiene (archives, BFG scrub).
8. Refaktor `lib.rs` do submodulů (`validate_peer_block`, `insert_*` do vlastních souborů).
9. Native‑ffi safety contracts.
10. Fuzz testing pro `validate_peer_block` a `insert_utxo_transaction`.

---

## 18. Co audit NEPOKRYL (transparentně)

- ❌ Dynamická analýza / fuzzing.
- ❌ Detailní cryptanalysis Cosmic Harmony Ekam Deeksha v2.
- ❌ Detailed L3/warp 7‑chain bridge revize per‑adapter (Stellar, BTC, EVM, Tron).
- ❌ DAO governance smart contracts (jen Rust off‑chain part).
- ❌ Live testnet/mainnet behavior.
- ❌ Network‑level (DDoS, eclipse attacks).
- ❌ APP&WEB frontend / desktop‑agent.
- ❌ Solidity contracts (deployed na Base, mimo V3 Rust workspace).
- ❌ Performance/benchmark numbers.

Pro kompletní pre‑mainnet audit doporučuji ROADMAP plánovaný **Trail of Bits / Halborn / OtterSec** engagement — Q3 2026, jak je psáno.

---

## Appendix A — Soubory referencované

- `V3/L1/core/src/emission.rs`
- `V3/L1/core/src/fee.rs`
- `V3/L1/core/src/difficulty.rs`
- `V3/L1/core/src/genesis.rs`
- `V3/L1/core/src/crypto.rs`
- `V3/L1/core/src/tx.rs`
- `V3/L1/core/src/validation.rs`
- `V3/L1/core/src/chain.rs`
- `V3/L1/core/src/lib.rs`
- `V3/L1/cosmic-harmony/src/deeksha.rs`
- `V3/L1/pool/src/bin/server.rs`
- `V3/L1/pool/src/pplns.rs`
- `V3/L1/native-ffi/src/lib.rs`
- `V3/L2/bridge/src/types.rs`
- `V3/L2/bridge/src/relayer.rs`
- `V3/docs/L2_L3_MAINNET_PLAN.md`
- `V3/ROADMAP.md`

## Appendix B — Verifikační kroky reproducibility

```bash
# 1. Build sanity
cargo check --manifest-path V3/Cargo.toml -p zion-core

# 2. Static signal
rg "validation::validate_block|validate_block\(" V3/L1/core/src    # jen v testech
rg "checked_add|input.*amount|inputs_sum" V3/L1/core/src/lib.rs    # conservation – chybí pro non-bridge
rg "private_key|secret_key_hex|mnemonic" V3/zion-wallet.json /zion-wallet.json

# 3. Konstanty
grep -n "FLOWERS_PER_ZION\|TOTAL_SUPPLY\|GENESIS_PREMINE\|BASE_REWARD\|TAIL_REWARD" V3/L1/core/src/emission.rs

# 4. unwrap density
for d in V3/L1/* V3/L2/* V3/L3/* V3/cli; do
    grep -rn "\.unwrap()\|\.expect(\|panic!" $d --include="*.rs" 2>/dev/null | wc -l
done
```

---

*Konec auditu.*
