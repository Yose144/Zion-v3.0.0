# ZION TerraNova — V3 whitepaper (Mainnet)

**Verze:** 3.0 — Ekam Deeksha  
**Datum:** březen 2026  
**Autoři:** přispěvatelé ZION (open source)  
**License:** MIT  
**Stav:** V3 před mainnetem (probíhá veřejný test-mainnet / rehearsal)

---

> *„Věříme kódu. 144 miliard ZION. Ani o jeden satoshi víc.“*

---

## Obsah

1. [Abstrakt](#1-abstrakt)
2. [Motivace](#2-motivace)
3. [Architektura L1](#3-architektura-l1)
4. [Konsensus — Ekam Deeksha v2](#4-konsensus--ekam-deeksha-v2)
5. [Ekonomický model](#5-ekonomický-model)
6. [Politika XP na L4 OASIS (časová osa)](#6-politika-xp-na-l4-oasis-časová-osa)
7. [Fair launch a Genesis](#7-fair-launch-a-genesis)
8. [DAO governance](#8-dao-governance)
9. [Humanitární fond a alokace L5/L6](#9-humanitární-fond-a-alokace-l5l6)
10. [L2 — most wZION a DeFi](#10-l2--most-wzion-a-defi)
11. [L3 — NCL, WARP a AI-native](#11-l3--ncl-warp-a-ai-native)
12. [L4 — herní svět ZION OASIS](#12-l4--herní-svět-zion-oasis)
13. [L5 — ZION Free World](#13-l5--zion-free-world)
14. [L6 — ZION Issobella](#14-l6--zion-issobella)
15. [Bezpečnost a kryptografie](#15-bezpečnost-a-kryptografie)
16. [Roadmap](#16-roadmap)
17. [Právní vyloučení odpovědnosti](#17-právní-vyloučení-odpovědnosti)
18. [Reference](#18-reference)

---

## 1. Abstrakt

**ZION TerraNova** je kryptoměna typu proof-of-work se šestivrstvou architekturou (L1–L6), navrženou pro odolnost vůči ASIC, férovou distribuci, vestavěné humanitární financování a více než stoletý emisní plán.

Tento dokument je **orientovaný na V3**. Historické materiály 2.9.x jsou kontext; technická pravda je dána kódem `V3/`, `V3/ROADMAP.md` a dokumenty ústavy mainnetu v repozitáři.

Klíčové parametry:

| Parametr | Hodnota |
|-----------|---------|
| **Celková nabídka** | 144 000 000 000 ZION (tvrdý strop) |
| **Čas bloku** | 60 sekund |
| **Počátení odměna za blok** | 5 400,067 ZION |
| **Emisní model** | Decade Decay (−20 % každých 10 let) |
| **Tail emise** | 724,784723787776 ZION/blok od ~2126 navždy |
| **Těžební algoritmus** | Ekam Deeksha v2 (CPU/GPU, odolnost vůči ASIC) |
| **Podpisy** | Ed25519 |
| **Hashování** | BLAKE3 |
| **Formát adresy** | Bech32 (`zion1…`) |
| **Transakční model** | UTXO |
| **Konsensus** | Proof-of-Work (Nakamoto) |
| **Wrapped token na L2** | wZION (ERC-20 na Base) |
| **Jazyk implementace** | Rust (asynchronní runtime Tokio) |

ZION automaticky alokuje **10 %** z každé odměny za blok na humanitární a vědecké účely: **5 %** Humanitární fond a **5 %** fond L5/L6 Issobella. Rozdělení vynucuje protokol a governance je nemůže změnit.

---

## 2. Motivace

### 2.1 Problémy status quo

Mnoho kryptoprojektů sdílí stejné strukturální nedostatky:

- **Insiderská předalokace** — VC a týmové tokeny generují nerovnost.
- **Centralizace přes ASIC** — specializovaný hardware vyřadí jednotlivé těžaře.
- **Žádný systémový společenský dopad** — dávání na úrovni protokolu chybí; filantropie je dobrovolná.
- **Šoky půlčením** — události typu halving (např. u Bitcoinu) náhle mění nabídkovou stranu.

### 2.2 Přístup ZION

| Slabina | Řešení ZION |
|------|---------------|
| Insider tokeny | Fair launch — žádný presale, ICO ani privátní kola |
| Centralizace ASIC | Ekam Deeksha v2 — memory-hard, optimalizace na CPU/GPU |
| Chybějící dopad | 10 % z každé block reward vynucuje kód |
| Šoky nabídky | Decade Decay — plynulé −20 % / dekádu + trvalá tail emise |

---

## 3. Architektura L1

### 3.1 Technologický stack

```
┌─────────────────────────────────────────────────┐
│  JSON-RPC 2.0 (TCP)           configurable      │
│  Pool Stratum Session Wire    configurable      │
├─────────────────────────────────────────────────┤
│  Consensus Engine (Ekam Deeksha v2)             │
│  Mempool  ·  Block Builder  ·  DAA (LWMA)       │
├─────────────────────────────────────────────────┤
│  UTXO Set  ·  Merkle Tree  ·  Fee Calculator    │
├─────────────────────────────────────────────────┤
│  Persistence (LMDB/heed)                        │
│  P2P Gossip (TCP)              configurable     │
└─────────────────────────────────────────────────┘
```

- **Runtime:** Rust + asynchronní Tokio
- **Databáze:** LMDB (memory-mapped, zero-copy čtení)
- **API:** JSON-RPC 2.0 přes TCP (konfigurovatelný bind)
- **Těžební protokol:** Stratum-style session wire v `V3/L1/pool` (konfigurovatelný bind)
- **P2P:** TCP gossip protokol (konfigurovatelný bind)

### 3.2 Model UTXO

ZION používá model Unspent Transaction Output. Každá transakce spotřebuje jeden či více existujících UTXO a vytvoří nové.

```rust
pub struct TxOutput {
  pub amount: u64,
  pub address: String,
  pub memo: Option<String>,
}
```

Výstupy jsou uzamčeny na veřejné klíče Ed25519. Pro utracení je nutný platný podpis.

### 3.3 Formát adres

Adresy používají kódování **Bech32** s human-readable prefixem `zion1`:

```
zion1q540v6y4f0s4v3n0f8t740t53494z56024u645c
```

Bech32 poskytuje detekci chyb a eliminuje nejednoznačné znaky (0/O, l/1).

### 3.4 Poplatek — 100 % burn

Všechny transakční poplatky se **spálí** (zničí). ZION je tak mírně deflační nad rámec emisního plánu. Těžaři dostávají odměnu výhradně z block rewards; incentive zůstávají vázané na bezpečnost sítě, ne na výběr poplatků.

### 3.5 P2P síť

- **Gossip** přes TCP (konfigurovatelný bind)
- Objevování peerů přes DNS seeds a hardcoded bootstrap uzly
- propagace bloků během sekund v globální topologii
- Banování peerů při porušení protokolu

---

## 4. Konsensus — Ekam Deeksha v2

### 4.1 Název algoritmu

Proof-of-work algoritmus se jmenuje **Ekam Deeksha** (sanskrt: „jedna iniciace“). Verze 2 sleduje mainnet.

### 4.2 Cíle návrhu

1. **Odolnost vůči ASIC** — memory-hard fáze brání dominanci jednoúčelového hardwaru
2. **Přívětivost pro CPU/GPU** — efektivní na běžném hardwaru včetně Apple Silicon NPU
3. **Vícefázový pipeline** — šest sekvenčních fází ztěžuje zkratky v optimalizaci

### 4.3 Tok výpočtu (pipeline)

```
Input: block_header ║ nonce (u64)
  │
  ├─ Stage 1: Keccak-256         → 32-byte digest
  ├─ Stage 2: SHA3-512           → 64-byte expansion
  ├─ Stage 3: Golden Matrix      → matrix multiplication diffusion
  ├─ Stage 4: 256 KiB Scratchpad → memory-hard fill + dependent reads
  ├─ Stage 5: NPU Mixing         → neural processing unit vector ops
  └─ Stage 6: Cosmic Fusion      → final hash reduction
  │
Output: 32-byte PoW hash
```

**Fáze 4 (Scratchpad)** je klíčová pro odolnost vůči ASIC. Pracovní sada 256 KiB se vejde do L2 cache, ale vyžaduje pseudonáhodné závislé čtení, což komplikuje pipelining a skrývání latence paměti u ASIC.

**Fáze 5 (NPU Mixing)** využívá Apple CoreML / NVIDIA TensorRT / Intel OpenVINO / ONNX Runtime (autodetekce) pro hardwarovou akceleraci na běžných zařízeních.

### 4.4 Algoritmus úpravy obtížnosti (DAA)

ZION používá **LWMA** s oknem 60 bloků:

- **Cílový čas bloku:** 60 sekund
- **Rozsah úpravy:** ±25 % na blok
- **Přepočítávání:** každý blok

LWMA plynule reaguje na změny hashrate v řádu sekund a omezuje oscilace a útoky přes manipulaci časových razítek.

### 4.5 Skóre odolnosti vůči ASIC

Interní odhad: **90/100** (podle metodologie [CryptoRating](https://cryptorating.eu/)).

---

## 5. Ekonomický model

### 5.1 Celková nabídka

Tvrdý strop **144 000 000 000 ZION** je dán v genesis a je neměnný. Governance nemůže nabídku zvýšit.

### 5.2 Emise Decade Decay

Na rozdíl od ostrých čtyřletých půlení u Bitcoinu ZION snižuje odměnu za blok o **20 %** každých **10 let** (5 256 000 bloků). Vzniká plynulá, předvídatelná křivka nabídky pro více než století těžby.

| Dekáda | Roky | Odměna za blok (ZION) | Emise dekády |
|--------|-------|---------------------|-----------------|
| 1 | 2026-2036 | 5,400.067 | 28,383,712,152 |
| 2 | 2036-2046 | 4,320.054 | 22,706,969,722 |
| 3 | 2046-2056 | 3,456.043 | 18,165,575,777 |
| 4 | 2056-2066 | 2,764.834 | 14,532,460,622 |
| 5 | 2066-2076 | 2,211.867 | 11,625,968,497 |
| 6 | 2076-2086 | 1,769.494 | 9,300,774,798 |
| 7 | 2086-2096 | 1,415.595 | 7,440,619,838 |
| 8 | 2096-2106 | 1,132.476 | 5,952,495,871 |
| 9 | 2106-2116 | 905.981 | 4,761,996,697 |
| 10 | 2116-2126 | 724.784723787776 | 3,809,597,357 |
| **Tail** | **2126+** | **724.784723787776** | **Navždy** |

**Tail emise** začíná po 10. dekádě. Minimální odměna **724,784723787776 ZION/blok** trvale motivuje těžbu — není nutný čistě „fee-only“ bezpečnostní model.

### 5.3 Rozdělení odměny za blok

Protokol automaticky rozdělí každou odměnu:

| Příjemce | Podíl | Účel |
|-----------|-------|---------|
| **Těžaři (PPLNS)** | 89 % | Bezpečnost sítě |
| **Humanitární fond** | 5 % | Globální humanitární projekty |
| **Fond L5/L6 Issobella** | 5 % | Věda a kosmický program |
| **Provozovatel poolu** | 1 % | Infrastruktura poolu |

Rozdělení je vynuceno v `V3/L1/core/src/emission.rs` (`fee_split`) a governance ho nemění.

### 5.4 Srovnání

| | ZION | Bitcoin | Monero | Ethereum |
|---|---|---|---|---|
| Nabídka | 144B | 21M | ∞ (tail) | ∞ |
| Emise | Decade Decay (−20 %/10 let) | Halving (−50 %/4 roky) | Tail 0.6 XMR/block | Emise + burn |
| Čas bloku | 60s | 600s | 120s | 12s |
| Konsensus | PoW (Ekam Deeksha) | PoW (SHA-256d) | PoW (RandomX) | PoS |
| ASIC | Vysoká (memory-hard) | Žádná | Vysoká | N/A |
| Vestavěné dávání | 10 % vynuceno | Žádné | Žádné | Žádné |
| Poplatky | 100 % burn | Aukce | Aukce | EIP-1559 burn |

---

## 6. Politika XP na L4 OASIS (časová osa)

### 6.1 Rozsah

XP a „consciousness“ progrese patří **L4 OASIS**, ne do konsenzu L1. L1 zůstává deterministické PoW + emise + validace.

### 6.2 Okno aktivace

- **Cílový start:** ~2028 (s rolloutem L4 OASIS)
- **Před 2028:** pouze návrh a R&D
- **Dopad na konsenzus:** žádný (aplikační vrstva)

### 6.3 Bezpečnostní princip

Žádné pravidlo XP nesmí měnit ústavní ekonomiku L1 (nabídka, decay, fee split, základní subsídie).

---

## 7. Fair launch a Genesis

### 7.1 Definice

ZION je projekt **fair launch**:

- **Žádné ICO**
- **Žádný presale** — žádná privátní kola, SAFT ani advisor tokeny
- **Žádné tajné pre-mining** řetězce před veřejným startem
- **Veřejný genesis** — alokace zveřejněné a ověřitelné on-chain

ZION lze získat **těžbou** nebo přijetím v transakci.

### 7.2 Genesis rezerva (veřejné shrnutí)

**16 280 000 000 ZION** (11,31 % celkové nabídky) je v genesis rezervováno na bootstrap ekosystému.

**Strategický obal:** **8 500 000 000 ZION** pro vývoj L4 OASIS / hry a bootstrap herního hospodářství (8,25B přímé OASIS sloty + 0,25B ekosystém pro game-dev).

| # | Alokace | ZION | Účel |
|---|-----------|------|---------|
| 1-5 | OASIS Golden Egg | 8 250 000 000 | Odměny herního světa L4 (5 slotů × 1,65B, vesting 10 let) |
| 6 | DAO Treasury (hlavní) | 2 500 000 000 | Rezerva pro governance |
| 7 | DAO Grants & Bounties | 1 000 000 000 | Granty vývojářům |
| 8 | DAO Ecosystem Bootstrap | 500 000 000 | Rozvoj ekosystému |
| 9 | Core Development Fund | 1 000 000 000 | Běžný vývoj |
| 10 | Network Infrastructure | 1 000 000 000 | Seed uzly a infrastruktura |
| 11 | Genesis Creator | 590 000 000 | Dlouhodobá správa projektu |
| 12 | Humanitarian DAO | 1 440 000 000 | Humanitární seed |

**Časový zámek DAO Treasury:** Všech **4 000 000 000 ZION** v položkách #6–8 je uzamčeno do výšky bloku **525 600** (~1 rok po genesis).

### 7.3 Bezpečnost a transparentnost

- Veřejný whitepaper záměrně neuvádí provozní adresy peněženek.
- Pravidla genesis lze auditovat v [`V3/L1/core/src/genesis.rs`](../L1/core/src/genesis.rs) a konstanty v [`V3/L1/core/src/emission.rs`](../L1/core/src/emission.rs).
- Každá genesis transakce je ověřitelná od bloku #0.

### 7.4 TestNet ≠ MainNet

Tokeny TestNet nemají hodnotu a nepřenášejí se. MainNet začíná novým blokem #0.

---

## 8. DAO governance

### 8.1 DAO Treasury

| Alokace | ZION | Účel |
|------------|------|---------|
| Community Governance (hlavní) | 2 500 000 000 | Primární rezerva |
| Grants & Bounties | 1 000 000 000 | Granty vývojářům |
| Ecosystem Bootstrap | 500 000 000 | Růst ekosystému |

### 8.2 Mechanismus hlasování

```
1 ZION = 1 hlas (snapshot-weighted)
Delegace:       dle politik vrstvy governance
Pre-exekuční zámek: 48 hodin

Návrh parametrů:  kvorum 10 %, 7 dní
Návrh treasury:   kvorum 15 %, 7 dní
Nouzový návrh:    kvorum 20 %, 3 dny
Podmínka prošití: hlasy_pro > hlasy_proti
```

### 8.3 Výdaje z treasury

Multi-sig: **5 ze 7** podpisů pro každou transakci z treasury.

### 8.4 Neměnné parametry

DAO **nemůže** změnit:

- Celkovou nabídku (144B ZION)
- Genesis alokaci (16,28B ZION)
- Čas bloku (60 sekund)
- Těžební algoritmus (Ekam Deeksha v2)
- Typ konsenzu (Proof-of-Work)
- Poměry rozdělení odměny (89/5/5/1 %)

### 8.5 Fáze decentralizace

| Fáze | Časová osa | Vlastnosti |
|-------|----------|----------|
| Fáze 1 | 2025-2026 | Snapshot hlasování, off-chain signály |
| Fáze 2 | 2026-2027 | On-chain návrhy (MainNet) |
| Fáze 3 | 2027+ | Plná decentralizace; volitelný R&D kvadratických hlasů (mimo konsenzus) |

---

## 9. Humanitární fond a alokace L5/L6

### 9.1 Mechanismus

Každý vytěžený blok automaticky alokuje:

- **5 %** → Humanitární fond (`Children Future Fund — Humanitarian DAO`)
- **5 %** → fond L5/L6 Issobella

Oba podíly vynucuje `V3/L1/core/src/emission.rs` na úrovni protokolu.

### 9.2 Governance humanitárního fondu

Fondy spravuje DAO hlasování. Organizace předkládají návrhy s:

- Cílovou populací a geografickým rozsahem
- Měřitelnými výstupy
- Povinnými čtvrtletními zprávami o využití

**Kategorie:** pitná voda, potraviny, přístřeší, vzdělávání, zdravotnictví, nouzová pomoc, ochrana životního prostředí.

### 9.3 Počáteční seed

Z genesis rezervy je **1 440 000 000 ZION** k okamžitému humanitárnímu rozjezdu — před tím, než těžební emise naplní fond dostatečně.

---

## 10. L2 — most wZION a DeFi

### 10.1 Architektura

**wZION** je ERC-20 wrapped token reprezentující hodnotu ZION na EVM řetězcích. Most přesouvá likviditu bez nutnosti plné L1 infrastruktury na EVM.

```
ZION L1  --[lock]-->  Bridge Contract  --[mint]-->  wZION (EVM)
wZION    --[burn]-->  Bridge Contract  --[unlock]-->  ZION L1
```

### 10.2 Bezpečnost mostu

- **Kvorum validátorů:** multi-sig 3 ze 5 pro cross-chain atestace
- Ověření L1 hlavičky bloku a Merkle důkazů
- Rate limiting přenosů
- RPC: Ankr Premium (mainnet), publicnode.com (testnet)

### 10.3 Podporované sítě

| Síť | Stav |
|---------|--------|
| Base Sepolia (testnet) | ✅ Live testnet |
| Base Mainnet | 📅 MainNet launch |
| Arbitrum One | 📅 MainNet launch |
| BNB Smart Chain | 📅 MainNet launch |

### 10.4 L2 smart kontrakty

Širší ekosystém má nasazení na Base Sepolia v linii 2.9. V kódu V3 je L2 reprezentováno daemon bridge/DAO/atomic-swap a migrací účtování na 12 desetinných míst (flowers).

| Kontrakt | Popis |
|----------|-------------|
| **wZION** | ERC-20 wrapped ZION |
| **ZionBridge** | Lock/mint a burn/unlock most |
| **ZionStaking** | Stakování wZION za výnos |
| **ZionFarm** | Farmení likvidity s LP tokeny |
| **AtomicSwap** | Trustless atomové swapy |
| **ZionGovernance** | On-chain DAO hlasování (L2 zrcadlo) |
| **ZionTreasury** | Multi-sig treasury |
| **UniV3Pool** | wZION/USDC koncentrovaná likvidita na Uniswap V3 |

### 10.5 DeFi ekosystém

- **Staking** — zisk z protokolu
- **Farming** — LP odměny
- **DEX obchod** — wZION/USDC přes Uniswap V3
- **Atomic swapy** — HTLC cross-chain
- **Governance** — návrhy a hlasy s wZION

---

## 11. L3 — NCL, WARP a AI-native

L3 tvoří tři propojené moduly:

| Modul | Crate | Účel |
|--------|-------|---------|
| NCL | `zion-ncl` | Distribuovaná AI inference |
| WARP | `zion-warp` | Protokol cross-chain swapů |
| AI-native | `zion-ai-native` | AI agenti on-chain |

### 11.1 NCL — Neural Compute Layer

NCL mění těžební infrastrukturu v distribuovanou AI síť. Těžaři mohou paralelně řešit inference úlohy a dostávat NCL odměny.

**Životní cyklus protokolu:**

```
ncl.register   → těžař ohlašuje kapacitu NCL
ncl.get_task   → úloha z poolu
ncl.submit     → odevzdání výsledku
ncl.status     → ověření a platba
```

### 11.2 Typy úloh a odměny

| Typ úlohy | Základní odměna | Ověření |
|-----------|-------------|--------------|
| Hash Chaining v1 | ~0,001 ZION | Deterministické (BLAKE3) |
| Embeddings | ~0,001 ZION | Sampling |
| LLM Inference | ~0,010 ZION | Sampling + reputace |
| Image Classification | ~0,002 ZION | Hash modelu |
| Image Generation | ~0,020 ZION | Percepční hash |
| Speech to Text | ~0,005 ZION | CER/WER |
| Model Training | ~0,100 ZION | Konvergence loss |

### 11.3 Detekce NPU runtime

NCL automaticky vybere nejrychlejší backend:

| Platforma | Backend |
|----------|---------|
| Apple M-series | CoreML |
| NVIDIA GPU | TensorRT |
| Intel CPU/GPU | OpenVINO |
| Jiné | ONNX Runtime (fallback) |

**Časová alokace:** výchozí 70 % těžba / 30 % NCL; nastavitelné 50–90 % těžba. Těžba má vždy prioritu.

### 11.4 WARP — Cross-chain swap protokol

WARP umožňuje atomové swapy mezi ZION a tokeny napříč 7 rodinami řetězců:

| Rodina | Příklady | Stav |
|---|---|---|
| EVM (Ankr) | Base, Arbitrum, BSC, ETH | ✅ Implementováno |
| Cosmos IBC | ATOM, OSMO | ✅ Implementováno |
| Bitcoin | BTC, LTC | ✅ Implementováno |
| Solana | SOL, SPL | ✅ Implementováno |
| NEAR | NEAR | ✅ Implementováno |
| Polkadot | DOT | ✅ Implementováno |
| TON | TON | ✅ Implementováno |

WARP REST API běží na portu **8092** (Axum). Perzistence SQLite.

### 11.5 AI-native

Vrstva AI-native implementuje agenty jako protokolové objekty: registr modelů on-chain, AI-asistovaná governance a analýza dat on-chain.

---

## 12. L4 — herní svět ZION OASIS

**OASIS** je open-world Unreal Engine 5 napojený na blockchain ZION — vrstva, kde se herní ekonomika potkává s reálnými L1 tokeny.

**Klíčové koncepty:**

- **8 genesis teritorií** (Mount Zion, Cedar Forest, …)
- **9 úrovní vědomí** (Kabala: Malkuth → Keter)
- **8,25B ZION odměn** (5 genesis slotů × 1,65B, rozložení 10 let)
- **XP off-chain** — SQLite `oasis.db`, L1 zůstává čisté

**REST API** (port 8094): health, hráč, XP, žebříček, guildy, mapa teritorií, reward pooly — 9 endpointů.

**Stav:** specifikace Q3 2026, implementace hry Q4 2026+.

---

## 13. L5 — ZION Free World

> *„Svoboda se nedostane darem — buduje se blok po bloku.“*

**Cíl:** 2030 | **Stav:** vize a specifikace

L5 je humanitární a vědecká vrstva financovaná přímo protokolem. Cíl: infrastruktura pro svobodné komunity, výzkum free energy a humanitární mise.

### Pilíře

1. **Výzkum free energy** — kvantová a alternativní energetika, open-source hardware
2. **Humanitární mise** — voda, vzdělání, zdraví, potraviny
3. **Svobodné komunity** — energeticky soběstačné vesnice, mesh sítě, lokální ekonomiky ZION
4. **Vzdělávání a osvěta** — open-source vzdělávací platformy, osvěta k těžbě vědomí

### Zdroje financování

| Zdroj | Mechanismus |
|--------|-----------|
| Odměna za blok | 5 % / blok → fond L5/L6 Issobella (automaticky) |
| Humanitární desátek | 5 % / blok (automaticky) |
| DAO granty | Hlasování komunity (variabilní) |
| Příjmy L4 OASIS | Podíl z herní ekonomiky (variabilní) |

### Milníky

| Rok | Milník |
|------|----------|
| 2030 | Založení ZION Free World Foundation |
| 2031 | První výzkumná laboratoř |
| 2033 | Prototyp energetického generátoru |
| 2035 | Pilot v 10 komunitách |
| 2037 | Publikace open-source hardware specifikace |
| 2040 | Hromadná výroba — energie pro miliony |

---

## 14. L6 — ZION Issobella

> *„Hvězda není cíl — je začátek.“*

**Cíl:** 2040+ | **Stav:** dlouhodobá vize

**ZION Issobella** je vrcholová vrstva — vědecká observatoř a výzkumná stanice na LEO. Decentralizovaná governance přes ZION DAO, vědecká data veřejná.

### Mise

- **Astronomický výzkum** (bez atmosférické degradace)
- **Monitorování klimatu** (podpora L5)
- **Satelitní mesh síť** — redundantní P2P uzly ZION na oběžné dráze
- **Výzkumné centrum** — mikrogravitace, kvantové experimenty
- **Vzdělávání** — živé přenosy z orbity pro komunitu

### Financování

| Zdroj | Mechanismus |
|--------|-----------|
| Fond L5/L6 Issobella | 5 % / blok (automaticky z `V3/L1/core/src/emission.rs`) |
| Tail emise (2126+) | 724,784723787776 ZION/blok navždy |
| DAO Treasury | Dlouhodobé rezervy |
| L4 OASIS NFT | Speciální kosmické NFT kolekce |

### Milníky

| Rok | Milník |
|------|----------|
| 2040 | ZION Space Division — projekt Issobella zahájen |
| 2042 | Design a proveditelnost |
| 2045 | První modul vyroben |
| 2048 | První modul na oběžné dráze |
| 2050 | Plně provozní stanice |
| 2126 | Issobella financována tail emisí navždy |

---

## 15. Bezpečnost a kryptografie

### 15.1 Kryptografické primitivy

| Primitivum | Použití |
|-----------|--------|
| **BLAKE3** | Hashování transakcí, Merkle pomůcky |
| **Ed25519** | Podpisy transakcí a bloků |
| **Keccak-256 + SHA3-512** | Fáze pipeline Ekam Deeksha v2 |

### 15.2 Merkle stromy

Každý blok obsahuje Merkle kořen transakcí pro efektivní SPV.

### 15.3 Známá omezení a mitigace

| Omezení | Mitigace |
|------------|------------|
| P2P bez TLS | Plánováno Q2 2026 |
| Nedeterminismus LLM v NCL | Sampling + reputace těžařů |
| Velké modely (>7B parametrů) | Chunkovaný download přes IPFS |
| Latence inference | Geo-balancing úloh |

### 15.4 Bezpečnostní audit

Nezávislý audit je plánován na Q2 2026. Výsledky budou v `docs/AUDIT.md`.

### 15.5 Testové pokrytí

Kódbáze obsahuje ~1 300 automatických testů napříč L1 core, pool, miner, L2 kontrakty a L3 moduly — vše prochází bez selhání.

---

## 16. Roadmap

### 16.1 Historie releasů

```
v2.9.5  - TestNet genesis, Rust L1 stack               ✅ (leden 2026)
v2.9.6  - L2/L3/L4, Decade Decay,                     ✅
           WARP 7 řetězců, OASIS REST, Ankr RPC,
           nonce u64, ASIC skóre 90/100
v2.9.7  - Code freeze, 168h stabilita, API docs       ✅
v2.9.8  - Kanonická cesta Ekam Deeksha, opravy       ✅
v2.9.9  - Pure code cleanup, migrační strategie       📅
v3.0    - MainNet Genesis (blok #0)                   📅 Q4 2026
```

### 16.2 Klíčové milníky

| Milník | Datum | Kritérium úspěchu |
|-----------|------|------------------|
| 168h stabilita | ✅ bře 2026 | 0 kritických alertů, pool 7+ dní |
| GPU miner alpha | Q2 2026 | Funkční CUDA/OpenCL |
| Bezpečnostní audit | Q2 2026 | Žádné kritické zranitelnosti |
| Mobilní peněženka | Q3 2026 | iOS + Android App Store |
| MainNet Genesis | Q4 2026 | Blok #0 a aktivace genesis rezervy |
| wZION mainnet | Q4 2026 | Base/Arbitrum/BSC |
| NCL + WARP live | Q1 2027 | 1 000 NCL úloh/den, aktivní WARP swapy |
| L3 DAO (fáze 2) | 2027 | On-chain hlasování |
| L4 OASIS XP rollout | 2028 (cíl) | XP/ekonomika jako nekonsenzusová L4 |
| L5 Free World | 2030 | Nadace + laboratoř |
| 1. Decade Decay | 2036 | Odměna → 4 320 ZION |
| Start L6 Issobella | 2040 | Space Division |
| Tail emise | 2126 | 724,784723787776 ZION/blok navždy |

---

## 17. Právní vyloučení odpovědnosti

ZION je **open-source software** a **experimentální technologie** pod licencí MIT. ZION **není**:

- Cenný papír podle MiCA ani jiného rámce
- Investiční produkt s garantovaným výnosem
- Licencovaný finanční instrument

Účast na síti ZION je **dobrovolná** **na vlastní riziko**. Hodnota tokenu není zaručena. Cena může klesnout na nulu. Regulační prostředí se může změnit.

ZION je **komunitně spravovaný open-source protokol** a v linii V3 **není provozován jediným firemním emitentem**.

Viz také:

- [`legal/disclaimer.md`](../../legal/disclaimer.md)
- [`legal/token.md`](../../legal/token.md)
- [`legal/risk.md`](../../legal/risk.md)

---

## 18. Reference

| Zdroj | Popis |
|----------|-------------|
| [`V3/L1/core/src/emission.rs`](../L1/core/src/emission.rs) | Emisní konstanty (flowers, decay, tail, fee split) |
| [`V3/L1/core/src/genesis.rs`](../L1/core/src/genesis.rs) | Validace genesis a integrity rezerv |
| [`V3/L1/core/src/difficulty.rs`](../L1/core/src/difficulty.rs) | Algoritmus obtížnosti LWMA |
| [`V3/L1/cosmic-harmony/src/deeksha.rs`](../L1/cosmic-harmony/src/deeksha.rs) | Kanonické PoW Ekam Deeksha v2 |
| [`V3/L2/dao/src/proposal.rs`](../L2/dao/src/proposal.rs) | Typy návrhů DAO, kvorum, okna hlasování |
| [`docs/mainnet/MAINNET_CONSTITUTION.md`](../../docs/mainnet/MAINNET_CONSTITUTION.md) | Ústava mainnetu (frozen) |
| [`V3/ROADMAP.md`](../ROADMAP.md) | Stav implementace a milníky |
| [github.com/Yose144/Zion-2.9](https://github.com/Yose144/Zion-2.9) | Zdrojový kód (MIT) |

---

*„Věříme kódu. 144B ZION. Ani o jeden satoshi víc.“*  
**— Ekonomický manifest ZION**

---

**© 2026 přispěvatelé ZION (open source). Licence MIT. Whitepaper verze 3.0.**