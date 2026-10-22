# Bridge and WARP

WARP is ZION's native bridge for transferring tokens between L1 and L2.

## Basic concepts

- **wZION** — wrapped ZION on EVM-compatible chains.
- **WARP** — cross-chain routing and liquidity.
- **ZION Bridge** — contract for lock/release between L1 ↔ L2.

## Contract

- wZION: `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6`

## How it works

1. You lock ZION on the L1 bridge contract.
2. An equivalent amount of wZION is minted to you on the target L2.
3. To convert wZION back, you burn it and the L1 bridge releases the original ZION.

## API

```bash
curl https://api.zionterranova.com/api/bridge/status
```

Returns the current state of the bridge, liquidity, and recent transactions.

## Security

- Always verify the contract address against the official source.
- Do not send tokens to unknown addresses.
- Use small amounts for testing.
