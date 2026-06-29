# L2 Bridge Completion — Status & Plan

**Last updated:** 2026-06-29

---

## ✅ Completed Work

### 1. ZIONBridge Contract v3 Deployed
- **Contract address:** `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` (Base mainnet, chain 8453)
- **Changes from original:**
  - `DAILY_LIMIT` changed from constant `10M wZION` → mutable variable `1B wZION` default + `setDailyLimit()` setter
  - `TIMELOCK_THRESHOLD` raised from `1M ZION` → `1B ZION` (disables timelock for premine 16.67M ZION locks)
  - OpenZeppelin imports fixed for v4.x (`security/` not `utils/`)
- **Roles configured:**
  - `BRIDGE_ROLE` on wZION granted to new bridge, revoked from previous (`0x5a1Df5961C166a79E0817329e2807Aac63Db57F5`)
  - `VALIDATOR_ROLE` + `GUARDIAN_ROLE` on bridge for all 5 validators
  - Validators: `0xdde17506...`, `0x24d98684...`, `0x665c55ed...`, `0x8e644b3e...`, `0x7e0D2eD7...`
  - Threshold: 5/5

### 2. DB Schema Fix — `amount_flowers` INTEGER → TEXT
- **Problem:** Pre-fork premine locks have `amount_flowers` up to `1.67e19` (16.67M ZION × 1e12 flowers/ZION legacy scale), overflowing SQLite `INTEGER` (i64 max `9.2e18`)
- **Fix:** Changed `amount_flowers` column from `INTEGER` to `TEXT` in both `l1_locks` and `evm_burns` tables
- **Migration:** Automatic table-rebuild migration on bridge startup (verified working on Edge)
- **Rust code:** `u64 ↔ String` conversion on insert/read
- Files: `V3/L2/bridge/src/db.rs`, `V3/L2/bridge/src/config.rs`, `V3/L2/bridge/tests/mainnet_readiness.rs`

### 3. Bridge Config Updated
- `V3/L2/bridge/config/bridge-mainnet.toml` → new bridge address
- `V3/config/bridge-mainnet.toml` → new bridge address

### 4. Premine Locks — MINTED ✅
- **All 7 L1 locks successfully minted on wZION:**
  - 1× 100 ZION lock (`8eb0bb8c...`)
  - 6× 16,666,666 ZION premine locks (`6bc2aa3e`, `d9ddb3c7`, `09fc9abb`, `2cd12d90`, `4b43e7a3`, `035c761d`)
- **wZION totalSupply:** `100,000,299 wZION`
- **Recipient balance:** `98,000,045 wZION` at `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` (2M wZION used for Uniswap liquidity)
- **ETH balance:** `0.0717 ETH` (for gas)
- `processedL1Locks[l1TxHash] = true` for all 7 locks on wZION contract
- DB: all locks marked `Completed`, `timelocked_ops` cleared

### 5. Bridge Relayer Running on Edge
- Edge node: `root@100.76.16.108`
- Service: `zion-edge-bridge` (systemd)
- Binary: `/usr/local/bin/zion-bridge` (v3.0.2, release build)
- DB: `/root/zion-2.9.6-main/data/bridge-mainnet.db`
- Config: `/root/zion-2.9.6-main/V3/L2/bridge/config/bridge-mainnet.toml`

### 6. Test Fixes
- `db::tests::test_insert_and_query_burn` — assertion mismatch fixed
- `config::tests::test_config_load_from_toml` — TOML uses `127.0.0.1`, assertion expected old IP
- `mainnet_readiness::test_parse_bridge_mainnet_toml` — bridge address updated to v3
- All `cargo test -p zion-bridge` tests pass

### 7. Uniswap V3 Pools Created & Seed Liquidity Added ✅

#### Pools Created
| Pair | Fee | Pool Address | sqrtPriceX96 | Tick | Status |
|------|-----|--------------|--------------|------|--------|
| wZION/USDC | 0.3% (3000) | `0x5eBdC6E1D516f42EEB54f14faCF8715AbD5B9d8d` | `1120455419495722778624` | -361501 | ✅ Created & initialized |
| wZION/WETH | 1.0% (10000) | `0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699` | `25054144837504793613172736` | -161190 | ✅ Created & initialized |

