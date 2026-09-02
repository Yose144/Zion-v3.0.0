# ZIONDex Operator Runbook

> **Version:** 2026-09-02
> **Scope:** ZIONDex AMM (Uniswap V2 fork) on Base Mainnet, ZISGate, liquidity management, swap monitoring, and incident response.

---

## 1. Contract Addresses (Base Mainnet, Chain 8453)

| Contract | Address | Role |
|----------|---------|------|
| ZIONDexFactory | `0x9F57998CC5Cb2a53426068c707Beac110966F351` | Creates pairs, stores protocol fee config |
| ZIONDexRouter | `0x7A2Ef5dDCD6278E2500F34a0cd1F241a6Da76662` | User-facing swap/liquidity router |
| ZIONDexZISGate | `0x55160347B33Bb56F0ea99499072Ba5bf8D2862A5` | Optional ZIS access control |
| Pair: tZION/tUSDT | `0x1fE64df93226b8434877D5826aE2DCEda171e39E` | Test token pair (100k tZION + 1k tUSDT) |
| Pair: wZION/USDC | `0x86ac36B7A38DB42a96E2205AFc79415e58904D63` | Real token pair (1000 wZION + 0.5487 USDC) |

### Test Tokens

| Token | Address | Decimals |
|-------|---------|----------|
| tZION | `0xC5E79b8C6475137aC3a982651097a219B63b0c33` | 18 |
| tUSDT | `0x677693fbFDe6a9EeA655033fffF93054B559552C` | 6 |
| tWETH | `0xcE5Df8e83B87f462835b51Ac6B2A4c53fafA620F` | 18 |

### Real Tokens

| Token | Address | Decimals |
|-------|---------|----------|
| wZION | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | 18 |
| USDC (Coinbase) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 |

---

## 2. ZISGate Configuration

### Current State (2026-09-02)

| Parameter | Value |
|-----------|-------|
| Admin | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` (validator-1) |
| ZIS Relay | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` |
| ZIS Public Key | `0xf272298cc6ee0d48b42cfce87151a3a6e4ca1a9c7e23ed52c9ef4e6b2920f757` |
| Gate Enabled | `false` (open access) |

### Operations

#### Enable gated access (whitelist-only swaps)

```bash
# Enable the gate
node -e "
const { Contract, Wallet, JsonRpcProvider } = require('ethers');
const provider = new JsonRpcProvider('https://base-rpc.publicnode.com');
const signer = new Wallet('0x<DEPLOYER_KEY>', provider);
const gate = new Contract('0x55160347B33Bb56F0ea99499072Ba5bf8D2862A5', [
  'function setGateEnabled(bool) external',
  'function whitelist(address,bool) external',
], signer);
(async () => {
  await gate.setGateEnabled(true);
  await gate.whitelist('0x<USER_ADDRESS>', true);
  console.log('Gate enabled + user whitelisted');
})();
"
```

#### Verify a ZIS user on-chain (relay call)

```bash
node -e "
const { Contract, Wallet, JsonRpcProvider, keccak256, toUtf8Bytes } = require('ethers');
const provider = new JsonRpcProvider('https://base-rpc.publicnode.com');
const signer = new Wallet('0x<RELAY_KEY>', provider);
const gate = new Contract('0x55160347B33Bb56F0ea99499072Ba5bf8D2862A5', [
  'function verifyZISProof((address,bytes32,uint256,bytes)) external returns (bool)',
], signer);
(async () => {
  const proof = {
    user: '0x<USER_ADDRESS>',
    userId: keccak256(toUtf8Bytes('user@example.com')),
    deadline: 0, // 0 = no expiry
    signature: '0x', // Ed25519 sig (not verified on-chain yet)
  };
  const ok = await gate.verifyZISProof(proof);
  console.log('Verified:', ok);
})();
"
```

#### Disable gate (open access)

```bash
node -e "
const { Contract, Wallet, JsonRpcProvider } = require('ethers');
const provider = new JsonRpcProvider('https://base-rpc.publicnode.com');
const signer = new Wallet('0x<DEPLOYER_KEY>', provider);
const gate = new Contract('0x55160347B33Bb56F0ea99499072Ba5bf8D2862A5', [
  'function setGateEnabled(bool) external',
], signer);
(async () => { await gate.setGateEnabled(false); console.log('Gate disabled'); })();
"
```

