# L2 Bridge Completion — Status & Plan

**Last updated:** 2026-06-29 (session 8: atomic swap activated with production escrow, DAO scanner fixed, 3.0.4 milestone defined)

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
  - `VALIDATOR_ROLE` on bridge for all 5 validators (required for `submitLockProof` / `confirmBurnRelease`)
  - `GUARDIAN_ROLE` + `DEFAULT_ADMIN_ROLE` on bridge only for validator-1 deployer (`0xdde17506...`) — controls pause/unpause and admin functions
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

### 7. Atomic Swap Daemon — Activated ✅ (Session 8, 2026-06-29)

- **Service:** `zion-edge-atomic-swap.service` — `active (running)` na portu 8452
- **Escrow address:** `zion1y0j484d5e8r49785d253e8w0c2x4t3n792m5724` (produkční Ed25519 keypair, 2026-06-29)
- **Contract:** `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb` (Base Mainnet, ZIONAtomicSwap.sol)
- **L1 watcher:** scanuje bloky od genesis, hledá `SWAP:LOCK` mema
- **EVM watcher:** sleduje Base mainnet HTLC events (Locked/Claimed/Refunded)
- **Opravy:**
  - `SO_REUSEADDR + SO_REUSEPORT` via socket2 crate → daemon se restartuje okamžitě bez čekání na TIME_WAIT
  - DB cesta opravena na `/root/zion-2.9.6-main/V3/data/atomic-swap.db`
  - `ZION_SWAP_BEARER_TOKEN` env var podpora pro API endpoint ochranu
- **Secrets:** `systemd drop-in /etc/systemd/system/zion-edge-atomic-swap.service.d/secrets.conf` (chmod 600)
- **⚠️ Funding potřeba:** escrow adresa musí dostat ~5-10 ZION pro release TX fees (L1)

### 8. DAO L1 Scanner Fix ✅ (Session 8, 2026-06-29)

- **Root cause:** `DAO_L1_RPC=http://127.0.0.1:8443/jsonrpc` — `normalize_rpc_addr()` strippuje `http://` prefix ale ne `/jsonrpc` suffix → `TcpStream::connect("127.0.0.1:8443/jsonrpc")` selhalo s "Connection refused"
- **Fix:** `DAO_L1_RPC=127.0.0.1:8443` v `/etc/systemd/system/zion-edge-dao.service`
- **Status po fix:** `[DAO-SCANNER] Starting L1 scanner → 127.0.0.1:8443` ✅

### 9. Uniswap V3 Pool Cleanup ✅ (Sessions 2, 3 & 5)

#### Canonical Pools on Base Mainnet (final state 2026-06-29)
| Pair | Fee | Pool Address | Liquidity | Status |
|------|-----|--------------|-----------|--------|
| wZION/USDT | 0.3% (3000) | `0x186b46c2f04153999d44D25179cD623fD62Bfda2` | 2,329,175,222,979,065 | **ACTIVE — PRIMARY ✅** |
| wZION/WETH | 1.0% (10000) | `0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699` | 429,876,233,605,855,311,813 | **ACTIVE — secondary ✅** |
| wZION/SOL | 0.01% (100) | `0xF38c56bbBBBC6d9FA11E7DE84bF7Bb70e1e8D2b3` | 23,597,018,927,051,195 | **ACTIVE — tertiary ✅** |

#### Dead/Rogue Pools (liq=0, no LP, cannot be destroyed)
| Pair | Fee | Pool Address | Liquidity | Note |
|------|-----|--------------|-----------|------|
| wZION/WETH | 0.3% (3000) | `0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB` | 0 | old wrong-price pool |
| wZION/USDC | 0.3% (3000) | `0x5eBdC6E1D516f42EEB54f14faCF8715AbD5B9d8d` | 0 | abandoned |
| wZION/SOL | 0.05% (500) | `0x2A0807007C62aC75DC0e295aE4C747a6CaC4051C` | 0 | rogue (no LP) |
| wZION/SOL | 0.3% (3000) | `0xc74F645A882dd7Bbbb60cc85Be10FF8a1572d01B` | 0 | inverted price (was $25M) |
| wZION/SOL | 1.0% (10000) | `0x1d43fd5afF5F7d810be32d8012e290210d823F11` | 0 | rogue (no LP) |

