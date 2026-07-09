# ZION TerraNova
## Mainnet Whitepaper v3.0

---

**Verze:** 3.0 — Připraveno k Mainnet Genesis
**Datum:** květen 2026
**Stav:** V3 mainnet implementace otestována; produkční nasazení v průběhu
**Licence:** MIT (open source)
**Repozitář:** `github.com/Yose144/2.9.6`

---

> *"In code we trust. 144 miliard ZION. Ani satoshi navíc."*

---

## Obsah

1. [Executive Summary](#executive-summary)
2. [Úvod: Proč ZION existuje](#úvod-proč-zion-existuje)
3. [Čtyři strukturální nedostatky](#čtyři-strukturální-nedostatky)
4. [Odpověď ZION: Šestivrstvá architektura](#odpověď-zion-šestivrstvá-architektura)
5. [Konsensus: Ekam Deeksha v2](#konsensus-ekam-deeksha-v2)
6. [Ekonomický model: Decade Decay](#ekonomický-model-decade-decay)
7. [Tokenomika a Genesis](#tokenomika-a-genesis)
8. [L2 — wZION Bridge a DeFi](#l2--wzion-bridge-a-defi)
9. [L3 — Inteligenční vrstva](#l3--inteligenční-vrstva)
10. [L4–L6: Dlouhý horizont](#l4l6-dlouhý-horizont)
11. [Bezpečnost, audit a pokrytí testy](#bezpečnost-audit-a-pokrytí-testy)
12. [DAO Governance](#dao-governance)
13. [Revenue systém](#revenue-systém)
14. [Živá infrastruktura](#živá-infrastruktura)
15. [Roadmapa](#roadmapa)
16. [Reference a původ kódu](#reference-a-původ-kódu)
17. [Právní prohlášení](#právní-prohlášení)

---

## Executive Summary

ZION TerraNova je Layer 1 blockchain s důkazem práce (Proof-of-Work), navržený k řešení čtyř strukturálních problémů, které trápí kryptoměny od jejich vzniku: centralizace těžby do rukou ASIC operátorů, přednostní alokace tokenů insiderům, nulový protokolární sociální dopad a volatilita způsobená náhlými změnami emise.

ZION je napsán od základů v jazyce **Rust** s **Tokio** async runtime. Představuje paměťově náročný PoW algoritmus **Ekam Deeksha v2**, který efektivně běží na běžných CPU a GPU a zároveň odolává ASIC specializaci. Jeho ekonomický model **Decade Decay** nahrazuje brutální čtyřletá půlení (halving) plynulým snížením o 20 % každých deset let, zakončeným věčnou tail emission, která garantuje motivaci těžařů na staletí.

Klíčové je, že **10 % z každé odměny za blok je automaticky a nezměnitelně alokováno na humanitární a vědecké účely** — 5 % do globálního Humanitárního fondu a 5 % do L5/L6 Issobella fondu pro dlouhodobý vědecký výzkum. Toto není marketingový slib; je to vynuceno přímo v konsensuálním kódu.

| Parametr | Hodnota |
|----------|---------|
| Celková nabídka (hard cap) | 144 000 000 000 ZION |
| Block time | 60 sekund |
| Počáteční odměna za blok | 5 400,067 ZION |
| Emisní model | Decade Decay (−20 % / 10 let) + tail emission od ~2126 |
| Tail emission | 724,784723787776 ZION / blok (navěky) |
| Těžební algoritmus | Ekam Deeksha v2 (256 KiB scratchpad, 6-fázový pipeline) |
| Konsensus | Proof-of-Work (Nakamoto) |
| Podpis | Ed25519 |
| Hashování | BLAKE3 |
| Formát adresy | Bech32 (`zion1…`) |
| Transakční model | UTXO |
| Atomická jednotka | 1 ZION = 1 000 000 000 000 flower (12 des. míst) |
| L2 wrapped token | wZION (ERC-20 na Base) |
| Jazyk kódu | Rust |

Celá kódová základna je open-source pod licencí MIT s přibližně **1 470 automatizovanými testy** a nulovým počtem selhávajících buildů.

---

## Úvod: Proč ZION existuje

Kryptoměna se zrodila z krásné myšlenky: permissionless, cenzuře odolný finanční systém, který nikdo nevlastní a je otevřený všem. Přesto téměř dvě desetiletí po genesis bloku Bitcoinu průmysl replikoval mnoho z problémů, které měl původně řešit.

Těžba — původně koncept "jeden CPU, jeden hlas" — je nyní ovládána průmyslovými ASIC farmami v regionech se subvencovanou elektřinou. Raní investoři a venture kapitálové fondy získávají nespravedlivé alokace ještě předtím, než se o projektu veřejnost dozví. Filantropie, pokud vůbec existuje, je dobrovolný dodatek spíše než protokolární záruka. A čtyřletý halving cyklus Bitcoinu vytváří předvídatelné, ale brutální šoky nabídky, které destabilizují těžařskou ekonomiku i cenové objevování.

ZION byl vytvořen jako přímá odpověď. Není to fork existujícího řetězce. Není to token na cizí síti. Je to čistá implementace Layer 1 blockchainu postavená specificky k řešení těchto čtyř strukturálních vad — každé designové rozhodnutí je vysledovatelné ke konkrétnímu problému a každý ekonomický parametr je ověřitelný v open-source kódu.

Projekt čerpá z dlouhé tradice open-source infrastruktury sloužící veřejnému dobru. Stejně jako Linux kernel, World Wide Web a samotný Bitcoin protokol je ZION především softwarová infrastruktura. Nemá marketingové oddělení. Má test suite.

---

## Čtyři strukturální nedostatky

### 1. Centralizace ASIC

Bitcoinův SHA-256 i Ethash byly původně těženy CPU a později GPU. V obou případech příchod ASIC (Application-Specific Integrated Circuits) rychle koncentroval hashrate do rukou několika průmyslových operátorů. Dnes čtyři těžební pooly ovládají většinu bitcoinového hashrate. "Decentralizace" slibovaná Satoshim se v praxi stala průmyslovou konsolidací.

**Odpověď ZION:** Ekam Deeksha v2 je záměrně paměťově náročný. Jeho 256 KiB scratchpad vyžaduje pseudonáhodné závislé čtení, které nelze efektivně pipeliningovat fixed-function hardwarem. ASIC navržený pro Ekam Deeksha by vypadal tak podobně jako běžný CPU s velkou cache, že by ztratil svou cenovou výhodu. Algoritmus dosahuje skóre 90/100 na nezávislých benchmarkách odolnosti vůči ASIC.

### 2. Přednostní alokace insiderům

Mnoho významných blockchain projektů alokovalo 15–50 % celkové nabídky zakladatelům, raným investorům a VC fondům před veřejným spuštěním. To vytváří strukturální nerovnost: insiderům prodávají za ceny, které veřejnost nemůže dorovnat, a komunita začíná svou účast již znevýhodněná.

**Odpověď ZION:** Fair Launch. Nebylo žádné ICO, žádný pre-sale, žádný SAFT a žádná alokace pro poradce. Jediný způsob, jak získat ZION, je vytěžit ho nebo obdržet v transakci. 11,31 % genesis premine je plně transparentní, časově uzamčeno kde je to vhodné, a jeho adresy jsou publikovány před spuštěním.

### 3. Nulový protokolární sociální dopad

Žádný významný blockchain protokol automaticky neodvádí část odměn za bloky na humanitární účely. Filantropie existuje jako dobrovolná, samohlášená aktivita jednotlivých držitelů nebo nadací. Neexistuje mechanismus, který by z darování udělal strukturální, nezastavitelnou vlastnost samotného protokolu.

**Odpověď ZION:** 10 % z každé odměny za blok je automaticky rozděleno protokolem do čtyř výstupů: 89 % těžařům, 5 % Humanitárnímu fondu, 5 % L5/L6 Issobella fondu a 1 % provozovateli poolu. Toto rozdělení je zakódováno v `V3/L1/core/src/emission.rs` na úrovni protokolu. DAO nemůže hlasovat o jeho změně.

### 4. Volatilita způsobená náhlými změnami emise

Čtyřletý halving cyklus Bitcoinu (−50 % přes noc) vytváří násilné šoky nabídky. Těžaři, kteří investovali do hardwaru na základě jedné úrovně odměny, najednou vidí své příjmy přepůleny bez postupného přizpůsobení. To nutí boom-bust cykly v těžařské ekonomice a přispívá k cenové volatilitě.

**Odpověď ZION:** Decade Decay snižuje odměnu za blok o 20 % každých 10 let (5 256 000 bloků). To je mírný, předvídatelný svah spíše než útes. Po 10 dekádách se odměna ustálí na věčné tail emission přibližně 724,785 ZION na blok — což zaručuje, že těžaři budou vždy motivováni zabezpečovat síť, bez spoléhání na nestabilní "fee-only" bezpečnostní model.

---

## Odpověď ZION: Šestivrstvá architektura

ZION je organizován jako zásobník šesti vrstev, každá nezávisle funkční a každá přidávající hodnotu bez závislosti na vyšších vrstvách.

```
┌─────────────────────────────────────────────────────────────┐
│  L6 — ZION Issobella    Orbitalní výzkumná stanice (2040+)   │
├─────────────────────────────────────────────────────────────┤
│  L5 — ZION Free World   Humanitární a vědecká nadace        │
│                         (cíl 2030)                          │
├─────────────────────────────────────────────────────────────┤
│  L4 — OASIS             Consciousness gaming + XP ekonomika  │
│                         (UE5 open-world, cíl 2028)           │
├─────────────────────────────────────────────────────────────┤
│  L3 — Inteligence       NCL AI marketplace + WARP bridge   │
│                         + AI-native agenti                   │
├─────────────────────────────────────────────────────────────┤
│  L2 — DeFi Bridge       wZION ERC-20 + Base/Arbitrum/BSC   │
│                         + DAO + atomické swapy              │
├─────────────────────────────────────────────────────────────┤
│  L1 — Core Chain        Ekam Deeksha v2 + UTXO + P2P       │
│                         + Stratum pool + LMDB               │
└─────────────────────────────────────────────────────────────┘
```

**L1** může běžet bez jakýchkoliv jiných vrstev. Solo těžař si stáhne node binárku, připojí se k P2P síti a začne těžit, aniž by se kdy dotkl L2–L6. Každá vyšší vrstva je opt-in.

### L1 — Core Blockchain

- **Runtime:** Rust + Tokio async
- **Databáze:** LMDB přes `heed` (memory-mapped, zero-copy čtení)
- **API:** JSON-RPC 2.0 přes TCP
- **Těžební protokol:** Stratum-style session wire (TCP, line-based)
- **P2P:** TCP gossip protokol s peer discovery, rate limiting a eskalujícími bany
- **Krypto:** Ed25519 podpis, BLAKE3 hashování, Bech32 `zion1…` adresy se 4-znakovým checksumem
- **Transakce:** UTXO model se SegWit-style BLAKE3 txidy
- **Poplatky:** 100 % spáleno (deflační tlak nad rámec emisního schedule)

### L2 — wZION Bridge a DeFi

- **wZION** je ERC-20 wrapped token na Base, Arbitrum a BNB Chain
- **Bridge:** Lock/mint + burn/unlock s 3-of-5 multi-sig validátorským quorumem
- **Smart kontrakty:** wZION, ZionBridge, ZionStaking, ZionFarm, AtomicSwap, ZionGovernance, ZionTreasury, UniV3Pool
- **DeFi:** Staking (12 % APR), liquidity farming, wZION/USDC na Uniswap V3, HTLC atomické swapy
- **Bezpečnost:** Fail-closed relayer — pokud není dosaženo validátorského quora, bridge abortuje před jakoukoliv L1 transakcí

### L3 — Inteligenční vrstva

- **NCL (Neural Compute Layer):** Distribuovaný AI inference marketplace, kde těžaři zpracovávají AI úlohy paralelně s těžbou
- **WARP:** Cross-chain swap protokol podporující 7 chain families (EVM, Bitcoin, Solana, NEAR, Polkadot, TON, Cosmos IBC)
- **AI-native:** On-chain AI agent framework s Hiran v2.2 — doménově specifický fine-tuned model (základ Llama-3.1-8B, QLoRA trénink na 22K instrukčních párech)

### L4–L6 — Dlouhý horizont

- **L4 (OASIS):** Unreal Engine 5 open-world hra propojená s blockchainem, s 9 úrovněmi vědomí a 8,25B ZION reward poolem distribuovaným přes 10 let
- **L5 (Free World):** Humanitární a vědecká nadace financovaná z 5 % alokace odměn za blok, s cílem spuštění v roce 2030
- **L6 (Issobella):** Dlouhodobá vize decentralizované vědecké výzkumné stanice na LEO (Low Earth Orbit), financované věčně tail emission od roku 2126

---

## Konsensus: Ekam Deeksha v2

Důkaz práce algoritmus se jmenuje **Ekam Deeksha** (sanskrt: "jedna iniciace"). Verze 2 je mainnet-track algoritmus aktivní od genesis bloku 0.

### Filozofie návrhu

Většina PoW algoritmů selhává v odolnosti vůči ASIC, protože spoléhá na jeden výpočetní primitiv. Pokud lze tento primitiv implementovat v silikonu, algoritmus padne. Ekam Deeksha v2 používá **šestifázový sekvenční pipeline**, který kombinuje více primitiv s paměťově náročnou fází uprostřed. ASIC by musel být efektivní v Keccak-256, SHA3-512, maticové multiplikaci, pseudonáhodném paměťovém přístupu, neurálních vektorových operacích a BLAKE3 — v podstatě obecný počítač, což poráží účel specializace.

### Šest fází

```
Vstup: block_header + nonce (u64)
  │
  ├─ Fáze 1: Keccak-256 .............. 32-bajtový digest
  ├─ Fáze 2: SHA3-512 ................ 64-bajtová expanze
  ├─ Fáze 3: Golden Matrix ........... Maticová multiplikační difúze
  ├─ Fáze 4: 256 KiB Scratchpad ...... Paměťově náročné plnění + závislé čtení
  ├─ Fáze 5: NPU Mixing .............. Neurální vektorové operace
  └─ Fáze 6: Cosmic Fusion ........... BLAKE3 finální hash redukce
  │
Výstup: 32-bajtový PoW hash
```

**Fáze 4 (Scratchpad)** je kotva odolnosti vůči ASIC. Pracovní sada 256 KiB se pohodlně vejde do moderní CPU L2 cache, ale vyžaduje pseudonáhodné závislé čtení, které poráží jak pipelining, tak skrývání latence paměti. ASIC by musel replikovat obecnou cache hierarchii, aby mohl soutěžit.

**Fáze 5 (NPU Mixing)** automaticky detekuje nejrychlejší dostupný AI backend — Apple CoreML, NVIDIA TensorRT, Intel OpenVINO nebo ONNX Runtime — a používá ho pro nativní hardwarovou akceleraci na běžných zařízeních.

### Úprava obtížnosti

ZION používá **LWMA (Linearly Weighted Moving Average)** s oknem 60 bloků:

- Cílový block time: **60 sekund**
- Úprava: **±25 % na blok** (celočíselná aritmetika, bez floating point)
- Timestamp sanity: **±120 sekund** od median-time-past
- Minimální obtížnost: **1 000**

LWMA reaguje plynule na změny hashrate detekované před pouhými sekundami, čímž předchází oscilacím a timestamp-gaming útokům, kterým trpí jednodušší algoritmy.

### Fork háky

Kód obsahuje konstanty pro hard-fork výšky pro budoucí upgrady konsensu. V aktuálním produkčním buildu je Ekam Deeksha v2 aktivní od výšky 0. Koordinovaný testnet rehearsal lze povolit přes cargo feature `testnet_fork_rehearsal` bez modifikace výchozí binárky.

---

## Ekonomický model: Decade Decay

### Proč Decade Decay?

Halving model Bitcoinu redukuje odměnu za blok o 50 % každé čtyři roky. To vytváří předvídatelný, ale násilný šok nabídky. Těžaři, kteří investovali do hardwaru na základě dané úrovně odměny, vidí své příjmy přes noc přepůleny. Výsledná volatilita hashrate se zpětně propisuje do cenové volatility.

ZION nahrazuje tento model **Decade Decay**: odměna za blok klesá o 20 % každých 10 let. To je mírný svah spíše než útes. Těžaři mají celou dekádu na přizpůsobení své ekonomiky a síť se vyhýbá boom-bust cyklům, které sužují čtyřleté halving systémy.

### Emisní schedule

| Dekáda | Roky | Odměna za blok (ZION) | Emise za dekádu |
|--------|------|----------------------|-----------------|
| 1 | 2026–2036 | 5 400,067 | ~28,38 miliard |
| 2 | 2036–2046 | 4 320,054 | ~22,71 miliard |
| 3 | 2046–2056 | 3 456,043 | ~18,17 miliard |
| 4 | 2056–2066 | 2 764,834 | ~14,53 miliard |
| 5 | 2066–2076 | 2 211,867 | ~11,63 miliard |
| 6 | 2076–2086 | 1 769,494 | ~9,30 miliard |
| 7 | 2086–2096 | 1 415,595 | ~7,44 miliard |
| 8 | 2096–2106 | 1 132,476 | ~5,95 miliard |
| 9 | 2106–2116 | 905,981 | ~4,76 miliard |
| 10 | 2116–2126 | 724,785 | ~3,81 miliard |
| **Tail** | **2126+** | **724,785** | **Navěky** |

Celková těžební emise za 100 let je přibližně 126,67 miliard ZION. Spolu s 16,28 miliardy genesis premine to zůstává v rámci hard capu 144 miliard.

### Tail emission

Po 10. dekádě (block height 52 560 001) se odměna za blok ustálí na **724,784723787776 ZION na blok** — navěky. Tato věčná minimální odměna zaručuje, že těžaři budou vždy motivováni zabezpečovat síť, bez ohledu na objem transakčních poplatků. ZION nikdy nevstoupí do nestabilního "fee-only" bezpečnostního modelu.

### Rozdělení 89/5/5/1

Každá odměna za blok je automaticky rozdělena protokolem do čtyř výstupů v coinbase transakci:

| Příjemce | Podíl | Účel |
|----------|-------|------|
| Těžaři (PPLNS) | 89 % | Zabezpečení sítě přes pool payouts |
| Humanitární fond | 5 % | Globální humanitární projekty |
| L5/L6 Issobella fond | 5 % | Věda, vesmír a dlouhodobý výzkum |
| Provozovatel poolu | 1 % | Infrastruktura poolu |

Toto rozdělení je vynuceno v `V3/L1/core/src/emission.rs` na úrovni protokolu. DAO nemůže hlasovat o jeho změně.

---

## Tokenomika a Genesis

### Celková nabídka

Hard cap je **144 000 000 000 ZION** — nastaven v genesis a neměnný. Žádné hlasování governance, žádný hard fork bez konsensu komunity a žádný skrytý inflační mechanismus ho nemůže zvýšit.

| Kategorie | Množství (ZION) | Podíl |
|-----------|-----------------|-------|
| Těžební emise (100 let + tail) | ~127 720 000 000 | 88,69 % |
| Genesis premine | 16 280 000 000 | 11,31 % |
| **Celkem** | **144 000 000 000** | **100 %** |

### Rozdělení Genesis Premine

Genesis blok (height 0) obsahuje 12 výstupů s celkem 16,28 miliardy ZION:

| # | Kategorie | Množství (ZION) | Lock |
|---|-----------|-----------------|------|
| 1–5 | OASIS Golden Egg / XP (5 slotů) | 8 250 000 000 | Žádný |
| 6 | DAO Treasury (hlavní rezerva) | 2 500 000 000 | 525 600 bloků (~1 rok) |
| 7 | DAO Grants & Bounties | 1 000 000 000 | 525 600 bloků (~1 rok) |
| 8 | DAO Ecosystem Bootstrap | 500 000 000 | 525 600 bloků (~1 rok) |
| 9 | Core Development Fund | 1 000 000 000 | Žádný |
| 10 | Network Infrastructure | 1 000 000 000 | Žádný |
| 11 | Genesis Projects Steward | 590 000 000 | Žádný |
| 12 | Humanitární — Children Future Fund | 1 440 000 000 | Žádný |

DAO Treasury lock je vynucen on-chain v `V3/L1/core/src/validation.rs` krok 11. Jakákoliv transakce utrácející DAO Treasury výstupy před blokem 525 600 je konsensem zamítnuta.

### Fee model

Všechny transakční poplatky jsou **spáleny** (zničeny). Nejdou těžařům, DAO ani žádné pokladně. To vytváří mírný deflační tlak nad rámec emisního schedule a sladí motivaci těžařů se zabezpečením sítě spíše než s extrakcí poplatků.

Minimální transakční poplatek je 1 000 flower (0,001 ZION) s minimální sazbou 1 flower na bajt.

---

## L2 — wZION Bridge a DeFi

### Wrapped ZION (wZION)

wZION je ERC-20 token na Base, Arbitrum a BNB Chain, který reprezentuje hodnotu ZION na EVM řetězcích. Bridge funguje na lock/mint + burn/unlock modelu:

1. Uživatel pošle ZION na L1 bridge vault adresu
2. Validátoři (3-of-5 multi-sig) potvrdí lock
3. wZION je mintnut na EVM řetězci
4. Zpět: wZION je spálen, validátoři potvrdí, ZION je uvolněn na L1

### Bezpečnost bridge

- **Validátorské quorum:** 3-of-5 multi-sig pro cross-chain atestace (produkční cíl; aktuálně staging s 1/2)
- **Fail-closed relayer:** Pokud není dosaženo validátorského quora, relayer vrátí chybu před jakoukoliv L1 transakcí. Neexistují žádné "syntetické" placeholder proofy.
- **Rate limity:** Minimálně 100 wZION na bridge, maximálně 5 000 000 na jednu transakci, 10 000 000 denní limit
- **Timelock:** Transfery nad 1 000 000 wZION spouštějí 24hodinové zpoždění
- **Auto-pause:** Bridge se automaticky pozastaví při detekci anomálie

### DeFi ekosystém

L2 DeFi vrstva poskytuje:

- **Staking:** Stake wZION a získej protokol yield (12 % APR, 7denní cooldown)
- **Liquidity Farming:** Poskytni wZION/WETH LP tokeny a získej odměny
- **DEX Trading:** wZION/USDC přes Uniswap V3 concentrated liquidity
- **Atomic Swaps:** Trustless HTLC cross-chain swapy mezi ZION a 7 chain families
- **DAO Governance:** On-chain proposal a hlasování s wZION

---

## L3 — Inteligenční vrstva

### Neural Compute Layer (NCL)

NCL transformuje ZION těžební infrastrukturu v distribuovanou AI compute síť. Těžaři mohou zpracovávat AI inference úlohy paralelně s těžbou a získávat dodatečné NCL odměny.

**Podporované AI backendy:**

| Platforma | Backend | Poznámky |
|-----------|---------|----------|
| Apple M-series | CoreML | Nativní Apple Neural Engine |
| NVIDIA GPU | TensorRT | CUDA-optimized |
| Intel CPU/GPU | OpenVINO | CPU/iGPU akcelerace |
| Generic | ONNX Runtime | Univerzální fallback |

Výchozí časová alokace: 70 % těžba / 30 % NCL, konfigurovatelné od 50–90 % těžba. Těžba má vždy prioritu.

### WARP — Cross-Chain Swap Protokol

WARP umožňuje atomické swapy mezi ZION a tokeny napříč 7 chain families:

| Chain Family | Příklady |
|---|---|
| EVM | Base, Arbitrum, BSC, Ethereum |
| Cosmos IBC | ATOM, OSMO |
| Bitcoin | BTC, LTC |
| Solana | SOL, SPL tokeny |
| NEAR | NEAR |
| Polkadot | DOT |
| TON | TON |

### AI-Native a Hiran v2.2

Hiran v2.2 je doménově specifický fine-tuned model pro ZION ekosystém:

- **Základní model:** `unsloth/Meta-Llama-3.1-8B-Instruct`
- **Trénink:** QLoRA s curriculum learning (5 fází, max rank 64)
- **Dataset:** 22 181 instrukčních párů
- **Inference:** ~40 tokenů/s na RTX 4090 (FP16)
- **Integrace:** `zion hiran` CLI příkazy, Docker service s llama.cpp + CUDA

---

## L4–L6: Dlouhý horizont

### L4 — OASIS Game World

OASIS je Unreal Engine 5 open-world hra propojená se ZION blockchainem. Představuje "consciousness mining" vrstvu, kde je hráčská angažovanost a progrese odměňována skutečnými ZION tokeny.

- **8 Genesis Territories** s unikátními ekonomikami
- **9 úrovní vědomí** (inspirováno Kabbalah Sefira: Malkuth až Keter)
- **8,25 miliard ZION reward pool** distribuovaný přes 10 let
- XP je sledováno off-chain v SQLite; L1 konsensus zůstává čistý PoW

**Consciousness Period (2026–2035):** Během první dekády OASIS přidává bonusové odměny nad rámec základní těžby:

| Úroveň | Multiplikátor | Celková odměna / blok |
|--------|---------------|----------------------|
| Physical (L1) | 1,0x | 5 400,07 ZION |
| Mental (L2) | 1,1x | 7 127,67 ZION |
| Conscious (L4) | 1,3x | 7 440,00 ZION |
| Enlightened (L6) | 2,0x | 8 539,33 ZION |
| On The Star (L9) | 10,0x | 21 096,37 ZION |

Po roce 2035 je bonusový pool vyčerpán a těžba pokračuje pouze základní odměnou.

### L5 — ZION Free World (cíl: 2030)

ZION Free World Foundation je humanitární a vědecká organizace financovaná přímo z 5 % alokace odměn za blok. Její pilíře:

1. Výzkum svobodné energie — kvantová a udržitelná energie, open-source hardware
2. Humanitární mise — pitná voda, vzdělání, zdravotnictví, potravinová bezpečnost
3. Svobodné komunity — energeticky nezávislé vesnice, mesh sítě, lokální ZION ekonomiky
4. Vzdělání a osvěta — open-source vzdělávací platformy

### L6 — ZION Issobella (cíl: 2040+)

Pojmenováno podle "ISS" + "Issobella", jde o dlouhodobou vizi decentralizované vědecké výzkumné stanice na LEO (Low Earth Orbit). Všechna vědecká data by byla veřejná, governance by byla řešena přes ZION DAO a financování by pocházelo z věčné tail emission od roku 2126.

---

## Bezpečnost, audit a pokrytí testy

### Výsledky interního auditu

Komplexní interní bezpečnostní audit byl dokončen v dubnu–květnu 2026, s identifikací a vyřešením všech kritických a high-severity nálezů před mainnet nasazením:

| Nález | Závažnost | Popis | Řešení |
|-------|-----------|-------|--------|
| F1 | Critical | Chybějící kontrola zachování hodnoty UTXO v peer blocích | PR #20 |
| F2 | High | XOR-based "Merkle root" zranitelný kolizím | PR #25 — BLAKE3 binární Merkle strom od genesis |
| F3 | Critical | Wallet klíče v plaintext JSON | PR #18 — šifrovaná wallet s PBKDF2 + AES-256-GCM |
| F3b | Critical | Credentisaly (PAT, API klíče, SSH) v git historii | `git filter-repo` + rotace (2026-05-07) |
| F4 | Medium | Bridge unlock spoléhal na relayer důvěru | PR #22 — L1 multisig vynucení (3/5) |
| F5 | Medium | Příliš mnoho unwrap/expect | PR #23 + #24 — strukturované error handling |
| F6 | Medium | Zdrojové archivy v repozitáři | Cleanup + history rewrite |
| Relayer | Medium | Možné syntetické placeholder proofy | PR #27 — fail-closed quorum |
| native-ffi | Medium | Unsafe C boundary bez kontraktů | PR #28 — safety kontrakty + `try_*` wrappery |

### Pokrytí testy

Kódová základna obsahuje přibližně **1 470 automatizovaných testů** napříč 13 crates, všechny procházející s nulovým počtem selhání:

| Crate | Testy | Poznámky |
|-------|-------|----------|
| zion-core | 488 lib | Konsensus, validace, mempool, P2P, RPC, wallet |
| zion-cosmic-harmony | ~100 | PoW algoritmus, scratchpad, NPU, obtížnost |
| zion-pool | 82 (53 + 29) | Validace share, PPLNS, session lifecycle, proxy |
| zion-miner | 59 | CPU/GPU backendy, telemetry |
| zion-native-ffi | 13–28 | Safety kontrakty algoritmů |
| zion-bridge | 193 (130 + 63) | Relay, validace, E2E burn-to-unlock |
| zion-dao | 65 (40 + 25) | Proposals, hlasování, treasury |
| zion-atomic-swap | 18 | HTLC, refund loop |
| zion-warp | 251 | 7-chain adaptéry |
| zion-ncl | 43 | AI task marketplace |
| zion-ai-native | 195 | Agent framework |
| zion-cli | 21 | Operátorské příkazy |

### Clean Gate

- `cargo fmt --all --check` — prochází
- `cargo clippy --workspace --all-targets` — prochází (exit 0)
- `cargo test --workspace --release -- --test-threads=1` — prochází
- `cargo audit` — 0 zranitelností

---

## DAO Governance

### DAO Treasury

DAO Treasury drží 4 miliardy ZION (24,6 % premine), uzamčeno do bloku 525 600 (~1 rok po genesis):

| Alokace | ZION | Účel |
|---------|------|------|
| Community Governance | 2 500 000 000 | Primární rezerva |
| Grants & Bounties | 1 000 000 000 | Vývojářské granty |
| Ecosystem Bootstrap | 500 000 000 | Růst ekosystému |

### Hlasování

- **1 ZION = 1 hlas** (snapshot-weighted)
- **Delegace:** Podporováno governance vrstvou
- **Pre-execution lock:** 48 hodin mezi schválením a provedením

| Typ proposal | Quorum | Trvání |
|--------------|--------|--------|
| Parametr | 10 % | 7 dní |
| Treasury | 15 % | 7 dní |
| Emergency | 20 % | 3 dny |
| Podmínka průchodu | votes_for > votes_against | — |

### Treasury Spending

Multi-sig ochrana: **5-of-7 podpisů** vyžadováno pro každou treasury transakci.

### Neměnné parametry

DAO **nemůže** změnit následující bez community-wide hard forku:

- Celková nabídka (144 miliard ZION)
- Genesis alokace (16,28 miliardy ZION)
- Block time (60 sekund)
- Těžební algoritmus (Ekam Deeksha v2)
- Typ konsensu (Proof-of-Work)
- Rozdělení odměn (89/5/5/1 %)

### Timeline decentralizace

| Fáze | Období | Funkce |
|------|--------|--------|
| Fáze 1 | 2025–2026 | Snapshot hlasování, off-chain signaling |
| Fáze 2 | 2026–2027 | On-chain proposal lifecycle (mainnet) |
| Fáze 3 | 2027+ | Plná decentralizace; quadratic voting R&D |

---

## Revenue systém

ZION V3 revenue systém je **multi-stream ekonomický engine** navržený k generování udržitelného financování pro ekosystém prostřednictvím tří kanálů:

### Kanál 1: Kánonická ZION těžba (50 %)

Těžaři připojení k ZION poolu získávají block rewards přes PPLNS (Pay Per Last N Shares) systém. Pool operator fee je 1 %, humanitární desátek 5 % a Issobella fond dostává 5 %. Zbývajících 89 % jde těžařům.

### Kanál 2: Multi-Algo External (25 %)

**External Pool Proxy** (`revenue-proxy` binárka) poskytuje transparentní Stratum bridge do externích poolů (2miners, MoneroOcean, ZPool). Když se těžař připojí k ZION v módu "Revenue" nebo "Auto", pool ho může přesměrovat na nejvýhodnější externí pool přes `PoolMessage::ProxyRedirect` protokolovou zprávu.

Funkce:
- Substituice wallet v `mining.authorize`/`mining.subscribe`/`login`
- Auto-reconnect s exponenciálním backoff
- Detekce IP-ban a failover
- Multi-coin startup přes `ZION_PROXY_COINS` (např. `KAS,ETC,ALPH`)

### Kanál 3: NCL AI Compute (25 %)

Těžaři přiřazení do NCL skupiny zpracovávají AI inference úlohy paralelně s těžbou. Úlohy zahrnují embeddings, LLM inference, klasifikaci obrazu a trénink modelů. Odměny jsou trackovány v `RevenueCollector` a vypláceny přes PPLNS systém poolu.

### Revenue Journal a Startup Replay

Všechny revenue události jsou zapisovány do append-only JSONL journalu s denní rotací. Při restartu pool serveru je journal automaticky replayován k rekonstrukci akumulovaného stavu, čímž se předchází ztrátě dat při pádech nebo deploy.

---

## Živá infrastruktura

Od května 2026 je následující infrastruktura provozuschopná:

**Pražský node (91.98.122.165):**
- V3 mainnet node běžící na height 26 910+
- RPC endpoint: `http://91.98.122.165:8443`
- Prometheus metriky: `http://91.98.122.165:9115/metrics`
- Next.js website s 72 statickými routami
- Pool server (Stratum port 3333, API port 8080)
- 12 Docker kontejnerů v běhu

**Poznámka:** Pražský node aktuálně běží v izolovaném módu (single peer), zatímco se provizují dodatečné seed nody v US, Singapuru a Helsinkách.

---

## Roadmapa

### Dokončeno

| Milník | Datum |
|--------|-------|
| TestNet genesis (v2.9.5) | leden 2026 |
| Code freeze & 168h stability test | březen 2026 |
| On-chain fee-split enforcement live (blok 465) | březen 2026 |
| Interní bezpečnostní audit (F1–F6 vyřešeno) | duben–květen 2026 |
| Genesis konsensus od bloku 0 (TX_HASH_V2 + BODY_ROOT_V2) | květen 2026 |
| History scrub & credential rotation | květen 2026 |
| Revenue systém Fáze A–E dokončeny | květen 2026 |
| Hiran v2.2 AI model trénink & CLI integrace | květen 2026 |
| DeFi ekosystém + explorer (72 rout) | květen 2026 |
| ~1 470 testů prochází, 0 selhání | květen 2026 |

### V průběhu

| Milník | Cíl |
|--------|-----|
| GPU miner alpha (CUDA/OpenCL) | Q2 2026 |
| Bridge 3/5 validator provisioning | Q2 2026 |
| CI infrastruktura (GitHub Actions) | Q2 2026 |

### Plánováno

| Milník | Cíl |
|--------|-----|
| Externí bezpečnostní audit (Trail of Bits / Halborn / OtterSec) | Q3 2026 |
| Bug bounty program | Q3 2026 |
| Mobilní wallet (iOS + Android) | Q3 2026 |
| **MainNet Genesis #0** | **Q4 2026** |
| wZION mainnet na Base/Arbitrum/BSC | Q4 2026 |
| NCL + WARP live (1 000 úloh/den) | Q1 2027 |
| L3 DAO Fáze 2 (on-chain hlasování) | 2027 |
| L4 OASIS XP rollout | 2028 |
| L5 ZION Free World Foundation | 2030 |
| 1. Decade Decay | 2036 |
| L6 ZION Issobella Space Division | 2040+ |
| Tail emission začíná | 2126 |

---

## Reference a původ kódu

| Zdroj | Cesta | Popis |
|-------|-------|-------|
| Emisní konstanty | `V3/L1/core/src/emission.rs` | Decade Decay, fee split, tail reward |
| Genesis blok | `V3/L1/core/src/genesis.rs` | 12 premine výstupů, DAO lock, genesis message |
| PoW algoritmus | `V3/L1/cosmic-harmony/src/deeksha.rs` | Ekam Deeksha v2 kanonický pipeline |
| Obtížnost | `V3/L1/core/src/difficulty.rs` | LWMA DAA |
| Validace | `V3/L1/core/src/validation.rs` | 11-kroková validace bloků |
| Wallet | `V3/L1/core/src/wallet.rs` | UTXO coin selection, batch payouts |
| DAO proposals | `V3/L2/dao/src/proposal.rs` | Quorum, hlasovací okna |
| Constitution | `docs/mainnet/MAINNET_CONSTITUTION.md` | Neměnný protokolární charter |
| Status | `StatusV3.md` | Aktuální provozní stav |
| Roadmap | `V3/ROADMAP.md` | Inženýrské fáze a gap inventory |
| Revenue plán | `REVENUE_IMPLEMENTATION_PLAN.md` | Delivery tracker |
| Zdrojový repozitář | `github.com/Yose144/2.9.6` | MIT licence |

---

## Právní prohlášení

ZION TerraNova je **open-source software** a **experimentální technologie** vydaná pod licencí MIT. **Není**:

- Cenným papírem podle MiCA ani žádného jiného regulačního rámce
- Investičním produktem s garantovaným výnosem
- Licencovaným finančním instrumentem

Účast na síti ZION je **dobrovolná** a probíhá **na vlastní riziko**. Hodnota tokenu není garantována. Cena může klesnout na nulu. Regulační prostředí se může změnit.

ZION je **komunitou provozovaný open-source protokol**. Žádná jednotlivá společnost neprovozuje síť. Všechny transakce jsou peer-to-peer.

Pro další právní informace viz:
- `legal/DISCLAIMER.md`
- `legal/TOKEN_NOT_SECURITY.md`
- `legal/RISK_DISCLOSURE.md`

---

> *"Gate, Gate, Paragate, Parasamgate, Bodhi Svaha"*
>
> — Dedikace genesis bloku, 2026

**ZION TerraNova v3.0 — MainNet Genesis**

**2026 ZION Open-Source Contributors. MIT Licence.**
