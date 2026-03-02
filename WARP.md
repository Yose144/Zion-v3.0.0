# WARP — Wormhole Architecture for Rainbow Protocol
> ZION TerraNova · Universal Cross-Chain Interoperability Layer
> **Last updated: 2025 · v2.9.6 · crate `zion-warp`**

---

## Quick Summary

| Question | Answer |
|---|---|
| Transport mechanism | **HTTP polling** (REST / JSON-RPC via `reqwest`) — NOT WebSocket |
| Cross-chain design | **ZION L1 as teleport hub** — all chains route through L1 (hub-and-spoke) |
| Poll interval | **15 seconds** (configurable via `poll_interval_secs`) |
| Python in WARP? | **No.** Pure Rust. Python only appears in `scripts/fix_bridge_addr.py` (1-off maintenance) |
| Adapter status | **7 / 7 fully implemented** (EVM, Solana, Tron, Stellar, Cosmos, Bitcoin, Cardano) |
| execute_mint() | 🔶 **D-04 stub** — signing service pending |
| Daemon port | **9333** (Axum REST) |
| Test coverage | **171 tests, 0 failures** |

---

## Architecture Overview

```
                  ┌───────────────────────────────────────────────┐
                  │              ZION L1  (TerraNova)             │
                  │       WARP vault: zion1warp0000...vault        │
                  │  Finality: 60 blocks  ·  Poll: 15 s           │
                  └───────────────┬───────────────────────────────┘
                                  │  WARP memo = "WARP:1:<chain>:<dest>"
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
    ┌─────▼─────┐          ┌──────▼──────┐         ┌─────▼──────┐
    │  EVM stack │          │  Alt-L1s    │         │  UTXO/PoW  │
    │ Base/Arb   │          │ Solana/Tron │         │ Bitcoin    │
    │ BSC/Polygon│          │Stellar/Cosmos│        │ Cardano    │
    └─────┬──────┘          └──────┬──────┘         └─────┬──────┘
          │  BridgeBurn event      │  program log / events │ metadata 674
          └───────────────────────┴───────────────────────┘
                            INBOUND FLOW
         HTTP polling every 15 s  →  DepositProof  →  WarpRouter
                            →  execute_mint()  →  ZION L1 mint

                           OUTBOUND FLOW
         client POST /transfers/outbound  →  WarpRouter
         →  ZION L1 burn  →  WARP_INBOUND:<chain>:<addr>
         →  destination chain mint adapter (D-04)
```

### Teleport Design (Hub-and-Spoke)
All cross-chain transfers **always go through ZION L1** as the settlement hub.
There is no direct chain-to-chain bridge. The flow is always:

```
Source chain burn  →  ZION L1 lock/mint  →  Destination chain mint
```

This is the **"teleport"** model referenced in the 2.9 roadmap. ZION L1 is the universal
truth layer. wZION on every external chain is a wrapped representation backed 1:1
by ZION locked in the L1 vault.

---

## WARP Memo Format

### Outbound (external chain → ZION L1)
```
WARP:1:<chain_id>:<zion_dest_address>
```
Example: `WARP:1:base:zion1abc123...`

### Inbound event tag (watcher parses)
```
WARP_INBOUND:<chain_id>:<zion_recipient_address>
```
Used internally in watcher.rs to route completed inbound transfers.

### Protocol constants (`L3/warp/src/protocol.rs`)
```rust
pub const WARP_MEMO_PREFIX: &str = "WARP";
pub const WARP_MEMO_VERSION: u32 = 1;
// Full format:  "WARP:1:<chain>:<dest_address>"
```

---

## Chain Adapter Status

| Chain | Family | Status | API Used | Config Env |
|---|---|---|---|---|
| Base Sepolia | EVM | ✅ Implemented | `eth_getLogs` JSON-RPC | `WARP_BASE_RPC` |
| Arbitrum Sepolia | EVM | ✅ Implemented | `eth_getLogs` JSON-RPC | `WARP_ARBITRUM_RPC` |
| BSC Testnet | EVM | ✅ Implemented | `eth_getLogs` JSON-RPC | `WARP_BSC_RPC` |
| Polygon Mumbai | EVM | ✅ Implemented | `eth_getLogs` JSON-RPC | `WARP_POLYGON_RPC` |
| Solana Devnet | Solana | ✅ Implemented | `getSignaturesForAddress` JSON-RPC | `WARP_SOLANA_RPC` |
| Tron Shasta | Tron | ✅ Implemented | TronGrid REST `/v1/contracts/events` | `WARP_TRON_API`, `TRON_API_KEY` |
| Stellar Testnet | Stellar | ✅ Implemented | Horizon REST + Soroban `getEvents` | `WARP_STELLAR_HORIZON`, `WARP_STELLAR_SOROBAN` |
| Cosmos Testnet | Cosmos | ✅ Implemented | CosmosSDK REST `/txs?events=wasm.*` | `WARP_COSMOS_REST` |
| Bitcoin Testnet | Bitcoin | ✅ Implemented | mempool.space REST + OP_RETURN | `WARP_BITCOIN_API` |
| Cardano Preprod | Cardano | ✅ Implemented | Blockfrost REST + metadata label 674 | `WARP_BLOCKFROST_URL`, `BLOCKFROST_PROJECT_ID` |

