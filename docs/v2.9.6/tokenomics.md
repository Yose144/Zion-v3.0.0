# 💰 Tokenomics v2.9.6 — Návrhy emission schedule pro 100letou vizi

> *Hledáme zlatý střed: dost prostředků na L5 Free World + L6 ZION Issobella,
> a přitom zachovat hodnotu ZION pro minery a holdery.*

---

## Současný stav (v2.9.5)

| Parametr | Hodnota | Problém |
|----------|---------|---------|
| Total Supply | 144,000,000,000 ZION | ✅ OK |
| Block Reward | 5,400.067 ZION (konstantní) | ⚠️ 45 let je krátké pro 100letý plán |
| Mining Duration | 45 let (2026–2071) | ⚠️ Po 2071 žádná emise |
| Halving | ❌ Žádný | ⚠️ Chybí mechanismus dlouhodobé vzácnosti |
| Fee Policy | 🔥 Burn | ✅ Deflationary |
| Tithe | 10% humanitární | ✅ Financuje L5/L6 |

### Proč potřebujeme změnu?

1. **45 let nestačí** — Pro vizi L5 (2030) a L6 (2040+) potřebujeme emisi minimálně 100 let
2. **Financování vrstev** — L5 Free World a L6 ZION Issobella vyžadují průběžné prostředky
3. **Incentivizace minerů** — Po roce 2071 by neexistoval důvod těžit (jen fees)
4. **Vzácnost** — Konstantní emise nevytváří pocit rostoucí vzácnosti

---

## 🔒 Co se NEMĚNÍ (neměnné protokolové konstanty)

| Parametr | Hodnota | Důvod |
|----------|---------|-------|
| **Total Supply** | 144,000,000,000 ZION | Základní sociální kontrakt |
| **Genesis Premine** | 16,780,000,000 ZION (11.65%) | Již vytvořeno v genesis bloku |
| **Block Time** | 60 sekund | Konsenzuální parametr |
| **Fee Burn** | 100% fees spalováno | Deflační mechanismus |
| **Tithe** | 10% block reward | Humanitární závazek |
| **Premine alokace** | Oasis 4.95B, L5 3.3B, DAO 4B, Infra 2.59B, Human 1.44B | Již distribuováno |

---

## 📊 Návrh A: "Decade Decay" — Lite Halving -20% / 10 let

> *Konzervativní, předvídatelný, inspirovaný přírodním rozkladem*

### Princip
Každých 10 let (5,256,000 bloků) se block reward sníží o 20%. Po dekádě 10 začíná **tail emission** — minimální věčný reward.

### Schedule

| Dekáda | Roky | Block Reward | % originálu | Emise za dekádu |
|--------|------|-------------|-------------|-----------------|
| 1 | 2026–2036 | 5,400 ZION | 100% | ~28.38B |
| 2 | 2036–2046 | 4,320 ZION | 80% | ~22.71B |
| 3 | 2046–2056 | 3,456 ZION | 64% | ~18.16B |
| 4 | 2056–2066 | 2,765 ZION | 51.2% | ~14.53B |
| 5 | 2066–2076 | 2,212 ZION | 41.0% | ~11.63B |
| 6 | 2076–2086 | 1,769 ZION | 32.8% | ~9.30B |
| 7 | 2086–2096 | 1,416 ZION | 26.2% | ~7.44B |
| 8 | 2096–2106 | 1,133 ZION | 21.0% | ~5.95B |
| 9 | 2106–2116 | 906 ZION | 16.8% | ~4.76B |
| 10+ | 2116+ | 725 ZION | 13.4% | ∞ tail emission |

### Celková emise

```
100 let:  ~122.86B ZION (z 127.22B max mining supply)
Zbývá:    ~4.86B ZION v tail emission bufferu
+ Fee burn: přirozená deflace eliminuje rozdíl
```

### Humanitární desátek z Lite Halvingu

