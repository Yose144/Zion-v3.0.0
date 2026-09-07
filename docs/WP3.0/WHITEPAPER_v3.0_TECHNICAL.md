# ZION TerraNova — Technical Whitepaper v3.0
## Decentralizovaná síť s vědomostní těžbou a distribuovanou AI vrstvou

**Verze:** 3.0 — MainNet Genesis  
**Datum:** 2026  
**Autoři:** ZION CoZ s.r.o., Praha, Česká republika  
**Licence kódu:** MIT  
**Repozitář:** https://github.com/Yose144/Zion-2.9  

**Readiness addendum (2026-03-03):** 168h stability PASS; před MainNet launch zůstává otevřená CHv4 production upgrade gate, revenue production activation gate a genesis/freeze sign-off gate (viz `docs/2.9.7/MAINNET_READINESS_UNIFIED.md`).

---

> *"Nestavíme banku. Stavíme most."*

---

## Obsah

1. [Abstrakt](#1-abstrakt)
2. [Motivace a cíle](#2-motivace-a-cíle)
3. [Architektura L1 — základní vrstva](#3-architektura-l1--základní-vrstva)
4. [Konsensus: CosmicHarmony v3](#4-konsensus-cosmicharmony-v3)
5. [Ekonomický model](#5-ekonomický-model)
6. [Vědomostní těžba (Consciousness Mining)](#6-vědomostní-těžba-consciousness-mining)
7. [Fair Launch](#7-fair-launch)
8. [DAO Governance](#8-dao-governance)
9. [Humanitární fond + L5/L6 alokace](#9-humanitární-fond--l5l6-alokace)
10. [L2 — wZION Bridge + DAO](#10-l2--wzion-bridge--dao)
11. [L3 — NCL + WARP + AI-native](#11-l3--ncl--warp--ai-native)
12. [L4 — ZION OASIS Game World](#12-l4--zion-oasis-game-world)
13. [L5 — ZION Free World](#13-l5--zion-free-world)
14. [L6 — ZION Issobella](#14-l6--zion-issobella)
15. [Bezpečnost a kryptografické primitiva](#15-bezpečnost-a-kryptografické-primitiva)
16. [Roadmap](#16-roadmap)
17. [Právní disclaimer](#17-právní-disclaimer)
18. [Reference](#18-reference)

---

## 1. Abstrakt

ZION TerraNova je vrstvená blockchain síť s důkazem práce (Proof-of-Work), navržená s třemi základními principy: **spravedlivé spuštění** bez venture capital ani ICO, **vědomostní těžba** jako gamifikační vrstva odměňující dlouhodobou angažovanost a **protokolová redistribuce odměn** (5 % humanitární fond + 5 % L5/L6 Issobella fund) embedded přímo do každého nalezeného bloku.

Síť je implementována v jazyce **Rust** na vrstvách L1–L4:

| Vrstva | Název | Technologie | Target |
|--------|-------|-------------|--------|
| L1 | Core blockchain | Rust, LMDB, Tokio, Axum | ✅ TestNet live |
| L2 | wZION Bridge + DAO | Solidity, ERC-20, Rust Axum | ✅ Base Sepolia live |
| L3 | NCL + WARP + AI-native | Rust, ONNX/CoreML/TensorRT | ⏳ Implementace |
| L4 | OASIS Game World | Rust, Axum, SQLite, UE5 | 📅 2029 |
| L5 | Free World | DAO-funded, real-world | 📅 2030 |
| L6 | ZION Issobella | Orbital station | 📅 2040+ |

**Klíčové parametry MainNet:**

| Parametr | Hodnota |
|----------|---------|
| Base supply target | 144 000 000 000 ZION (144 miliard) |
| Block reward (dekáda 1) | 5 400,067 ZION |
| Decay schedule | Decade Decay −20 % / 10 let (viz §5.4) |
| Tail emission | 724,785 ZION/blok od roku 2126 (navěky) |
| Block time | 60 sekund |
| Mining horizon | 100+ let + tail emission |
| Premine | 16 780 000 000 ZION (11,65 %) |
| Nejmenší jednotka | 1 ZION = 1 000 000 000 000 flower (12 des. míst) |
| Konsensus | CosmicHarmony v3 (paměťově náročný PoW) |
| Algoritmus DAA | LWMA, okno 60 bloků, max. ±25 % |
| Distribuce bloku | 89 % miners / 5 % humanitarian / 5 % L5–L6 / 1 % pool |

---

## 2. Motivace a cíle

### 2.1 Problém

Moderní kryptoměnový ekosystém trpí třemi systémovými vadami:

1. **Centralizace těžby** — SHA-256 a Ethash jsou dominovány průmyslovými ASIC operátory; individuální těžaři jsou vytlačeni z trhu.
2. **Nerovnoměrné podmínky spouštění** — Převažující model ICO/presale umožňuje insiderům a VC fondům nakoupit tokeny za výrazně nižší ceny než veřejnost. Ethereum alokoval ~17 % pre-genesis insiderům, Solana ~48 % VC fondům.
3. **Technologie bez hodnot** — Téměř žádná blockchain síť nemá zabudovaný mechanismus pro přerozdělení části vytvořeného bohatství k humanitárním účelům.

### 2.2 Řešení ZION

ZION řeší každý z těchto problémů konkrétním protokolárním mechanismem:

| Problém | Řešení ZION |
|---------|-------------|
| ASIC dominance | CosmicHarmony v3 — paměťově náročný algoritmus, CPU-/GPU-first |
| Nerovné podmínky | Fair Launch — nula presale, nula VC, tým těží jako všichni ostatní |
| Technologie bez hodnot | Povinná redistribuce — 5 % humanitární fond + 5 % L5/L6 Issobella fund |

### 2.3 Vizionářský rámec

Základní hodnoty projektu vycházejí ze spirituálně-etické tradice:

- **Dharma** — projekt má svůj účel přesahující finanční zisk
- **Ahimsa** — neubližovat (Fair Launch, ASIC resistance)
- **Seva** — služba (humanitární tithe)
- **Satya** — pravda (open-source, on-chain auditovatelnost)
- **Karma** — co dáváš, to dostáváš (consciousness mining)

---

## 3. Architektura L1 — základní vrstva

### 3.1 Technický stack

```
┌─────────────────────────────────────────────────────────────┐
│                    ZION L1 Stack                            │
├─────────────────┬───────────────────────────────────────────┤
│ API Layer       │ Axum (REST + JSON-RPC 2.0), Stratum v2    │
├─────────────────┼───────────────────────────────────────────┤
│ Execution       │ Rust, Tokio async runtime                 │
├─────────────────┼───────────────────────────────────────────┤
│ Consensus       │ CosmicHarmony v3 (PoW)                    │
├─────────────────┼───────────────────────────────────────────┤
│ Ledger model    │ Hybrid Account + UTXO                     │
├─────────────────┼───────────────────────────────────────────┤
│ Storage         │ LMDB (Lightning Memory-Mapped Database)   │
├─────────────────┼───────────────────────────────────────────┤
│ P2P             │ Tokio TCP, gossip protokol                │
├─────────────────┼───────────────────────────────────────────┤
│ Crypto          │ Blake3, Ed25519, Keccak-256, SHA3-512     │
└─────────────────┴───────────────────────────────────────────┘
```

### 3.2 Hybridní Account + UTXO model

ZION V3 používá hybridní transakční model: jednoduchý Account model (from/to/amount) pro coinbase a běžné transfery, a plný UTXO model (inputs/outputs) pro pokročilé transakce (multi-input, bridge unlock). Výhody:

- Paralelní validace nezávislých transakcí
- Jednoduší formální ověřitelnost
- Přirozená podpora pro multi-input multi-output transakce

### 3.3 Transakční struktura

```rust
pub struct TxOutput {
    pub address: String,   // Bech32 "zion1..." formát
    pub amount: u64,       // V atomických jednotkách
    pub memo: Option<String>,  // Volitelný text (≤256 B)
}

pub struct Transaction {
    pub version: u32,
    pub inputs: Vec<TxInput>,
    pub outputs: Vec<TxOutput>,
    pub lock_time: u64,
    pub signature: Ed25519Signature,
}
```

### 3.4 Adresní formát

Adresy jsou ve formátu Bech32 s prefixem `zion1`, celkem 44 znaků:

```
zion1 + 39 lowercase alphanumerical characters
Příklad: zion166e6v3k204h8p5w4w3a7m0x790q5m7z5z6n252p
```

### 3.5 Pool — Stratum v2

Mining pool implementuje **Stratum v2** protokol:

- **VarDiff** — dynamická obtížnost shares podle hashrate minéra
- **PPLNS** — Pay Per Last N Shares (věrný model, odolný proti pool hopping)
- **Share validator** — pool vždy sám počítá hash, nepřijímá výsledek od minéra bez ověření
- **Redis** — backend pro share tracking s atomickými operacemi

### 3.6 P2P bezpečnost

- **Rate limiting** — max. 100 zpráv/60 s na peer
- **Automatický ban** — eskalační model: 300 s → 1 800 s → 7 200 s (permanentní po 3. striků)
- **Max peers** — 128
- **Gossip protokol** — efektivní propagace transakcí a bloků

### 3.7 Poplatky

Transakční poplatky jsou **burnovány** (fee_policy = "burn"), nikoliv přidělovány těžařům. Minimální poplatek: 1 flower/bajt.

---

## 4. Konsensus: CosmicHarmony v3

### 4.1 Přehled

**CosmicHarmony v3 (CHv3)** je paměťově náročný Proof-of-Work algoritmus, navržený jako odolný vůči ASIC specializaci. Staví na kombinaci:

1. **Keccak-256 + SHA3-512** — kryptografický základ pipeline
2. **Golden Matrix** — maticová difúzní vrstva
3. **256 KiB Scratchpad** — memory-hard náhodný přístup (ASIC resistance)
4. **NPU Mixing** — neuronová akcelerace (CoreML / TensorRT / OpenVINO)
5. **Cosmic Fusion** — finální hash redukce (8 kol)

### 4.2 Verze algoritmů podle výšky bloku

```
Výška 0–99 999:     CosmicHarmonyV1  (základní)
Výška 100 000+:     CosmicHarmonyV3  (hlavní produkční)
```

### 4.3 CHv4 rozšíření (implementováno v v2.9.7)

Ve verzi v2.9.7 byly implementovány dvě optimalizační fáze CHv4:

- **Fáze A — NPU mixing:** Mixování výstupu s hash přes neuronové síťové koeficienty; využívá NPU/Apple Neural Engine pro akceleraci.
- **Fáze B — NCL PoUW:** Proof-of-Useful-Work integrace; součástí výpočtu je reálný NCL AI task.

> **Poznámka:** CHv4 Fáze C (ZK-Shark) byla záměrně vynechána; doba generování proof by způsobila nepřijatelné zpoždění při ověřování bloků.

### 4.4 Difficulty Adjustment Algorithm (DAA)

```
Typ:    LWMA (Linearly Weighted Moving Average)
Okno:   60 bloků (~60 minut)
Max Δ:  ±25 % na retargeting interval
Min:    1 000 (ochrana proti DOS při nízké solvabilitě)
Cíl:    60 sekund/blok
```

### 4.5 Finalizace

- **Soft finality:** 60 potvrzení (~60 minut)
- **Max reorg depth:** 10 bloků
- **Coinbase maturity:** 100 bloků před utratou

---

## 5. Ekonomický model

### 5.1 Klíčové konstanty

Ekonomické parametry jsou ověřitelné v kódu: `V3/L1/core/src/genesis.rs` (premine + genesis) a `V3/L1/core/src/emission.rs` (Decade Decay + tail emission + fee split).

```
Base Supply Target: 144 000 000 000 ZION (144B)
Legacy Mining Param: 127 220 000 000 ZION (88,35 %)
Genesis Premine:     16 780 000 000 ZION (11,65 %)

Block Reward (dekáda 1):   5 400,067 ZION
Block Time:                60 sekund
Decade Decay:              −20 % každých 5 256 000 bloků (10 let)
Tail emission (2126+):     724,785 ZION/blok navěky

Flower units:           1 000 000 000 000 flower/ZION (12 des. míst)
```

### 5.2 Matematický důkaz emise (Dekáda 1)

```python
MINING_EMISSION = 127_220_000_000          # ZION  
BLOCKS_PER_DECADE = 5_256_000             # 10 let × 525 600 bloků/rok

BASE_BLOCK_REWARD = 5_400.067 ZION        # Dekáda 1 (z reward_calculator.rs)
                                           # Zdroj: reward_calculator.rs::BASE_BLOCK_REWARD
```

### 5.3 Decade Decay — emisní schedule

Od v2.9.6 je implementován **Decade Decay (Model A)**: každých 10 let (5 256 000 bloků) klesá block reward o 20 %. Po dekádě 10 začíná **tail emission** — věčná minimální odměna.

```
DECAY_FACTOR = 0.80  (−20 % / dekáda)
TAIL_REWARD  = 724.785 ZION/blok (od roku ~2126 navěky)
```

| Dekáda | Roky | Block reward | Emise za dekádu |
|--------|------|--------------|------------------|
| 1 | 2026–2036 | 5 400,067 ZION | ~28,38 B |
| 2 | 2036–2046 | 4 320,054 ZION | ~22,71 B |
| 3 | 2046–2056 | 3 456,043 ZION | ~18,16 B |
| 4 | 2056–2066 | 2 764,834 ZION | ~14,53 B |
| 5 | 2066–2076 | 2 211,867 ZION | ~11,63 B |
| 6 | 2076–2086 | 1 769,494 ZION | ~9,30 B |
| 7 | 2086–2096 | 1 415,595 ZION | ~7,44 B |
| 8 | 2096–2106 | 1 132,476 ZION | ~5,95 B |
| 9 | 2106–2116 | 905,981 ZION | ~4,76 B |
| 10 | 2116–2126 | 724,785 ZION | ~3,81 B |
| 11+ | 2126+ | **724,785 ZION** (tail) | ∞ věčná |

```
Celková emise (100 let):  ~126,67 B ZION
Tail od 2126:             724,785 ZION/blok navěky
```

**Proč Decade Decay?**
- Zachovává motivaci minerů na 100+ let díky tail emission
- Financuje L5 Free World (2030) a L6 Issobella (2040+)
- Mírnější šok než Bitcoin halving (−20 % vs −50 %)
- Předvídatelný: přesný schedule zapsán v kódu (`reward_calculator.rs`)

### 5.4 Premine — rozdělení

| Kategorie | ZION | % z premine | Účel |
|-----------|------|-------------|------|
| OASIS + Golden Egg/XP | 8 250 000 000 | 50,7 % | OASIS herní odměny, early-adopter incentives |
| DAO Treasury | 4 000 000 000 | 24,6 % | Komunitní governance, granty |
| Infrastructure | 2 590 000 000 | 15,9 % | Vývoj, seed nodes, audit |
| Humanitarian Fund | 1 440 000 000 | 8,8 % | Iniciální seed humanitárního fondu |
| **Celkem** | **16 780 000 000** | **100 %** | — |

#### Zablokování DAO Treasury

DAO Treasury (4B ZION) je zablokováno na **525 600 bloků ≈ 1 rok** od genesis. Toto je vynuceno na protokolové úrovni v `premine.rs::DAO_TREASURY_LOCK_HEIGHT`.

### 5.5 Distribuce odměny za blok (aktuální v2.9.6)

```
Block Reward (celkový)
  ├── 5 %  → Humanitarian Tithe  (Children Future Fund)
  ├── 5 %  → L5/L6 Issobella Fund (vesmírná stanice + Free World)
  ├── 1 %  → Pool Fee
  └── 89 % → Miners (rozděleno přes PPLNS)
```

**Zdroj:** `L1/pool/src/blockchain/reward_calculator.rs`
```rust
pub const DEFAULT_TITHE_PERCENT:         Decimal = dec!(5.0);
pub const DEFAULT_ISSOBELLA_FUND_PERCENT: Decimal = dec!(5.0);
pub const DEFAULT_POOL_FEE_PERCENT:       Decimal = dec!(1.0);
// miner_share = total − tithe − issobella − pool_fee  → 89 %
```

### 5.6 Vědomostní odměna (Consciousness Period 2025–2035)

V první dekádě existence sítě jsou dostupné **bonusové odměny z OASIS poolu**:

```
OASIS Pool: 8 250 000 000 ZION
Trvání:     10 let = 5 256 000 bloků (2025–2035)
Bonus/blok: 8 250 000 000 / 5 256 000 = 1 569,63 ZION

Výsledná odměna (consciousness period):
  Celková = base_reward + consciousness_bonus × level_multiplier
  Celková = 5 400,067 + 1 569,63 × multiplier
```

| Consciousness Level | Multiplier | Celková odměna/blok |
|--------------------|------------|---------------------|
| Physical (L1) | 1,0× | 5 400,07 ZION |
| Mental (L2) | 1,1× | 7 127,67 ZION |
| Aware (L3) | 1,2× | 7 283,82 ZION |
| Conscious (L4) | 1,3× | 7 440,00 ZION |
| Awakened (L5) | 1,5× | 7 754,51 ZION |
| Enlightened (L6) | 2,0× | 8 539,33 ZION |
| Transcendent (L7) | 3,0× | 10 108,96 ZION |
| Cosmic (L8) | 5,0× | 13 248,22 ZION |
| On The Star (L9) | 10,0× | 21 096,37 ZION |

Po roce 2035: Bonus pool vyčerpán. Veškeré mining odbaveno pouze base reward 5 400,067 ZION.

### 5.7 Vědomostní distribuce

```
Block Reward = base + consciousness_bonus × multiplier
  ├── 5 %  → Humanitarian Fund
  ├── 5 %  → L5/L6 Issobella Fund
  ├── 1 %  → Pool
  └── 89 % → PPLNS miners
```

### 5.8 Kumulativní supply (s Decade Decay)

```
Kumulativní mining emise (dekáda 1–10):
  2036: ~28,38B + 16,78B premine = ~44,66B  (31 %)
  2046: ~51,09B + 16,78B        = ~67,37B  (47 %)
  2056: ~69,25B + 16,78B        = ~85,53B  (59 %)
  2126: ~126,67B + 16,78B       = ~142,95B (99 %)
  2126+: tail 724.785 ZION/blok navěky
```

### 5.9 Srovnání s konkurencí

| Parametr | Bitcoin | Monero | Ethereum | ZION |
|----------|---------|--------|----------|------|
| Total supply | 21M (2140) | ∞ tail | ∞ EIP-1559 | **144B + tail** |
| Block time | 10 min | 2 min | 12 sec | **60 sec** |
| Halving | −50 % / 4 roky | Postupný | N/A | **−20 % / 10 let (Decade Decay)** |
| Mining end | ~2140 | Nikdy | N/A | **Nikdy (tail 2126+)** |
| ASIC resistant | Ne | Ano | N/A | **Ano (CHv3, score 90/100)** |
| Humanitární | Ne | Ne | Ne | **5 % tithe + 5 % L5/L6** |
| Fair Launch | ✅ | ✅ | ⚠️ | **✅** |
| Premine | 0 % | 0 % | ~7 % | **11,65 %** |

**Proč Decade Decay místo halvingu?** Postupné snížení o 20 % každých 10 let zajišťuje předvídatelný security budget pro těžaře, eliminuje prudké cenové šoky a financuje L5 Free World i L6 Issobella po celou dobu existence sítě.

---

## 6. Vědomostní těžba (Consciousness Mining)

### 6.1 Záměr

Consciousness Mining je gamifikační vrstva, která odměňuje dlouhodobou a konstruktivní účast v síti. Není pouhým finančním nástrojem — je to meritokracie angažovanosti.

### 6.2 Devět úrovní vědomí

```
Level  Název           Multiplier  XP potřeba
──────────────────────────────────────────────
  1    Physical        1,0×             0
  2    Mental          1,1×         1 000
  3    Aware           1,2×         5 000
  4    Conscious       1,3×        15 000
  5    Awakened        1,5×        50 000
  6    Enlightened     2,0×       150 000
  7    Transcendent    3,0×       500 000
  8    Cosmic          5,0×     1 500 000
  9    On The Star    10,0×     5 000 000
```

### 6.3 Zdroje XP

| Aktivita | XP |
|----------|----|
| Odeslání validního share | 10 |
| Nalezení bloku | 1 000 |
| Dokončení NCL tasku | 50–500 |
| Komunitní pomoc | 100–250 |
| Přijatý pull request do core repo | 500–10 000 |
| Humanitární dar (1 ZION = 1 XP) | 1/ZION |

#### Speciální výzvy (Consciousness Challenges)

Každý týden systém generuje bonusové výzvy:

| Typ výzvy | XP bonus |
|-----------|----------|
| Mining Marathon (168h) | 5 000 |
| Komunitní pomocník (5 nováčků) | 2 500 |
| Merged PR | 10 000 |
| Dokumentace (tutoriál) | 3 000 |
| Bug Hunter | 5 000 |
| NCL Pioneer (100 AI tasků) | 7 500 |

### 6.4 XP Decay

```
<7 dní neaktivity:   žádný pokles
7+ dní:              -1 % XP/den
Maximum poklesu:     50 % (XP nikdy neklesne pod 50 % maxima)
```

### 6.5 Vzorec odměny

```
Reward = (block_reward + consciousness_bonus) × PPLNS_share × level_multiplier
```

#### Příklad (MainNet, L6 Enlightened, 25 % PPLNS share)

```
Total block = 5 400,067 + (1 569,63 × 2,0) = 8 539,33 ZION
Miner share (89 %): 8 539,33 × 0,89 = 7 600,00 ZION  
PPLNS 25 %:         7 600,00 × 0,25 = 1 900,00 ZION
Humanitarian (10 %): 853,93 ZION → fond
```

### 6.6 Implementace v Rust

```rust
pub enum ConsciousnessLevel {
    Physical = 1,       // 1.0×
    Mental = 2,         // 1.1×
    Aware = 3,          // 1.2×
    Conscious = 4,      // 1.3×
    Awakened = 5,       // 1.5×
    Enlightened = 6,    // 2.0×
    Transcendent = 7,   // 3.0×
    Cosmic = 8,         // 5.0×
    OnTheStar = 9,      // 10.0×
}
```

---

## 7. Fair Launch

### 7.1 Definice

Fair Launch znamená, že **neexistuje žádný soukromý prodej** tokenů před spuštěním sítě — žádné ICO, žádný presale, žádná alokace pro VC fondy ani pro tým.

Rozhodnutí padlo **15. ledna 2026**: plánovaný presale byl zrušen, 500M ZION bylo přesunuto do DAO Treasury.

### 7.2 Srovnání modelů spouštění

| Projekt | Model | VC % | Tým % |
|---------|-------|------|-------|
| Bitcoin | Fair Launch | 0 % | 0 % |
| Monero | Fair Launch | 0 % | 0 % |
| Ethereum | Presale | ~17 % | ~10 % |
| Solana | VC heavy | ~48 % | ~13 % |
| **ZION** | **Fair Launch** | **0 %** | **0 %** |

### 7.3 Transparentnost genesis

Všechny genesis adresy jsou zveřejněny v souboru `PREMINE_ADDRESSES_PUBLIC.txt` a v `L1/core/src/blockchain/premine.rs`. Každá transakce z genesis adres je on-chain ověřitelná.

### 7.4 TestNet ≠ MainNet

TestNet tokeny jsou bezcenné a nebudou převedeny. MainNet začne novým blokem #0.

---

## 8. DAO Governance

### 8.1 DAO Treasury

| Část | ZION | Účel |
|------|------|------|
| Community Governance (main) | 2 500 000 000 | Hlavní rezerva |
| Grants & Bounties | 1 000 000 000 | Vývojářské granty |
| Ecosystem Bootstrap | 500 000 000 | Ekosystémový rozvoj |

Time-lock: Veškerý DAO Treasury zablokován do výšky bloku 525 600 (~1 rok po genesis).

### 8.2 Hlasovací mechanismus

```
1 ZION = 1 hlas
Delegace: Libovolná (kdykoli odvolatelná)
Time-lock před exekucí: 48 hodin

Standardní návrh:  quorum 4 %, >50 % FOR, 7 dní
Konstitucní změna: quorum 10 %, >67 % FOR, 14 dní
Nouzový návrh:     quorum 2 %, >75 % FOR, 3 dny
```

### 8.3 Treasury výdaje

Multi-sig ochrana: **5 z 7 podpisů** nutných pro jakoukoliv transakci z treasury.

### 8.4 Immutable parametry

DAO **nemůže** změnit:
- Total supply (144B ZION)
- Genesis allocation (16,78B)  
- Block time (60s)
- Mining algoritmus
- Konsensus typ (PoW)

### 8.5 Fáze decentralizace

```
Fáze 1 (2025–2026): Snapshot voting, off-chain signaling
Fáze 2 (2026–2027): On-chain proposal lifecycle (MainNet)
Fáze 3 (2027+):     Plná decentralizace, quadratic voting
```

---

## 9. Humanitární fond + L5/L6 alokace

### 9.1 Mechanismus

Z každého nalezeného bloku je **automaticky odečteno 5 %** a posláno na adresu Humanitarian Fund (`Children Future Fund — Humanitarian DAO` v genesis). Dalších **5 %** směřuje do L5/L6 Issobella fund. Toto je enforced v `reward_calculator.rs`.

### 9.2 Konstantní podíl

Distribuce je v kódu nastavena jako:
- 5 % Humanitarian Fund
- 5 % L5/L6 Issobella Fund
- 1 % Pool fee
- 89 % Miners (PPLNS)

Progresivní plán (10 → 25 %) byl součástí staršího WP v2.9.5, ale v kódu v2.9.6 je implementováno fixní schéma 5+5+1+89.

### 9.3 Governance humanitárního fondu

Prostředky spravuje DAO hlasováním. Organizace podávají návrhy se:
- specifikací cílové skupiny a lokace
- konkrétními měřitelnými výsledky
- povinnou kvarterní zprávou o využití

Kategorie: čistá voda, potravinová bezpečnost, přístřeší, vzdělávání, zdravotnictví, nouzová pomoc, životní prostředí.

### 9.4 Iniciální seed

Z genesis premine je **1 440 000 000 ZION** (8,8 % premine) alokováno jako okamžitě dostupný seed pro humanitární fond — pro případ, že jsou potřeba prostředky dříve, než se mining emise akumuluje.

---

## 10. L2 — wZION Bridge

### 10.1 Architektura

**wZION** je ERC-20 obalený token reprezentující ZION hodnotu na EVM sítích. Most umožňuje přesun likvidity bez nutnosti L1 transakce na EVM chainu.

```
ZION L1 ──[lock]──→ Bridge Contract ──[mint]──→ wZION (EVM chain)
wZION (EVM)  ──[burn]──→ Bridge Contract ──[unlock]──→ ZION L1
```

### 10.2 Podporované sítě

| Síť | Status |
|-----|--------|
| Base Mainnet | 📅 MainNet |
| Arbitrum One | 📅 MainNet |
| BNB Smart Chain | 📅 MainNet |
| Base Sepolia (testnet) | ✅ Živý testnet |

### 10.3 Bezpečnost

- Relayer validuje L1 block headers a Merkle proofs
- Multi-sig kontrola nad bridge kontrakty
- Rate limiting přeshraničních přenosů
- RPC: Ankr Premium (mainnet), publicnode.com (testnet)

---

## 11. L3 — NCL + WARP + AI-native

### 11.1 Záměr

L3 se skládá ze tří vzájemně provázaných modulů:

| Modul | Crate | LOC | Testů | Účel |
|-------|-------|-----|-------|------|
| NCL | `zion-ncl` | ~688 | 40 | Distribuované AI inference |
| WARP | `zion-warp` | ~2 400 | 164 | Cross-chain swap protokol |
| AI-native | `zion-ai-native` | ~500 | 45 | AI agenti, on-chain inteligence |

### 11.2 NCL — Neural Compute Layer

**NCL (Neural Compute Layer)** přeměňuje těžební infrastrukturu v distribuovanou AI computing síť. Minéři mohou paralelně s těžbou zpracovávat AI inference tasky a získávat za ně dodatečné NCL odměny.

### 11.3 Protokol

```
Životní cyklus tasku:
  ncl.register   → miner oznámí NCL kapacitu
  ncl.get_task   → obdrží AI task z poolu
  ncl.submit     → odešle výsledek
  ncl.status     → pool ověří a zaplatí

Protokol verze: 1.0
Rate limit:     60 requestů/minutu
```

### 11.4 Typy tasků a base odměny

| Task Type | Base odměna | Verifikace |
|-----------|-------------|------------|
| Hash Chaining v1 | ~0,001 ZION | Deterministická (Blake3) |
| Embeddings | ~0,001 ZION | Sampling |
| LLM Inference | ~0,010 ZION | Sampling + reputace |
| Image Classification | ~0,002 ZION | Model hash |
| Image Generation | ~0,020 ZION | Perceptual hash |
| Speech to Text | ~0,005 ZION | CER/WER scoring |
| Model Training | ~0,100 ZION | Loss convergence |

### 11.5 Deterministická verifikace (Hash Chaining)

Pro auditovatelné AI tasky je implementován Blake3 hash chaining:

```rust
pub fn verify_hash_chain(seed: &str, rounds: u32, expected: &str) -> bool {
    let mut hash = blake3::hash(seed.as_bytes());
    for _ in 0..rounds {
        hash = blake3::hash(hash.as_bytes());
    }
    hash.to_hex().as_str() == expected
}
```

### 11.6 NPU Runtime Detection

NCL automaticky detekuje nejrychlejší dostupný AI backend:

```
Apple M-series:  CoreML (nejvyšší výkon)
NVIDIA GPU:      TensorRT
Intel CPU/GPU:   OpenVINO
Ostatní:         ONNX Runtime (fallback)
```

### 11.7 Časové dělení

Výchozí alokace: **70 % mining / 30 % NCL**. Konfigurovatelné v rozsahu 50–90 % mining. Mining má vždy prioritu.

### 11.8 NCL + Consciousness bonus

NCL odměny jsou rovněž násobeny consciousness level multiplierem. Miner na úrovni L6 (Enlightened, 2,0×) dostane dvojnásobnou NCL odměnu oproti L1.

---

### 11.9 WARP — Cross-chain Swap Protocol

**WARP** je cross-chain swap protokol umožňující atomické výměny ZION s tokeny na 7 chain families:

| Chain Family | Příklady | Status |
|---|---|---|
| EVM (via Ankr) | Base, Arbitrum, BSC, ETH | ✅ Implementováno |
| Cosmos IBC | ATOM, OSMO | ✅ |
| Bitcoin | BTC, LTC | ✅ |
| Solana | SOL, SPL | ✅ |
| NEAR | NEAR | ✅ |
| Polkadot | DOT | ✅ |
| TON | TON | ✅ |

WARP REST API běží na portu **8092** (Axum). Persistence přes SQLite (`WarpDb`). **XP Bridge** — WARP swapy akumulují XP body na L1 (on-chain XP přes WARP transakce).

### 11.10 AI-native

AI-native vrstva implementuje AI agenty jako first-class objekty protokolu: on-chain model registry, AI-assisted governance pro DAO rozhodnutí, analýza on-chain dat.

---

## 12. L4 — ZION OASIS Game World

OASIS je Unreal Engine 5 open-world propojený s ZION blockchainem. Je to vrstva, kde se herní ekonomika stýká s reálnými tokeny L1.

**Klíčové koncepty:**
- **8 Genesis Territories** (Mount Zion, Cedar Forest, …)
- **9 Consciousness Levels** (Kabbalah Sefira: Malkuth → Keter)
- **4,95B ZION reward pool** (3 sloty × 1,65B, 10letá distribuce; Slots 4 & 5 repurposed to L5 Free World Projects — 3.3B ZION)
- **XP off-chain** — SQLite `oasis.db`, L1 zůstává čistý

**REST API** (port 8094): health, player, XP award, leaderboard, guild CRUD, territory map, reward pools — celkem 9 endpointů.

**Status:** Specifikace Q3 2026, game implementation Q4 2026+.

---

## 13. L5 — ZION Free World

> *"Freedom is not given — it is built, block by block."*

**Cíl:** 2030 | **Status:** Vize & Specifikace

L5 je humanitární a vědecká vrstva financovaná přímo z blockchainového protokolu. Jejím záměrem je vybudovat infrastrukturu svobodných komunit, výzkum kvantové volné energie a realizace humanitárních misí.

### Financování L5

| Zdroj | Mechanismus | Podíl |
|-------|-------------|-------|
| Block reward | 5 % z každého bloku → L5/L6 Issobella Fund | Automatický |
| Humanitarian Tithe | 5 % z každého bloku | Automatický |
| DAO Granty | Hlasování komunity | Variabilní |
| L4 OASIS revenue | % z ekonomické aktivity | Variabilní |

### Pilíře L5

1. **Free Energy Research** — výzkum kvantové a volné energie, open-source hardware
2. **Humanitarian Missions** — čistá voda, vzdělání, zdravotnictví, potravinová bezpečnost
3. **Free Communities** — energeticky nezávislé obce, mesh sítě, lokální ZION ekonomiky
4. **Education & Awareness** — open-source vzdělávací platformy, consciousness mining

### Milníky

| Rok | Milník |
|-----|--------|
| 2030 | Launched ZION Free World Foundation |
| 2031 | První výzkumná laboratoř (kvantová energie) |
| 2033 | Prototyp energetického generátoru |
| 2035 | Pilotní nasazení v 10 komunitách |
| 2037 | Open-source release hardware specifikací |
| 2040 | Masová produkce — energie pro miliony |

---

## 14. L6 — ZION Issobella (Orbitální stanice)

> *"The star is not the destination — it is the beginning."*

**Cíl:** 2040+ | **Status:** Dlouhodobá vize

**ZION Issobella** (kombinace _ISS_ + vlastní jméno) je vrcholná vrstva ekosystému — vědecká observatoř a výzkumná stanice na nízké oběžné dráze Země (LEO). Decentralizovaná správa přes ZION DAO, veškerá vědecká data veřejná.

### Mise L6

- **Astronomický výzkum** (bez atmosférického zkreslení)
- **Monitoring klimatu** (podpora L5 Free World)
- **Satelitní mesh síť** — redundantní P2P ZION uzly v orbitu
- **Výzkumné centrum** — mikrogravitace, kvantové experimenty
- **Vzdělávání** — live-streamy z vesmíru pro komunitu

### Financování L6

| Zdroj | Mechanismus |
|-------|-------------|
| L5/L6 Issobella Fund | 5 % z každého bloku (automaticky z reward_calculator) |
| Tail emission (2126+) | 724,785 ZION/blok navěky |
| DAO Treasury | Dlouhodobá vyhrazení fondů |
| L4 OASIS NFT | Speciální kosmické NFT kolekce |

### Milníky

| Rok | Milník |
|-----|--------|
| 2040 | ZION Space Division — projekt Issobella zahájen |
| 2042 | Design a feasibility study |
| 2045 | Výroba prvního modulu |
| 2048 | První modul na orbitě |
| 2050 | Plně operační stanice |
| 2126 | Issobella financována z tail emission navěky |

---

## 15. Bezpečnost a kryptografické primitiva

### 15.1 Využité primitiva

| Primitivum | Použití |
|------------|---------|
| **Blake3** | Block hashing, merkle tree, NCL hash chaining |
| **Ed25519** | Podepisování transakcí a bloků |
| **Keccak-256 + SHA3-512** | Ekam Deeksha v2 konsensus pipeline (stage 1+2) |
| **Golden Matrix + Scratchpad** | Ekam Deeksha v2 memory-hard stages (stage 3+4) |

### 15.2 Stromy transakcí

Každý blok obsahuje Merkle root transakcí pro efektivní SPV ověření.

### 15.3 Známé limity a jejich řešení

| Omezení | Mitigace |
|---------|----------|
| P2P nemá TLS | Plánováno Q2 2026 |
| NCL LLM non-determinismus | Sampling + reputace miner |
| Velké modely (>7B) | IPFS chunked download |
| Real-time inference latency | Geobalanování tasků |

### 15.4 Security audit

Nezávislý bezpečnostní audit je naplánován na Q2 2026. Výsledky budou zveřejněny v `docs/AUDIT.md`.

---

## 16. Roadmap

### 16.1 Verze

```
v2.9.5  ─ TestNet genesis, Rust L1 stack (Leden 2026)      ✅
v2.9.6  ─ L2/L3/L4 implementace, CHv4 A+B, Decade Decay,  ✅
           WARP 7-chain, OASIS REST, Discord alerting,
           Ankr RPC, nonce u64, ASIC score 90/100
v2.9.7  ─ Code freeze, 168h stability test, API docs       ✅
v2.9.8  ─ Bug fix round 1                                  📅
v2.9.9  ─ Bug fix round 2                                  📅
v3.0    ─ MainNet Genesis (Block #0)                       📅 Q4 2026
```

### 16.2 Milníky

| Milestone | Datum | Kritéria úspěchu |
|-----------|-------|------------------|
| 168h stability | ✅ Mar 2026 | 0 kritických alertů, pool 7+ dní |
| GPU miner alpha | Q2 2026 | CUDA/OpenCL funkční |
| Security audit | Q2 2026 | Žádná kritická zranitelnost |
| Mobile wallet | Q3 2026 | iOS + Android App Store |
| MainNet Genesis | Q4 2026 | Block #0, genesis premine distribuován |
| wZION mainnet | Q4 2026 | Live na Base/Arbitrum/BSC |
| NCL + WARP live | Q1 2027 | 1 000 NCL tasků/den, WARP swapy aktivní |
| L3 DAO (Fáze 2) | 2027 | On-chain voting |
| L5 Free World | 2030 | Foundation + výzkumná lab |
| 1. Decade Decay event | 2036 | Block reward −20 % → 4 320 ZION |
| L6 Issobella start | 2040 | Space Division zahájen |
| Tail emission | 2126 | 724,785 ZION/blok navěky |

---

## 17. Právní disclaimer

ZION je **open-source software** a **experimentální technologie**. ZION **není**:
- Cenný papír (security) dle MiCA ani žádné jiné regulace
- Investiční produkt s garantovanou návratností
- Licencovaný finanční nástroj

Účast v ZION síti je **dobrovolná** a probíhá **na vlastní riziko**. Hodnota tokenu není zaručena. Cena může klesnout na nulu. Regulatorní prostředí se může změnit.

ZION CoZ s.r.o. prodává **software**, nikoliv tokeny. Premine adresy jsou zveřejněny v souladu s principem transparentnosti, nikoliv jako investiční nabídka.

Viz také:
- `legal/DISCLAIMER.md`
- `legal/TOKEN_NOT_SECURITY.md`
- `legal/RISK_DISCLOSURE.md`
- `legal/PREMINE_DISCLOSURE.md`

---

## 18. Reference

| Odkaz | Popis |
|-------|-------|
| `config/mainnet.toml` | Mainnet síťové parametry (část emisních hodnot je legacy) |
| `L1/core/src/blockchain/premine.rs` | Genesis premine kód |
| `L1/core/src/blockchain/block.rs` | Block struktura a algoritmus |
| `docs/2.9.7/API_ENDPOINTS.md` | Kompletní API reference |
| `docs/2.9.7/GENESIS_CEREMONY.md` | Průběh genesis ceremonie |
| `PREMINE_ADDRESSES_PUBLIC.txt` | Veřejné genesis adresy |
| `legal/` | Právní dokumentace |
| https://github.com/Yose144/Zion-2.9 | Zdrojový kód (MIT) |

---

*"In code we trust. 144B ZION. Not one satoshi more."*  
**— ZION Economic Manifesto**

---

**© 2026 ZION CoZ s.r.o., Praha. MIT licence. Whitepaper version 3.0.**
