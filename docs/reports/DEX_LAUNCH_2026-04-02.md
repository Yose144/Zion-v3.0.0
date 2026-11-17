# ZION DEX Launch — 2. dubna 2026

> **Historický den: wZION je obchodovatelný na Uniswap V3 (Base Mainnet).**

---

## Co se stalo

ZION L1 chain → Base L2 bridge → Uniswap V3 DEX. Celý DeFi stack je živý.

### Časový průběh

1. **Bridge relay** — 100 wZION přijato na adresu `0xdde175...` přes ZION→Base bridge
2. **Pool deploy** — Uniswap V3 pool vytvořen a inicializován na Base Mainnet
3. **Seed liquidity** — 50 wZION + 0.0005 WETH vloženo jako full-range LP pozice
4. **Swap enabled** — wZION je swapovatelný na app.uniswap.org

### Oprava PM adresy

Při seedování liquidity jsme zjistili, že NonfungiblePositionManager adresa
`0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f5` neexistuje na Base (EOA).
Správná adresa z Uniswap docs: `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1`
(poslední znak `1` ne `5`). Opraveno v `dex-config.ts`.

---

## Klíčové adresy (Base Mainnet, chain 8453)

| Kontrakt | Adresa |
|---|---|
| wZION (ERC-20) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| ZIONBridge | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` |
| Uniswap V3 Pool (wZION/WETH 0.3%) | `0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB` |
| LP NFT #4901417 | vlastník: `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` |

## Parametry poolu

| Parametr | Hodnota |
|---|---|
| Fee tier | 3000 (0.3%) |
| Cena | 1 ZION = 0.00001 ETH (~$0.035) |
| Tick | -115136 |
| Likvidita | 158113883008418966 |
| Tick range | [-887220, 887220] (full-range) |
| token0 | wZION |
| token1 | WETH |

## Transakce

| Akce | TX Hash |
|---|---|
| createPool | `0x2c0989140ed83f50e56ae33710af2fba9b5b5a1f09e5e5e7a8e2625886574e74` |
| initialize | `0xb26f06797f1abf64910b3ae5a8a7901ba73a8d233fe2ecfdc5594fbdefa5ffc2` |
| wZION approve | `0xf25e6aa0c003af52bfcdef0e0acdc7f906f697629dd71f6bc0647d066e379c6e` |
| WETH approve | `0x7f369a3fda87d7040012859856b465c9380d60e94d5f6cd28bfd8fa05f0886a9` |
| mint LP | `0xb0845bd0f6e94e0ca09a00f117e155e6099876820358322623585bb96b19e130` |

---

## Jak swapovat wZION (návod pro uživatele)

### Předpoklady

- MetaMask (nebo jiná peněženka) s Base sítí
- ETH na Base pro gas (~$0.01 za swap)

### Kroky

1. Otevři [app.uniswap.org](https://app.uniswap.org)
2. Přepni síť na **Base**
3. V poli "Select a token" vlož adresu: `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6`
4. Uniswap ukáže warning "This token isn't traded on leading..." → klikni **"I understand"**
5. Zadej množství ETH → uvidíš kolik wZION dostaneš
6. Klikni **Swap** → potvrď v MetaMask
7. Hotovo! wZION je ve tvé peněžence

### Jak přidat wZION do MetaMask

1. Otevři MetaMask → síť **Base**
2. Import Tokens → Custom Token
3. Token Contract: `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6`
4. Symbol: `wZION`, Decimals: `18`
5. Add Custom Token

### Jak získat wZION přes bridge (z L1)

1. Vlastní ZION coiny na L1 chainu
2. Pošli ZION na bridge vault adresu na L1
3. Relayer automaticky mintne wZION na Base
4. wZION se objeví v MetaMask na Base síti

---

## Pool na BaseScan

- Pool: [basescan.org/address/0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB](https://basescan.org/address/0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB)
- wZION: [basescan.org/token/0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6](https://basescan.org/token/0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6)

---

## Aktuální stav likvidity a co to znamená

Pool byl nasazen s minimálním seedem: **50 wZION + 0.0005 WETH** (~$3.50 celkem).
Toto je **technický proof-of-concept**, ne obchodní pool.

### Proč nemůžu swapnout velké množství?

Uniswap V3 je AMM (Automated Market Maker) — cena se počítá z poměru tokenů v poolu.
Při nízké likviditě má každý swap obrovský **price impact**:

| Swap | Price impact | Dostaneš |
|---|---|---|
| 1 wZION → ETH | ~2% | ~férovou cenu |
| 10 wZION → ETH | ~20% | výrazně méně |
| 1 000 wZION → ETH | ~99% | skoro nic |

### Kolik likvidity je potřeba pro reálné obchodování?

Při ceně 1 ZION = 0.00001 ETH (~$0.035):

| Úroveň | wZION v poolu | ETH v poolu | Celková hodnota |
|---|---|---|---|
| **Teď** (seed) | 50 | 0.0005 | ~$3.50 |
| Malý test | 10 000 | 0.1 | ~$350 |
| Funkční pool | 100 000 | 1 | ~$3 500 |
| Slušný pool | 1 000 000 | 10 | ~$35 000 |

### Jak přidat likviditu?

1. Poslat ETH na deployer adresu (`0xdde175...`) na Base
2. Bridgnout ZION z L1 premine peněženky → wZION na Base
3. Wrap ETH → WETH
4. Spustit `seed-liquidity.ts` s většími částkami (nebo přidat přes Uniswap UI)

### Právní poznámka

- Uniswap je **permissionless** — kdokoliv může vytvořit pool, žádné povolení není třeba
- "Impersonator token" warning je normální u nových tokenů — zmizí po registraci na token listu
- Pool s $3 likvidity je **technický milestone**, ne finanční produkt
- Pro reálné obchodování je třeba: více likvidity, token list registrace, a audit

---

## Co dál

- [ ] Přidat více likvidity (větší ETH páření)
- [ ] Registrovat wZION na tokenlists.org (odstranit impersonator warning)
- [ ] Nasadit price oracle monitoring
- [ ] Burn→Unlock zpětný bridge (wZION → ZION L1)
- [ ] CoinGecko / CMC listing request

---

*"Z nuly na DEX za jeden den. ZION žije."* 🔥
