# 🌀 WARP — Wormhole Architecture for Rainbow Protocol

**ZION TerraNova L3 — Universal Cross-Chain Interoperability**

> *WARP connects ZION to every major blockchain, enabling seamless asset
> teleportation across the multi-chain universe.*

---

## 🏗️ Architecture Overview

```
                    ┌──────────────────────────────────────────────────┐
                    │              🌀 WARP ROUTER                      │
                    │  ┌──────────┬──────────┬──────────┬───────────┐ │
                    │  │ Transfer │ Validator│   Fee    │  State    │ │
                    │  │ Routing  │ Quorum   │  Engine  │  Machine  │ │
                    │  └────┬─────┴────┬─────┴────┬─────┴────┬──────┘ │
                    └───────┼──────────┼──────────┼──────────┼────────┘
                            │          │          │          │
              ┌─────────────┼──────────┼──────────┼──────────┼────────────┐
              │             │    CHAIN ADAPTER LAYER         │            │
              │ ┌───────┐ ┌┴──────┐ ┌┴──────┐ ┌┴───────┐ ┌┴────────┐  │
              │ │  EVM  │ │Solana │ │ Tron  │ │Stellar │ │ Cardano │  │
              │ │       │ │       │ │       │ │        │ │         │  │
              │ │Base   │ │SPL    │ │TRC-20 │ │Soroban │ │Plutus   │  │
              │ │Arb    │ │Anchor │ │TVM    │ │Classic │ │Native   │  │
              │ │BSC    │ │       │ │       │ │Asset   │ │Token    │  │
              │ │Polygon│ │       │ │       │ │        │ │         │  │
              │ └───┬───┘ └───┬───┘ └───┬───┘ └───┬────┘ └────┬────┘  │
              │     │         │         │         │            │        │
              │ ┌───┴───┐ ┌──┴────┐                                    │
              │ │Cosmos │ │Bitcoin│  ← Also available                   │
              │ │IBC    │ │HTLC   │                                    │
              │ └───────┘ └───────┘                                    │
              └────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │   ZION L1 (6 decimals)    │
              │   Bridge Vault Address    │
              │   WARP:1:chain:address    │
              └───────────────────────────┘
```

---

## 🔗 Supported Chains

| Chain     | Family   | Token Standard | Decimals | Finality     | Status      |
|-----------|----------|----------------|----------|--------------|-------------|
| **Base**      | EVM      | ERC-20         | 18       | ~2 min       | � Signing live |
| **Arbitrum**  | EVM      | ERC-20         | 18       | ~15 min      | 🟢 Signing live |
| **BSC**       | EVM      | BEP-20         | 18       | ~15 sec      | 🟢 Signing live |
| **Polygon**   | EVM      | ERC-20         | 18       | ~5 min       | 🟢 Signing live |
| **Solana**    | Solana   | SPL Token      | 9        | ~12 sec      | 🟢 Signing live |
| **Tron**      | Tron     | TRC-20         | 18       | ~57 sec      | 🟢 Signing live |
| **Stellar**   | Stellar  | Stellar Asset  | 7        | ~5 sec       | � Signing live |
| **Cardano**   | Cardano  | Native Token   | 6        | ~7 min       | 🟡 Skeleton |
| **Cosmos**    | Cosmos   | IBC / CW20     | 6        | ~6 sec       | 🟡 Skeleton |
| **Bitcoin**   | Bitcoin  | HTLC           | 8        | ~60 min      | � Signing live |

---

## 🔄 Transfer Flow

### Outbound: ZION L1 → External Chain

```
1. User sends ZION to L1 vault with memo:
   WARP:1:solana:7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU

2. L1 Watcher detects lock TX → creates DepositProof

3. Router:
   a. Validates chains, address, amount
   b. Converts decimals (L1 6 dec → Solana 9 dec: ×10³)
   c. Calculates fee (0.15%)
   d. Creates WarpMessage

4. Validators sign WarpMessage (3-of-5 quorum)

5. Destination adapter executes mint:
   - EVM: bridgeMint() on wZION contract
   - Solana: SPL token mint via Anchor program
   - Tron: TRC-20 mint via TriggerSmartContract
   - Stellar: Payment from issuer / Soroban mint
   - Cardano: Native token mint via Plutus script
   - Cosmos: IBC transfer / CW20 mint

6. Transfer marked as Completed ✅
```

