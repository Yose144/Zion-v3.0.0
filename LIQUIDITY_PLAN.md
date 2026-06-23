# ZION — Real Liquidity Plan

> **Datum:** 2026-06-23
> **Status:** ~100M wZION pending mint (timelock expiry 2026-06-24 16:52 UTC)
> **Cíl:** Seed likvidita na Uniswap V3, staking pool, DAO treasury aktivace, plná DeFi roadmapa

---

## 1. Přehled — Co Máme k Dispozici

| Asset | Množství | Adresa / Kontrakt | Status |
|-------|----------|-------------------|--------|
| wZION (pending mint) | ~100,000,000 wZION | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` | ⏳ po timelock 2026-06-24 |
| ETH (pro likviditu) | dle aktuálního zůstatku | `0xdde17506...` | potřeba doplnit |
| UniV3Pool | wZION/WETH 0.3% | `0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB` | ✅ deployed, seed pending |
| ZIONStaking | 12% APR | deployed na Base | ✅ deployed, seed pending |
| ZIONFarm | MasterChef | deployed na Base | ✅ deployed, seed pending |
| DAO Treasury | 4,000,000,000 ZION | genesis slot 6-8 | ⏳ cliff ~červen 2027 |

---

## 2. UniV3Pool — Seed Likvidita

### 2A. Parametry poolu

| Parametr | Hodnota | Zdůvodnění |
|----------|---------|------------|
| Pair | wZION / WETH | Hlavní trading pair |
| Fee tier | 0.3% | Standard pro volatile pairs (1% pro málo likvidní) |
| Počáteční cena | TBD — doporučení níže | Dle tržní kapitalizace |
| Tick range | Full range (-887272 → 887272) | Maximální likvidita pro seed |
| Seed wZION | 50,000,000 – 80,000,000 wZION | 50–80% z available 100M |
| Seed ETH | dle počáteční ceny | V poměru k wZION |

### 2B. Doporučení počáteční ceny

Toto je zásadní rozhodnutí — nastavit příliš nízko = nedoceněno, příliš vysoko = nenakoupí nikdo.

**Referenční výpočet (příklad):**
```
Pokud chceme market cap = $1M USD při ceně ETH = $2500:
  wZION price = $1M / 144B ZION total supply = $0.0000069/ZION
  wZION/ETH price = $0.0000069 / $2500 = 0.00000000276 ETH/wZION
  = 1 ETH = ~362 000 000 wZION

Pokud chceme market cap = $10M USD:
  wZION price = $0.000069/ZION
  = 1 ETH = ~36 200 000 wZION

Doporučení pro seed: začít konzervativně s ~$1–5M FDV
```

> **Akce potřebná od uživatele:** Rozhodnutí o počáteční ceně (FDV) před přidáním likvidity.

### 2C. Postup přidání likvidity (po mint)

```bash
# 1. Ověřit wZION balance
cast call 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6 \
  "balanceOf(address)(uint256)" 0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186 \
  --rpc-url https://mainnet.base.org

# 2. Approve wZION pro NonfungiblePositionManager
cast send 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6 \
  "approve(address,uint256)(bool)" \
  0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f8 \
  50000000000000000000000000 \
  --private-key $VALIDATOR_KEY \
  --rpc-url https://mainnet.base.org

# 3. Mint pozice (NonfungiblePositionManager na Base)
# Uniswap V3 NonfungiblePositionManager: 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f8
cast send 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f8 \
  "mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))" \
  "(0x0c493763..., 0x4200...0006, 3000, -887272, 887272, 50000000000000000000000000, ETH_AMOUNT, 0, 0, 0xdde17506..., DEADLINE)" \
  --value ETH_AMOUNT_WEI \
  --private-key $VALIDATOR_KEY \
  --rpc-url https://mainnet.base.org
```

> Doporučení: Použít Uniswap V3 web UI (`app.uniswap.org`) nebo vlastní Next.js script pro bezpečnější přidání likvidity.

### 2D. Rozdělení 100M wZION

| Použití | Množství | % |
|---------|----------|---|
| UniV3Pool seed liquidity | 60,000,000 wZION | 60% |
| ZIONStaking rewards pool | 20,000,000 wZION | 20% |
| ZIONFarm rewards pool | 10,000,000 wZION | 10% |
| Reserve (bridge operations, treasury) | 10,000,000 wZION | 10% |
| **Celkem** | **100,000,000 wZION** | 100% |

---

## 3. ZIONStaking — Aktivace

### Parametry

| Parametr | Hodnota |
|----------|---------|
| Kontrakt | deployed na Base |
| Reward token | wZION |
| APR | 12% |
| Cooldown | 7 dní |
| Rewards pool seed | 20,000,000 wZION |

### Postup aktivace

```solidity
// 1. Approve a vložit rewards do staking kontraktu
wZION.approve(stakingContract, 20_000_000e18);
stakingContract.notifyRewardAmount(20_000_000e18);

