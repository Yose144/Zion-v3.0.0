# L2 Bridge Completion — Status & Plan

**Last updated:** 2026-06-28

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
- **Recipient balance:** `100,000,045 wZION` at `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186`
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

---

## 🔧 In Progress — Uniswap V3 Seed Liquidity

### Target Price
- **0.0002 USD per ZION**

### Token Addresses (Base mainnet)
| Token | Address | Decimals |
|-------|---------|----------|
| wZION | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | 18 |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 |
| WETH | `0x4200000000000000000000000000000000000006` | 18 |

### Uniswap V3 Addresses (Base mainnet)
| Contract | Address |
|----------|---------|
| V3 Factory | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` |
| NonfungiblePositionManager | `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1` |
| SwapRouter | `0x2626664c2603336E57B271c5C0b26F421741e481` |
| QuoterV2 | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` |
| Universal Router | `0x198EF79F1F515F02dFE9e3115eD9fC07183f02fC` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

> ⚠️ **NOT** `0x1F98431c8aD98523631AE4a59f267346ea31F984` — that's Ethereum mainnet, not Base!

### Existing Pools
| Pair | Fee | Pool Address | Status |
|------|-----|--------------|--------|
| wZION/WETH | 0.3% (3000) | `0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB` | Exists, price ~$0.017/ZION (wrong price) |
| wZION/USDC | 0.3% (3000) | — | Not created |
| wZION/WETH | 1% (10000) | — | Not created |

### Price Calculations
```
wZION/USDC (fee=3000):
  token0 = wZION (lower address), token1 = USDC
  1 ZION = 0.0002 USDC → raw: 1e18 wZION = 200 USDC (6 dec)
  price_raw = 200 / 1e18 = 2e-16
  sqrtPriceX96 = sqrt(2e-16) * 2^96 = 1120455419495722778624

wZION/WETH (fee=10000, ETH=$2000):
  token0 = wZION, token1 = WETH
  1 ZION = 0.0002 USD = 0.0002/2000 ETH = 1e-7 WETH
  price_raw = 1e-7 (both 18 dec)
  sqrtPriceX96 = sqrt(1e-7) * 2^96 = 25054144837504793613172736
```

### Current Blocker — Pool Creation Reverted
Both `createAndInitializePoolIfNecessary` TXs reverted:
- wZION/USDC: TX `0xf4c398d2...` — FAILED
- wZION/WETH: TX `0xc8844baa...` — FAILED

**Need to investigate revert reason.** Likely causes:
1. wZION has transfer restrictions / whitelist that blocks Uniswap NPM
2. sqrtPriceX96 out of valid tick range (MIN_TICK=-887272, MAX_TICK=887272)
3. wZION `whenNotPaused` or similar guard

### Setup Script
- `/root/uniswap_v3_setup.py` on Edge node (created, needs debugging)
- Supports: `--create-pools`, `--add-liquidity`, `--add-liquidity-weth`, `--check`

---

## 📋 Plan for Completion

### Step 1: Debug Pool Creation Revert
- [ ] Trace revert reason for TX `0xf4c398d2...` (wZION/USDC)
- [ ] Check if wZION has transfer restrictions (whitelist, max transfer, etc.)
- [ ] Verify sqrtPriceX96 is within valid tick range
- [ ] If wZION blocks transfers to Uniswap, may need to whitelist NPM address or remove restriction
- [ ] Check wZION contract for `canTransfer` / `isWhitelisted` / similar modifiers

### Step 2: Create Uniswap V3 Pools
- [ ] Create wZION/USDC pool (fee=3000, 0.3%) at 0.0002 USD/ZION
- [ ] Create wZION/WETH pool (fee=10000, 1%) at 0.0002 USD/ZION
- [ ] Verify pool initialization (check `slot0.sqrtPriceX96`, `liquidity`)

### Step 3: Acquire USDC and WETH for Seed Liquidity
- [ ] User needs to fund deployer address (`0xdde17506...`) with USDC and WETH
- [ ] Suggested amounts (user to confirm):
  - wZION/USDC: 10M ZION + $2,000 USDC (small seed)
  - wZION/WETH: 10M ZION + 1 WETH (~$2,000)
- [ ] Alternatively: swap some wZION for USDC/WETH via Uniswap after pool creation

### Step 4: Add Seed Liquidity
- [ ] Approve wZION + USDC for NPM (`0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1`)
- [ ] Mint full-range position for wZION/USDC (tickLower=-887220, tickUpper=887220)
- [ ] Approve wZION + WETH for NPM
- [ ] Mint full-range position for wZION/WETH
- [ ] Record NFT position IDs

### Step 5: Verify & Monitor
- [ ] Check pool prices match 0.0002 USD/ZION
- [ ] Verify liquidity depth on both pools
- [ ] Test small swap via Uniswap UI or SwapRouter
- [ ] Monitor bridge relayer continues processing new locks

### Step 6: Optional — Old wZION/WETH Pool
- [ ] Existing pool `0xa88C4C89...` has wrong price (~$0.017/ZION)
- [ ] Either: withdraw liquidity if we have a position, or ignore it
- [ ] New 1% pool will be the canonical one at correct price

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