### Inbound: External Chain → ZION L1

```
1. User burns wZION on external chain
   (calls bridgeBurn / SPL burn / etc.)

2. Chain Watcher detects burn event → creates DepositProof

3. Router validates + creates WarpMessage

4. Validators reach quorum (3-of-5)

5. ZION L1 releases locked ZION to recipient

6. Transfer marked as Completed ✅
```

---

## 💰 Fee Model

| Route            | Fee   | Min Fee   | Max Fee     |
|------------------|-------|-----------|-------------|
| ZION ↔ EVM       | 0.1%  | 0.1 ZION  | 10,000 ZION |
| ZION ↔ Solana    | 0.15% | 0.1 ZION  | 15,000 ZION |
| ZION ↔ Tron      | 0.1%  | 0.1 ZION  | 10,000 ZION |
| ZION ↔ Stellar   | 0.1%  | 0.1 ZION  | 10,000 ZION |
| ZION ↔ Cardano   | 0.2%  | 0.2 ZION  | 20,000 ZION |
| ZION ↔ Cosmos    | 0.15% | 0.1 ZION  | 15,000 ZION |
| ZION ↔ Bitcoin   | 0.25% | 0.5 ZION  | 25,000 ZION |

### Fee Distribution
- 🔥 **50% BURN** — permanent deflation
- 🏛️ **25% DAO Treasury** — governance fund
- 💰 **25% Validators** — incentive for bridge operators

---

## 🔒 Security Model

### 1. Validator Multisig (3-of-5)
Every cross-chain operation requires 3 of 5 validators to sign.
Validators run independent nodes and verify proofs independently.

### 2. Source Chain Finality
Each chain has specific finality requirements:
- Bitcoin: 6 blocks (~60 min)
- ZION L1: 60 blocks (~15 min)
- EVM: 12-20 blocks (varies)
- Solana: 31 confirmations (~12 sec)
- Stellar/Cosmos: 1 block (instant BFT finality)

### 3. Timelock for Large Amounts
Transfers >1M ZION get a 24-hour delay, allowing guardians to review.

### 4. Daily Limits
10M ZION maximum throughput per chain per day.

### 5. Replay Protection
Each transfer has a unique UUID + source TX hash.
Processed transfers tracked in both DB and on-chain mappings.

### 6. Emergency Pause
Guardian role can pause any chain adapter independently.

---

## 🔢 Decimal Conversion Table

ZION L1 uses **12 decimals** — 1 ZION = `1,000,000,000,000` flowers
(`FLOWERS_PER_ZION = 10¹²`). The sub-unit is called **flowers**
(canonical name per `docs/CANONICAL_UNITS_AUDIT.md` and `AGENTS.md`).
All columns below convert **from L1 flowers** to the destination chain's
native integer unit.

| Destination | Decimals | flowers → native | 1 ZION =              |
|-------------|----------|-----------------|-----------------------|
| EVM (wZION) | 18       | × 10⁶           | 1,000,000,000,000,000,000 wei |
| Solana      | 9        | ÷ 10³           | 1,000,000,000 lamports |
| Tron        | 18       | × 10⁶           | 1,000,000,000,000,000,000 sun |
| Stellar     | 7        | ÷ 10⁵           | 10,000,000 stroops    |
| Cardano     | 6        | ÷ 10⁶           | 1,000,000 lovelace    |
| Cosmos      | 6        | ÷ 10⁶           | 1,000,000 uatom-equiv |
| Bitcoin     | 8        | ÷ 10⁴           | 100,000,000 satoshis  |

> **Bridge code reference:** `V3/L2/bridge/src/types.rs` exposes
> `l1_flowers_to_wzion_wei()` (×10⁶) and `wzion_wei_to_l1_flowers()`
> (÷10⁶). Legacy aliases `l1_atomic_to_wzion_wei` are kept for
> backward compatibility but new code should use the `flowers` names.

---

## 📁 Crate Structure

