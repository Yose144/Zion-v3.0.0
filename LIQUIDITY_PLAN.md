# ZION — Real Liquidity Plan

> **Datum:** 2026-06-24 (aktualizováno)
> **Status:** Cena potvrzena — **$0.00002 / ZION**. sqrtPriceX96 + tick parametry vypočítány a nastaveny ve všech systémech.
> **Cíl:** Seed likvidita na Uniswap V3, staking pool, DAO treasury aktivace, plná DeFi roadmapa

---

## ⚡ TL;DR — Kolik ETH potřebuješ

> Referenční kurz: **ETH = $1 656** (2026-06-24) · Seed cena: **$0.00002 / ZION** · 1 ETH = 82,8M wZION

| Scénář | wZION do poolu | ETH CELKEM | USD celkem | TVL |
|--------|---------------|-----------|------------|-----|
| Minimum | 20M | **0.30 ETH** | ~$495 | ~$800 |
| Konzervativní | 30M | **0.41 ETH** | ~$685 | ~$1 200 |
| ✅ **Doporučeno** | **60M** | **≈ 0.80 ETH** | **~$1 300** | **~$2 400** |
| Agresivní | 80M | **≈ 1.02 ETH** | ~$1 700 | ~$3 200 |
| Vše | 100M | **≈ 1.26 ETH** | ~$2 085 | ~$4 000 |

> **Číslo které si zapamatuj:** Připrav si **≥ 0.80 ETH** (~$1 300) na deployer peněžence
> `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186`. To pokryje 60M wZION do full-range poolu
> + gas na všechny operace + top-up 5 validátorů.
>
> Pokud máš méně ETH — použij **concentrated tick range** (`-182940 → -181740`):
> z 0.41 ETH (30M wZION) dostaneš pool hluboký ~5× víc než za stejné ETH v full-range.

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
| Fee tier | 0.3% (3000) | Standard pro volatile pairs |
| **Počáteční cena** | **$0.00002 / ZION** | ✅ POTVRZENO — FDV ~$2,9M |
| token0 / token1 | wZION (token0) / WETH (token1) | wZION addr < WETH addr |
| **sqrtPriceX96** | **`8706917217488994866036736`** | `sqrt(1.2077e-8) × 2^96` |
| **Tick seed** | **`-182328`** | `floor(log(1.2077e-8) / log(1.0001))` |
| Tick spacing | 60 | Pro 0.3% pool |
| Tick range (full) | `-887220` → `887220` | Maximální likvidita pro seed |
| Tick range (conc.) | `-182940` → `-181740` | ±600 ticků ≈ ±6% kolem seed ceny |
| Seed wZION | 20,000,000 – 30,000,000 wZION | Doporučeno: nespotřebuj vše najednou |
| Seed ETH | ~0.24–0.36 ETH (@ $0.00002 seed) | ETH strana = úzké hrdlo hloubky |

### 2B. Doporučení počáteční ceny

Toto je zásadní rozhodnutí — nastavit příliš nízko = nedoceněno, příliš vysoko = nenakoupí nikdo.

> **Pozn.:** Dřívější verze počítala s ETH = $2 500. Aktuální kurz (2026-06-23) je **ETH = $1 656**;
> všechny přepočty níže ho zohledňují.

#### Srovnání s trhem (live, 2026-06-23)

| Coin | Cena | Market cap | Supply | Poznámka |
|------|------|-----------|--------|----------|
| Monero (XMR) | $317.36 | $5.95B | 18.8M | PoW etalon, nízká supply |
| Litecoin | $42.03 | $3.25B | 77M | — |
| Kaspa (KAS) | $0.0286 | $787M | ~27.5B | **nejlepší srovnání — vysoká supply** |
| Zano | $9.82 | $151M | 15M | privacy PoW |
| Ergo | $0.2205 | $18.4M | 83M | fair-launch PoW |
| Zephyr | $0.3649 | $4.57M | 12.5M | malý PoW |
| Dynex | $0.0105 | $1.12M | 107M | mikro-cap |

#### Klíč: FDV vs. reálný float

ZION má **144B max supply** (kategorie Kaspy/Nexy), ale k likviditě je jen **~100M wZION
(0,069 % supply)**; většina premine je v programových/locked peněženkách (4B DAO locked, 8,25B
OASIS, dev/infra). Reálný obchodovatelný float na startu je řádově **~100–200M ZION**, ne 144B.

- **FDV** = cena × 144B → číslo, které ukáže CoinGecko/CMC.
- **Reálný market cap** = cena × skutečný float → realita dne 1.