Both pools initialized at **$0.0002 USD/ZION**.

#### Seed Liquidity Positions
| Pool | NFT Position ID | Tick Range | wZION | USDC/WETH | Type | TX |
|------|----------------|------------|-------|-----------|------|-----|
| wZION/USDC | 5431091 | -361440 to -360000 | 1,000,000 | 0 | Single-sided (above price) | `0x8f1e5ef7...` |
| wZION/WETH | 5431093 | -161000 to -160000 | 1,000,000 | 0 | Single-sided (above price) | `0xaa7d2824...` |
| wZION/WETH | 5431714 | -162000 to -160000 | 100,000 | 0.0069 WETH | **Two-sided (ACTIVE)** | `0xc7f84d0e...` |

**wZION/WETH pool has ACTIVE liquidity** at current price: `547,909,963,844,053,940,788`
**wZION/USDC pool** still only has single-sided liquidity (needs USDC funding).

#### WETH Acquisition
- Wrapped 0.02 ETH → WETH via WETH contract `deposit()`
- Used 0.0069 WETH for two-sided liquidity
- Remaining: ~0.013 WETH
- Could not swap WETH → USDC via Uniswap SwapRouter (reverts — possibly wrong router for Base) or Aerodrome (wrong factory address)

#### Issues Resolved
1. **Pool creation revert:** Root cause was **out of gas** — gas estimate ~4.75M, but gas limit was set to 1M. Fixed by setting gas limit to 5.5M.
2. **Mint revert:** Root cause was **wrong ABI encoding** — NPM `mint()` takes a single struct parameter, not individual parameters. Fixed by using tuple-based ABI.
3. **Wrong Uniswap addresses:** `0x1F98431c8aD98523631AE4a59f267346ea31F984` is Ethereum mainnet, NOT Base. Correct Base addresses discovered from Base docs.
4. **Bridge reprocessing minted locks:** Fixed by setting `start_block_height = 11700` (above last lock at 11614) in bridge config.
5. **Validator-5 out of ETH:** Funded with 0.01 ETH from deployer.

---

## 🔧 Remaining Work — wZION/USDC Two-Sided Liquidity

### Current State
- wZION/WETH pool: **ACTIVE two-sided liquidity** ✅ (100K wZION + 0.0069 WETH)
- wZION/USDC pool: Single-sided only (1M wZION above price, inactive)
- Deployer has ~0.013 WETH remaining, 0 USDC
- Need USDC to add two-sided liquidity to wZION/USDC pool

### Step 1: Get USDC
- [ ] User sends USDC to `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186`
- [ ] Or: debug Uniswap SwapRouter / Aerodrome router to swap WETH → USDC
- [ ] Suggested: $2,000 USDC for seed liquidity (10M ZION at $0.0002/ZION)

### Step 2: Add Two-Sided Liquidity to wZION/USDC
- [ ] Approve wZION + USDC for NPM (`0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1`)
- [ ] Mint position spanning current tick (tickLower=-362000, tickUpper=-360000, spacing=60)
- [ ] Use struct-based ABI for `mint()` — see Technical Notes below

### Step 3: Verify & Monitor
- [ ] Check pool prices match 0.0002 USD/ZION
- [ ] Verify active liquidity on both pools
- [ ] Test small swap via Uniswap UI
- [ ] Monitor bridge relayer continues processing new locks

### Step 4: Optional — Old wZION/WETH Pool
- [ ] Existing pool `0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB` (fee=3000) has wrong price (~$0.017/ZION)
- [ ] Either: withdraw liquidity if we have a position, or ignore it
- [ ] New 1% pool (`0x18c0DaeF...`) will be the canonical one at correct price

---

## 📝 Technical Notes

