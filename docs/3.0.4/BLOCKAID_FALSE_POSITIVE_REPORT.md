# Blockaid False-Positive Report — wZION "Potential Honeypot" Warning

**Date:** 2026-07-10  
**Token:** wZION (Wrapped ZION)  
**Contract:** `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6`  
**Chains:** Base (8453), BSC (56), Polygon (137), Arbitrum (42161), Optimism (10), Avalanche (43114)  
**Submission URL:** https://report.blockaid.io/  
**Uniswap Info:** https://support.uniswap.org/hc/en-us/articles/40074236290445  

---

## Warning Displayed

Uniswap UI (powered by Blockaid) shows:
1. **"Potential Honeypot"** — flagged by Blockaid heuristics
2. **"Not listed on leading U.S. exchanges"** — expected, ZION not yet on Coinbase/Kraken/Gemini

## Why This Is a False Positive

### wZION is a legitimate bridge token, NOT a honeypot

| Honeypot Indicator | wZION Status |
|---|---|
| Sell fees / transfer fees | **None** — standard ERC-20 transfer, no fees |
| Blacklist mechanism | **None** — no blacklist/whitelist functions |
| Hidden minting | **None** — `bridgeMint` is `BRIDGE_ROLE` gated, only bridge relay can mint |
| Cannot sell after buying | **False** — users freely swap wZION on Uniswap V3 |
| Pause mechanism | `emergencyPause` exists but is `GUARDIAN_ROLE` gated (DAO multisig 3-of-3) — standard bridge security |

### Contract Architecture

- **Standard:** OpenZeppelin ERC-20 with AccessControl (verified on Basescan)
- **Mint:** `bridgeMint()` — restricted to `BRIDGE_ROLE` (ZIONBridge contract only)
- **Burn:** `bridgeBurn()` — users burn wZION to unlock native ZION on L1 via WARP bridge
- **Pause:** `emergencyPause()` — restricted to `GUARDIAN_ROLE` (DAO guardian multisig)
- **Source verified:** 7/7 contracts verified on Basescan (wZION, ZIONBridge, ZIONAtomicSwap, ZIONGovernance, ZIONTreasury, ZIONStaking, ZIONFarm)

### Why Blockaid Flags It

Blockaid heuristics flag any token with:
- Admin-controlled mint function → **standard for bridge tokens** (like WBTC, wETH)
- Pause function → **standard for bridge tokens** (emergency stop)

These are the same security patterns used by major bridge tokens (WBTC, wstETH, cbETH). The heuristics produce false positives for legitimate bridge tokens.

## Evidence

1. **Basescan verified source:** https://basescan.org/address/0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6#code
2. **Active Uniswap V3 pools:**
   - wZION/USDT 0.3% — actively traded
   - wZION/WETH 1.0% — active liquidity
   - wZION/SOL 0.01% — active
3. **No sell restrictions:** Users have successfully sold wZION on Uniswap V3
4. **Open-source project:** Full source code at https://github.com/user/zion-terranova (publication pending Phase 9)
5. **Security disclosures:** 5 vulnerabilities disclosed and remediated (ZION-2026-001 through ZION-2026-005)

## Request

Please review the wZION contract and remove the "Potential Honeypot" flag. The token is a legitimate cross-chain bridge token with standard security patterns (role-gated mint, guardian pause) identical to WBTC and other major wrapped tokens.

The "Not listed on leading U.S. exchanges" warning is expected — ZION is a new Layer-1 project with public launch scheduled for 31 December 2026. Exchange listings will follow post-launch.

## Contact

Project: ZION TerraNova  
Website: https://zionterranova.com  
Dashboard: https://dashboard.zionterranova.com  
Network: ZION V3 Mainnet (Proof of Work Layer 1)  
Protocol: v3.0.5