Cenu nastav tak, aby **FDV vypadalo věrohodně (miliony, ne miliardy)**, jinak to působí jako
nafouknutý projekt.

#### Cenová pásma (podle cílového FDV na 144B max supply)

| Cílové FDV | Cena / ZION | Pozice vs. trh |
|-----------|-------------|----------------|
| $1M | $0.0000069 | pod Dynexem — moc nízko |
| **$2–3M** | **$0.0000139–0.0000208** | **úroveň Zephyr/Dynex — doporučeno** |
| $5M | $0.0000347 | částečně nad Ergem — agresivní |
| $10M+ | $0.0000694+ | nereálné pro den 1 bez historie |

#### ✅ DOPORUČENÍ

**Počáteční cena: `$0.00002 / ZION` (≈ `0.0000000121 ETH`), FDV ≈ $2,9M.**

- Věrohodný mikro-cap vstup mezi Dynex ($1,1M) a Ergo ($18M), na úrovni Zephyr.
- Na reálném floatu (~100–200M) je skutečný day-1 market cap jen ~$2–4k — poctivé pro fair launch.
- Nechává obrovský prostor pro organický růst; nevypadá nafouknutě.

#### Seed poolu — kolik ETH skutečně potřebuješ

> **Klíčový vzorec:** `ETH_potřeba = wZION_v_poolu × (0.00002 / 1656) = wZION × 0.00000001208`
> Neboli: **1 ETH = 82 800 000 wZION** při seed ceně.

##### Tabulka scénářů — likvidita (samotný pool)

| Scénář | wZION do poolu | ETH pro likviditu | Hodnota v USD | TVL celkem |
|--------|---------------|-------------------|---------------|------------|
| Minimum (živý pool) | 20 000 000 | **0.2415 ETH** | ~$400 | ~$800 |
| Konzervativní start | 30 000 000 | **0.3623 ETH** | ~$600 | ~$1 200 |
| Dobrá hloubka | 50 000 000 | **0.6039 ETH** | ~$1 000 | ~$2 000 |
| ✅ Plný pool (doporučeno) | 60 000 000 | **0.7246 ETH** | ~$1 200 | ~$2 400 |
| Agresivní | 80 000 000 | **0.9662 ETH** | ~$1 600 | ~$3 200 |
| Vše do poolu | 100 000 000 | **1.2077 ETH** | ~$2 000 | ~$4 000 |

> **Proč TVL = ~2× ETH?** V Uni V3 full-range dává 1 ETH (strana token1) ~stejnou USD hodnotu
> jako wZION strana token0. TVL = ETH_hodnota + wZION_hodnota ≈ 2 × ETH_hodnota.

##### Tabulka scénářů — KOMPLETNÍ budget (likvidita + plyn + operace)

Operace mimo samotnou likviditu vyžadují ETH na gas Base Mainnet + seed validátorů:

| Položka | ETH | USD |
|---------|-----|-----|
| wZION approve (NonfungiblePositionManager) | ~0.0001 | ~$0.17 |
| UniV3Pool initialize (pokud pool neinicializovaný) | ~0.0002 | ~$0.33 |
| NonfungiblePositionManager.mint (pozice) | ~0.0005 | ~$0.83 |
| ZIONStaking.notifyRewardAmount seed | ~0.0001 | ~$0.17 |
| ZIONFarm seed pool | ~0.0002 | ~$0.33 |
| Validator ETH top-up (5× validátor × 0.01 ETH) | **0.0500** | ~$82.8 |
| **Gas + operace celkem** | **~0.0511 ETH** | **~$85** |

##### ✅ KOMPLETNÍ ETH BUDGET — CO POTŘEBUJEŠ MÍT NA PENĚŽENCE

| Scénář | Likvidita | + Gas/ops | = **CELKEM potřeba** | USD celkem |
|--------|-----------|-----------|----------------------|------------|
| Minimum (20M wZION) | 0.2415 ETH | 0.0511 ETH | **0.30 ETH** | ~$495 |
| Konzervativní (30M) | 0.3623 ETH | 0.0511 ETH | **0.41 ETH** | ~$685 |
| Dobrá hloubka (50M) | 0.6039 ETH | 0.0511 ETH | **0.66 ETH** | ~$1 085 |
| ✅ **Plný pool (60M)** | 0.7246 ETH | 0.0511 ETH | **≈ 0.78 ETH** | ~$1 285 |
| Agresivní (80M) | 0.9662 ETH | 0.0511 ETH | **≈ 1.02 ETH** | ~$1 685 |
| Vše do poolu (100M) | 1.2077 ETH | 0.0511 ETH | **≈ 1.26 ETH** | ~$2 085 |