```
warp/
├── Cargo.toml                  # Dependencies: tokio, ethers, bs58, ed25519-dalek, etc.
└── src/
    ├── lib.rs                  # Module exports + architecture diagram
    ├── main.rs                 # WARP node entry point
    ├── error.rs                # WarpError enum (chain, transfer, validation errors)
    ├── types.rs                # ChainId, Asset, WarpTransfer, WarpStatus, conversion
    ├── protocol.rs             # WarpMessage, DepositProof, MintInstruction, memo format
    ├── registry.rs             # ChainRegistry: register, lookup, enable/disable chains
    ├── router.rs               # WarpRouter: orchestrate transfers end-to-end
    ├── state.rs                # TransferStateMachine: lifecycle + valid transitions
    ├── fees.rs                 # FeeEngine: per-route fees, distribution (burn/DAO/validators)
    ├── validator.rs            # WarpValidatorSet + ConsensusTracker
    ├── config.rs               # WarpConfig: load from TOML
    ├── metrics.rs              # Atomic counters + MetricsSnapshot
    └── adapter/
        ├── mod.rs              # ChainAdapter trait + create_adapter factory
        ├── evm.rs              # 🟢 EVM adapter — live EIP-155 signing via evm_signer
        ├── solana.rs           # 🟢 Solana adapter — live SPL mintTo via solana_signer
        ├── tron.rs             # 🟢 Tron adapter — live TRC-20 mint via tron_signer
        ├── stellar.rs          # 🟢 Stellar adapter — live payment via stellar_signer
        ├── cardano.rs          # Cardano adapter (Native Token, Plutus)
        ├── cosmos.rs           # Cosmos adapter (IBC, CW20)
        └── bitcoin.rs          # 🟢 Bitcoin adapter — live P2WPKH sending via btc_signer
```

---

## 🆚 WARP vs L2 Bridge

| Aspect          | L2 Bridge (`bridge/`)    | L3 WARP (`warp/`)              |
|-----------------|--------------------------|----------------------------------|
| Scope           | EVM chains only          | All chain families               |
| Protocol        | Lock/Mint/Burn           | Universal + HTLC                 |
| Memo Format     | `BRIDGE:chain:addr`      | `WARP:1:chain:addr`             |
| Adapter         | Fixed EVM                | Pluggable per-chain              |
| Fees            | 0.1% flat                | Per-route (0.1%–0.25%)          |
| State Machine   | Simple (6 states)        | Full lifecycle (9 states)        |
| Router          | Direct relay             | Multi-chain orchestrator         |
| Cross-Chain     | ❌ Only L1↔EVM           | ✅ Any↔Any via L1 hub           |

The L2 Bridge remains operational for fast EVM bridging.
WARP extends it to the full multi-chain universe.

---

## 📅 Implementation Roadmap

| Phase | Scope | Target |
|-------|-------|--------|
| **Phase 1** ✅ | L2 wZION Bridge (EVM) | Done (Sprint 3.4) |
| **Phase 2** ✅ | WARP Skeleton (all adapters) | Done (Sprint 3.4.15-3.4.20) |
| **Phase 2.5** ✅ | EVM `execute_mint` — real EIP-155 signing | Done (2026-03-03) |
| **Phase 3** ✅ | Bitcoin P2WPKH `execute_mint` — BIP143 signing | Done (2026-03-03) |
| **Phase 4** ✅ | Stellar classic Payment signing — ed25519, XDR, StrKey | Done (2026-03-03) |
| **Phase 5** ✅ | Solana SPL `mintTo` — ed25519, compact-u16, ATA derivation, no SDK | Done (2026-03-03) |
| **Phase 6** ✅ | Tron TRC-20 `mint` — secp256k1, base58check, TronGrid REST | Done (2026-03-03) |
| **Phase 7** ⬜ | Cardano native token + Plutus | 2026 Q3 |
| **Phase 8** ⬜ | Cosmos IBC integration | 2026 Q4 |
| **Phase 9** ⬜ | Full E2E testing + audit | 2027 Q1 |
| **Phase 10** ⬜ | MainNet launch | 2027 Q2 |

---

## 🦀 Solana Signing Implementation (Phase 5)

> Implemented: 2026-03-03 | Commit: `39d4d58` | Tests: 228 pass

### Overview

The Solana adapter now performs **real on-chain SPL Token `mintTo` transactions**
with zero dependency on `solana-sdk` or `solana-client` — pure Rust using
`ed25519-dalek`, `bs58`, and `sha2` (all already present).

### Module: `solana_signer.rs`