---

## 3. Liquidity Management

### Add liquidity to existing pair

Use the `add-wzion-liquidity.js` script as a template. Key steps:

1. Transfer token A and token B directly to the pair contract
2. Call `pair.addLiquidity(amount0, amount1)` where `amount0`/`amount1` are sorted by token address (token0 < token1)

```bash
cd V31/contracts/ZIONDex
DEPLOYER_KEY=0x<KEY> RPC_URL=https://base-rpc.publicnode.com node add-wzion-liquidity.js
```

### Remove liquidity

```bash
node -e "
const { Contract, Wallet, JsonRpcProvider } = require('ethers');
const provider = new JsonRpcProvider('https://base-rpc.publicnode.com');
const signer = new Wallet('0x<KEY>', provider);
const pair = new Contract('<PAIR_ADDR>', [
  'function removeLiquidity(uint256) external returns (uint256,uint256)',
  'function balanceOf(address) view returns (uint256)',
], signer);
(async () => {
  const lp = await pair.balanceOf(signer.address);
  const [a, b] = await pair.removeLiquidity(lp);
  console.log('Removed:', a.toString(), b.toString());
})();
"
```

### Check pair reserves

```bash
node -e "
const { Contract, JsonRpcProvider, formatUnits } = require('ethers');
const provider = new JsonRpcProvider('https://mainnet.base.org');
const pair = new Contract('<PAIR_ADDR>', [
  'function getReserves() view returns (uint112,uint112,uint32)',
  'function token0() view returns (address)',
], provider);
(async () => {
  const [r0, r1] = await pair.getReserves();
  const t0 = await pair.token0();
  console.log('token0:', t0);
  console.log('reserve0:', formatUnits(r0, 18));
  console.log('reserve1:', formatUnits(r1, 6));
})();
"
```

---

## 4. Swap Monitoring

### E2E swap test

```bash
cd V31/contracts/ZIONDex
DEPLOYER_KEY=0x<KEY> node swap-test.js  # if exists, or use inline script
```

### Check swap history via DEX API

```bash
curl -s https://app.zionterranova.com/api/swap/swaps?limit=20 | jq .
```

### Check pair via DEX API

```bash
curl -s -X POST https://app.zionterranova.com/api/swap/amm/pair \
  -H 'Content-Type: application/json' \
  -d '{"chain":"base","factory_address":"0x9F57998CC5Cb2a53426068c707Beac110966F351","token_a":{"id":{"chain":"base","contract":"0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6","ticker":"wZION"},"decimals":18,"name":"wZION"},"token_b":{"id":{"chain":"base","contract":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","ticker":"USDC"},"decimals":6,"name":"USDC"}}' | jq .
```

---

## 5. Wallet Seed Rotation

### Current deployer wallet

- **Address:** `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186`
- **Key source:** `/etc/zion/keys/validator.key` on Edge (validator-1)
- **ETH balance:** ~0.000016 ETH (sufficient for ~3 more deploys)
- **wZION balance:** ~99.68M wZION

### Rotation procedure

1. Generate new key: `node -e "const {Wallet} = require('ethers'); const w = Wallet.createRandom(); console.log(w.address, w.privateKey)"`
2. Transfer ETH to new address for gas
3. Transfer wZION/USDC to new address
4. Call `gate.setAdmin(newAddress)` on ZISGate
5. Call `factory.setFeeToSetter(newAddress)` on ZIONDexFactory
6. Update `/etc/zion/keys/validator.key` on Edge
7. Update `defi-contracts.ts` deployer reference in comments

### Reconciliation alert response

When `Reconciler` detects `diff > alert_threshold`:

1. Check `GET /v1/admin/reconciliation?limit=5` on multichain API
2. Compare on-chain reserves vs internal ledger
3. If diff is real (not timing skew), pause swaps: `gate.setGateEnabled(true)` + whitelist only admin
4. Investigate root cause (failed swap, double-spend, oracle manipulation)
5. Fix + resume: `gate.setGateEnabled(false)`

---

## 6. ZIS Auth Enablement

### Dashboard (already enabled)