---

## Contract & Token Addresses

### EVM Chains (Base Sepolia — Deployed & Live)
| Contract | Address |
|---|---|
| ZIONBridge (vault) | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` |
| wZION ERC-20 | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| ZIONFarm | (Base Sepolia, see L2 docs) |
| ZIONGovernance | (Base Sepolia, see L2 docs) |
| ZIONStaking | (Base Sepolia, see L2 docs) |
| ZIONTreasury | (Base Sepolia, see L2 docs) |
| Uniswap V3 ZION/USDC pool | (Base Sepolia, see L2 docs) |

### EVM Chain IDs
| Chain | Chain ID |
|---|---|
| Base Sepolia | 84532 |
| Arbitrum Sepolia | 421614 |

### ZION L1
| Item | Value |
|---|---|
| WARP Vault | `zion1warp0000000000000000000000000000vault` |
| RPC primary | `http://77.42.31.72:8444` |
| RPC backup | `http://46.225.126.243:8444` |
| Validator | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` |

---

## Adapter Implementation Details

### EVM (`L3/warp/src/adapter/evm.rs`)
- **Scan**: `eth_blockNumber` → `eth_getLogs` with `BridgeBurn(address,uint256,string)` topic
- **ABI decode**: `from` (address 32B), `amount` (uint256 32B), `dest` (string offset+len+data)
- **Amount conversion**: 18-decimal ERC-20 → 6-decimal ZION (`/ 10^12`)
- **Local helper**: `wzion_contract(chain_id)` maps chain → wZION address

### Solana (`L3/warp/src/adapter/solana.rs`)
- **Scan**: `getSlot` → `getSignaturesForAddress(mint_pubkey, limit=40)` → `getTransaction`
- **Log parse**: `"Program log: BridgeBurn amount=X dest=zion1..."` in inner instructions
- **Config**: `SOLANA_CLUSTER` (devnet/mainnet-beta), `WARP_SOLANA_RPC`

### Tron (`L3/warp/src/adapter/tron.rs`)
- **Scan**: `GET /wallet/getnowblock` → `GET /v1/contracts/{addr}/events?event_name=BridgeBurn&limit=20`
- **Fields**: `result.amount` (sun, 6 dec), `result.destZion` (string)
- **Config**: `TRON_NETWORK` (mainnet/shasta/nile), `WARP_TRON_API`, `TRON_API_KEY`

### Stellar (`L3/warp/src/adapter/stellar.rs`)
- **Scan**: Horizon `GET /ledgers?order=desc&limit=1` → Soroban `getEvents` (contractId + BridgeBurn topic)
- **Event value JSON**: `{ "amount": "<u64>", "dest": "<zion_addr>", "from": "<stellar_addr>" }`
- **Config**: `STELLAR_NETWORK`, `WARP_STELLAR_HORIZON`, `WARP_STELLAR_SOROBAN`

### Cosmos (`L3/warp/src/adapter/cosmos.rs`)
- **Scan**: `/cosmos/base/tendermint/v1beta1/blocks/latest` → `/cosmos/tx/v1beta1/txs?events=wasm._contract_address%3D{addr}%20AND%20wasm.action%3Dbridge_burn`
- **Log parse**: wasm attributes `amount`, `dest_addr`, `sender`
- **Config**: `COSMOS_NETWORK`, `WARP_COSMOS_REST`

### Bitcoin (`L3/warp/src/adapter/bitcoin.rs`)
- **Scan**: mempool.space `/blocks/tip/height` → `/address/{addr}/txs` → `/tx/{txid}/status`
- **OP_RETURN parse**: hex-decoded script ASM → `WARP_INBOUND:bitcoin:<zion_addr>`
- **Amount**: sum of non-OP_RETURN outputs (satoshis × 10 for 6-dec ZION)
- **Safety**: only confirmed TXs (status.confirmed == true)
- **Config**: `BITCOIN_NETWORK` (mainnet/testnet/signet), `WARP_BITCOIN_API`

### Cardano (`L3/warp/src/adapter/cardano.rs`)
- **Scan**: Blockfrost `/blocks/latest` → `/assets/{asset}/transactions` → `/txs/{hash}/metadata` (label 674) → `/txs/{hash}/utxos`
- **Metadata label 674**: `{ "warp_dest": "<zion_addr>" }` (CIP-20 format)
- **Amount**: wZION UTXOs in − wZION UTXOs out = burned delta
- **Graceful skip**: if `BLOCKFROST_PROJECT_ID` not set, returns empty vec (no panic)
- **Config**: `CARDANO_NETWORK`, `WARP_BLOCKFROST_URL`, `BLOCKFROST_PROJECT_ID`

---

## Watcher Loop (`L3/warp/src/watcher.rs`)

```
tokio::spawn(watcher.run())  ←  started in main.rs
        │
        ▼  every 15 s (tokio::time::sleep)
  ── for each enabled chain ──────────────────────────────────
  │  adapter.fetch_deposits(from_block, to_block)            │
  │  → Vec<DepositProof>                                     │
  │  for each proof:                                         │
  │    dedup by tx_hash (seen_hashes HashSet)                │
  │    parse WARP_INBOUND:<chain>:<zion_addr>                │
  │    router.initiate_inbound(&chain, proof, &recipient)    │
  │    on permanent error: skip + cache in error_cache       │
  └──────────────────────────────────────────────────────────
