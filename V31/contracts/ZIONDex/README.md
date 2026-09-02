# ZIONDex — On-chain AMM DEX (Uniswap V2 fork)

ZIONDex is a Uniswap V2–style AMM DEX written in Solidity 0.8.20 with two
additions over the original Uniswap V2 design:

1. **Protocol fee** — a configurable share of the swap fee is minted as LP
   tokens to a ZION treasury address (`feeTo`) on every swap.
2. **Optional ZIS gate** — an access-control contract (`ZIONDexZISGate`) that
   can whitelist verified ZIS users before they are allowed to swap.

The contracts are self-contained (no external libraries) and compile with
`solcjs` or any Solidity 0.8.20+ toolchain (Foundry, Hardhat, Remix).

## Contracts

| File | Purpose |
|------|---------|
| `ZIONDexFactory.sol` | Creates and registers AMM pairs; holds protocol fee config. |
| `ZIONDexPair.sol` | AMM pair with ERC-20 LP tokens, K-invariant swap, protocol fee mint. |
| `ZIONDexRouter.sol` | User-facing router: multi-hop swap, add/remove liquidity, quotes. |
| `ZIONDexZISGate.sol` | Optional ZIS-backed access control (whitelist / open mode). |

## Contract Addresses (Base Mainnet — deployed 2026-08-31 / 2026-09-02)

| Contract | Address | Chain | Status |
|----------|---------|-------|--------|
| `ZIONDexFactory`  | `0x9F57998CC5Cb2a53426068c707Beac110966F351` | Base | ✅ Verified |
| `ZIONDexRouter`   | `0x7A2Ef5dDCD6278E2500F34a0cd1F241a6Da76662` | Base | ✅ Verified |
| `ZIONDexZISGate`  | `0x55160347B33Bb56F0ea99499072Ba5bf8D2862A5` | Base | ✅ Configured (relay + pubkey set) |
| Pair: tZION/tUSDT | `0x1fE64df93226b8434877D5826aE2DCEda171e39E` | Base | ✅ 100k tZION + 1k tUSDT |
| Pair: wZION/USDC  | `0x86ac36B7A38DB42a96E2205AFc79415e58904D63` | Base | ✅ 1000 wZION + 0.5487 USDC |

### ZISGate Configuration (2026-09-02)

| Parameter | Value |
|-----------|-------|
| Admin | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` (validator-1) |
| ZIS Relay | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` |
| ZIS Public Key | `0xf272298cc6ee0d48b42cfce87151a3a6e4ca1a9c7e23ed52c9ef4e6b2920f757` |
| Gate Enabled | `false` (open access — all users can swap) |

> To enable gated access: `gate.setGateEnabled(true)` + `gate.whitelist(user, true)`.
> To verify a ZIS user on-chain: `gate.verifyZISProof(proof)` (called by admin or relay).

## How to deploy (solcjs)

```bash
cd /Users/yeshuae/Projects/2.9.6/V31/contracts/ZIONDex

# 1. Compile all contracts (ABI + bytecode + optimizer)
solcjs --abi --bin --optimize -o build *.sol

# 2. The output lands in build/:
#    build/ZIONDexFactory_sol_ZIONDexFactory.abi
#    build/ZIONDexFactory_sol_ZIONDexFactory.bin
#    build/ZIONDexPair_sol_ZIONDexPair.abi
#    build/ZIONDexPair_sol_ZIONDexPair.bin
#    build/ZIONDexRouter_sol_ZIONDexRouter.abi
#    build/ZIONDexRouter_sol_ZIONDexRouter.bin
#    build/ZIONDexZISGate_sol_ZIONDexZISGate.abi
#    build/ZIONDexZISGate_sol_ZIONDexZISGate.bin
```

Deployment order (using `cast` from Foundry, or any deployer):