// 2. Nastavit rewards duration (např. 1 rok)
stakingContract.setRewardsDuration(365 days);
```

### Staking flow pro uživatele
```
1. Uživatel bridguje ZION → wZION
2. Approve wZION → ZIONStaking kontrakt
3. stake(amount) → dostane stakeZION tokeny
4. Každý blok/den akumuluje rewards
5. Po 7 dnech cooldown: unstake() + claimRewards()
```

---

## 4. ZIONFarm (Yield Farming) — Aktivace

### Parametry

| Parametr | Hodnota |
|----------|---------|
| Kontrakt | MasterChef-style deployed na Base |
| LP token | UniV3 NFT pozice (wZION/WETH) |
| Reward token | wZION |
| Rewards pool seed | 10,000,000 wZION |

### Farm pools (navrhované)

| Pool | LP token | Multiplikátor | APR (odhad) |
|------|----------|---------------|-------------|
| wZION/WETH | UniV3 0.3% | 4× | ~80% |
| wZION single-stake | wZION | 2× | ~40% |
| Future: wZION/USDC | UniV3 0.05% | 1× | ~20% |

---

## 5. Reverse Bridge — Burn→Unlock E2E Test

### Postup

```bash
# 1. Burn wZION na ZIONBridge (získá zpět L1 ZION)
cast send 0x89504D6eD6993d726438E1A9C18aaC79e8d0eF88 \
  "burn(uint256,string)()" \
  1000000000000000000000 \   # 1000 wZION wei (18 decimals)
  "zion1<your_l1_address>" \
  --private-key $VALIDATOR_KEY \
  --rpc-url https://mainnet.base.org

# 2. Relay detekuje Burn event, čeká na Base finality
# 3. Relay odesílá unlock TX na L1 RPC
# 4. L1 node odemkne UTXO z bridge vault → odešle na L1 adresu
```

> ⚠️ **Burn→Unlock implementace v relay:** Zkontrolovat `relayer.rs` `handle_evm_burn()` — musí být plně implementováno pro produkci.

---

## 6. Validator ETH Top-Up

Každý validátor potřebuje ETH pro gas. Aktuální stav (~0.001–0.002 ETH/validátor) je minimální.

```
Doporučení: 0.01 ETH × 5 validátorů = 0.05 ETH celkem
Při ceně ETH $2500 = $125 USD — zanedbatelná částka pro bezpečný provoz
```

| Adresa | Aktuální | Cílový zůstatek |
|--------|----------|-----------------|
| `0xdde17506...` | ~0.002 ETH | ≥ 0.01 ETH |
| `0x24d986...` | ~0.001 ETH | ≥ 0.01 ETH |
| `0x665c55...` | ~0.001 ETH | ≥ 0.01 ETH |
| `0x8E644b...` | ~0.001 ETH | ≥ 0.01 ETH |
| `0x7e0D2e...` | ~0.001 ETH | ≥ 0.01 ETH |

---

## 7. DAO Treasury — Aktivace a Plán

### Parametry treasury

| Parametr | Hodnota |
|----------|---------|
| Celková treasury | 4,000,000,000 ZION (genesis premine) |
| Adresy | Sloty 6, 7, 8 z genesis (`PREMINE_ADDRESSES_PUBLIC.txt`) |
| Multi-sig | 5 z 7 signatářů |
| Cliff | `DAO_TREASURY_LOCK_HEIGHT` ≈ 525,600 bloků (∼1 rok od genesis) |
| Cliff datum (odhad) | červen 2027 (genesis byl 2026-06-11) |
| Denní limit výdajů | 100,000,000 ZION |

### Fáze aktivace

```
Fáze 1 (2026-Q3/Q4): Příprava
  - Dokumentovat multi-sig signatáře (5/7)
  - Web UI pro treasury view
  - Snapshot off-chain voting (diskuze bez bind. hlasování)
  - Sestavit první grant program proposal

Fáze 2 (2027-Q1/Q2): Cliff přiblíže
  - Ověřit DAO_TREASURY_LOCK_HEIGHT on-chain
  - Audit treasury balance a addresses
  - Technická zkouška multi-sig flow

Fáze 3 (2027-Q2): Odemknutí + First Proposals
  - Cliff dosažen → treasury odemčena
  - Submit první governance proposal
  - Quorum hlasování (10% oběžného množství)
  - Timelock 48h → exekuce
  - První grantová alokace