> **Doporučení pro první launch:**
> Připrav si na peněžence **≥ 0.80 ETH** (~$1 300). Umožní ti plný pool (60M wZION)
> s bezpečnou rezervou na gas a top-up validátorů. Koncentrovaný tick range
> (místo full-range) ti z těchto ETH vytěží ~5–10× hlubší pool kolem seed ceny.

**Praktická pravidla:**
1. **Neseeduj celých 100M najednou.** Do poolu dej **60M wZION**, zbytek (40M) drž pro postupné dolévání.
2. **Kritický minimum:** 0.30 ETH nestačí na nic smysluplného — pool o $800 TVL se slippne při prvním obchodu za $50.
3. Při méně než 0.50 ETH použij **concentrated tick range** (`-182940` → `-181740`) místo full-range — z 0.36 ETH vytěžíš pool hluboký jako za 3 ETH full-range.
4. **Neinzeruj FDV $2,9M jako „market cap"** — kommunikuj reálný circulating market cap (~$2–4k na startu).

> ✅ **Cena potvrzena: $0.00002/ZION** — sqrtPriceX96 a tick parametry vypočítány a zapsány do kódu.
> **Akce:** Zajisti **≥ 0.80 ETH** na deployer peněžence `0xdde17506...` a spusť pool seeding dle sekce 2C.

### 2C. Postup přidání likvidity (po mint)

**Klíčové konstanty (verified 2026-06-24):**

| Konstanta | Hodnota |
|-----------|---------|
| Seed cena | `$0.00002 / ZION` |
| sqrtPriceX96 | `8706917217488994866036736` |
| Seed tick | `-182328` |
| Tick range (full) | `-887220` → `887220` |
| Tick range (concentrated ±6%) | `-182940` → `-181740` |
| Pool fee | `3000` (0.3%) |
| token0 | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` (wZION) |
| token1 | `0x4200000000000000000000000000000000000006` (WETH) |
| NonfungiblePositionManager | `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f8` |

```bash
# 1. Ověřit wZION balance (mělo by být ~100M po timelock executeTimelockedMint)
cast call 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6 \
  "balanceOf(address)(uint256)" 0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186 \
  --rpc-url https://mainnet.base.org

# 2. Ověřit stav poolu (sqrtPriceX96 == 0 → pool ještě neinicializovaný)
cast call 0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB \
  "slot0()(uint160,int24,uint16,uint16,uint16,uint8,bool)" \
  --rpc-url https://mainnet.base.org

# 3. Approve wZION pro NonfungiblePositionManager (~25M wZION seed)
cast send 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6 \
  "approve(address,uint256)(bool)" \
  0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f8 \
  25000000000000000000000000 \
  --private-key $VALIDATOR_KEY \
  --rpc-url https://mainnet.base.org

# 4. Mint pozice s full-range tick bounds (@$0.00002 seed price)
#    amount0Desired = 25_000_000 wZION (25M × 1e18)
#    amount1Desired = ~302_000_000_000_000_000 WETH (0.302 ETH @ $0.00002)
#    sqrtPriceX96 a ticky jsou vypočítané výše
cast send 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f8 \
  "mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))(uint256,uint128,uint256,uint256)" \
  "(0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6,0x4200000000000000000000000000000000000006,3000,-887220,887220,25000000000000000000000000,302000000000000000,0,0,0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186,$(date -d '+30 min' +%s))" \
  --value 302000000000000000 \
  --private-key $VALIDATOR_KEY \
  --rpc-url https://mainnet.base.org
```

> **Doporučení:** Pro větší bezpečnost použij [Uniswap V3 web UI](https://app.uniswap.org) nebo
> připravený Next.js script (`V3/scripts/seed-liquidity.ts`). Vždy ověř transakci na Base Scan
> před finálním potvrzením.

### 2D. Rozdělení 100M wZION

> **Pozn.:** Tabulka níže je *max alokace* na DeFi. Pro **počáteční seed** UniV3 poolu doporučujeme
> dle sekce 2B nasadit jen **20–30M wZION** a zbytek z LP alokace dolévat postupně podle hloubky
> ETH a cenové objevitelnosti (ne celých 60M najednou).

| Použití | Množství | % |
|---------|----------|---|
| UniV3Pool LP (seed 20–30M + postupné dolévání) | 60,000,000 wZION | 60% |
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
Při ceně ETH $1 656 (2026-06-24) = $83 USD — zanedbatelná částka pro bezpečný provoz
Tento gas budget je zahrnut v kompletním ETH budget (sekce 2B výše).
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
