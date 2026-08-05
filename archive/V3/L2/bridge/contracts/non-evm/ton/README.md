# ZION Jetton — TON (TEP-74)

## Overview

ZION on TON is implemented as a **TEP-74 jetton** with **9 decimals** (TON standard — all TON jettons use 9 decimals by convention). The WARP relay handles the conversion from L1's 6 decimals to TON's 9 decimals (multiply by 1000 on mint, divide by 1000 on burn). Bridge mint/burn authority is controlled by the WARP bridge multisig (5/5 validator quorum).

## Files

| File | Description |
|------|-------------|
| `zion_jetton.fc` | FunC code for jetton master contract + wallet contracts |

## Token Parameters

- **Name:** ZION
- **Symbol:** ZION
- **Decimals:** 9 (TON standard — 1 ZION = 1,000,000,000 nano)
- **Max Supply:** 144,000,000,000 ZION (144B)
- **Bridge Authority:** WARP bridge multisig (admin address)
- **Standard:** TEP-74 (TON jetton standard)

## Decimal Conversion

TON uses 9 decimals by convention. ZION L1 uses 6 decimals. The WARP relay handles the conversion:
- **Mint (L1 → TON):** L1 amount × 1000 = TON nano amount
- **Burn (TON → L1):** TON nano amount ÷ 1000 = L1 atomic amount

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Jetton Master Contract                                          │
│  - total_supply: Coins                                           │
│  - admin: MsgAddress (WARP bridge multisig)                     │
│  - paused: bool                                                  │
│  - total_minted: Coins (audit)                                   │
│  - total_burned: Coins (audit)                                   │
│  - jetton_wallet_code: cell                                      │
│  - validators: 5 × 256-bit public keys                           │
│                                                                  │
│  Operations:                                                     │
│  - op=0: Bridge mint (admin only)                                │
│  - op=1: Bridge burn (from wallet)                               │
│  - op=2: Pause (admin only)                                      │
│  - op=3: Unpause (admin only)                                    │
│  - op=0x8e8d9b57: Provide wallet address (TEP-74)               │
│  - op=0x7362d09c: Get jetton data (TEP-74)                      │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Jetton Wallet Contract (per-user)                               │
│  - balance: Coins                                                │
│  - owner: MsgAddress                                             │
│  - master: MsgAddress                                            │
│  - jetton_code: cell                                             │
│                                                                  │
│  Operations:                                                     │
│  - op=0x178d4519: Transfer (TEP-74)                             │
│  - op=0x595f07bc: Internal transfer (from another wallet)       │
│  - op=0x7bdd97de: Burn (bridge burn — user initiates)           │
│  - op=0x8e8d9b57: Get wallet data (TEP-74)                      │
└─────────────────────────────────────────────────────────────────┘
```

## Deployment Steps

### Prerequisites
- `ton-compiler` or `func` CLI
- `toncli` or `ton-constructor` for deployment
- A TON wallet with TON for deployment gas
- TON Center API key (for the WARP adapter)

### 1. Compile the FunC code
```bash
# Using ton-compiler
func -o zion_jetton.fif -SPA zion_jetton.fc

# Or using toncli
toncli build
```

### 2. Deploy to TON mainnet
```bash
# Using toncli
toncli deploy -n mainnet

# Or using ton-constructor / tonhub
# 1. Create the master contract from the compiled Fift code
# 2. Initialize with admin address = WARP bridge multisig
# 3. Set the 5 validator public keys in contract storage
# 4. Send deployment transaction with sufficient TON for storage
```

### 3. Verify deployment
```bash
# Check jetton data via TON Center API
curl -s "https://toncenter.com/api/v2JSONRPC" \
  -d '{"jsonrpc":"2.0","id":1,"method":"runGetMethod","params":
  {"address":"<master_address>","method":"get_jetton_data","stack":[]}}'

# Should return: total_supply, mintable=true, decimals=9
```

### 4. Update the WARP adapter
After deployment, update `V3/L3/warp/src/adapter/ton.rs`:
- Set `WARP_TON_BRIDGE_ACCOUNT` env var to the jetton master contract address (EQ...)
- Set `WARP_TON_API` and `WARP_TON_API_KEY` env vars

## Bridge Flow

### L1 → TON (Mint)
1. User locks ZION on L1 bridge address
2. WARP relay confirms ≥60 block finality
3. Relay sends op=0 message to jetton master contract
4. Message includes: amount (in nano, L1_amount × 1000), destination, l1_tx_hash
5. Master contract mints jettons to destination's wallet contract
6. Program log: `BridgeMint <amount> <destination> <l1_tx_hash>`

### TON → L1 (Burn)
1. User sends op=0x7bdd97de (burn) to their jetton wallet contract
2. Message includes: amount, l1_recipient (bech32), burn_id
3. Wallet reduces balance and notifies master (op=1)
4. Master reduces total_supply
5. Program log: `BridgeBurn <amount> <l1_recipient> <burner> <burn_id>`
6. WARP relay observes the transaction and releases ZION on L1

## TEP-74 Standard

The contract implements the [TEP-74 jetton standard](https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md):
- `transfer` (op=0x178d4519) — transfer jettons to another wallet
- `internal_transfer` (op=0x595f07bc) — receive from another wallet
- `get_wallet_address` (op=0x8e8d9b57) — compute wallet address for an owner
- `get_jetton_data` (op=0x7362d09c) — get jetton metadata

## Security

- **Admin authority:** Only the bridge multisig can mint and pause
- **Validator quorum:** 5/5 required (enforced by the multisig wallet that sends mint messages)
- **Pause:** Admin can pause mint/burn in emergencies
- **Replay protection:** L1 tx hashes and burn IDs (tracked off-chain by WARP relay)
- **Min amount:** 100 ZION (100,000,000,000 nano) minimum to prevent dust attacks
- **Max supply:** 144B ZION hard cap enforced in master contract
- **Bounceable messages:** All messages are bounceable for error recovery

## Notes

- The FunC code provided is a reference implementation. Production deployment requires:
  - Proper state serialization (begin_cell/end_cell)
  - Gas calculation and forwarding
  - Wallet contract code compilation and embedding
  - Multi-sig wallet integration for the admin address
- The `~dump()` calls produce program logs that the WARP relay parses
- TON addresses use base64url format (EQ.../UQ...) — the adapter handles conversion