```rust
pub struct SolanaSigner { /* ed25519 SigningKey */ }

impl SolanaSigner {
    pub fn from_env() -> WarpResult<Self>           // reads WARP_SOLANA_RELAY_KEY
    pub fn from_base58(key_b58: &str) -> WarpResult<Self>  // 32 or 64-byte keypair
    pub fn pubkey(&self) -> [u8; 32]
    pub async fn mint_to(
        &self, client: &Client, rpc_url: &str,
        recipient_wallet: &str, mint_addr: &str, amount: u64,
    ) -> WarpResult<String>                         // returns base58 tx signature
}

pub fn derive_ata(owner: &[u8;32], mint: &[u8;32]) -> WarpResult<[u8;32]>
pub async fn get_latest_blockhash(client: &Client, rpc_url: &str) -> WarpResult<[u8;32]>
```

### Transaction Building (legacy format, no SDK)

```
1. derive_ata(recipient_wallet, mint_addr)
            via findProgramAddress(seeds=[wallet, TOKEN_PROGRAM, mint], ATA_PROGRAM)
            SHA-256 hash of seeds, off-curve check (not a valid Ed25519 point)
            bump nonce 255→0 search

2. getLatestBlockhash → 32-byte blockhash

3. build_mint_to_message(authority, mint, dest_ata, blockhash, amount)
   Message header: [1, 0, 1]   (1 signer, 0 readonly-signed, 1 readonly-unsigned)
   Accounts (compact-u16 = 4):
     [0] authority      (signer, writable)
     [1] mint           (writable)
     [2] dest_ata       (writable)
     [3] TOKEN_PROGRAM  (read-only)
   Instruction: program_idx=3, accounts=[1,2,0], data=[0x07, amount_u64_le]

4. sig = ed25519.sign(message_bytes)   ← Solana: no pre-hashing, sign raw

5. serialize_transaction: compact-u16(1) || sig[64] || message
   → base64 encode → sendTransaction
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `WARP_SOLANA_RELAY_KEY` | Base58-encoded keypair (64-byte seed\|\|pubkey or 32-byte seed) |
| `SOLANA_CLUSTER` | `mainnet-beta` \| `devnet` \| `testnet` (default: mainnet-beta) |
| `WARP_SOLANA_RPC` | Custom RPC endpoint override |

---

## 🔴 Tron Signing Implementation (Phase 6)

> Implemented: 2026-03-03 | Commit: `1ad0aca` | Tests: 252 pass

### Overview

The Tron adapter now performs **real on-chain TRC-20 `mint` transactions** via
TronGrid REST API, using the same `k256` secp256k1 crate already present for EVM.

### Module: `tron_signer.rs`

```rust
pub struct TronSigner { /* k256 secp256k1 SigningKey */ }

impl TronSigner {
    pub fn from_env() -> WarpResult<Self>           // reads WARP_TRON_RELAY_KEY
    pub fn from_hex(hex_key: &str) -> WarpResult<Self>
    pub fn address(&self) -> String                 // Tron base58check address
    pub async fn mint_trc20(
        &self, client: &Client, api_url: &str,
        contract: &str, recipient: &str, amount: u64,
    ) -> WarpResult<String>                         // returns txID
}

pub fn tron_address_from_key(key: &SigningKey) -> String
pub fn tron_base58check_encode(payload: &[u8]) -> String
pub fn tron_base58check_decode(addr: &str) -> WarpResult<[u8;21]>
pub fn abi_encode_mint_params(recipient: &str, amount: u64) -> WarpResult<String>
```

### Transaction Flow

```
1. abi_encode_mint_params(recipient, amount)
   Tron ABI (64 bytes / 128 hex chars):
     Bytes  0-11: 0x00 padding
     Bytes 12-31: Tron address bytes (drop 0x41 prefix)
     Bytes 32-55: 0x00 padding
     Bytes 56-63: amount as u64 big-endian

2. POST /wallet/triggersmartcontract
   {
     owner_address: relay_wallet_address,
     contract_address: wzion_contract,
     function_selector: "mint(address,uint256)",
     parameter: <abi_hex>,
     fee_limit: 50_000_000   ← 50 TRX max
   }
   → unsigned tx JSON + txID = SHA256(raw_data)

3. tron_sign_txid(key, txID)
   (sig, recid) = sign_prehash_recoverable(txid_bytes)
   out = r[32] || s[32] || v[1]   v = recid (0 or 1, NOT +27)

