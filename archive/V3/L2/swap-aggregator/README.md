# ZION Swap Aggregator

> Orchestrates bridge lock + Uni V3 swap for one-click ZION ↔ ETH/USDC swaps.

## Architecture

```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────┐
│   Client    │────▶│  Swap Aggregator    │────▶│   Bridge    │
│  (Web/App)  │     │   (Axum REST API)   │     │   Relay     │
└─────────────┘     └─────────────────────┘     └─────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   Uni V3 Quoter/    │
                    │   Router (Base)     │
                    └─────────────────────┘
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/swap` | Initiate a new swap (lock + mint + swap) |
| GET | `/swap/:id` | Get swap status and TX hashes |
| GET | `/swaps` | List recent swaps |
| POST | `/quote` | Get a price quote without executing |
| GET | `/health` | Service health check |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SWAP_AGGREGATOR_BIND` | `0.0.0.0:8456` | HTTP server bind address |
| `SWAP_AGGREGATOR_DB` | `swap-aggregator.db` | SQLite database path |
| `BRIDGE_API_URL` | `http://localhost:8443` | Bridge relay API |
| `BASE_RPC_URL` | `https://mainnet.base.org` | Base Mainnet RPC |
| `WZION_ADDRESS` | `0x0c493...bb6` | wZION ERC-20 contract |
| `UNIV3_POOL_ADDRESS` | `0xa88C...4FBB` | wZION/WETH Uni V3 pool |
| `UNIV3_ROUTER_ADDRESS` | `0x2626...7481` | Uni V3 swap router |
| `QUOTER_V2_ADDRESS` | `0x3d4e...76a` | Uni V3 QuoterV2 |
| `MAX_SLIPPAGE_BPS` | `500` | Max slippage (5%) |

## Swap Flow — ZION → ETH

1. **Pending** → Client submits swap request
2. **Locking** → Submit L1 lock TX to bridge vault
3. **Bridging** → Wait for bridge relay (60-block finality)
4. **Swapping** → Execute Uni V3 exactInputSingle (wZION → WETH)
5. **Completed** → ETH delivered to user's EVM wallet

## Swap Flow — ETH → ZION

1. **Pending** → Client submits swap request
2. **Swapping** → Execute Uni V3 exactInputSingle (WETH → wZION)
3. **Bridging** → Burn wZION on bridge contract
4. **Completed** → ZION unlocked on L1 address

## Build & Run

```bash
cd V3/L2/swap-aggregator
cargo run --release
```

## Testing

```bash
cargo test
```

## Future Work

- [ ] Real bridge API integration (currently placeholder)
- [ ] Real Uni V3 QuoterV2 integration for price quotes
- [ ] EVM transaction signing and submission
- [ ] Background worker with retry logic
- [ ] WebSocket status streaming
- [ ] Fee estimation and slippage protection