```

### Návrhy prvních DAO proposals (2027+)

| # | Proposal | Typ | Navrhovaná částka |
|---|----------|-----|-------------------|
| DAO-001 | Liquidity Mining Program | SpendTreasury | 100M ZION/rok |
| DAO-002 | Developer Grant Program | SpendTreasury | 50M ZION/rok |
| DAO-003 | Marketing + Listings | SpendTreasury | 20M ZION |
| DAO-004 | Security Audit Fund | SpendTreasury | 10M ZION |
| DAO-005 | Humanitarian Fund alokace | SpendTreasury | 5M ZION/kvartál |
| DAO-006 | Staking APR adjustment | ProtocolChange | — |
| DAO-007 | Bridge threshold reduction | ProtocolChange | — |

---

## 8. Full DeFi Roadmapa — Přehled Zbývajícího

### Krátkodobé (0–4 týdny)

| # | Úkol | ETA | Závislost |
|---|------|-----|-----------|
| 1 | ~100M wZION mint | 2026-06-24 16:52 | Automaticky |
| 2 | Validator ETH top-up | 2026-06-24 | Ruční |
| 3 | UniV3Pool seed liquidity | 2026-06-25 | Rozhodnutí o ceně |
| 4 | ZIONStaking seed rewards | 2026-06-25 | Po mint |
| 5 | E2E burn→unlock test | 2026-06-26 | Po mint |
| 6 | Web bridge UI real | 2026-07-01 | Frontend práce |
| 7 | Web swap UI (/defi/swap) | 2026-07-07 | Frontend práce |
| 8 | Explorer bridge tracker | 2026-07-07 | Backend API |

### Střednědobé (1–3 měsíce)

| # | Úkol | ETA |
|---|------|-----|
| 9 | Staking web UI | 2026-07 |
| 10 | Desktop Agent bridge + swap | 2026-07 |
| 11 | Mobile bridge + swap | 2026-08 |
| 12 | DAO Snapshot voting (off-chain) | 2026-08 |
| 13 | RPC WebSocket subscriptions | 2026-08 |
| 14 | zion-wallet TypeScript SDK | 2026-09 |
| 15 | CoinGecko / CMC listing | 2026-09 |
| 16 | BitcoinTalk ANN | 2026-09 |

### Dlouhodobé (3–12 měsíců)

| # | Úkol | ETA |
|---|------|-----|
| 17 | NCL ONNX backend live | 2026-Q4 |
| 18 | WARP Bitcoin adapter | 2026-Q4 |
| 19 | WalletConnect v2 integrace | 2026-Q4 |
| 20 | DAO treasury UI on-chain | 2027-Q1 |
| 21 | DAO treasury cliff + first proposals | 2027-Q2 |
| 22 | WARP Solana + Cosmos adapters | 2027 |
| 23 | Plný veřejný launch (31.12.2026) | 2026-12-31 |

---

## 9. Checklist — Před Přidáním Likvidity

```
[ ] wZION balance ověřen: cast call 0x0c493763... "balanceOf(address)(uint256)" 0xdde17506...
[ ] Rozhodnutí o počáteční ceně (FDV) — viz sekce 2B
[ ] ETH dostupné na 0xdde17506... pro párování s wZION v poolu
[ ] Validator ETH topped up (≥ 0.01 ETH × 5)
[ ] UniV3Pool deploy ověřen: 0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB
[ ] Burn→Unlock relay testován
[ ] Bridge UI dostupné pro uživatele (nebo alespoň CLI)
```

---

## 10. Smart Contract Adresy (Base Mainnet)

| Contract | Address |
|----------|---------|
| wZION (ERC-20) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| ZIONBridge (5/5) | `0x89504D6eD6993d726438E1A9C18aaC79e8d0eF88` |
| BridgeValidator (5/5) | `0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627` |
| UniV3Pool (wZION/WETH) | `0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB` |
| ZIONStaking | TBD — ověřit deployment |
| ZIONFarm | TBD — ověřit deployment |
| ZIONGovernance | TBD — ověřit deployment |
| ZIONTreasury | TBD — ověřit deployment |
| UniV3 NonfungiblePositionManager | `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f8` |
| UniV3 SwapRouter | `0x2626664c2603336E57B271c5C0b26F421741e481` |
| WETH9 (Base) | `0x4200000000000000000000000000000000000006` |

---

*Viz také:*
- [`docs/DEFI_FULL_ROADMAP.md`](./docs/DEFI_FULL_ROADMAP.md) — kompletní DeFi + DAO roadmapa
- [`BRIDGE_MAINNET_READINESS.md`](./BRIDGE_MAINNET_READINESS.md) — bridge stav
- [`fixL1bridge100m.md`](./fixL1bridge100m.md) — 100M ZION recovery report
- [`V3/L2/dao/docs/README.md`](./V3/L2/dao/docs/README.md) — DAO governance

*Generated with [Devin](https://devin.ai)*