### Uniswap V3 NPM mint() ABI
The NPM `mint()` function takes a **single struct parameter**, not individual parameters:
```python
# CORRECT — struct-based ABI
NPM_ABI = [{
    "inputs": [{"components": [
        {"name": "token0", "type": "address"},
        {"name": "token1", "type": "address"},
        {"name": "fee", "type": "uint24"},
        {"name": "tickLower", "type": "int24"},
        {"name": "tickUpper", "type": "int24"},
        {"name": "amount0Desired", "type": "uint256"},
        {"name": "amount1Desired", "type": "uint256"},
        {"name": "amount0Min", "type": "uint256"},
        {"name": "amount1Min", "type": "uint256"},
        {"name": "recipient", "type": "address"},
        {"name": "deadline", "type": "uint256"},
    ], "name": "params", "type": "tuple"}],
    "name": "mint", ...
}]

# Call with tuple:
params = (token0, token1, fee, tickLower, tickUpper, amt0, amt1, amt0Min, amt1Min, recipient, deadline)
npm.functions.mint(params).call({"from": deployer})
```

### Gas Requirements
- `createAndInitializePoolIfNecessary`: ~4.6M gas (set limit to 5.5M)
- `mint` (single-sided): ~490K gas (set limit to 600K)
- `mint` (full-range two-sided): ~500K gas estimated

### Single-Sided Liquidity
- When `tickLower > currentTick`, only token0 is deposited (no token1 needed)
- Position is "inactive" — liquidity only activates when price moves into range
- Pool `liquidity` variable stays 0 until price enters the position's range
- Tokens are held by the pool contract, not the NPM

---

## 🔑 Key Files & Locations

| Item | Path |
|------|------|
| Bridge contract source | `V3/L2/bridge/contracts/src/ZIONBridge.sol` |
| wZION contract source | `V3/L2/bridge/contracts/src/wZION.sol` |
| Bridge config (L2) | `V3/L2/bridge/config/bridge-mainnet.toml` |
| Bridge config (root) | `V3/config/bridge-mainnet.toml` |
| DB schema | `V3/L2/bridge/src/db.rs` |
| Relayer code | `V3/L2/bridge/src/relayer.rs` |
| L1 watcher | `V3/L2/bridge/src/l1_watcher.rs` |
| Uniswap setup script | `/root/uniswap_v3_setup.py` (Edge node) |
| Edge DB | `/root/zion-2.9.6-main/data/bridge-mainnet.db` (Edge node) |
| Validator keys | `/root/zion-validator-key.env` (Edge node) |

## 🌐 Network Info
- **L1 (ZION):** Edge node `100.76.16.108`, RPC `127.0.0.1:8443`
- **L2 (Base):** Chain ID 8453, RPC `https://mainnet.base.org`
- **Bridge address (L1):** `zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0`
- **Bridge contract (L2):** `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467`
- **wZION (L2):** `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6`
- **Deployer/recipient:** `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186`

## 📊 Token Supply
- **wZION totalSupply:** 100,000,299 wZION (100M ZION bridged)
- **wZION MAX_SUPPLY:** 144,000,000,000 wZION (144B — matches L1 total supply)
- **Available to bridge:** ~143.9B wZION remaining
- **Deployer wZION balance:** ~97,900,045 wZION (2.1M used for Uniswap liquidity)
- **Deployer ETH balance:** ~0.041 ETH
- **Deployer WETH balance:** ~0.013 WETH
- **Deployer USDC balance:** 0 USDC

## 📊 Uniswap V3 Addresses (Base mainnet)
| Contract | Address |
|----------|---------|
| V3 Factory | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` |
| NonfungiblePositionManager | `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1` |
| SwapRouter | `0x2626664c2603336E57B271c5C0b26F421741e481` |
| QuoterV2 | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` |
| Universal Router | `0x198EF79F1F515F02dFE9e3115eD9fC07183f02fC` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

> ⚠️ **NOT** `0x1F98431c8aD98523631AE4a59f267346ea31F984` — that's Ethereum mainnet, not Base!

## 📊 Token Addresses (Base mainnet)
| Token | Address | Decimals |
|-------|---------|----------|
| wZION | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | 18 |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 |
| WETH | `0x4200000000000000000000000000000000000006` | 18 |
