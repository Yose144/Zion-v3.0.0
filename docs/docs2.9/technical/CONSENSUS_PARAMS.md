# Zion Consensus Parameters

Status: Unified v2.7.5 (2025-10-09)

| Parameter | Value | Notes |
|-----------|-------|-------|
| Symbol | ZION | |
| Decimals | 6 | Confirmed via atomic units (1e6) in core
| Max Supply (Cap) | 144,000,000,000 | Hard cap on L1
| Premine | 14,342,857,143 (≈10%) | See deployment log for breakdown
| Mining Supply Target | 129,657,142,857 (≈90%) | Delivered across ~45 active years
| Block Target Time | 60 s | Unified target for emission math
| Base Block Reward | 5,479.45 ZION | Fixed-rate base schedule
| Annual Base Emission | 2,880,000,000 ZION | 5,479.45 × 525,600 blocks/yr
| Emission Schedule | No-halving base schedule | DAO may taper tail to honor cap
| Difficulty Algorithm | LWMA (to verify) | Retargeting tuned for 60 s target
| PoW Algorithm (L1) | RandomX (rx/0) | To verify exact variant/params in core
| Mining Stack (Pools) | Yescrypt/KawPow/RandomX | Pool/L2 integration; not L1 inflation
| P2P Port | 18080 | Default in compose
| RPC Port | 18081 | Default in compose
| Shim RPC Port | 18089 | Internal proxy
| Stratum Port | 3333 | Pool
| Mempool TTL | TBD | Add after code audit
| Coinbase Maturity | TBD (e.g. 60 blocks) | Needed for payout validation
| Min Fee | TBD | Extract from core
| Address Prefix | 'Z3' | Base58 start
| Extra Nonce Space | ≥ 16 bytes | Ensures multi-miner scaling

## Base Emission Model (Non-Inflationary Clarification)
- 2.88B ZION/rok je základní on-chain emise při 60 s block time a 5,479.45 ZION/blok.
- Cíl mining supply ~129.657B dosažen za ~45 aktivních let; roky 46–50 lze spravovat governance (tail → 0), aby byl zachován cap 144B.

## Premine Breakdown (Reference)
Viz `ZION_2.7.5_COMPLETE_DEPLOYMENT_SUCCESS_LOG.md` – PREMINE DISTRIBUTION BREAKDOWN:
- Mining Operators: 10.0B ZION (5 adres × 2B)
- Development Fund: 1.0B ZION
- Infrastructure: 1.0B ZION
- Humanitarian: 1.0B ZION
- DAO Transition: 1.0B ZION
- Genesis Community: 343M ZION

## Redistribution Policies (Pool/L2 – Not Inflation)
- Humanitarian tithe (2.7.1→2.7.2→2.7.3): 10% → 15% → 20% (ultimate konfigurace 25%).
- Tithe a PoC multipliers jsou redistribuce výplat na úrovni poolu/L2 v rámci fixní on-chain emise – nejedná se o dodatečný mint. Cap 144B zůstává zachován.

## To Verify in Core
- Konkrétní implementace difficulty (okno, váhy) a přesný RX variant/parametrizace.
- Coinbase maturity a výchozí min fee (statická vs. dynamická) a block size pravidla.

## Block Template Flow (Operational)
1. Pool → node (shim): `getblocktemplate`
2. Template cache (např. 12 s)
3. Miner řeší PoW dle konsenzu (RX) / pool využívá multi-algo pro účastníky
4. Share → pool → (candidate) → `submitblock`
5. Na success: invalidace template cache

## Future Additions
- Tail emission policy (governance) – formální specifikace
- Upgrade heights / feature flags

---
Aktualizujte při změně protokolových konstant. Udržujte stabilní render pro explorery a tooling. 
