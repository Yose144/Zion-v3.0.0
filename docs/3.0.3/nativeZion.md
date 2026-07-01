# WARP Bridge — Native ZION Token Naming Convention

## Souhrn

WARP přenáší **native L1 ZION**. "w" prefix je Ethereum konvence (WETH, WBTC) — na non-EVM chainech nedává smysl, tam je to prostě **ZION**.

## Token naming convention

| Chain type | Token name | Proč |
|-----------|-----------|------|
| **EVM** (Base, BSC, Polygon, Arbitrum, Optimism, Avalanche) | **wZION** | ERC-20 wrapped token — "w" prefix je Ethereum konvence (jako WBTC, WETH) |
| **Solana** | **ZION** | SPL token — nativní reprezentace |
| **Tron** | **ZION** | TRC-20 — nativní reprezentace |
| **Stellar** | **ZION** | Issued asset — nativní reprezentace |
| **Cosmos** | **ZION** | CosmWASM contract — nativní reprezentace |
| **Cardano** | **ZION** | Native token (policy_id + asset_name) |
| **Aptos** | **ZION** | Move module — nativní reprezentace |
| **Sui** | **ZION** | Move module — nativní reprezentace |
| **NEAR** | **ZION** | NEAR contract — nativní reprezentace |
| **TON** | **ZION** | Jetton — nativní reprezentace |
| **Lightning** | (BTC) | HTLC — direct BTC channel, no token |

## WARP Bridge Architecture

WARP přenáší **native L1 ZION**, ne wZION. wZION je jen wrapped reprezentace na EVM chainech (jako WBTC na Ethereum).

### Outbound (ZION L1 → external chain)
1. Uživatel pošle ZION L1 TX → output na `BRIDGE_VAULT_ADDRESS` + memo `BRIDGE:<dest_chain>:<recipient>`
2. L1 node zaznamená "bridge lock" — **ZION se zamkne** v bridge vault (`getBridgeLocks` RPC)
3. WARP watcher detekuje lock → router vytvoří outbound transfer
4. WARP validator set podepíše mint instruction (quorum 3/5)
5. WARP adapter na dest chain → `execute_mint()` → **mintne ZION** (nebo **wZION** na EVM) recipientovi (1:1 peg)

### Inbound (external chain → ZION L1)
1. Uživatel **spálí** ZION/wZION na external chain (`bridgeBurn` na EVM, ekvivalent na non-EVM)
2. WARP watcher detekuje burn event → router vytvoří inbound transfer
3. WARP validator set podepíše unlock instruction (quorum 3/5)
4. WARP zavolá `submitBridgeUnlock` na L1 node → **odemkne ZION** z bridge vault → recipient

### L1 RPC endpointy (již implementováno v `V3/L1/core/src/rpc.rs`)
- `getBridgeLocks(from_height, to_height)` — scan bloků pro TX s output na BRIDGE_VAULT_ADDRESS
- `getBridgeVaultBalance()` — celkový ZION zamčený v bridge vault
- `submitBridgeUnlock(recipient, amount_flowers, burn_id, evm_chain, evm_tx_hash, validator_proofs)` — uvolní ZION z vault (vyžaduje 3/5 validator signatures)

### Bridge vault
`BRIDGE_VAULT_ADDRESS` = `crypto::derive_keyless_address("ZION Bridge Vault V3 Mainnet")` — keyless address, ~100M ZION locked.

## ZION kontrakty (deploy nutný per chain)

- **EVM:** wZION ERC-20 s `bridgeMint(address, uint256, bytes32)` + `bridgeBurn(uint256, string)` events
- **Solana:** ZION SPL token s mint authority = WARP relay
- **Tron:** ZION TRC-20 s mint/burn
- **Stellar:** ZION issued asset (trustline)
- **Cosmos:** ZION CosmWASM contract s mint/burn
- **Cardano:** ZION native token (policy_id + asset_name)
- **Aptos/Sui:** ZION Move module s mint/burn
- **NEAR:** ZION contract s mint/burn
- **TON:** ZION jetton s mint/burn
- **Lightning:** BTC Lightning (HTLC, no ZION — direct BTC channel)

## Změny v kódu (commit 7d52cfd0)

- **15 souborů** aktualizováno (non-EVM adapters + signers + comments)
- `wzion_mint` → `zion_mint` (Solana)
- `wzion_contract` → `zion_contract` (Tron, Stellar, Cosmos)
- `wzion_asset` → `zion_asset` (Cardano)
- `WARP_STELLAR_WZION_ISSUER` → `WARP_STELLAR_ZION_ISSUER`
- Default asset code `"wZION"` → `"ZION"` (Stellar)
- Všechny log messages a comments aktualizovány
- **EVM adapter (`evm.rs`) nedotčen** — zachovává wZION

## Test results

- **499 WARP tests pass**, 0 warnings, 0 failures
