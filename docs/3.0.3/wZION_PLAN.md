# wZION Launch & Liquidity Plan

> **Datum:** 2026-06-24  
> **Status:** 100M wZION emergency mint complete — liquidity seed pending ETH decision  
> **wZION totalSupply:** 100,000,199  
> **Deployer:** `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186`

---

## 1. Co se dnes stalo (2026-06-24)

### 1.1 Emergency mint ~100M wZION

24h timelock na bridge kontraktu vypršel v 16:52–16:56 UTC, ale automatický mint se neprovedl.

**Root cause:**
1. `DAILY_LIMIT = 10M` (constant) v `ZIONBridge.sol` — každý lock 16.67M > 10M → `DailyLimitExceeded` revert.
2. Bridge kontrakt neměl `BRIDGE_ROLE` na wZION.

**Řešení:**
- Deployer (`0xdde17506...`) má `BRIDGE_ROLE` na wZION přímo.
- Provedeno 6× `wZION.bridgeMint()` přímo z deployer EOA, čímž se obešel bridge kontrakt a jeho DAILY_LIMIT bug.
- 6 TXs confirmed na Base Mainnet blocích 47770934–47770969.
- Celkem mintováno: **99,999,899 wZION**.

| L1 TX Hash | Amount (wZION) | EVM TX Hash | Block |
|-----------|----------------|-------------|-------|
| `0x035c761d...` | 16,666,569 | `0x3c7bfda2...` | 47770934 |
| `0x09fc9abb...` | 16,666,666 | `0x15e18a4a...` | 47770940 |
| `0x2cd12d90...` | 16,666,666 | `0x7cc9c484...` | 47770946 |
| `0x4b43e7a3...` | 16,666,666 | `0x1d28c8ec...` | 47770953 |
| `0x6bc2aa3e...` | 16,666,666 | `0xe47f2b2a...` | 47770959 |
| `0xd9ddb3c7...` | 16,666,666 | `0x1e7a82ff...` | 47770969 |

### 1.2 Opravy konfigurace

| Oprava | Kde | Status |
|--------|-----|--------|
| `max_single_amount` 5M → 100M | `bridge-mainnet.toml` (Edge) | ✅ |
| L1 node restart | Edge server | ✅ 19:42 UTC |
| `BRIDGE_ROLE` grant pro bridge | wZION kontrakt | ✅ TX `0xa6d820c8...` |
| Relay restart | Edge server | ✅ |

### 1.3 Stav po mintu

| Metrika | Hodnota |
|---------|---------|
| wZION totalSupply | 100,000,199 |
| Deployer wZION | 100,000,045 |
| Deployer ETH | 0.001869 |
| wZION MAX_SUPPLY | 144,000,000,000 |
| Bridge `BRIDGE_ROLE` na wZION | ✅ granted |
| 7th lock (100 wZION) | 4/5 conf (minor) |

---

## 2. Stav UniV3 Poolu

### 2.1 Aktuální pool

| Parametr | Hodnota |
|----------|---------|
| Adresa | `0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB` |
| Pair | wZION / WETH 0.3% |
| sqrtPriceX96 | `232034385766325786393449389` |
| Tick | `-116670` |
| Aktuální cena | **~$0.0142 / wZION** |
| Likvidita | `158113883008418966` |
| wZION v poolu | 54.0 |
| WETH v poolu | 0.000463 |
| LP NFT | #4901417 (vlastní deployer) |

### 2.2 Problém: cena je špatně

Pool byl nasazen 2. 4. 2026 jako proof-of-concept se 50 wZION + 0.0005 WETH na cenu ~$0.035.  
Plán `LIQUIDITY_PLAN.md` počítá s cenou **$0.00002 / wZION**.  
Aktuální cena je **~$0.0142**, tedy **~710× vyšší** než cíl.

**Důsledek:** Nelze seednout 10M wZION při $0.00002 s dostupným ETH.  
Pool nelze "re-inicializovat" — `initialize()` v UniV3 jde zavolat jen jednou.