| Dekáda | Tithe/block | Tithe za dekádu | Kumulativní |
|--------|-------------|-----------------|-------------|
| 1 | 540 ZION | ~2.84B | 2.84B |
| 2 | 432 ZION | ~2.27B | 5.11B |
| 3 | 346 ZION | ~1.82B | 6.93B |
| 4 | 277 ZION | ~1.45B | 8.38B |
| 5 | 221 ZION | ~1.16B | 9.54B |

**Za 50 let: ~9.54B ZION pro humanitární projekty (L5 + L6)**

### ✅ Výhody
- Velmi předvídatelný — komunita ví přesně co čekat
- -20% je měkký náraz (vs BTC -50%)
- Tail emission zajistí věčnou motivaci minerů
- 100 let emise pokrývá celou vizi "On the Star"

### ⚠️ Nevýhody
- Pomalejší nárůst vzácnosti než u BTC
- V dekádě 1 možná příliš vysoká emise (inflační tlak)
- Méně "event driven" — halvings nevytvářejí mediální buzz

---

## 📊 Návrh B: "Golden Ratio Decay" — -25% / 8 let

> *Agresivnější, inspirovaný zlatým řezem a Fibonacciho sekvencí*

### Princip
Každých 8 let (4,204,800 bloků) se block reward sníží o 25%. Rychlejší vzácnost, ale stále mnohem měkčí než BTC.

### Schedule

| Epoch | Roky | Block Reward | % originálu | Emise za epoch |
|-------|------|-------------|-------------|----------------|
| 1 | 2026–2034 | 5,400 ZION | 100% | ~22.71B |
| 2 | 2034–2042 | 4,050 ZION | 75% | ~17.03B |
| 3 | 2042–2050 | 3,038 ZION | 56.3% | ~12.77B |
| 4 | 2050–2058 | 2,278 ZION | 42.2% | ~9.58B |
| 5 | 2058–2066 | 1,709 ZION | 31.6% | ~7.19B |
| 6 | 2066–2074 | 1,282 ZION | 23.7% | ~5.39B |
| 7 | 2074–2082 | 961 ZION | 17.8% | ~4.04B |
| 8 | 2082–2090 | 721 ZION | 13.4% | ~3.03B |
| 9 | 2090–2098 | 541 ZION | 10.0% | ~2.27B |
| 10 | 2098–2106 | 405 ZION | 7.5% | ~1.70B |
| 11 | 2106–2114 | 304 ZION | 5.6% | ~1.28B |
| 12+ | 2114+ | 228 ZION | 4.2% | ∞ tail emission |

### Celková emise

```
88 let:   ~86.99B ZION
100 let:  ~88.27B ZION
Zbývá:    ~39.45B "nikdy nevytěženo" → maximální deflační efekt
```

### ✅ Výhody
- Rychlejší vzácnost → potenciálně vyšší hodnotový růst
- 8-letý cyklus může korelovat s ekonomickými cykly
- "Golden Ratio" je silný brand (φ = 1.618...)
- Více "halving events" → více mediální pozornosti

### ⚠️ Nevýhody
- Mining supply nikdy plně využito (~39B ZION "zmrazeno")
- Rychlejší pokles motivace minerů
- V pozdních epochách velmi nízký reward

---

## 📊 Návrh C: "Century Constant + Tail" — Prodloužená konstantní emise

> *Nejjednodušší: prostě roztáhnout současný model na 100 let*

### Princip
Zachovat konstantní block reward, ale snížit ho tak, aby emise trvala 100 let místo 45. Po 100 letech začne tail emission.

### Výpočet

```
Mining Supply: 127,220,000,000 ZION
Bloky za 100 let: 52,560,000
Nový block reward: 127,220,000,000 / 52,560,000 = 2,430.021 ZION/block
```

### Schedule

| Období | Roky | Block Reward | Emise |
|--------|------|-------------|-------|
| Konstantní | 2026–2126 | 2,430 ZION | 127.22B |
| Tail | 2126+ | 243 ZION (10%) | ∞ |

### ✅ Výhody
- Maximální jednoduchost (nejmenší změna kódu)
- Plně předvídatelná emise
- 100% mining supply se vytěží

