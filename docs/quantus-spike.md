# F0 Spike — Quantus chain kompatibilita (2026-10-08)

Verdikt: **GO** — veřejný RPC žije, metadata V14 dekódována, extrinsic format
je standardní Substrate v4 (custom extensions jsou unit-typy → 0 byte na wire),
subxt cesta produkčně ověřená (quantus-cli), HTTP fallback funguje.

## Sondované endpointy

| | Planck (mainnet) | Heisenberg (testnet) |
|---|---|---|
| WS RPC | `wss://a1-planck.quantus.cat` ✅ | `wss://a1-heisenberg.quantus.cat` ✅ |
| HTTP RPC | `https://a1-planck.quantus.cat` ✅ (POST JSON-RPC, reqwest stačí) | — |
| `system_chain` | Planck | Heisenberg |
| `system_name`/`version` | Quantus Node / 0.6.4-phase-alignment-373ecfe4f9e | stejné |
| `system_properties` | ss58=**189**, decimals=**12**, symbol=**PLK** | ss58=189, symbol=HEI |
| peers/synced | 28 / ✅ (head ~1 229 367) | 2 / ✅ |
| runtime | specName `quantus-runtime`, specVersion **153**, txVersion **6** | specVersion 148 |
| metadata | V14, 101 345 B, magic `meta` | V14, 101 493 B |

⚠️ **Ticker poznámka:** on-chain `tokenSymbol` na Plancku je **PLK**, tržní
ticker dle CoinGecko **QTC**. Interně držíme `QTU` (QTC je v enumu Qubitcoin),
v UI zobrazujeme „QTC (Quantus)".

## Extrinsic formát (V14 metadata)

`UncheckedExtrinsic<MultiAddress, Call, DilithiumSignatureScheme, Extra>`:

- **Signature** = enum `DilithiumSignatureScheme`: variant `Dilithium87`
  → `Dilithium87SignatureWithPublic { bytes: [u8; TOTAL_LEN] }`
  (pubkey 2592 B + sig 4627 B ≈ 7219 B). Variant `Dilithium65` existuje též.
- **Address** = `sp_runtime::MultiAddress` (Id/Index/Raw/Address32/Address20).

### Signed extensions (pořadí pro `extra` tuple)

```
CheckNonZeroSender        ()        add=()
CheckSpecVersion          ()        add=u32
CheckTxVersion            ()        add=u32
CheckGenesis              ()        add=H256
CheckMortality            Era       add=H256
CheckNonce                Compact   add=()
CheckWeight               ()        add=()
ReversibleTransactionExtension ()   add=()   ← custom, unit → 0B
WormholeProofRecorderExtension ()   add=()   ← custom, unit → 0B
ChargeTransactionPayment  Compact(tip) add=()
CheckMetadataHash         Mode(u8)  add=Option<[u8;32]>
WeightReclaim             ()        add=()
```

**Závěr:** oba quantus-custom extensions jsou prázdné → hand-rolled SCALE
builder je 100 % proveditelný; subxt `DefaultExtrinsicParams` funguje taky
(quantus-cli to tak produkčně používá).

## Pallety (index → využití v bridge)

| idx | pallet | relevance |
|---|---|---|
| 0 | System | `remark`(0:0), `remark_with_event`(0:7), storage `Account`/`Events`/`BlockHash` |
| 2 | Balances | `transfer_allow_death`(2:0), **`transfer_keep_alive`(2:3)**, `transfer_all`(2:4), `burn`(2:10) |
| 5 | QPoW | consensus metadata |
| 6 | MiningRewards | emission |
| 9 | Utility | batch (`batch`/`batch_all` pro multi-payout!) |
| 11 | ReversibleTransfers | sender-cancellable — NE pro swapy |
| 19 | **Multisig** | escrow/možné 2-of-2 flow později |
| 20 | **Wormhole** | ZK burn→claim (`UsedNullifiers`,`TransferCount`) — provable-burn směr QTC→ZION |
| 22 | Vesting | — |