4. tx["signature"] = [sig_hex]

5. POST /wallet/broadcasttransaction → result=true → txID returned
```

### Address Derivation

```
Keccak256(uncompressed_pubkey[1..])  → 32 bytes
→ last 20 bytes = EVM-style address
→ prepend 0x41 → 21 bytes
→ SHA256(SHA256(21 bytes))[0..4] = checksum
→ base58(21 bytes + 4 checksum bytes) = Tron address (starts with 'T')
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `WARP_TRON_RELAY_KEY` | 32-byte secp256k1 private key, hex-encoded |
| `TRON_NETWORK` | `mainnet` \| `nile` \| `shasta` (default: mainnet) |
| `WARP_TRON_API` | TronGrid API base URL override |
| `TRON_API_KEY` | TronGrid API key (added as `TRON-PRO-API-KEY` header) |

---

## 🔏 EVM Signing Implementation (Phase 2.5)

> Implemented: 2026-03-03 | Commit: `5e6dc58` | Tests: 180 pass

### Overview

The EVM adapter now performs **real on-chain transactions** for `execute_mint` without
any external ethers-rs dependency — pure Rust using `k256`, `sha3`, and `rlp`.

### Module: `evm_signer.rs`

```rust
// Key public API:
pub struct EvmSigner { /* secp256k1 SigningKey */ }

impl EvmSigner {
    pub fn from_env() -> WarpResult<Self>   // reads WARP_EVM_RELAY_KEY env var
    pub fn from_hex(key: &str) -> WarpResult<Self>
    pub async fn send_tx(
        &self, client: &Client, rpc_url: &str,
        chain_id: u64, to: &str,
        calldata: &[u8], value: u128, gas_limit: u64,
    ) -> WarpResult<String>                 // returns 0x tx hash
}

pub fn abi_encode_bridge_mint(
    recipient: &str, amount: u128, msg_hash: &[u8; 32],
) -> WarpResult<Vec<u8>>
```

### EIP-155 Signing Flow

```
1. Fetch nonce  → eth_getTransactionCount (latest)
2. Fetch gasPrice → eth_gasPrice
3. Build TX fields: nonce, gasPrice, gasLimit=300_000, to, value=0, data=calldata
4. RLP-encode pre-sign tuple + (chainId, 0, 0)  ← EIP-155
5. hash = Keccak256(rlp_bytes)
6. (sig, recid) = k256 ECDSA sign(hash)
7. v = recid + 2*chainId + 35            ← EIP-155 replay protection
8. RLP-encode final TX (nonce, gasPrice, gasLimit, to, value, data, v, r, s)
9. eth_sendRawTransaction("0x" + hex(raw_tx)) → tx_hash
```

### ABI Encoding for `bridgeMint(address, uint256, bytes32)`

```
Bytes  0- 3: selector = keccak256("bridgeMint(address,uint256,bytes32)")[0..4]
Bytes  4-35: address  = 12×0x00 + 20 addr bytes   (left-padded to 32)
Bytes 36-67: amount   = 16×0x00 + u128.to_be_bytes (right-aligned uint256)
Bytes 68-99: msgHash  = 32 bytes verbatim
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WARP_EVM_RELAY_KEY` | Yes (for live minting) | Hex-encoded secp256k1 private key of relay wallet |
| `WARP_EVM_GAS_LIMIT` | No (default 300,000) | Override per-call gas limit |

If `WARP_EVM_RELAY_KEY` is **not set**, `execute_mint` falls back to a dry-run
`eth_call` simulation and returns a clear error — no silent failures.

### Supported Chains & Chain IDs

| Chain | Chain ID |
|-------|----------|
| Base | 8453 |
| Base Sepolia | 84532 |
| Arbitrum One | 42161 |
| BSC | 56 |
| Polygon | 137 |
| Ethereum Mainnet | 1 (default) |

---

## 🧪 Testing Strategy

```
Unit Tests (per module):
  cargo test -p zion-warp

Integration Tests (per chain):
  cargo test -p zion-warp --test solana_integration
  cargo test -p zion-warp --test tron_integration

E2E Test (full flow):
  ZION L1 → lock → WARP → mint on Solana Devnet → burn → WARP → unlock on L1
```

---

*Built with 🌀 for the ZION multi-chain universe.*
*Peace and One Love.* ☮️❤️