```bash
# 1. Deploy the factory (no constructor args).
FACTORY=$(cast send --private-key $KEY --create $(cat build/ZIONDexFactory_sol_ZIONDexFactory.bin) | jq -r .contractAddress)

# 2. Deploy the router, pointing at the factory.
ROUTER=$(cast send --private-key $KEY --create $(cat build/ZIONDexRouter_sol_ZIONDexRouter.bin) \
        --constructor-args $FACTORY | jq -r .contractAddress)

# 3. (Optional) Deploy the ZIS gate.
GATE=$(cast send --private-key $KEY --create $(cat build/ZIONDexZISGate_sol_ZIONDexZISGate.bin) | jq -r .contractAddress)

# Or use the Node.js deploy script (includes gas estimate + post-deploy config):
#   node deploy-zisgate.js                    # gas estimate only
#   DEPLOYER_KEY=0x... node deploy-zisgate.js # deploy + configure
#   DEPLOYER_KEY=0x... ZIS_RELAY=0x... node deploy-zisgate.js  # deploy + set relay

# 4. (Optional) Configure the protocol fee recipient.
cast send --private-key $KEY $FACTORY "setFeeTo(address)" $TREASURY
cast send --private-key $KEY $FACTORY "setProtocolFeeBps(uint256)" 5
```

> If `solcjs` is not installed locally, install it with
> `npm install -g solc@0.8.20`, or compile on the Edge server where the
> toolchain is available.

## How to interact

### 1. Create a pair

```bash
# Anyone may create a pair via the factory.
cast send --private-key $KEY $FACTORY "createPair(address,address)" $WZION $USDC
```

### 2. Add liquidity (via the router)

```solidity
router.addLiquidity(
    tokenA: wZION,
    tokenB: USDC,
    amountADesired: 1000e18,
    amountBDesired: 5000e6,
    amountAMin: 990e18,
    amountBMin: 4950e6,
    to: msg.sender,
    deadline: block.timestamp + 600
);
```

The caller must first approve the router for `amountADesired` / `amountBDesired`
of each token.

### 3. Swap exact tokens for tokens (single hop)

```solidity
address[] path = [wZION, USDC];
uint[] amounts = router.swapExactTokensForTokens(
    amountIn: 100e18,
    amountOutMin: 490e6,
    path: path,
    to: msg.sender,
    deadline: block.timestamp + 600
);
```

### 4. Multi-hop swap (2 hops)

```solidity
address[] path = [wZION, USDC, USDT];
uint[] amounts = router.swapExactTokensForTokens(
    amountIn: 100e18,
    amountOutMin: 480e6,
    path: path,
    to: msg.sender,
    deadline: block.timestamp + 600
);
```

### 5. Quote (off-chain / view)

```solidity
address[] path = [wZION, USDC];
uint[] amounts = router.getAmountsOut(100e18, path);
// amounts[amounts.length-1] is the expected output.
```

### 6. Remove liquidity

```solidity
router.removeLiquidity(
    tokenA: wZION,
    tokenB: USDC,
    liquidity: 500e18,
    amountAMin: 0,
    amountBMin: 0,
    to: msg.sender,
    deadline: block.timestamp + 600
);
```

The caller must first approve the router for `liquidity` LP tokens of the pair.

### 7. ZIS gate (optional)

```solidity
// Admin enables the gate (only verified users may swap).
gate.setGateEnabled(true);

// Admin whitelists a user directly.
gate.whitelist(user, true);

// Or a trusted ZIS relay verifies a proof.
gate.verifyZISProof(ZISProof({
    user: user,
    userId: bytes32(...),
    deadline: block.timestamp + 3600,
    signature: ed25519Sig
}));

// The router (or any consumer) checks:
bool ok = gate.canSwap(user);
```

## ABI summary

### ZIONDexFactory

| Function | Signature |
|----------|-----------|
| `createPair` | `(address tokenA, address tokenB) → address pair` |
| `getPair` | `(bytes32 key) → address` (key = keccak256(token0,token1)) |
| `pairFor` | `(address tokenA, address tokenB) → address` |
| `getPairCount` | `() → uint256` |
| `setFeeTo` | `(address) → void` (governance) |
| `setFeeToSetter` | `(address) → void` (governance) |
| `setProtocolFeeBps` | `(uint256) → void` (governance, max 250) |
| `feeTo` | `address` |
| `feeToSetter` | `address` |
| `protocolFeeBps` | `uint256` |

### ZIONDexPair (also an ERC-20 LP token)