```

### Key types
```rust
pub struct DepositProof {
    pub tx_hash:   String,   // chain-specific TX id
    pub sender:    String,   // source wallet
    pub recipient: String,   // dest ZION address
    pub amount:    u64,      // atomic units (6 decimals)
    pub block:     u64,      // block/slot/ledger number
    pub chain:     String,   // "base" | "solana" | "tron" | …
}
```

---

## REST API (`L3/warp/src/server.rs`)

Axum daemon, port **9333**

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness probe |
| GET | `/metrics` | Prometheus metrics |
| GET | `/chains` | List registered chains |
| GET | `/transfers` | All transfers |
| GET | `/transfers/pending` | Pending transfers |
| POST | `/transfers/outbound` | Initiate outbound transfer |
| POST | `/transfers/inbound` | Initiate inbound transfer |
| GET | `/transfers/:id` | Get transfer by UUID |
| POST | `/transfers/:id/advance` | Advance transfer FSM |

---

## Configuration Reference (`config/warp-testnet.toml`)

```toml
[warp]
name = "ZION WARP TestNet Node"
version = "0.1.0"
network = "testnet"

[l1]
rpc_url = "http://77.42.31.72:8444"
vault_address = "zion1warp0000000000000000000000000000vault"
finality_blocks = 60
poll_interval_secs = 15       # ← global poll cadence