### ⚠️ Nevýhody
- **Nižší počáteční reward** (2,430 vs 5,400) → méně atraktivní pro early minery
- Žádný "halving event" → žádný mediální buzz
- Žádný pocit rostoucí vzácnosti
- **Bootstrap problém** — v prvních letech chceme nejvíc minerů

---

## 📊 Návrh D: "Dual Phase" — Vysoký start + postupný pokles

> *Kompromis: silný bootstrap + dlouhodobá udržitelnost*

### Princip
Dvě fáze: 10 let vysokého rewardu (bootstrap), pak postupný pokles. Nejlepší z obou světů.

### Schedule

| Fáze | Roky | Block Reward | Emise | Účel |
|------|------|-------------|-------|------|
| **Bootstrap** | 2026–2036 | 5,400 ZION | ~28.38B | Přitáhnout minery, vybudovat síť |
| **Decay 1** | 2036–2046 | 3,780 ZION (-30%) | ~19.87B | L5 Free World launch |
| **Decay 2** | 2046–2056 | 2,646 ZION (-30%) | ~13.91B | L6 start |
| **Decay 3** | 2056–2066 | 1,852 ZION (-30%) | ~9.74B | Mature network |
| **Decay 4** | 2066–2076 | 1,297 ZION (-30%) | ~6.81B | 50 let jubileum |
| **Decay 5** | 2076–2086 | 908 ZION (-30%) | ~4.77B | |
| **Decay 6** | 2086–2096 | 635 ZION (-30%) | ~3.34B | |
| **Decay 7** | 2096–2106 | 445 ZION (-30%) | ~2.34B | |
| **Decay 8** | 2106–2116 | 311 ZION (-30%) | ~1.64B | |
| **Tail** | 2116+ | 311 ZION (věčný) | ∞ | Tail emission |

### Celková emise

```
90 let:   ~90.80B ZION
100 let:  ~92.44B ZION
Tail:     311 ZION/block navždy
Fee burn: kompenzuje "nevytěženou" supply
```

### ✅ Výhody
- **Silný bootstrap** — prvních 10 let plný reward (5,400)
- -30% je výrazný ale ne brutální
- Tail emission je dostatečně vysoká (311 ZION)
- Dobře financuje L5 (2030+) i L6 (2040+)

### ⚠️ Nevýhody
- -30% je strmější pokles než Návrh A
- Mining supply nebude plně využito

---

## 📊 Návrh E: "Harmony Curve" — Logaritmická křivka

> *Matematicky elegantní: plynulý pokles bez skoků*

### Princip
Místo diskrétních halvingů používáme **logaritmickou křivku** — reward plynule klesá s každým blokem. Žádné skoky, žádné šoky.

### Vzorec

```
reward(height) = BASE_REWARD × (1 - ln(height) / ln(MAX_BLOCKS))

Kde:
  BASE_REWARD = 5,400 ZION
  MAX_BLOCKS = 52,560,000 (100 let)
```

### Přibližné hodnoty

| Rok | Block Height | Block Reward | % originálu |
|-----|-------------|-------------|-------------|
| 2026 | 1 | 5,400 ZION | 100% |
| 2030 | 2,102,400 | 4,850 ZION | ~90% |
| 2036 | 5,256,000 | 4,400 ZION | ~81% |
| 2046 | 10,512,000 | 3,900 ZION | ~72% |
| 2056 | 15,768,000 | 3,500 ZION | ~65% |
| 2066 | 21,024,000 | 3,100 ZION | ~57% |
| 2076 | 26,280,000 | 2,800 ZION | ~52% |
| 2096 | 36,792,000 | 2,200 ZION | ~41% |
| 2126 | 52,560,000 | 1,000 ZION | ~19% |
| 2126+ | > 52,560,000 | 1,000 ZION | tail |

### ✅ Výhody
- Matematicky krásné — žádné "halving skoky"
- Velmi postupný pokles → minimální šok pro minery
- Reward nikdy nespadne dramaticky
- Inspirováno přírodními procesy (logaritmický rozpad)

### ⚠️ Nevýhody
- Složitější implementace
- Těžší komunikace komunitě ("kdy je halving?" → "nikdy, klesá plynule")
- Méně mediálně atraktivní
- Potenciálně neférové — velká část supply těžena v prvních dekádách