> All rogue pools are filtered in `/api/cex/listings` via `CANONICAL_POOLS` whitelist. DexScreener will naturally de-list them as they show 0 activity.

#### NFT Positions Withdrawn (Sessions 2–3)
| NFT # | Pool | Tick Range | Action | TX |
|-------|------|------------|--------|----|
| 4901417 | wZION/WETH 0.3% | -887220 to 887220 | Withdrawn + burned | `0xb0a3283c...` |
| 5431091 | wZION/USDC 0.3% | -361440 to -360000 | Withdrawn + burned | `0xb40cd241...` |
| 5431093 | wZION/WETH 1.0% | -161000 to -160000 | Withdrawn + burned | `0x1beb81c1...` |

#### NFT Positions Burned (Session 5)
| NFT # | Pool | Reason | TX |
|-------|------|--------|----|
| 5431714 | wZION/WETH 1.0% | liq=0, owed=0 — empty position | `0xb6003f2c...` |
| 5434637 | wZION/USDT 0.3% | liq=0, owed=0 — empty position | `0x51a4454b...` |

#### Active NFT Positions (final 2026-06-29)
| NFT # | Pool | Liquidity | Status |
|-------|------|-----------|--------|
| 5434576 | wZION/WETH 1.0% (10000) | 429,876,233,605,855,311,813 | **ACTIVE — wide ±30%** |
| 5434872 | wZION/SOL 0.01% (100) | 23,597,018,927,051,195 | **ACTIVE** |
| 5435121 | wZION/USDT 0.3% (3000) | 2,329,175,222,979,065 | **ACTIVE — primary** |

**WETH pool liquidity:** 429,876,233,605,855,311,813
**USDT pool liquidity:** 2,329,175,222,979,065
**SOL pool liquidity:** 23,597,018,927,051,195

#### Key Fix: Tuple ABI
- **Root cause of previous failed withdraws:** NPM `decreaseLiquidity()` and `collect()` take **struct (tuple)** parameters, not individual params
- Wrong selector: `decreaseLiquidity(uint256,uint128,uint256,uint256,uint256)` = `0x03a3f2ab` → reverts silently
- Correct selector: `decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))` = `0x0c49ccbe` → works
- Same for `collect()`: use `collect((uint256,address,uint128,uint128))` not `collect(uint256,address,uint128,uint128)`
- Script: `ZION_OS/dashboard/uniswap_withdraw.py`

#### Token Balances After Liquidity Addition (Session 4)
- **wZION:** 99,681,908.06 (350K used for Uniswap: 200K WETH + 100K+50K USDT + 100K SOL)
- **ETH:** 0.006082
- **WETH:** 0
- **USDC:** 0
- **USDT:** 14.59 (23.78 received from swap, 9.19 used for liquidity)
- **SOL:** 0.002302

---

## 🔧 Remaining Work — Pool Expansion