## subxt Config (z quantus-cli — produkčně ověřené)

```rust
impl Config for ChainConfig {
    type AccountId = AccountId32;
    type Address = MultiAddress<AccountId32, ()>;
    type Signature = DilithiumSignatureScheme;   // qp-dilithium-crypto
    type Hasher = SubxtBlake2bHasher;            // BlakeTwo256
    type Header = SubstrateHeader<u32, SubxtBlake2bHasher>;
    type AssetId = u32;
    type ExtrinsicParams = DefaultExtrinsicParams<Self>;
}
// Signer: DilithiumPair → DilithiumSignatureScheme::Dilithium(sig_with_public)
```

⚠️ Header má custom pole `zkTreeRoot` — subxt `SubstrateHeader` decode
funguje (subxt header decode je benevolentní), ale při ručním parsování
headeru počítat se 4. rootem.

## RPC cally potřebné pro adapter

| Účel | RPC |
|---|---|
| height | `chain_getFinalizedHead` → `chain_getHeader` |
| block scan | `chain_getBlock` (extrinsics hex → SCALE parse) |
| balance | `state_getStorage` System.Account (twox128 concat) |
| nonce | `system_accountNextIndex` |
| submit | `author_submitExtrinsic` |
| fee | `payment_queryInfo` |
| genesis | `chain_getBlockHash(0)` (pro CheckGenesis) |
| runtime ver | `state_getRuntimeVersion` |

## Transport

- Primární: **HTTPS JSON-RPC** (`https://a1-planck.quantus.cat`) — poll-based,
  stačí existující `reqwest` dep, žádný WS klient.
- Sekundární/vlastní node: `ws://127.0.0.1:9944` — připravit přepínatelné
  přes `QUANTUS_RPC` env.

## Finalita

`chain_getFinalizedHead` vrací skutečný finalized head ≠ best (digest logy
`pow_` seal + druhý log pravděpodobně finality gadget). **QPoW je
probabilistický** — bridge používá `QUANTUS_MIN_CONF` (default 30 bloků).

## Ověřené nástroje/craty

- `qp-rusty-crystals-dilithium` (crates.io 3.0.1) — ML-DSA-87 sign/verify, pure Rust, no-std → **wasm-kompatibilní** (desktop wallet path)
- `qp-dilithium-crypto` (0.5.0) — sp-core/sp-runtime traits, `DilithiumPair`, `DilithiumSignatureScheme`
- `qp-rusty-crystals-hdwallet` — HD derivace (optional dep)
- `quantus-cli` (GitHub) — reference impl; použít jako inspiraci, ne dep (táhne clap/CLI strom)

## Zbývá k F1 rozhodnutí

- [x] ss58 encode/decode utility — implementováno v `adapters/quantus.rs`
      (`ss58_encode`/`ss58_decode`, two-byte prefix 189, blake2b-512 "SS58PRE" checksum)
- [ ] HD derivation path — ověřit vs `quantus key quantus --scheme wormhole`/`--words`
      (F2: `qp-rusty-crystals-hdwallet` nebo 32B seed z keyringu)
- [x] Dilithium87SignatureWithPublic byte layout = **sig(4627)‖pubkey(2592)** = 7219 B,
      enum variant `Dilithium` index 0x00
- [ ] Testnet faucet/zdroj HEI pro E2E send test
- [ ] `payment_queryInfo` fee response format
- [x] AccountId32 = `poseidon2_squeeze_twice(dilithium_pubkey)[0..32]`
      (ověřeno proti `qp-dilithium-crypto` `IdentifyAccount`)
- [x] Vlastní signed extensions (`ReversibleTransactionExtension`,
      `WormholeProofRecorderExtension`) = unit typy → 0 B na wire,
      standardní extrinsic v4 encoding funguje
- [x] Custom header pole `zkTreeRoot` — header jen čteme (number), nedekódujeme