---

## Srovnávací tabulka

| Parametr | A: Decade | B: Golden | C: Century | D: Dual | E: Harmony |
|----------|:---------:|:---------:|:----------:|:-------:|:----------:|
| **Interval** | 10 let | 8 let | — | 10 let | plynulý |
| **Redukce** | -20% | -25% | 0% | -30% | logaritmická |
| **Počáteční reward** | 5,400 | 5,400 | 2,430 | 5,400 | 5,400 |
| **Reward v 2076** | 2,212 | 1,282 | 2,430 | 1,297 | 2,800 |
| **Tail emission** | 725 | 228 | 243 | 311 | 1,000 |
| **Emise / 100 let** | ~123B | ~88B | 127.7B | ~92B | ~110B |
| **Jednoduchost** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Bootstrap** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Udržitelnost** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Média/Buzz** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐⭐ |
| **L5/L6 funding** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 💰 Financování vrstev — kde vzít prostředky?

### Existující zdroje (z genesis)

| Fond | Částka | Primární účel |
|------|--------|---------------|
| ZION Oasis + Golden Egg/Xp | 4.95B | L4 Oasis ekosystém (3 slots) |
| L5 Free World Projects | 3.3B | L5 Free World Projects (Slots 4 & 5 repurposed) |
| DAO Treasury | 4.0B | Governance, granty, vývoj |
| Infrastructure | 2.59B | Servery, nody, audity |
| Humanitarian | 1.44B | Humanitární programy |

### Průběžné zdroje

| Zdroj | Mechanismus | Odhad (10 let) |
|-------|-------------|----------------|
| **Humanitarian Tithe** | 10% z každého block reward | ~2.84B ZION |
| **Fee Burn** | 100% fees spalováno → deflace | Závisí na aktivitě |
| **DAO Granty** | Hlasování komunity z Treasury | Až 4B k dispozici |

### Nové zdroje (návrhy pro v2.9.6)

| Návrh | Mechanismus | Dopad |
|-------|-------------|-------|
| **L5/L6 Fond** | 2–5% block reward vyhrazeno | Dedikovaný zdroj pro vesmírný program |
| **Oasis Revenue Share** | % z L4 ekonomické aktivity | Variabilní, roste s adopcí |
| **Research NFTs** | Speciální NFT kolekce financující výzkum | Jednorázové, community-driven |
| **Quantum Energy Revenue** | Prodej energie z L5 kvantového motoru | Od ~2035, potenciálně obrovský |
| **Space Partners** | Spolupráce s ESA, SpaceX, atd. | Sdílené náklady |

---

## Dopady na distribuci block reward

### Současný model (v2.9.5)

```
Block Reward: 5,400.067 ZION
├── 89% → Miner:        4,806.060 ZION
├── 10% → Humanitarian:   540.007 ZION
└──  1% → Pool Fee:        54.001 ZION
```

### Navrhovaný model A: Přidání L5/L6 fondu (3%) — ZAMÍTNUTO

> ⛔ Nahrazeno zvoleným modelem 5% humanitarian + 5% L5/L6

### ✅ Zvolený model: 5% Humanitarian + 5% L5/L6 Issobella

```
Block Reward: 5,400.067 ZION (Dekáda 1)
├── 89% → Miner:            4,806.060 ZION
├──  5% → Humanitarian:       270.003 ZION
├──  5% → L5/L6 Issobella Fund: 270.003 ZION
└──  1% → Pool Fee:            54.001 ZION
```

**Dopad:** Miner reward beze změny (89%), humanitární fond se rozdělil 50/50
s L5/L6 Issobella fundem. Doplněno o off-chain výdělky ze ZION Oasis (L4).

**L5/L6 Issobella Fund získá:**
- Za 10 let: ~1.42B ZION (z coinbase)
- Za 50 let: ~5.2B ZION (z coinbase)
- Za 100 let: ~7.0B ZION (z coinbase + tail)
- Plus: variabilní příjem ze ZION Oasis (Golden Egg, NFT, Games)