### ✅ DONE (Session 2)
- [x] Swap 0.002 WETH → 3.14 USDT via SwapRouter02 multicall
- [x] Create + initialize USDT/wZION pool (fee=3000, $0.0002/ZION)
- [x] Add two-sided liquidity (100K wZION + 3.14 USDT)
- [x] Cleanup wrong SOL/wZION pools (withdraw + burn NFTs #5434733, #5434820)
- [x] Swap WETH → SOL via KyberSwap (total 0.0178 WETH → 0.2835 SOL)
- [x] Create + initialize SOL/wZION pool (fee=0.01%, exact $0.0002/ZION)
- [x] Add exact-ratio liquidity (100K wZION + 0.272 SOL)

### Current State — 3 Canonical Active Pools (2026-06-29)
- wZION/USDT 0.3%: **ACTIVE — PRIMARY** ✅ (~$150+ TVL)
  - NFT #5435121: active wide position — sole active position on pool
  - Price reference: wZION/USDT on-chain (USDT=stablecoin, most reliable USD price)
- wZION/WETH 1.0%: **ACTIVE** ✅ (wide position, 430T liquidity)
  - NFT #5434576: wide ±30% — active (200K wZION + 0.020 WETH)
- wZION/SOL 0.01%: **ACTIVE** ✅ (23.6T liquidity, 100K wZION + 0.272 SOL)
  - NFT #5434872: tick [-340387, -330387] (±5000 ticks)
- Dead/rogue pools (liq=0, no LP, filtered in API): 5 pools — see table above
- Deployer NFTs: **3 active** (#5434576, #5434872, #5435121) — 2 empty burned (session 5)

### Liquidity Plan — Focus on USDT
- **Primary:** wZION/USDT 0.3% — target to grow to **500K wZION + 100 USDT** ($100+ liquidity)
  - Stablecoin pair = best for real trading and integrations
  - Current: 69,955 wZION + 11.45 USDT (~$15 TVL) — **needs more USDT**
  - Remaining deployer USDT: 14.59 (can add another ~$14 liquidity)
- **Secondary:** wZION/WETH 1.0% — maintain wide position, add if more WETH available
- **Tertiary:** wZION/SOL 0.01% — keep as-is, do not add more (volatile, expensive to rebalance)
- **Dead pools:** leave at 0 liquidity; do not deposit again

### Blockaid / Uniswap "Potential Honeypot" Warning
- **Status:** False positive from Blockaid heuristics (used by Uniswap UI)
- **Root cause:** wZION contract has `bridgeMint` (BRIDGE_ROLE only) and `emergencyPause` (GUARDIAN_ROLE) — standard bridge token security, but Blockaid flags admin-controlled mint as honeypot risk
- **Not a real honeypot:** No sell fees, no blacklist, no hidden minting — contract is verified ERC-20 with OpenZeppelin AccessControl
- **Also flagged:** "Not listed on leading U.S. exchanges" (expected — not on Coinbase/Kraken/Gemini yet)
- **Mitigation:**
  1. Increase liquidity and trading volume (in progress)
  2. Submit false-positive report to Blockaid via Uniswap "Submit an issue" link
  3. Get token verified on Basescan (source code already verified)
  4. Apply for Uniswap Default Token List (requires volume + community)
  5. Website docs: add explanation for users about the warning

### Remaining Tasks
- [x] Add USDT liquidity to primary pool (50K wZION + 9.19 USDT added — session 4)
- [x] Update website /api/defi/pools and /api/defi/status to include USDT + SOL pools
- [x] Update DeFi dashboard UI to prioritize USDT pool
- [x] Fix decimal adjustment in price calculation (USDT 6 decimals vs wZION 18)
- [x] Burn NFT #5431714 (session 5 — TX `0xb6003f2c...`)
- [x] Burn NFT #5434637 (session 5 — TX `0x51a4454b...`)
- [x] Filter rogue/dead pools in /api/cex/listings (CANONICAL_POOLS whitelist — session 5)
- [x] Fix best_price_usd — WETH-first ordered fallback, no longer picks $25M outlier (session 5)
- [x] Add wZION/USDT price sparkline chart to /defi page (session 5)
- [x] Clean up defi-contracts.ts — remove DEAD/LEGACY entries, update NFT position IDs (session 5)
- [x] Update CEX page DexScreener link to primary USDT pool (session 5)
- [x] Update L2OS dashboard DeFi panel canonical pool mapping (session 4+5)
- [x] E2E reverse bridge test — burn TX confirmed, relay detected, 5/5 sigs OK (session 6)
- [x] Configure ZION_VALIDATOR_EXTRA_KEYS + ZION_BRIDGE_VALIDATOR_PUBKEYS on Edge (session 6)
- [x] **P0 FIX: BRIDGE_VAULT_SEED reverted → node rebuilt → deployed → 100 ZION unlocked on L1 blok 20919 (session 7)** ✅
- [x] **Reverse bridge FULLY OPERATIONAL end-to-end** ✅
- [ ] Add more USDT liquidity (need external USDT or more ETH to swap)
- [ ] Submit Blockaid false-positive report
- [ ] Deploy ZIONStaking + ZIONFarm on Base Mainnet (needs ~0.01 ETH for deploy gas)
- [ ] Monitor bridge relayer continues processing new locks

### Session 7 Changes (2026-06-29) — Reverse Bridge Fully Operational
| What | Where | Detail |
|------|-------|--------|
| BRIDGE_VAULT_SEED fix | `V3/L1/core/src/crypto.rs` | Reverted seed `"ZION Bridge Vault V3 Mainnet"` → addr `zion1w0r0a560...` (100M ZION) |
| BRIDGE_VAULT_ADDRESS fix | `V3/L1/core/src/fee.rs` | Konstanta aktualizována + comment přidán |
| L1 node rebuild | Edge server | `cargo build --release -p zion-core --bin node` (38.88s) → `/usr/local/bin/zion-node` |
| L1 node restart | Edge systemd | `zion-edge-node1.service` restartován, nová binárka aktivní |
| `getBridgeVaultBalance` ověřen | L1 RPC | Vrací `zion1w0r0a560...` / `99,999,999 ZION` ✅ |
| Relay restart | Edge | Pending burn `0x250553...` re-queue → 5/5 sigs → `submitBridgeUnlock` OK |
| L1 unlock TX | L1 blok 20919 | `100000000 flowers` (100 ZION) → `zion16825y...` memo `BRIDGE_UNLOCK:base:0x250553...` ✅ |
| `confirmBurnRelease` | Base Mainnet | TX `0x97f41f0add2e08...` confirmed ✅ |
| Replay protection | L1 RPC | Second attempt → `bridge unlock replay key already used` ✅ (double-spend prevence) |
| 514 unit tests | `cargo test -p zion-core` | Všechny OK incl. `bridge_vault_address_matches_crypto_derivation` ✅ |

#### Bridge E2E Test Summary (FINAL)

| Krok | Status | Detail |
|------|--------|--------|
| 1. `bridgeBurn(100 wZION)` | ✅ | TX `0x70ad4d93...` Base blok 47982490 |
| 2. EVM watcher detekce | ✅ | BridgeBurn event `2026-06-29T17:34:40` |
| 3. 5/5 validator signatures | ✅ | ZION_VALIDATOR_EXTRA_KEYS + ZION_BRIDGE_VALIDATOR_PUBKEYS |
| 4. `submitBridgeUnlock` L1 | ✅ | L1 blok 20919, 100 ZION → `zion16825y...` |
| 5. `confirmBurnRelease` EVM | ✅ | TX `0x97f41f0add2e08...` Base mainnet |
| 6. Replay protection | ✅ | Druhý pokus odmítnut |

**Reverse bridge (EVM→L1) je plně funkční na mainnet.**

### Session 6 Changes (2026-06-29)
| What | Where | Detail |
|------|-------|--------|
| Reverse bridge E2E test | on-chain + relay | `bridgeBurn(100 wZION)` TX `0x70ad4d93...` blok 47982490 — CONFIRMED ✅ |
| Relay detection | `zion-edge-bridge` | BridgeBurn event zachycen `2026-06-29T17:34:40` — INFO log ✅ |
| 5/5 signatures | relay env | `ZION_VALIDATOR_EXTRA_KEYS` přidán do `/root/zion-validator-key.env` — 5 klíčů agregováno ✅ |
| Validator pubkeys | L1 node drop-in | `ZION_BRIDGE_VALIDATOR_PUBKEYS` + `ZION_BRIDGE_VALIDATOR_THRESHOLD=5` v `/etc/systemd/system/zion-edge-node1.service.d/bridge-validators.conf` ✅ |
| **BLOCKER resolved** | `V3/L1/core/src/fee.rs:135` | `BRIDGE_VAULT_ADDRESS` nyní odpovídá live vault `zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0`; reverse bridge E2E prošel a unlock flow je funkční. |
| wZION_PLAN.md aktualizace | `docs/` | USDT deployer=0 (vše v poolu: 26.66 USDT + 138K wZION), pool in-range ✅ |

#### ✅ RESOLVED: BRIDGE_VAULT_ADDRESS alignment

**Původní symptom (historický):** `submitBridgeUnlock` vracel `bridge vault balance 0 is insufficient`

**Root cause:**
```
V3/L1/core/src/fee.rs:135
pub const BRIDGE_VAULT_ADDRESS: &str = "zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0";
                                         ↑ live bridge vault adresa (aligned)
```

```
V3/L2/bridge/config/bridge-mainnet.toml
bridge_address = "zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0"
                   ↑ live vault kde je 99,999,999 ZION
                     (bridge posílal locky sem, ale kód v fee.rs neví o ní)
```

**Resolution summary:** Konstanta v L1 byla srovnána na live vault adresu a reverse bridge E2E (EVM burn → L1 unlock) byl úspěšně dokončen.

### Session 5 Changes (2026-06-29)
| What | Where | Detail |
|------|-------|--------|
| Burn empty NFTs | on-chain | NFT #5431714 + #5434637 — liq=0, owed=0 — burned via NPM.burn() |
| Canonical pool filter | `/api/cex/listings` | `CANONICAL_POOLS` Set, whitelist-only filter, no rogue pools |
| Price feed fix | `/api/cex/listings` | `best_price_usd` = WETH→USDT→SOL ordered fallback (not max) |
| Price sparkline chart | `/defi/page.tsx` | SVG sparkline, samples `/api/defi/price` every 60s, 60-pt window |
| defi-contracts.ts cleanup | `src/lib/defi-contracts.ts` | Removed DEAD/LEGACY entries, corrected NFT IDs (5435121 not 5434637) |
| CEX DexScreener link | `/cex/page.tsx` | Changed from WETH pool → USDT pool (primary) |

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

### Uniswap V3 NPM decreaseLiquidity() + collect() ABI
**CRITICAL:** Same tuple pattern applies to `decreaseLiquidity()` and `collect()`. Using individual params produces wrong function selector → silent revert.
```python
# CORRECT — tuple ABI
{
    "inputs": [{"components": [
        {"name": "tokenId", "type": "uint256"},
        {"name": "liquidity", "type": "uint128"},
        {"name": "amount0Min", "type": "uint256"},
        {"name": "amount1Min", "type": "uint256"},
        {"name": "deadline", "type": "uint256"},
    ], "name": "params", "type": "tuple"}],
    "name": "decreaseLiquidity", ...
}

# Call with tuple:
npm.functions.decreaseLiquidity((token_id, liquidity, 0, 0, deadline))
npm.functions.collect((token_id, recipient, MAX_UINT128, MAX_UINT128))
```

**Wrong selector (individual params):** `0x03a3f2ab` → reverts silently (no error message)
**Correct selector (tuple):** `0x0c49ccbe` → works

### SwapRouter02 multicall pattern (Base)
SwapRouter02 (`0x2626664c2603336E57B271c5C0b26F421741e481`) does NOT expose `exactInputSingle` directly — must wrap in `multicall(deadline, [calldata])`.
```python
# 1. Build exactInput calldata (tuple ABI)
path = bytes.fromhex(WETH[2:] + (500).to_bytes(3,'big').hex() + USDT[2:])
ei_fn = router.functions.exactInput((path, recipient, amount_in, 0))
ei_calldata = ei_fn.build_transaction({...})["data"]

# 2. Wrap in multicall
fn = router.functions.multicall(deadline, [ei_calldata])
tx_hash, receipt = send_tx(w3, account, fn, gas_limit=250000)
```
**Path encoding:** `tokenIn (20 bytes) + fee (3 bytes) + tokenOut (20 bytes)` = 43 bytes packed

### KyberSwap aggregator (for cross-DEX swaps)
When Uniswap V3 has no direct pool (e.g., WETH→SOL), use KyberSwap aggregator API:
```python
# 1. Get route
url = f"https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn={WETH}&tokenOut={SOL}&amountIn={amount}"
route = json.loads(urlopen(url))["data"]["routeSummary"]

# 2. Build swap tx
build_url = "https://aggregator-api.kyberswap.com/base/api/v1/route/build"
build_data = {"routeSummary": route, "sender": addr, "recipient": addr, "slippageTolerance": 500, "deadLine": 9999999999}
swap_data = json.loads(urlopen(build_url, json.dumps(build_data)))["data"]
# swap_data["routerAddress"], swap_data["data"], swap_data["gas"]

# 3. Approve token for router, then send tx to router with calldata
```
**KyberSwap router (Base):** `0x6131B5fae19EA4f9D964eAc0408E4408b66337b5`
**Route for WETH→SOL:** PancakeSwap V3 / Aerodrome Slipstream (multi-hop)
**Note:** Larger WETH→SOL swaps (>0.005 WETH) may revert with `Call failed`. Use 0.002–0.005 WETH chunks and slippage 20% if needed.

### SOL/wZION exact-price math
Target: $73.44/SOL and $0.0002/wZION → 1 SOL = 367,200 wZION.
```python
SOL_PRICE = 73.44
ZION_PRICE = 0.0002
sol_per_zion = ZION_PRICE / SOL_PRICE          # 1 wZION = X SOL
price_raw = (sol_per_zion * 1e9) / 1e18        # raw ratio (SOL 9 dec / wZION 18 dec)
sqrt_price_x96 = int(math.sqrt(price_raw) * (2**96))  # 4134549992039516733440
```
For 100K wZION in a 0.01% concentrated position ±5000 ticks around the target price, the exact SOL amount is ~0.2724 SOL. The mint was executed at this exact ratio; the pool initialized at 1 SOL = 367,200 wZION and immediately received a post-creation swap that moved the spot price to ~410,912 wZION/SOL. This is normal market arbitrage, not a setup error.

### Gas Requirements
- `createAndInitializePoolIfNecessary`: ~4.6M gas (set limit to 5.5M)
- `mint` (two-sided, new pool): ~555K gas (set limit to 700K)
- `mint` (single-sided): ~490K gas (set limit to 600K)
- `decreaseLiquidity`: ~180K gas (set limit to 400K)
- `collect`: ~85K gas (set limit to 200K)
- `burn`: ~85K gas (set limit to 150K)
- `multicall` (swap): ~130K gas (set limit to 250K)
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
| Uniswap setup script | `/root/fix_sol_pool_exact.py` (Edge node) |
| Legacy setup scripts | `/root/uniswap_v3_setup.py`, `/root/create_sol_wzion_pool_final.py` |
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
- **Deployer wZION balance:** ~99,731,908 wZION (300K in Uniswap: 200K WETH + 100K USDT + 100K SOL)
- **Deployer ETH balance:** ~0.021 ETH
- **Deployer WETH balance:** 0
- **Deployer USDC balance:** 0
- **Deployer USDT balance:** 0 (3.14 USDT used for pool liquidity)
- **Deployer SOL balance:** 0.002302

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
| USDT | `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2` | 6 (bridged) |
| SOL  | `0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82` | 9 (Base bridge) |
| WETH | `0x4200000000000000000000000000000000000006` | 18 |
