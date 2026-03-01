# ZION TerraNova — Technical Whitepaper v3.0
## Decentralizovaná síť s vědomostní těžbou a distribuovanou AI vrstvou

**Verze:** 3.0 — MainNet Genesis  
**Datum:** 2026  
**Autoři:** ZION CoZ s.r.o., Praha, Česká republika  
**Licence kódu:** MIT  
**Repozitář:** https://github.com/Yose144/Zion-2.9  

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
9. [Humanitární desátek](#9-humanitární-desátek)
10. [L2 — wZION Bridge](#10-l2--wzion-bridge)
11. [L3 — Neural Compute Layer (NCL)](#11-l3--neural-compute-layer-ncl)
12. [L4 — OASIS Platform](#12-l4--oasis-platform)
13. [Bezpečnost a kryptografické primitiva](#13-bezpečnost-a-kryptografické-primitiva)
14. [Roadmap](#14-roadmap)
15. [Právní disclaimer](#15-právní-disclaimer)
16. [Reference](#16-reference)

---

## 1. Abstrakt

ZION TerraNova je vrstvená blockchain síť s důkazem práce (Proof-of-Work), navržená s třemi základními principy: **spravedlivý spuštění** bez venture capital ani ICO, **vědomostní těžba** jako gamifikační vrstva odměňující dlouhodobou angažovanost, a **povinný humanitární desátek** embedded přímo do každého nalezeného bloku.

Síť je implementována v jazyce **Rust** na vrstvách L1–L4:

| Vrstva | Název | Technologie | Stav |
|--------|-------|-------------|------|
| L1 | Core blockchain | Rust, LMDB, Tokio, Axum | ✅ TestNet live |
| L2 | wZION bridge | Solidity, ERC-20 | ✅ Base Sepolia live |
| L3 | NCL AI compute | Rust, ONNX/CoreML/TensorRT | ⏳ Implementace |
| L4 | OASIS platform | Rust + Web | 📅 Plánováno |

**Klíčové parametry MainNet:**

| Parametr | Hodnota |
|----------|---------|
| Total supply | 144 000 000 000 ZION (144 miliard) |
| Block reward | 5 400,067 ZION (konstantní, bez halvingu) |
| Block time | 60 sekund |
| Mining duration | ~45 let (2025–2070) |
| Premine | 16 280 000 000 ZION (11,31 %) |
| Atomická jednotka | 1 ZION = 1 000 000 atomů (6 desetinných míst) |
| Konsensus | CosmicHarmony v3 (paměťově náročný PoW) |
| Algoritmus DAA | LWMA, okno 60 bloků, max. ±25 % |

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
| Technologie bez hodnot | Humanitární desátek — 10 % z každého bloku povinně do humanitárního fondu |

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
│ Ledger model    │ UTXO (Unspent Transaction Output)         │
├─────────────────┼───────────────────────────────────────────┤
│ Storage         │ LMDB (Lightning Memory-Mapped Database)   │
├─────────────────┼───────────────────────────────────────────┤
│ P2P             │ Tokio TCP, gossip protokol                │
├─────────────────┼───────────────────────────────────────────┤
│ Crypto          │ Blake3, Ed25519, Argon2id, ChaCha20-Poly  │
└─────────────────┴───────────────────────────────────────────┘
```

### 3.2 UTXO model

ZION používá klasický UTXO model (jako Bitcoin), nikoliv account model (jako Ethereum). Každá transakce spotřebovává existující UTXO a vytváří nové. Výhody:

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

- **Rate limiting** — max. 100 zpráv/sekundu na peer
- **Automatický ban** — přestupníci blokováni na 3 600 sekund
- **Max peers** — 128 (96 inbound, 32 outbound)
- **Gossip protokol** — efektivní propagace transakcí a bloků

### 3.7 Poplatky

Transakční poplatky jsou **burnovány** (fee_policy = "burn"), nikoliv přidělovány těžařům. Minimální poplatek: 1 atomická jednotka/bajt.

---

## 4. Konsensus: CosmicHarmony v3

### 4.1 Přehled

**CosmicHarmony v3 (CHv3)** je paměťově náročný Proof-of-Work algoritmus, navržený jako odolný vůči ASIC specializaci. Staví na kombinaci:

1. **Argon2id** — memory-hard hashing (ASIC resistance)
2. **Blake3** — rychlý kryptografický hash
3. **Scratchpad pattern** — náhodný přístup do paměti (memory latency bottleneck)

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

Všechny ekonomické parametry jsou **immutable** — zakódované v genesis bloku. Jsou ověřitelné v `config/mainnet.toml` a `L1/core/src/blockchain/premine.rs`.

```
Total Supply:       144 000 000 000 ZION (144B)
Mining Emission:    127 720 000 000 ZION (88,69 %)
Genesis Premine:     16 280 000 000 ZION (11,31 %)

Block Reward:           5 400,067 ZION (konstantní)
Block Time:             60 sekund
Mining Duration:        ~45 let (bloky 0–23 651 999)
Total Mining Blocks:    23 652 000

Atomic Units:           1 000 000 atomů/ZION (6 des. míst)
```

### 5.2 Matematický důkaz emise

```python
MINING_EMISSION = 127_720_000_000          # ZION
TOTAL_BLOCKS    = 45 × 525_600 = 23_652_000

BASE_BLOCK_REWARD = 127_720_000_000 / 23_652_000
                  = 5 400,067 ZION/blok  ✓

Ověření zpětně:
5 400,067 × 23 652 000 = 127 720 384 400 ZION
Zaokrouhlovací chyba:         384 400 ZION  (< 0,001 %)
```

### 5.3 Premine — rozdělení

| Kategorie | ZION | % z premine | Účel |
|-----------|------|-------------|------|
| OASIS + Golden Egg/XP | 8 250 000 000 | 50,7 % | OASIS herní odměny, early-adopter incentives |
| DAO Treasury | 4 000 000 000 | 24,6 % | Komunitní governance, granty |
| Infrastructure | 2 590 000 000 | 15,9 % | Vývoj, seed nodes, audit |
| Humanitarian Fund | 1 440 000 000 | 8,8 % | Iniciální seed humanitárního fondu |
| **Celkem** | **16 280 000 000** | **100 %** | — |

#### Zablokování DAO Treasury

DAO Treasury (4B ZION) je zablokováno na **525 600 bloků ≈ 1 rok** od genesis. Toto je vynuceno na protokolové úrovni v `premine.rs::DAO_TREASURY_LOCK_HEIGHT`.

### 5.4 Vědomostní odměna (Consciousness Period 2025–2035)

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

### 5.5 Distribuce odměny za blok

```
Block Reward (celkový) = base + consciousness bonus
  ↓
Humanitarian Tithe (10 %): → Humanitarian Fund address
  ↓
Pool Fee (1 %): → Pool operator
  ↓
Miner Share (89 %): → Rozděleno přes PPLNS mezi těžaře
```

### 5.6 Roční emise

```python
Per Year: 525 600 bloků × 5 400,067 ZION = 2 838 275 215 ZION (~2,84B)

Kumulativní supply:
  2025: 19,1B ZION  (13,3 % z total)
  2030: 30,5B ZION  (21,2 %)
  2035: 44,7B ZION  (31,0 %)
  2040: 58,9B ZION  (40,9 %)
  2050: 87,3B ZION  (60,6 %)
  2070: 144B ZION   (100 %)
```

### 5.7 Srovnání s konkurencí

| Parametr | Bitcoin | Monero | Ethereum | ZION |
|----------|---------|--------|----------|------|
| Total supply | 21M (2140) | ∞ tail | ∞ EIP-1559 | **144B (2070)** |
| Block time | 10 min | 2 min | 12 sec | **60 sec** |
| Halving | Každé 4 roky | Postupný | N/A | **Žádný** |
| ASIC resistant | Ne | Delší | N/A | **Ano (CHv3)** |
| Humanitární | Ne | Ne | Ne | **10–25 % tithe** |
| Fair Launch | ✅ | ✅ | ⚠️ | **✅** |
| Premine | 0 % | 0 % | ~7 % | **11,31 %** |

**Proč žádný halving?** Konstantní odměna zajišťuje předvídatelný security budget pro těžaře a eliminuje cenové šoky způsobené skokovou změnou emise.

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
- Genesis allocation (16,28B)  
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

## 9. Humanitární desátek

### 9.1 Mechanismus

Z každého nalezeného bloku je **automaticky odečteno 10 %** a posláno na adresu Humanitarian Fund (`Children Future Fund — Humanitarian DAO` v genesis). Toto je enforced v reward_calculator.

### 9.2 Progresivní schedule

```
Rok 1 (2027):      10 %
Roky 2–3:          15 %
Roky 4–5:          20 %
Rok 6+:            25 %
```

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

## 11. L3 — Neural Compute Layer (NCL)

### 11.1 Záměr

**NCL (Neural Compute Layer)** přeměňuje těžební infrastrukturu v distribuovanou AI computing síť. Minéři mohou paralelně s těžbou zpracovávat AI inference tasky a získávat za ně dodatečné NCL odměny.

### 11.2 Protokol

```
Životní cyklus tasku:
  ncl.register   → miner oznámí NCL kapacitu
  ncl.get_task   → obdrží AI task z poolu
  ncl.submit     → odešle výsledek
  ncl.status     → pool ověří a zaplatí

Protokol verze: 1.0
Rate limit:     60 requestů/minutu
```

### 11.3 Typy tasků a base odměny

| Task Type | Base odměna | Verifikace |
|-----------|-------------|------------|
| Hash Chaining v1 | ~0,001 ZION | Deterministická (Blake3) |
| Embeddings | ~0,001 ZION | Sampling |
| LLM Inference | ~0,010 ZION | Sampling + reputace |
| Image Classification | ~0,002 ZION | Model hash |
| Image Generation | ~0,020 ZION | Perceptual hash |
| Speech to Text | ~0,005 ZION | CER/WER scoring |
| Model Training | ~0,100 ZION | Loss convergence |

### 11.4 Deterministická verifikace (Hash Chaining)

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

### 11.5 NPU Runtime Detection

NCL automaticky detekuje nejrychlejší dostupný AI backend:

```
Apple M-series:  CoreML (nejvyšší výkon)
NVIDIA GPU:      TensorRT
Intel CPU/GPU:   OpenVINO
Ostatní:         ONNX Runtime (fallback)
```

### 11.6 Časové dělení

Výchozí alokace: **70 % mining / 30 % NCL**. Konfigurovatelné v rozsahu 50–90 % mining. Mining má vždy prioritu.

### 11.7 NCL + Consciousness bonus

NCL odměny jsou rovněž násobeny consciousness level multiplierem. Miner na úrovni L6 (Enlightened, 2,0×) dostane dvojnásobnou NCL odměnu oproti L1.

---

## 12. L4 — OASIS Platform

OASIS je hravá aplikační vrstva nad ZION ekonomikou. Plánuje:

- Výherní mechanismy (Golden Egg — 8,25B ZION pool)
- In-game tokeny vázané na ZION L1
- Cross-chain integrace přes wZION bridge
- Consciousness score jako vstup do herní mechaniky

**Status:** Specifikace Q3 2026, implementace Q4 2026+.

---

## 13. Bezpečnost a kryptografické primitiva

### 13.1 Využité primitiva

| Primitivum | Použití |
|------------|---------|
| **Blake3** | Block hashing, merkle tree, NCL hash chaining |
| **Ed25519** | Podepisování transakcí a bloků |
| **Argon2id** | Memory-hard element konsenzu (ASIC resistance) |
| **ChaCha20-Poly1305** | P2P šifrovaná komunikace |

### 13.2 Stromy transakcí

Každý blok obsahuje Merkle root transakcí pro efektivní SPV ověření.

### 13.3 Známé limity a jejich řešení

| Omezení | Mitigace |
|---------|----------|
| P2P nemá TLS | Plánováno Q2 2026 |
| NCL LLM non-determinismus | Sampling + reputace miner |
| Velké modely (>7B) | IPFS chunked download |
| Real-time inference latency | Geobalanování tasků |

### 13.4 Security audit

Nezávislý bezpečnostní audit je naplánován na Q2 2026. Výsledky budou zveřejněny v `docs/AUDIT.md`.

---

## 14. Roadmap

### 14.1 Verze

```
v2.9.5  ─ TestNet genesis, Rust L1 stack         ✅ Dokončeno
v2.9.6  ─ CHv4 A+B, discord alerting, bridge     ✅ Dokončeno
v2.9.7  ─ Code freeze, 168h stability test       ✅ Dokončeno
v2.9.8  ─ Bug fix round 1                         📅 Plánováno
v2.9.9  ─ Bug fix round 2                         📅 Plánováno
v3.0    ─ MainNet Genesis                         📅 Cíl: 2026
```

### 14.2 Milníky

| Milestone | Datum | Kritéria úspěchu |
|-----------|-------|------------------|
| 168h stability | ✅ Mar 2026 | 0 kritických alertů, pool 7+ dní |
| GPU miner alpha | Q2 2026 | CUDA/OpenCL funkční |
| Security audit | Q2 2026 | Žádná kritická zranitelnost |
| Mobile wallet | Q3 2026 | iOS + Android App Store |
| MainNet Genesis | Q4 2026 | Block #0, genesis premine distribuován |
| wZION mainnet | Q4 2026 | Live na Base/Arbitrum/BSC |
| NCL LLM support | Q1 2027 | 1 000 tasků/den |
| Full DAO (Fáze 2) | 2027 | On-chain voting |

---

## 15. Právní disclaimer

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

## 16. Reference

| Odkaz | Popis |
|-------|-------|
| `config/mainnet.toml` | Kanonické mainnet parametry |
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