---

## 3. Možnosti seedování

### 3.1 Cena podle ETH budgetu (10M wZION)

Pokud vložíme 10M wZION jako full-range LP, cena se ustálí na:

| ETH vložíš | Cena wZION | FDV (144B) | Poznámka |
|------------|------------|------------|----------|
| 0.1 ETH | $0.0000166 | ~$2.4M | Blízko původního plánu |
| 0.2 ETH | $0.0000331 | ~$4.8M | Mírně nad plánem |
| 0.5 ETH | $0.0000828 | ~$11.9M | Zlatý střed |
| 1.0 ETH | $0.000166 | ~$23.9M | Konzervativní realistický start |
| 2.0 ETH | $0.000331 | ~$47.7M | Agresivnější |

**Počet:** `cena = (ETH × 1656) / 10_000_000`

### 3.2 Realistický postup

1. **Spálit starou LP pozici NFT #4901417** — vrátí 54 wZION + 0.00046 WETH.
2. **Rozhodnout ETH budget** — podle toho vypočítat cenu.
3. **Wrapnout ETH → WETH**.
4. **Mintnout novou full-range LP pozici** s 10M wZION + X WETH.

Cena se nastaví automaticky podle poměru wZION:WETH.

### 3.3 Další pooly (USDC, cbBTC)

| Pool | Druhý token | Adresa na Base | Co potřebujeme |
|------|-------------|----------------|----------------|
| wZION/USDC | USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | USDC + ETH na gas |
| wZION/cbBTC | cbBTC | `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf` | cbBTC + ETH na gas |
| wZION/USDT | USDT | `0xfde4C96cE8598e1fDd71d3B79D3583f4Cba96B2b` | USDT + ETH na gas |

**Bez USDC/cbBTC/ETH nelze seedovat.** Ankr ani jiný protokol nevyřeší nedostatek těchto tokenů.

---

## 4. Zbývající úkoly

| # | Úkol | Priorita | Závislost |
|---|------|----------|-----------|
| 1 | Rozhodnout ETH budget pro seed | HIGH | Peníze |
| 2 | Spálit starou LP pozici #4901417 | HIGH | ETH na gas |
| 3 | Seednout wZION/WETH pool | HIGH | ETH + rozhodnutí |
| 4 | E2E swap test | HIGH | Pool s likviditou |
| 5 | Aktivovat ZIONStaking (20M wZION) | MEDIUM | Pool seed |
| 6 | Aktivovat ZIONFarm (10M wZION) | MEDIUM | Pool seed |
| 7 | Redeploy ZIONBridge bez DAILY_LIMIT | LOW | Budoucí velké mints |
| 8 | 7th lock (100 wZION) | LOW | 5th validator conf |
| 9 | Přidat wZION/USDC pool | LOW | USDC |
| 10 | Přidat wZION/cbBTC pool | LOW | cbBTC |

---

## 5. Kontrakty a adresy

| Kontrakt | Adresa |
|----------|--------|
| wZION (ERC-20) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| ZIONBridge | `0x89504D6eD6993d726438E1A9C18aaC79e8d0eF88` |
| UniV3 Pool wZION/WETH | `0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB` |
| UniV3 Factory | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` |
| NonfungiblePositionManager | `0x03a520b32C04BF3bEef7BEb72E919cf822Ed34f1` |
| SwapRouter | `0x2626664c2603336E57B271c5C0b26F421741e481` |
| WETH | `0x4200000000000000000000000000000000000006` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| cbBTC | `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf` |

---

## 6. Poznámky

- `LIQUIDITY_PLAN.md` obsahuje chybnou NonfungiblePositionManager adresu (`...f8` místo `...f1`).
- `wZION_PLAN.md` je živý dokument — aktualizovat po každém kroku.
- `StatusV3.md` obsahuje detailní chronologii emergency mintu.