| Function | Signature |
|----------|-----------|
| `initialize` | `(address token0, address token1, address factory) → void` |
| `addLiquidity` | `(uint256 amount0, uint256 amount1) → uint256 liquidity` |
| `removeLiquidity` | `(uint256 lpAmount) → (uint256 amount0, uint256 amount1)` |
| `swap` | `(uint256 amount0Out, uint256 amount1Out, address to) → void` |
| `getReserves` | `() → (uint112, uint112, uint32)` |
| `getAmountOut` | `(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) → uint256` (pure) |
| `sync` | `() → void` |
| `transfer` / `transferFrom` / `approve` / `balanceOf` / `totalSupply` | standard ERC-20 |
| `name` / `symbol` / `decimals` | `"ZIONDex LP Token"`, `"ZDX-LP"`, `18` |

### ZIONDexRouter

| Function | Signature |
|----------|-----------|
| `swapExactTokensForTokens` | `(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) → uint[] amounts` |
| `getAmountsOut` | `(uint amountIn, address[] path) → uint[] amounts` (view) |
| `addLiquidity` | `(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) → (uint amountA, uint amountB, uint liquidity)` |
| `removeLiquidity` | `(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) → (uint amountA, uint amountB)` |
| `factory` | `address` |

### ZIONDexZISGate

| Function | Signature |
|----------|-----------|
| `canSwap` | `(address user) → bool` (view) |
| `verifyZISProof` | `(ZISProof proof) → bool` |
| `whitelist` | `(address user, bool status) → void` (admin) |
| `whitelistBatch` | `(address[] users, bool status) → void` (admin) |
| `setGateEnabled` | `(bool enabled) → void` (admin) |
| `setZisPublicKey` | `(bytes32) → void` (admin) |
| `setZisRelay` | `(address) → void` (admin) |
| `setAdmin` | `(address) → void` (admin) |
| `gateEnabled` | `bool` |
| `zisPublicKey` | `bytes32` |
| `zisRelay` | `address` |
| `verifiedUsers` | `mapping(address → bool)` |

`ZISProof` struct:
```solidity
struct ZISProof {
    address user;
    bytes32 userId;
    uint256 deadline;
    bytes signature;  // Ed25519 signature (verified off-chain / by relay)
}
```

## Key implementation details

1. **K invariant** (swap):
   ```solidity
   uint256 balance0Adjusted = balance0 * 1000 - amount0In * 3;
   uint256 balance1Adjusted = balance1 * 1000 - amount1In * 3;
   require(balance0Adjusted * balance1Adjusted >= reserve0 * reserve1 * 1000000, "ZIONDex: K");
   ```
2. **getAmountOut** (0.3% fee):
   ```solidity
   uint256 amountInWithFee = amountIn * 997;
   uint256 numerator = amountInWithFee * reserveOut;
   uint256 denominator = reserveIn * 1000 + amountInWithFee;
   return numerator / denominator;
   ```
3. **LP minting** — first provider: `sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY`
   (1000 locked to `0xdead`). Subsequent: `min(totalSupply*amount0/reserve0, totalSupply*amount1/reserve1)`.
4. **Protocol fee** — on each swap, `protocolFeeBps / 10000` of the current LP
   total supply is minted to `feeTo` (capped at 1% of supply per swap). Set
   `feeTo = address(0)` or `protocolFeeBps = 0` to disable.
5. **Solidity 0.8.20** — checked arithmetic is used throughout (no SafeMath
   needed). No external libraries.
6. **Safe transfers** — all token transfers use low-level `call` with return
   data validation (OpenZeppelin `SafeERC20` style).

## Security notes

- The pair uses `CREATE2` via the factory for deterministic addresses.
- `MINIMUM_LIQUIDITY = 1000` LP tokens are locked to `0xdead` on first
  liquidity to prevent the first LP from minting a tiny supply and
  inflating the share price.
- The router uses `deadline` checks to prevent front-running / stale txs.
- The ZIS gate is **off by default** (`gateEnabled = false`). Enable it only
  when the ZIS relay / whitelist flow is operational.
- On-chain Ed25519 verification is **not yet implemented**; the gate relies on
  admin whitelist or a trusted relay. Replace `verifyZISProof` with a real
  precompile call when available.
- These contracts have not been audited. Review before mainnet use.