- `ZION_OS/dashboard/app.py` `_check_auth()` prioritizes ZIS SSO cookie, falls back to Basic Auth
- `/api/me` endpoint returns `{"authenticated":true,"source":"zis"|"basic","role":"operator"}`
- ZIS service: `https://auth.zionterranova.com` (port 8096 on Edge)

### Marketplace (already enabled)

- `AuthContext` + `ConnectButton` integrated with `zis-client.ts`
- ZIS SSO cookie shared across `.zionterranova.com` domain

### ZISGate on-chain (configured, gate disabled)

- ZIS Relay = deployer address (can call `verifyZISProof`)
- ZIS Public Key = keccak256(JWT_SECRET) — for audit/future Ed25519 verification
- Gate is OPEN (gateEnabled=false) — all users can swap without ZIS verification
- To require ZIS: `gate.setGateEnabled(true)` + verify users via relay

---

## 7. Deposit / Swap / Withdraw Flow

### User flow (custodial model)

1. **Deposit:** User sends tokens to their L2-derived deposit address (BIP39 from ZIS user ID)
2. **Swap:** User requests swap via `/api/swap/execute-v2` — L2 executes on-chain via router
3. **Withdraw:** User requests withdrawal via `/api/swap/withdraw` — L2 sends tokens to recipient

### Operator monitoring

```bash
# Check deposit addresses
curl -s https://app.zionterranova.com/api/swap/deposits | jq .

# Check pending withdrawals
curl -s https://app.zionterranova.com/api/swap/withdrawals?status=pending | jq .

# Check reconciliation reports
curl -s http://127.0.0.1:8453/v1/admin/reconciliation?limit=5 | jq .
```

---

## 8. Incident Response

### Swap failure

1. Check DEX API health: `curl -s http://127.0.0.1:8454/v1/swap/health`
2. Check pair reserves (on-chain)
3. Check if gate is enabled: `gate.gateEnabled()`
4. If gate accidentally enabled: `gate.setGateEnabled(false)`
5. Check multichain service: `systemctl status zion-v31-multichain`

### Liquidity drain

1. Check pair reserves — if one side is near zero, swaps will fail
2. Add more liquidity (see §3)
3. If malicious drain suspected: enable gate `gate.setGateEnabled(true)` + whitelist only admin

### ZIS auth failure

1. Check ZIS service: `curl -s http://127.0.0.1:8096/health`
2. Check JWT_SECRET in `/opt/zion/identity/.env`
3. Restart ZIS: `systemctl restart zion-zis`
4. If ZIS down, dashboard falls back to Basic Auth automatically

---

## 9. Deployer ETH Top-up

The deployer wallet (`0xdde17506...`) needs ETH for gas on Base. Current balance: ~0.000016 ETH.

### Top-up procedure

1. Send ETH to `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` on Base
2. 0.001 ETH is sufficient for ~50 deploys at current gas prices
3. Monitor via: `curl -s https://mainnet.base.org -X POST -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186","latest"],"id":1}'`

---

## 10. Files Reference

| File | Purpose |
|------|---------|
| `V31/contracts/ZIONDex/ZIONDexZISGate.sol` | ZISGate contract source |
| `V31/contracts/ZIONDex/configure-zisgate.js` | ZISGate configuration script |
| `V31/contracts/ZIONDex/add-wzion-liquidity.js` | wZION/USDC liquidity script |
| `V31/contracts/ZIONDex/add-liquidity.js` | Router-based liquidity script |
| `V31/contracts/ZIONDex/add-liquidity-direct.js` | Direct pair liquidity script |
| `APP&WEB/website-v2.9/src/lib/defi-contracts.ts` | Contract address registry (frontend) |
| `APP&WEB/website-v2.9/src/lib/dex-api.ts` | DEX API helpers (frontend) |
| `APP&WEB/website-v2.9/src/app/dex/portfolio/page.tsx` | Portfolio UI with LP positions |
| `V31/L2/multichain/src/contracts.rs` | L2 token registry (Rust) |
| `V31/L2/multichain/src/swap/dex.rs` | DEX router logic (Rust) |
| `V31/L2/multichain/src/swap/dex/swap_executor.rs` | Swap executor (Rust) |
| `V31/L2/multichain/src/swap/dex/intent_engine.rs` | Intent-based swap engine (Rust) |
| `V31/L2/multichain/src/reconciliation.rs` | Reconciliation engine (Rust) |
