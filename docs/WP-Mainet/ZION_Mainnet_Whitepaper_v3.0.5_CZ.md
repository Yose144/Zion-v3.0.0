# ZION TerraNova — Whitepaper pro Mainnet v3.0.5 (Kanonická verze)

**Verze:** 3.0.5 — Mainnet Beta  
**Datum:** Červenec 2026  
**Autoři:** ZION Open-Source Contributors  
**Licence kódu:** MIT  
**Stav:** Mainnet Beta — 11/11 služeb aktivních, protocol `zion-v3-node/3.0.5`, veřejný launch 31. prosince 2026  
**Jazyk:** Čeština

> **Kanonický zdroj pravdy:** Tento dokument nahrazuje všechny předchozí drafty whitepaperů, včetně `docs/WP-Mainet/ZION_Mainnet_Whitepaper_v3.0_CZ.md`, `docs/WP3.0/WHITEPAPER_v3.0.md` a legacy verzí 2.9.x. Pro aktuální technickou pravdu ověřujte `StatusV3.md`, `V3/ROADMAP.md`, `3.0.5.md` a kód v `V3/`.

---

> *„V kódu věříme. 144 miliard ZION. Ne jeden satoshi navíc."*

---

## Obsah

1. [Abstrakt](#1-abstrakt)
2. [Manifest](#2-manifest)
3. [Od 2.9 k 3.0.5 — stručná historie](#3-od-29-k-305--stručná-historie)
4. [Živý stav sítě](#4-živý-stav-sítě)
5. [Architektura L1](#5-architektura-l1)
6. [Konsensus — Ekam Deeksha v2](#6-konsensus--ekam-deeksha-v2)
7. [Ekonomický model](#7-ekonomický-model)
8. [L2 — wZION bridge a DeFi](#8-l2--wzion-bridge-a-defi)
9. [L3 — NCL, WARP a AI-Native](#9-l3--ncl-warp-a-ai-native)
10. [L4 — herní svět ZION OASIS](#10-l4--herní-svět-zion-oasis)
11. [L5 — ZION Free World a L6 — ZION Issobella](#11-l5--zion-free-world-a-l6--zion-issobella)
12. [AuxPoW merge mining](#12-auxpow-merge-mining)
13. [ZionDex](#13-ziondex)
14. [Bezpečnost, kryptografie a historie auditů](#14-bezpečnost-kryptografie-a-historie-auditů)
15. [DAO governance](#15-dao-governance)
16. [Revenue systém — multistream architektura](#16-revenue-systém--multistream-architektura)
17. [Mainnet připravenost a testování](#17-mainnet-připravenost-a-testování)
18. [Roadmap](#18-roadmap)
19. [Právní vyloučení odpovědnosti](#19-právní-vyloučení-odpovědnosti)
20. [Reference](#20-reference)

---

## 1. Abstrakt

**ZION TerraNova** je kryptoměna typu proof-of-work se šestivrstvou architekturou (L1–L6), navržená tak, aby odolávala ASICům, spravedlivě rozdělovala nově vzniklou hodnotu, automaticky financovala humanitární projekty a vědecký výzkum, a to při emisním plánu na 100 let.

Toto je **kanonický whitepaper verze 3.0.5**. Odráží stav sítě po decimal forku 3.0.3, hard genesis resetu 3.0.4 a operacionalizaci 3.0.5 „All Green". Dokumenty 2.9.x jsou považovány za legacy kontext; technickou pravdu definuje kód v `V3/`, `StatusV3.md`, `3.0.5.md` a `V3/ROADMAP.md`.

Klíčové parametry na první pohled:

| Parametr | Hodnota |
|----------|---------|
| **Celková nabídka** | 144 000 000 000 ZION (tvrdý strop) |
| **Čas bloku** | 60 sekund |
| **Odměna za blok (1. dekáda)** | 5 400,067 ZION |
| **Emisní model** | Decade Decay (−20 % každých 10 let) |
| **Trvalá odměna od ~2126** | 724,784723787776 ZION/blok — navěky |
| **Těžební algoritmus** | Ekam Deeksha v2 (CPU/GPU, odolný vůči ASIC) |
| **Podpisová křivka** | Ed25519 |
| **Hashování** | BLAKE3 |
| **Formát adresy** | Bech32 (`zion1…`) |
| **Transakční model** | UTXO + rozšíření o account-model memo |
| **Konsensus** | Proof-of-Work (Nakamoto) |
| **Atomická jednotka** | 1 flower; **1 ZION = 1 000 000 flowers** (6 desetinných míst) |
| **L2 wrapped token** | wZION (ERC-20 na Base, Arbitrum, BSC, Polygon, Optimism, Avalanche) |
| **Programovací jazyk** | Rust (Tokio async runtime) |
| **Verze protokolu** | `zion-v3-node/3.0.5` |
| **Genesis hash** | `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` |
| **Živá výška** | 827+ a roste |
| **Produkční server** | `62.171.141.136` |
| **Cíl veřejného launchi** | 31. prosince 2026 |

Z každé odměny za blok putuje **10 %** automaticky na humanitární a vědecké účely: 5 % do Humanitárního fondu a 5 % do fondu L5/L6 Issobella. Dalších 1 % je protokolem spáleno. Toto rozdělení vynucuje samotný protokol a nelze jej změnit hlasováním DAO.

---

## 2. Manifest

### 2.1 Proč svět potřebuje ZION

Většina kryptoměnových projektů trpí stejnými systémovými neduhy jako tradiční finance — jen s jiným kabátem:

- **Insiderská alokace** — venture kapitál a týmové tokeny vytvářejí strukturální nerovnost.
- **ASIC centralizace** — specializovaný hardware rychle vytlačí běžné uživatele.
- **Technologie bez smyslu** — v protokolu neexistuje mechanismus přerozdělení hodnoty zpět společnosti.
- **Šokové halvingy** — události jako bitcoinové půlení způsobují náhlé otřesy na straně nabídky.
- **Křehké bridge** — wrapped asset závisí na neprůhledných multi-sigech bez on-chain accountability.

### 2.2 Jak ZION odpovídá

| Neduh | ZION řešení |
|-------|-------------|
| Insider tokeny | Fair Launch — žádný předprodej, žádné ICO |
| ASIC centralizace | Ekam Deeksha v2 — paměťově náročný, optimalizovaný pro CPU/GPU |
| Technologie bez smyslu | 10 % z každé odměny vynuceno kódem |
| Nabídkové šoky | Decade Decay — postupné −20 % za dekádu + věčný tail |
| Neprůhledné bridge | 5/5 validator quorum, on-chain důkazy, timelocky, daily limit |

### 2.3 Pět pilířů

ZION vyrůstá z etických principů, které překládá do konsenzuálních pravidel:

- **Dharma** — projekt má účel přesahující finanční zisk.
- **Ahimsa** — neubližovat (Fair Launch, odolnost vůči ASIC).
- **Seva** — služba (humanitární desátek).
- **Satya** — pravda (open-source, auditovatelnost on-chain).
- **Karma** — co dáváš, to dostáváš (consciousness mining, odměna za věrnost).

---

## 3. Od 2.9 k 3.0.5 — stručná historie

### 3.1 Éra 2.9.x

ZION začal jako Rust rewrite vícevrstvé blockchainové vize. Testnetová linie 2.9.x ověřila základní myšlenky — CosmicHarmony PoW, šestivrstvou architekturu a cross-chain bridge — ale akumulovala technický dluh a používala 1e12 atomickou škálu nekompatibilní s EVM bridgingem.

### 3.2 v3.0.0–v3.0.2 — cesta k mainnet genesis

V3 mainnet linie přinesla čistou implementaci v Rustu, Ed25519 podpisy, BLAKE3 hashování, UTXO model s account-model rozšířeními a algoritmus Ekam Deeksha v2. První mainnet genesis blok obsahoval 14 ústavních premine výstupů.

### 3.3 v3.0.3 — Decimal Fork (27. 6. 2026)

Aby ZION mohl čistě bridgovat na EVM chainy (18 desetinných míst) a zjednodušit uživatelská čísla, provedl decimal fork:

- **Před:** 1 ZION = 1 000 000 000 000 flowers (12 desetinných míst)
- **Po:** 1 ZION = 1 000 000 flowers (6 desetinných míst)
- **Migrační výška:** 18 850 na pre-reset chainu
- **RPC kompatibilita:** `scaled_amount()` helper normalizuje pre-migration zůstatky
- **Kanonické pojmenování:** `_flowers` je on-chain jednotková přípona

Fork zachoval všechny hashe bloků 0..18 850 a změnil pouze display a kontraktní škálování pro nové bloky.

### 3.4 v3.0.4 — Hard Genesis Reset (6. 7. 2026)

Bezpečnostní incident s kompromitovaným Edge serverem a uniklými EVM/týmovými klíči přinutil k plnému hard genesis resetu. Reset:

- Přesunul všechny služby na nový server: `62.171.141.136`
- Zregeneroval všech 14 premine + 5 canonical + bridge vault adres
- Deploynul 7 nových kontraktů na Base Mainnet (wZION, ZIONBridge, ZIONGovernance, ZIONTreasury, ZIONStaking, ZIONFarm, ZIONAtomicSwap)
- Implementoval account-model `memo` pole a sjednocené L2 watcher skenování
- Opravil dva kritické konsenzuální bugy:
  - **F1 (ZION-2026-001):** Chybějící ověření podpisu u P2P account transakcí
  - **F5 (ZION-2026-002):** Chybějící validace zůstatku odesílatele umožňující neomezenou inflaci

Nový genesis hash je `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`.

### 3.5 v3.0.5 — „All Green" Operationalizace (9. 7. 2026)

Upgrade 3.0.5 operacionalizoval celý mainnet stack:

- Bump protokolu z 3.0.3 na 3.0.5
- Sjednocení dokumentace, odstranění starých IP a falešných commit hashů
- Build a deploy všech L2/L3 služeb (bridge, DAO, atomic-swap, WARP)
- Oprava web Docker deployu (image z 2,57 GB na 377 MB)
- Zapnutí 2minutového watchdog timeru s auto-restartem
- Ověření E2E memo testů v bloku 752
- Oprava memory leaků pomocí bounded block retention a kanálů

### 3.6 v3.0.5+ — aktuální stav (13. 7. 2026)

Nedávné milníky:

- **AuxPoW merge mining** integrován do pool serveru a dashboardu (11 externích coinů)
- **Škálovatelnost poolu** optimalizována pro 1 000+ minerů (F1-F6, P7-P10)
- **Non-EVM tokeny** deployovány na Solana SPL a Stellar native asset
- **ZionDex** integrován s L3 WARP API a cross-chain AMM routingem
- **Lightning Network** LND Docker stack připraven pro Edge deploy

---

## 4. Živý stav sítě

### 4.1 Topologie

```
Edge Server (62.171.141.136) — primární 24/7 node + pool
  ├── zion-node    :8333 P2P, 127.0.0.1:8443 RPC
  ├── zion-node2   :8334 P2P, 127.0.0.1:8448 RPC (follower)
  ├── zion-pool    :8444 Stratum
  ├── zion-bridge  :9101 metrics
  ├── zion-dao     :8450 API
  ├── zion-atomic-swap :8452 API
  ├── zion-warp    :8453 API
  ├── zion-oasis, zion-free-world, zion-issobella
  ├── zion-dashboard :8766 (Basic Auth přes nginx)
  ├── nginx        :80/443 → web + RPC proxy
  └── zion-web-next Docker container

Core/Local (109.81.87.10) — backup node + AI služby
  └── zion-backup-node :8333 P2P, 127.0.0.1:8446 RPC
```

### 4.2 Živé metriky (13. 7. 2026)

| Metrika | Hodnota |
|---------|---------|
| Protokol | `zion-v3-node/3.0.5` |
| Výška chainu | 827+ |
| Genesis hash | `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` |
| Aktivní služby | 11/11 |
| P2P peerů | 1 (3-node mesh) |
| Pool minerů | 11+ |
| Pool hashrate | ~365 KH/s |
| Circulating supply | 16,78 mld. ZION |
| Celková nabídka | 144 mld. ZION |
| Velikost web image | 377 MB |
| Využití disku | 34G / 145G (24 %) |
| Využití RAM | 2,2G / 7,8G (28 %) |

### 4.3 Veřejné endpointy

| Služba | Endpoint |
|--------|----------|
| Web | `https://zionterranova.com` |
| Dashboard | `https://dashboard.zionterranova.com` |
| Pool | `62.171.141.136:8444` |
| Veřejný RPC | `rpc.zionterranova.com:8443` (nginx TCP proxy) |

---

## 5. Architektura L1

### 5.1 Technologický stack

```
┌─────────────────────────────────────────────────┐
│  JSON-RPC 2.0 (TCP)           konfigurovatelné  │
│  Pool Stratum Session Wire    konfigurovatelné  │
├─────────────────────────────────────────────────┤
│  Konsenzusní engine (Ekam Deeksha v2)           │
│  Mempool  ·  Block Builder  ·  DAA (LWMA)         │
├─────────────────────────────────────────────────┤
│  UTXO Set  ·  Merkle Tree  ·  Fee Calculator    │
├─────────────────────────────────────────────────┤
│  Persistence (LMDB/heed)                        │
│  P2P Gossip (TCP)              konfigurovatelné  │
└─────────────────────────────────────────────────┘
```

- **Runtime:** Rust + Tokio async
- **Databáze:** LMDB (memory-mapped) přes `heed`
- **API:** JSON-RPC 2.0 přes TCP
- **Těžební protokol:** Stratum-style session wire v `V3/L1/pool`
- **Peer-to-peer:** TCP gossip protokol

### 5.2 UTXO model

ZION používá Unspent Transaction Output model. Každá transakce spotřebuje jeden nebo více UTXO a vytváří nové.

```rust
pub struct TxOutput {
  pub amount: u64,      // Množství ve flowers (atomické jednotky)
  pub address: String,  // Cílová adresa (zion1...)
  pub memo: Option<String>,
}
```

Výstupy jsou zamčeny na Ed25519 veřejné klíče. Utrácení vyžaduje platný podpis. V3.0.4 memo hard fork přidal volitelné 256B ASCII `memo` pole do UTXO i account-model transakcí, což L2 watcherům umožňuje parsovat intent-based zprávy jako `BRIDGE:0x...`, `DAO:vote:1:yes` a `SWAP:LOCK:<hash>:120:base:0x...`.

### 5.3 Formát adresy

Adresy používají **Bech32** kódování s lidsky čitelnou předponou `zion1`:

```
zion1q540v6y4f0s4v3n0f8t740t53494z56024u645c
```

Bech32 poskytuje detekci chyb a eliminuje nejednoznačné znaky (0/O, l/1).

### 5.4 Fee politika — 100 % burn

Všechny transakční poplatky jsou **spáleny** (zničeny). To z ní činí mírně deflační měnu nad rámec emisního plánu. Těžaři jsou odměňováni výhradně block rewardem, což drží jejich motivaci v souladu se zabezpečením sítě.

Konstanty (`V3/L1/core/src/fee.rs`):
- `MIN_TX_FEE = 1_000` flowers (0,001 ZION)
- `MIN_FEE_RATE = 1` flower/byte
- `MAX_TX_SIZE = 100_000` bytes
- Burn adresa: `zion1burn0000000000000000000000000000000dead`

### 5.5 P2P síť

- TCP gossip protokol
- Discovery přes hardcoded seed peery
- Šíření bloků během sekund
- Peer banování za protokolová porušení
- Rate limiting: max 100 zpráv/60 s na peer
- Eskalující bany: 300 s → 1 800 s → 7 200 s (po 3. strike permanentní)
- Max peerů: 128
- IBD engine s batch sync (500 bloků/request), stall detection a peer round-robin

---

## 6. Konsensus — Ekam Deeksha v2

### 6.1 Jméno algoritmu

Proof-of-work algoritmus se jmenuje **Ekam Deeksha** (sanskrt: „jedna iniciace"). Verze 2 je mainnet-track algoritmus.

### 6.2 Cíle návrhu

1. **Odolnost vůči ASIC** — paměťově náročné fáze brání dominanci fixed-function hardware
2. **Přátelský k CPU/GPU** — efektivní na běžném hardwaru včetně Apple Silicon NPU
3. **Multi-stage pipeline** — šest sekvenčních fází brání shortcut optimalizacím

### 6.3 Pipeline

```
Vstup: block_header ║ nonce (u64)
  │
  ├─ Fáze 1: Keccak-256        → 32-byte digest
  ├─ Fáze 2: SHA3-512          → 64-byte expansion
  ├─ Fáze 3: Golden Matrix     → maticová difúze
  ├─ Fáze 4: 256 KiB Scratchpad → paměťově náročný fill + závislá čtení
  ├─ Fáze 5: NPU Mixing        → vektorové operace NPU
  └─ Fáze 6: Cosmic Fusion     → finální hash redukce
  │
Výstup: 32-byte PoW hash
```

**Fáze 4 (Scratchpad)** je klíčová pro odolnost vůči ASIC. 256 KiB pracovní sada se vejde do L2 cache, ale vyžaduje pseudo-náhodná závislá čtení, což poráží pipelining i memory-latency hiding strategie ASICů.

**Fáze 5 (NPU Mixing)** může využívat Apple CoreML, NVIDIA TensorRT, Intel OpenVINO nebo ONNX Runtime na běžných zařízeních.

### 6.4 DAA (Difficulty Adjustment Algorithm)

ZION používá **LWMA (Linearly Weighted Moving Average)** s 60-block oknem:

- **Cílový čas bloku:** 60 sekund
- **Rozsah úpravy:** ±25 % na blok (celočíselná aritmetika)
- **Retarget:** Každý blok
- **Timestamp sanity:** ±2× target (±120 s)
- **Min difficulty:** 1 000

### 6.5 Fork hooks

`CHV_EKAM_V2_FORK_HEIGHT` je připraven pro koordinované budoucí PoW upgrady. V default production buildu je Ekam Deeksha v2 aktivní od genesis (výška 0).

---

## 7. Ekonomický model

### 7.1 Celková nabídka

Tvrdý strop je **144 000 000 000 ZION** — zapsáno v genesis a neměnné. Žádné governance hlasování jej nemůže zvýšit.

| Kategorie | Množství | Podíl |
|-----------|----------|-------|
| Těžební nabídka | 127 720 000 000 ZION | 88,35 % |
| Genesis premine | 16 780 000 000 ZION | 11,65 % |
| **Celkem** | **144 000 000 000 ZION** | **100 %** |

Atomická jednotka: **1 ZION = 1 000 000 flowers** (6 desetinných míst). Veškeré on-chain účetnictví používá flowers (`u64`).

### 7.2 Decade Decay emise

Na rozdíl od bitcoinových náhlých půlení ZION snižuje block reward o **20 %** každých **10 let** (5 256 000 bloků). To vytváří hladkou, předvídatelnou křivku, která udrží těžaře v motivaci přes sto let.

| Dekáda | Roky | Odměna za blok (ZION) | Emise za dekádu |
|--------|------|-----------------------|-----------------|
| 1 | 2026–2036 | 5 400,067 | 28 383 712 152 |
| 2 | 2036–2046 | 4 320,054 | 22 706 969 722 |
| 3 | 2046–2056 | 3 456,043 | 18 165 575 777 |
| 4 | 2056–2066 | 2 764,834 | 14 532 460 622 |
| 5 | 2066–2076 | 2 211,867 | 11 625 968 497 |
| 6 | 2076–2086 | 1 769,494 | 9 300 774 798 |
| 7 | 2086–2096 | 1 415,595 | 7 440 619 838 |
| 8 | 2096–2106 | 1 132,476 | 5 952 495 871 |
| 9 | 2106–2116 | 905,981 | 4 761 996 697 |
| 10 | 2116–2126 | 724,784723787776 | 3 809 597 357 |
| **Tail** | **2126+** | **724,784723787776** | **Navěky** |

**Tail emission** začíná po 10. dekádě. Věčná minimální odměna **724,784723787776 ZION/blok** zajišťuje, že těžaři budou vždy motivováni zabezpečovat síť.

### 7.3 Rozdělení každé odměny

Každý nalezený blok je automaticky rozdělen protokolem:

| Příjemce | Podíl | Účel |
|----------|-------|------|
| **Těžaři (PPLNS)** | 89 % | Bezpečnost sítě |
| **Humanitární fond** | 5 % | Globální humanitární projekty |
| **Fond L5/L6 Issobella** | 5 % | Věda a vesmírný program |
| **Protokolový burn** | 1 % | Spáleno, nikdy neznamintováno |

Toto rozdělení je vynucováno v `V3/L1/core/src/emission.rs` a nelze jej změnit governance. 1 % „pool fee" je **spáleno** protokolem; provozovatel poolu jej nedostává jako revenue. On-chain fee-split je živý: V3 core produkuje a validuje čtyřvýstupové coinbase payouty s deterministickým split `89/5/5/1`. První explicitně ověřený blok se spuštěným fee-splitem: **#465**.

### 7.4 Srovnání

| | ZION | Bitcoin | Monero | Ethereum |
|---|---|---|---|---|
| Nabídka | 144 mld. | 21 mil. | ∞ (tail) | ∞ |
| Emise | Decade Decay (−20 %/10 let) | Halving (−50 %/4 roky) | Tail 0,6 XMR/blok | Emise + burn |
| Čas bloku | 60 s | 600 s | 120 s | 12 s |
| Konsensus | PoW (Ekam Deeksha) | PoW (SHA-256d) | PoW (RandomX) | PoS |
| Odolnost vůči ASIC | Vysoká (paměťově náročná) | Žádná | Vysoká | N/A |
| Built-in giving | 10 % vynuceno | Žádné | Žádné | Žádné |
| Fee model | 100 % burn | Aukce | Aukce | EIP-1559 burn |

### 7.5 Genesis premine — transparentně

13/14 wallet definováno v `PREMINE_ADDRESSES_PUBLIC.txt`:

| # | Kategorie | Množství (ZION) | Účel |
|---|-----------|-----------------|------|
| 1–5 | OASIS + Golden Egg/XP | 8 250 000 000 | Herní odměny v L4 |
| 6 | DAO Treasury (hlavní) | 2 500 000 000 | Rezerva pro komunitní governance |
| 7 | DAO Grants & Bounties | 1 000 000 000 | Vývojářské granty |
| 8 | DAO Ecosystem Bootstrap | 500 000 000 | Růst ekosystému |
| 9 | Core Development Fund | 1 000 000 000 | Průběžný vývoj |
| 10 | Network Infrastructure | 1 000 000 000 | Seed nodes a infrastruktura |
| 11 | Genesis Projects Steward | 590 000 000 | Celozávodní správa projektů |
| 12 | Humanitární — Children Future Fund | 1 440 000 000 | Humanitární seed |
| 13 | Bridge Seed Fund | 400 000 000 | Provozní rozpočet bridge |
| 14 | Bridge Vault UTXO Seed | 100 000 000 | UTXO likvidita pro bridge unlocky |

**DAO Treasury time-lock:** Celých 4 000 000 000 ZION v DAO treasury (#6–8) je zamčeno do výšky bloku **525 600** (~1 rok po genesis). On-chain enforcement v `V3/L1/core/src/validation.rs` krok 11.

---

## 8. L2 — wZION bridge a DeFi

### 8.1 Architektura

**wZION** je ERC-20 wrapped token reprezentující hodnotu ZION na EVM chainech. Bridge umožňuje pohyb likvidity bez potřeby L1 infrastruktury na EVM chainu.

```
ZION L1  ──[lock]──→  Bridge Contract  ──[mint]──→  wZION (EVM)
wZION    ──[burn]──→  Bridge Contract  ──[unlock]──→  ZION L1
```

### 8.2 Bezpečnost bridge

- **Validator quorum:** 5/5 multi-sig pro cross-chain atestace na mainnetu
- Ověření L1 block headeru a Merkle důkazů
- Rate limiting přeshraničních transferů
- Daily limit, max single amount a timelock threshold vynucené kontraktem
- Relayer fail-closed: pokud signers < threshold nebo duplicitní `validator_id` → chyba **před** L1 RPC voláním
- Account-model memo pole pro lock intent (např. `BRIDGE:0x<evm>`)

### 8.3 Podporované sítě

| Síť | Stav | Chain ID |
|-----|------|----------|
| Base Mainnet | Live | 8453 |
| Arbitrum One | Live | 42161 |
| BNB Smart Chain | Nakonfigurováno | 56 |
| Polygon | Nakonfigurováno | 137 |
| Optimism | Live | 10 |
| Avalanche C-Chain | Nakonfigurováno | 43114 |

### 8.4 L2 smart kontrakty (Base Mainnet)

Všechny kontrakty jsou ověřeny na Basescan:

| Kontrakt | Adresa | Popis |
|----------|--------|-------|
| **wZION** | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | ERC-20 wrapped ZION (stejná adresa na všech 6 EVM chainech) |
| **ZionBridge (Base)** | `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` | Lock/mint a burn/unlock bridge, 5/5 validatorů |
| **ZionBridge (non-Base)** | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | Bridge proxy na Arb/BSC/Poly/Opt/Avax |
| **ZionStaking** | `0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B` | Stakování wZION za 12 % APR |
| **ZionFarm** | `0x167B2753F5D8D9F8e62875cc9e379d7804308B08` | Liquidity farming, 1 wZION/s |
| **ZionGovernance** | `0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8` | On-chain DAO hlasování |
| **ZionTreasury** | `0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD` | 3-of-3 multisig treasury |
| **ZionAtomicSwap** | `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb` | Trustless HTLC swapy |
| **UniV4 Pool** | `0xcCEaD51568E8d701f7db7e6699F3986031F07C7B` | wZION/USDT + wZION/WETH |

### 8.5 DeFi ekosystém

L2 DeFi ekosystém poskytuje:

- **Staking** — stakovat wZION za protokolový yield (12 % APR, 7d cooldown, 100K wZION reward pool)
- **Farming** — poskytnout likviditu a získat LP odměny (500K wZION pool)
- **DEX trading** — wZION/USDT a wZION/WETH přes Uniswap V4 concentrated liquidity
- **Atomic swapy** — trustless HTLC cross-chain swapy (100K ZION escrow)
- **Governance** — DAO návrhy a hlasování s wZION (5 guardians)

---

## 9. L3 — NCL, WARP a AI-Native

L3 se skládá ze tří propojených modulů:

| Modul | Crate | Účel |
|-------|-------|------|
| NCL | `zion-ncl` | Distribuovaný AI inference marketplace |
| WARP | `zion-warp` | Univerzální cross-chain bridge protokol |
| AI-native | `zion-ai-native` | On-chain AI agenti |

### 9.1 NCL — Neural Compute Layer

NCL transformuje těžební infrastrukturu do distribuované AI výpočetní sítě. Těžaři mohou zpracovávat AI inference tasky paralelně s těžbou a získávat dodatečné NCL odměny.

**Životní cyklus protokolu:**

```
ncl.register   → miner oznámí NCL kapacitu
ncl.get_task   → obdrží AI task z poolu
ncl.submit     → odešle výsledek
ncl.status     → pool ověří a zaplatí
```

### 9.2 NPU runtime detekce

NCL automaticky detekuje nejrychlejší AI backend:

| Platforma | Backend |
|-----------|---------|
| Apple M-series | CoreML |
| NVIDIA GPU | TensorRT |
| Intel CPU/GPU | OpenVINO |
| Ostatní | ONNX Runtime (fallback) |

### 9.3 WARP — Cross-chain bridge protokol

WARP umožňuje nativní přenosy ZION do a z 12 chainových rodin:

| Chain rodina | Stav |
|---|---|
| EVM (Base, Arbitrum, BSC, Polygon, Optimism, Avalanche) | Live / nakonfigurováno |
| Bitcoin | Implementováno |
| Solana | SPL token deployován |
| Tron | Kontrakt připraven, čeká deploy |
| Stellar | Native asset deployován |
| Cardano | CBOR TX builder připraven |
| Cosmos | CosmWasm kontrakt připraven |
| Aptos | BCS TX builder připraven |
| Sui | BCS TX builder připraven |
| NEAR | borsh TX builder připraven |
| TON | TL-B/BOC TX builder připraven |
| Lightning | LND Docker stack připraven |

WARP REST API běží na portu **8453** (Axum). Persistence přes SQLite. Validator quorum: 3/5.

### 9.4 AI-Native a Hiran v2.2

AI-native vrstva implementuje AI agenty jako first-class protokolové objekty: on-chain model registry, AI-asistovaná governance pro DAO rozhodnutí a on-chain datovou analýzu.

**Hiran v2.2** je doménově fine-tunovaný model pro ZION ekosystém:

- **Base model:** `unsloth/Meta-Llama-3.1-8B-Instruct`
- **Metoda:** QLoRA (curriculum, 5 fází)
- **Inference:** Ollama/llama.cpp, porty 11434 / 8001 / 8002

---

## 10. L4 — herní svět ZION OASIS

**OASIS** je metaverse/herní vrstva napojená na ZION blockchain — kde se herní ekonomika setkává s reálnými L1 tokeny.

**Klíčové koncepty:**

- **8 Genesis Territories**
- **9 Consciousness Levels** (Kabbalah Sefira: Malkuth → Keter)
- **8,25 mld. ZION reward pool** (5 genesis slotů × 1,65 mld., 10letá distribuce)
- **XP off-chain** — SQLite `oasis.db`, L1 zůstává čistý

**REST API** (port 8094): health, player, XP award, leaderboard, guild CRUD, territory map, reward pools.

**Stav:** Live daemon; herní implementace pokračuje.

---

## 11. L5 — ZION Free World a L6 — ZION Issobella

### 11.1 L5 — ZION Free World

> *„Svoboda není dána — buduje se blok po bloku."*

**Cíl:** 2030

L5 je humanitární a vědecká vrstva financovaná přímo blockchainovým protokolem. Jejím účelem je budovat infrastrukturu pro svobodné komunity, zkoumat svobodnou energii a provádět humanitární mise.

**Pilíře:**

1. Výzkum svobodné energie
2. Humanitární mise
3. Svobodné komunity
4. Vzdělávání a povědomí

**Zdroje financování:** 5 % z bloku → L5/L6 Issobella Fund + 5 % z bloku → Humanitární fond + DAO grants + L4 OASIS revenue.

### 11.2 L6 — ZION Issobella

> *„Hvězda není cíl — je začátek."*

**Cíl:** 2040+

**ZION Issobella** je vrcholová vrstva — vědecká observatoř a výzkumný program. Mise zahrnují astronomický výzkum, klimatické monitorování, satelitní mesh síť, mikrogravitaci a vzdělávání.

**Financování:** L5/L6 Issobella Fund (5 % z bloku), tail emission (2126+), DAO Treasury, L4 OASIS NFTs.

---

## 12. AuxPoW merge mining

ZION pool server podporuje **AuxPoW merge mining** přes standalone `AuXpow` crate. To umožňuje ZION těžařům současně těžit až 11 externích proof-of-work coinů bez snížení ZION hashrate.

### 12.1 Podporované rodičovské coiny

| Coin | Algoritmus | Stav |
|------|-----------|------|
| DCR | Blake3 (DCP-0011) | Primární cíl |
| ALPH | Blake3 | Sekundární cíl |
| KAS | kHeavyHash | Podporováno |
| ERG | Autolykos v2 | Podporováno |
| RVN | KawPow | Podporováno |
| ETC | Etchash | Podporováno |
| EVR | KawPow | Podporováno |
| MEWC | KawPow | Podporováno |
| FLUX | ZelHash | Podporováno |
| CLORE | KawPow | Podporováno |
| XMR | RandomX | Podporováno |

### 12.2 Architektura

- `AuXpow/` crate poskytuje Stratum v1 proxy, dispatch externích hasherů a profit switching
- Pool server spouští `AuxPowScheduler` na dedikovaném Tokio runtime
- Externí pool joby jsou multiplexovány do ZION miner práce
- Platné externí share se forwardují upstream do rodičovského poolu
- Profit-switching používá 15% hysteresis a circuit breaker (5 failů → 300 s cooldown)

### 12.3 Aktivace

AuxPoW je defaultně vypnuto. Pro zapnutí:

```bash
ZION_AUXPOW_ENABLED=1
ZION_AUXPOW_WALLET=<real-wallet-address>
```

### 12.4 True AuxPoW budoucnost

Současná implementace je **pool-side proxy** (Fáze 1). Budoucí hard fork přinese **true AuxPoW**, kde ZION bloky ponesou rodičovské chain header a DCR/ALPH hashrate bude přímo zabezpečovat ZION. Viz `AUXPOW_TRUE_MERGE_MINING_PLAN.md`.

---

## 13. ZionDex

**ZionDex** je cross-chain decentralizovaná burzová vrstva ZION. Ve spojení s WARP umožňuje swapy mezi jakýmikoli tokeny na jakýchkoli chainech s využitím ZION jako nativní settlement asset.

### 13.1 Komponenty

| Komponent | Stav | Detaily |
|---|---|---|
| ZionDex Router | Live Beta | Dijkstra path finding, top 3 cesty, 30s price cache |
| Intent crate | Built | SwapIntent, EIP-712 + Ed25519 podpis, Dutch auction |
| Solver daemon | Built | REST API port 8455, off-chain solver |
| AMM kontrakty | Built | Foundry-tested PoolManager + Hooks + Router + ZDX |
| TypeScript SDK | Built | `@zion/dex-sdk` |
| Web UI | Live Beta | `/dex`, `/ziondex`, `/dex/liquidity`, `/dex/portfolio` |
| Mobile/Desktop | Built | React Native + Electron obrazovky |

### 13.2 Integrace

- ZionDex Router se připojuje k L3 WARP API (`127.0.0.1:8453`)
- Cross-chain AMM routing dotazuje WARP `/chains` a počítá optimální cesty
- Exekuce přes `POST /transfers/outbound` a polling `GET /transfers/:id`

### 13.3 Roadmap

- Deploy ZionDex Router service na Edge (port 8454)
- Deploy IntentSettlement + SolverRegistry na Base (čeká ETH budget)
- Frontend intent UI
- Custom AMM deploy

---

## 14. Bezpečnost, kryptografie a historie auditů

### 14.1 Kryptografické primitiva

| Primitivum | Použití |
|------------|---------|
| **BLAKE3** | Hashování transakcí, Merkle utility, core hashing |
| **Ed25519** | Podpis transakcí a bloků |
| **Keccak-256 + SHA3-512** | Fáze Ekam Deeksha v2 pipeline |
| **RIPEMD-160** | Mezikrok v derivaci adresy |
| **secp256k1 (k256)** | EVM bridge validator podpisy |

### 14.2 Bezpečnostní vlastnosti

- **Max reorg depth:** 10 bloků
- **Soft finality:** 60 bloků (~60 minut)
- **Coinbase maturity:** 100 bloků
- **Peer banování:** automatické banování za invalidní bloky
- **Rate limiting:** max 100 zpráv/s na peer
- **Zeroize wallet secret key** po podpisu
- **LMDB atomické zápisy** — single transaction pro block + UTXO updates
- **F4.7 max TX cap:** limit 144B ZION aktivní od výšky 1
- **F5 balance check:** validace zůstatku odesílatele aktivní od genesis

### 14.3 Bezpečnostní incidenty a náprava

V rozmezí 2.–3. 7. 2026 ZION síť zaznamenala incidenty zveřejněné v `docs/security/SECURITY_DISCLOSURE_2026-07.md`:

| ID | Závažnost | Problém | Náprava |
|---|---|---|---|
| ZION-2026-001 | HIGH | Falešná account TX přes P2P (chybějící `verify_signature`) | Opraveno v3.0.4, height-gated |
| ZION-2026-002 | CRITICAL | Bypass validace zůstatku v account modelu | Opraveno v3.0.4, height-gated |
| ZION-2026-003 | CRITICAL | Kompromitace Edge serveru přes TeamViewer | Hard reset + nový server |
| ZION-2026-005 | CRITICAL | Kompromitace EVM klíčů | Čeká redeploy kontraktů |

Nebyly ohroženy žádné externí uživatelské prostředky. ZION je pre-launch bez distribuce tokenů třetím stranám.

### 14.4 Historie auditů

- **Interní audit:** Probíhá; všechny nálezy výše byly nápravně řešeny nebo čekají
- **Externí audit:** Plánován na Q4 2026 před veřejným launchi
- **Basescan verification:** 7/7 Base Mainnet kontraktů ověřeno (9. 7. 2026)

---

## 15. DAO governance

### 15.1 DAO Treasury

| Alokace | ZION | Účel |
|---------|------|------|
| Community Governance (hlavní) | 2 500 000 000 | Primární rezerva |
| Grants & Bounties | 1 000 000 000 | Vývojářské granty |
| Ecosystem Bootstrap | 500 000 000 | Růst ekosystému |

Treasury zamčeno do výšky bloku **525 600**.

### 15.2 Hlasovací mechanismus

- 1 ZION = 1 hlas (snapshot-weighted)
- Delegace podporována vrstvou governance policies
- Pre-execution lock: 48 hodin

| Typ návrhu | Quorum | Trvání |
|------------|--------|--------|
| Parametr | 10 % | 7 dní |
| Treasury | 15 % | 7 dní |
| Emergency | 20 % | 3 dny |
| Podmínka přijetí | votes_for > votes_against | — |

### 15.3 Treasury spending

Multi-sig ochrana: historicky **5-of-7**; aktuální L2 Treasury kontrakt je **3-of-3 multisig**. DAO on-chain hlasování používá 5 guardians.

### 15.4 Neměnné parametry

DAO **nemůže** změnit:

- Celkovou nabídku (144 mld. ZION)
- Genesis alokaci (16,78 mld. ZION)
- Čas bloku (60 sekund)
- Těžební algoritmus (Ekam Deeksha v2)
- Typ konsensu (Proof-of-Work)
- Poměry rozdělení block reward (89/5/5/1 %)

### 15.5 Fáze decentralizace

| Fáze | Časový rámec | Vlastnosti |
|------|--------------|------------|
| Fáze 1 | 2025–2026 | Snapshot hlasování, off-chain signalizace |
| Fáze 2 | 2026–2027 | On-chain proposal lifecycle (MainNet) |
| Fáze 3 | 2027+ | Plná decentralizace; volitelně quadratic-voting R&D |

---

## 16. Revenue systém — multistream architektura

ZION V3 revenue systém je **multi-stream ekonomický engine** se třemi primárními kanály:

| Stream | Alokace | Stav |
|--------|-----------|------|
| **ZION Canonical Mining** | 50 % | On-chain payouty živé (fee split 89/5/5/1) |
| **Multi-Algo External (AuxPoW)** | 25 % | Pool-side proxy živý; true AuxPoW fork plánován |
| **NCL AI Compute** | 25 % | Telemetry a tracking živé; AI gateway integrace probíhá |

### 16.1 Ověřené komponenty

- `RevenueCollector` — thread-safe, idempotent bloky, circuit breaker
- `RevenueJournal` — append-only JSONL, daily rotace, replayable
- `RevenueHealth` — per-source circuit breaker (10 failů / 60s reset)
- `ProfitRouter` — 11+ coinů, hierarchie preferencí, hysteresis
- `StreamLayers` — konsenzuálně bezpečné telemetry wrappery

### 16.2 On-chain fee payouty

Při nalezení ZION bloku pool odesílá batch UTXO transakci platící:

- 5 % humanitární desátek
- 5 % Issobella fund
- 1 % spáleno

Při selhání se poplatky obnoví přes `restore_fees()` a retry se provede příští kolo.

---

## 17. Mainnet připravenost a testování

### 17.1 Testovací pyramida (13. 7. 2026)

| Crate | Testy | Poznámky |
|---|---|---|
| `zion-core` (L1) | 432 | Konsensus, validace, RPC, LMDB |
| `zion-cosmic-harmony` (L1 PoW) | 95 | Ekam Deeksha, GPU kernely |
| `zion-pool` (L1) | 106 | 73 lib + 33 bin, PPLNS, AuxPoW |
| `zion-miner` (L1) | 59 | GPU/CPU, externí algoritmy |
| `zion-native-ffi` | 4 | Native acceleration scaffold |
| `zion-bridge` (L2) | 157 | L1↔EVM relay |
| `zion-dao` (L2) | 65 | Governance |
| `zion-atomic-swap` (L2) | 15 | HTLC swapy |
| `zion-warp` (L3) | 499 | 12 chain adaptérů |
| `zion-ncl` (L3) | 43 | AI compute marketplace |
| `zion-ai-native` (L3) | 89 | Agent framework |
| `zion-auxpow` | 40 | Merge mining proxy |
| ZionDex Router | 37 | 20 unit + 8 integrace + 9 intent |
| ZionDex Intent | 12 | SwapIntent, podpis, Dutch auction |
| ZionDex Solver | 19 | Off-chain solver |
| ZionDex AMM | 20 | PoolManager + IntentSettlement |
| **Celkem** | **~1 600+** | **0 selhání** |

### 17.2 Clean Gate

- `cargo fmt --all --check` ✅
- `cargo clippy --workspace --all-targets` ✅
- `cargo test --workspace --release` ✅
- `cargo audit` ✅ 0 zranitelností

### 17.3 Produktivní blockery

| Priorita | Položka | Stav |
|----------|---------|------|
| P0 | Redeploy EVM kontraktů (ZION-2026-005) | Čeká rozhodnutí ownera |
| P0 | Externí bezpečnostní audit | Plánován Q4 2026 |
| P1 | Non-EVM chain deployy (7/9 zbývá) | Probíhá |
| P1 | Lightning Network LND deploy na Edge | Probíhá |
| P1 | ZionDex Router service na Edge | Čeká |
| P2 | `systemd User=zion` hardening | Neimplementováno |
| P2 | Hlubší DEX likvidita | Čeká ETH budget |

### 17.4 Živá infrastruktura

**Edge server (`62.171.141.136`) — AKTIVNÍ:**
- V3 mainnet node: výška 827+
- RPC endpoint: `127.0.0.1:8443` (veřejně přes nginx proxy)
- Pool server: `0.0.0.0:8444`
- Prometheus metrics: `0.0.0.0:9115/metrics`
- Web: `https://zionterranova.com`
- Dashboard: `https://dashboard.zionterranova.com`
- 11 aktivních systemd služeb + watchdog timer + web Docker container

---

## 18. Roadmap

### 18.1 Historie verzí

| Verze | Datum | Stav | Klíčové deliverables |
|-------|-------|------|----------------------|
| v2.9.5 | 2025 | Archiv | TestNet genesis, Rust L1 stack |
| v2.9.7 | Začátek 2026 | Archiv | Code freeze, 168h stabilita |
| v3.0.3 | 27. 6. 2026 | Live | Decimal fork (1e12 → 1e6 flowers) |
| v3.0.4 | 6. 7. 2026 | Live | Hard genesis reset, DeFi deploy, bezpečnostní fixy |
| **v3.0.5** | **9. 7. 2026** | **Mainnet Beta** | **All Green — 11/11 služeb aktivních** |
| v3.1.0 | Q4 2026 | Plánováno | Wallet SDK, mobilní appka, L4 OASIS backend, externí audit |
| **v3.x veřejný launch** | **31. 12. 2026** | **Cíl** | **Veřejný mainnet launch** |

### 18.2 Klíčové milníky

| Milník | Datum | Kritérium úspěchu |
|--------|-------|-------------------|
| Decimal fork | 27. 6. 2026 | 1 ZION = 1 000 000 flowers |
| Hard genesis reset | 6. 7. 2026 | Nový server, nové klíče, 7 kontraktů deploynuto |
| All Green | 9. 7. 2026 | 11/11 služeb aktivních, E2E memo testy |
| AuxPoW integrace | 11. 7. 2026 | Live test pool + dashboard |
| Non-EVM Solana + Stellar | 13. 7. 2026 | SPL token + native asset live |
| Bezpečnostní audit | Q4 2026 | Žádné kritické zranitelnosti |
| Mobilní wallet | Q4 2026 | iOS + Android App Store submission |
| **Veřejný mainnet launch** | **31. 12. 2026** | **Veřejné těžba a používání** |
| 1. Decade Decay | 2036 | Block reward → 4 320 ZION |
| L5 Free World | 2030 | Nadace + výzkumné laboratoře |
| L6 Issobella start | 2040 | Space Division iniciován |
| Tail emission | 2126 | 724,784723787776 ZION/blok navěky |

---

## 19. Právní vyloučení odpovědnosti

ZION je **open-source software** a **experimentální technologie** vydaná pod MIT licencí. ZION **není**:

- Cenným papírem podle MiCA ani žádného jiného regulačního rámce
- Investičním produktem s garantovaným výnosem
- Licencovaným finančním instrumentem

Účast na síti ZION je **dobrovolná** a probíhá **na vlastní riziko**. Hodnota tokenu není garantována. Cena může klesnout na nulu. Regulační prostředí se může změnit.

ZION je **komunitou provozovaný open-source protokol** a **není provozován jedinou firemní entitou** v této V3 linii.

**Mainnet Beta status:** Těžba je aktivní na vlastní riziko. Síť může obsahovat chyby — bez záruky. Genesis blok a historie chainu jsou trvalé.

Viz také:

- `../../docs/legal/DISCLAIMER.md`
- `../../docs/legal/TOKEN_NOT_SECURITY.md`
- `../../docs/legal/RISK_DISCLOSURE.md`
- `../../docs/legal/LEGAL_DISCLAIMER.md`

---

## 20. Reference

| Zdroj | Popis |
|-------|-------|
| `V3/L1/core/src/emission.rs` | Ústavní emisní konstanty |
| `V3/L1/core/src/genesis.rs` | Validace genesis a reserve integrity |
| `V3/L1/core/src/difficulty.rs` | LWMA difficulty algoritmus |
| `V3/L1/cosmic-harmony/src/deeksha.rs` | Ekam Deeksha v2 kanonický PoW |
| `V3/L2/dao/src/proposal.rs` | DAO typy návrhů, quorum, hlasovací okna |
| `StatusV3.md` | Aktuální provozní stav a blockery |
| `3.0.5.md` | Kanonické shrnutí 3.0.5 „All Green" |
| `V3/ROADMAP.md` | Implementační fáze a gap inventory |
| `ZionDex.md` | Stav a architektura cross-chain DEX |
| `AGENTS.md` | Runbook pro vývojáře a operátory |
| `docs/security/SECURITY_DISCLOSURE_2026-07.md` | Veřejné zveřejnění zranitelností |
| `AUXPOW_TRUE_MERGE_MINING_PLAN.md` | Strategie hard-forku AuxPoW |
| `github.com/Zion-TerraNova/v3-Mainnet` | Veřejný zdrojový kód (MIT licence) |

---

> *„Gate, Gate, Paragate, Parasamgate, Bodhi Svaha"*  
> — Dedication v genesis bloku, 2026

**ZION TerraNova v3.0.5 — Mainnet Beta**