### Předchozí model B: Vyšší L5/L6 (5%) — ZAMÍTNUTO

```
Block Reward: 5,400.067 ZION
├── 84% → Miner:        4,536.056 ZION
├── 10% → Humanitarian:   540.007 ZION
├──  5% → L5/L6 Fund:     270.003 ZION
└──  1% → Pool Fee:        54.001 ZION
```

**Dopad:** Miner dostane o 270 ZION méně, ale L5/L6 fond získá:
- Za 10 let: ~1.42B ZION
- Za 50 let: ~5.2B ZION
- Za 100 let: ~7.0B ZION (s Decade Decay)

### Předchozí model C: Zachovat miner reward, rozdělit tithe — ✅ TOTO BYLO ZVOLENO

> Viz "Zvolený model" výše — implementováno s 5% humanitarian + 5% L5/L6 Issobella.

---

## 🎯 Zvolený model: A (Decade Decay) + 5/5 distribuce

> ✅ **SCHVÁLENO — implementováno v `core/src/blockchain/reward.rs`**

### Proč Model A?

1. **Decade Decay (-20% / 10 let):**
   - Nejpředvídatelnější a nejférovější
   - 100 let emise přesně pokrývá celou vizi
   - Tail emission zajistí motivaci minerů navždy
   - -20% je dostatečně měkký náraz

2. **5% Humanitarian + 5% L5/L6 Issobella Fund:**
   - Miner share zachován na 89% (žádný dopad na minery!)
   - Humanitární tithe snížen z 10% na 5% — uvolněno pro Issobella
   - 5% dedikovaný fond pro L5 Free World + L6 ZION Issobella
   - Doplněno o výdělky ze ZION Oasis (L4) — off-chain revenue share

3. **ZION Oasis (L4) revenue:**
   - Dodatečný příjem z ekonomické aktivity L4
   - Golden Egg, Winners, NFT, Game layer → % směřuje do L5/L6
   - Off-chain mechanismus — neovlivňuje coinbase

### Finální parametry (implementované)

| Parametr | v2.9.5 | v2.9.6 ✅ |
|----------|--------|----------|
| Halving | ❌ Ne | ✅ Decade Decay (-20% / 10 let) |
| Mining Duration | 45 let | **100 let + tail emission** |
| Miner Share | 89% | **89%** (zachováno!) |
| Humanitarian | 10% | **5%** |
| L5/L6 Issobella Fund | — | **5%** |
| Pool Fee | 1% | 1% |
| Tail Emission | — | **724.785 ZION/block (od 2126)** |
| Oasis Revenue | — | **off-chain → L5/L6** |

---

## ⚡ Hard Fork implementace — ✅ HOTOVO

### Co bylo implementováno (v2.9.6):

1. **`core/src/blockchain/reward.rs`** — ✅ Decade Decay s `calculate()`, tail emission, 5/5/89/1 distribuce
2. **`pool/src/blockchain/reward_calculator.rs`** — ✅ `calculate_block_reward_at_height()` + Issobella fund
3. **`pool/src/shares/processor.rs`** — ✅ 4-way fee split (miner/humanitarian/issobella/pool)
4. **`pool/src/main.rs`** — ✅ API pool info s Issobella fund percentage

### Co NEVYŽADUJE hard fork?

- Fee burn model (beze změny)
- UTXO model (beze změny)
- P2P protokol (beze změny)
- Cosmic Harmony v3 (beze změny)
- Genesis premine (neměnný)

---

## Governance proces

Finální tokenomics bude vybrána v tomto procesu:

1. **📋 Návrhy** — tento dokument (5 variant)
2. **💬 Diskuze** — komunita na DAO fóru
3. **🗳️ Hlasování** — DAO governance vote
4. **⚙️ Implementace** — hard fork kód
5. **🧪 TestNet** — testování na testnet
6. **🚀 Aktivace** — mainnet fork na dohodnuté výšce

---

*"Zlatý střed mezi ambicí a realismem — stavíme na 100 let, ne na hype cyklus."* 💰