[[chains]]
id = "base"
family = "Evm"
rpc_url = "https://sepolia.base.org"
wzion_address = "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6"
evm_chain_id = 84532
finality_blocks = 3
enabled = true
max_single_amount = 5_000_000_000_000   # 5M ZION
daily_limit      = 10_000_000_000_000   # 10M ZION
min_amount       =       100_000_000    # 100 ZION
```

### Validator quorum (testnet)
```toml
[validator]
address   = "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186"
threshold = 1      # 1-of-1 for testnet; mainnet will be 2-of-3 or higher
```

---

## Decimal Conversion Table

| Chain | Native decimals | ZION decimals | Divisor |
|---|---|---|---|
| EVM (wZION ERC-20) | 18 | 6 | `10^12` |
| Solana (SPL) | 6 | 6 | `1` |
| Tron (TRC-20) | 6 | 6 | `1` |
| Stellar (Soroban) | 7 | 6 | `10` |
| Cosmos (cw20) | 6 | 6 | `1` |
| Bitcoin (satoshi→custom) | 8 | 6 | `sat × 10` |
| Cardano (Lovelace/asset) | 6 | 6 | `1` |

---

## L3 XP Bridge (`L3/warp/src/xp_bridge.rs`)

Completed WARP transfers emit a `WarpXpEvent` for the AI consciousness system:

```
base_xp     = 50
volume_xp   = min(amount_atomic / 1_000_000, 200)   ← up to 200 XP
cross_bonus = if source_family != dest_family { 25 } else { 0 }
total_xp    = max 275 per transfer
```

Events are drained by the server loop and fed to `ConsciousnessEngine::add_xp()`.

---

## What Is NOT Yet Done (D-04 Pending)

### `execute_mint()` — Signing Service

All 7 adapter files contain:
```rust
// D-04: Signing service not yet built.
// This would call the ZION L1 RPC to sign & broadcast a mint TX.
Err(WarpError::NotImplemented("execute_mint pending D-04".into()))
```

**Required for D-04:**
1. ZION L1 mint RPC endpoint (authenticated)
2. Validator key management / HSM
3. Multi-sig aggregation (for mainnet quorum > 1)
4. Replay protection (nonce / seen-tx database)
5. Rate limiting per-chain / per-day

Until D-04 is complete, the daemon **receives and validates inbound proofs** but does not
actually mint ZION on L1. The transfer FSM stops at `WarpStatus::Validated`.

---

## Git History

| Commit | Description |
|---|---|
| `b9050c4` | L3/warp: fix watcher loop — correct API call signatures, ChainConfig/WarpConfig Default impls, poll_interval_secs |
| `94ea1af` | L3/warp: implement all 6 stub adapters (Solana, Tron, Stellar, Cosmos, Bitcoin, Cardano) with real HTTP |

---

## Crate Structure

```
L3/warp/
├── Cargo.toml
└── src/
    ├── lib.rs              # pub mod declarations
    ├── main.rs             # Axum server + watcher spawn
    ├── config.rs           # WarpConfig, ChainConfig (serde + Default)
    ├── protocol.rs         # WARP memo format, DepositProof, WarpMessage
    ├── types.rs            # WarpStatus, WarpTransfer, ChainFamily
    ├── error.rs            # WarpError, WarpResult
    ├── router.rs           # WarpRouter — transfer FSM
    ├── registry.rs         # ChainRegistry — registered chains
    ├── fees.rs             # FeeEngine — fee calculation
    ├── validator.rs        # WarpValidatorSet — quorum logic
    ├── db.rs               # TransferDb — SQLite persistence
    ├── server.rs           # Axum routes + WarpState
    ├── watcher.rs          # Background polling loop
    ├── xp_bridge.rs        # WarpXpEvent → ConsciousnessEngine
    └── adapter/
        ├── mod.rs          # ChainAdapter trait
        ├── evm.rs          # ✅ eth_getLogs JSON-RPC
        ├── solana.rs       # ✅ Solana JSON-RPC
        ├── tron.rs         # ✅ TronGrid REST
        ├── stellar.rs      # ✅ Horizon + Soroban
        ├── cosmos.rs       # ✅ CosmosSDK REST
        ├── bitcoin.rs      # ✅ mempool.space REST
        └── cardano.rs      # ✅ Blockfrost REST
```

---

## FAQ

**Q: Why HTTP polling and not WebSocket?**
HTTP polling was chosen intentionally:
- Simpler — no persistent connection management, reconnect logic, or heartbeat
- Battle-tested — works with any public RPC endpoint without auth quirks
- Sufficient — 15s latency is acceptable for bridge finality (all chains require ≥ 3 confirmed blocks anyway)
- WebSocket *could* be added later for sub-second latency if needed

**Q: Is this the "teleport" from the 2.9 roadmap?**
Yes. "Teleport" = hub-and-spoke through ZION L1. Nothing moves directly from chain A to chain B.
Every transfer is: burn on source → lock on ZION L1 → mint on destination.
ZION L1 is the universal truth. `WARP:1:<chain>:<addr>` is the teleport instruction embedded in the TX memo.

**Q: Was there Python in the old WARP bridge?**
No Python in the L3 Rust codebase. The only Python in the repo is:
- `scripts/fix_bridge_addr.py` — one-off maintenance script (13 lines, unrelated to WARP)
- `APP&WEB/public_html/V2/api/php-python-bridge.php` — web layer PHP→Python helper
- `tests/mock_stratum_server.py` — stratum mining mock

**Q: What is the `zion-warp` daemon?**
An Axum REST server on port 9333 + a background tokio task (watcher) that polls all enabled chains.
It is a standalone binary (`cargo run -p zion-warp`) reading `config/warp-testnet.toml`.

---

## Next Steps

| Priority | Task | Notes |
|---|---|---|
| 🔴 D-04 | `execute_mint()` signing service | Requires L1 RPC + key mgmt |
| 🟡 | Main validator key rotation | Multi-sig for mainnet |
| 🟡 | Enable remaining chains in config | Currently only `base` enabled=true |
| 🟡 | Add Arbitrum/BSC wZION addresses | Currently `0x000...000` placeholders |
| 🟢 | WebSocket adapter (optional) | Low-latency improvement, not critical |
| 🟢 | L4 Oasis XP sync | `oasis_bridge.rs` ready, needs L4 REST endpoint |
