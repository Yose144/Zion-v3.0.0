# ZION TerraNova — Whitepaper pro Mainnet
## Česká publikovatelná verze v3.0

**Verze:** 3.0 — Mainnet Genesis Ready  
**Datum:** Květen 2026  
**Autoři:** ZION Open-Source Contributors  
**Licence kódu:** MIT  
**Stav:** V3 mainnet-track — konsensus, emise, bridge, revenue a AI vrstvy implementovány; produkční nasazení v přípravě  
**Jazyk:** Čeština

---

> *„V kódu věříme. 144 miliard ZION. Ne jeden satoshi navíc."*

---

## Obsah

1. [Manifest](#1-manifest)
2. [Proč svět potřebuje ZION](#2-proč-svět-potřebuje-zion)
3. [Ekonomie, která dává smysl](#3-ekonomie-která-dává-smysl)
4. [Šest vrstev — jedna vize](#4-šest-vrstev--jedna-vize)
5. [Jak těžíte vy, ne jen korporace](#5-jak-těžíte-vy-ne-jen-korporace)
6. [wZION a mosty do světa DeFi](#6-wzion-a-moasty-do-světa-defi)
7. [AI, která slouží síti](#7-ai-která-slouží-síti)
8. [OASIS — hra s opravdovou hodnotou](#8-oasis--hra-s-opravdovou-hodnotou)
9. [L5 a L6 — od země ke hvězdám](#9-l5-a-l6--od-země-ke-hvězdám)
10. [DAO — když komunita drží volant](#10-dao--když-komunita-drží-volant)
11. [Revenue systém — více zdrojů, větší stabilita](#11-revenue-systém--více-zdrojů-větší-stabilita)
12. [Bezpečnost a kryptografie](#12-bezpečnost-a-kryptografie)
13. [Mainnet — co je hotové, co nás čeká](#13-mainnet--co-je-hotové-co-nás-čeká)
14. [Právní vyloučení odpovědnosti](#14-právní-vyloučení-odpovědnosti)
15. [Reference](#15-reference)

---

## 1. Manifest

**ZION TerraNova** není „další kryptoměna". Je pokus odpovědět na otázku, kterou si dnes klade málokdo:

> *Může blockchain sloužit něčemu víc než spekulacím?*

ZION je proof-of-work síť se šestivrstvou architekturou (L1–L6), navržená tak, aby odolala průmyslovým těžebním monopolům, spravedlivě rozdělovala nově vzniklou hodnotu a automaticky — bez dobrovolných příspěvků, bez marketingových slibů — financovala humanitární projekty a vědecký výzkum.

Všechna pravidla jsou zapsána přímo v kódu. Nelze je obejít. Nelze je změnit hlasováním managementu. Síť nepatří žádné firmě. Patří všem, kdo na ní těží, vyvíjejí ji nebo ji používají.

---

### ZION v číslech — na první pohled

| Parametr | Hodnota |
|----------|---------|
| **Celková nabídka** | 144 000 000 000 ZION (tvrdý strop) |
| **Čas bloku** | 60 sekund |
| **Odměna za blok (1. dekáda)** | 5 400,067 ZION |
| **Emisní model** | Decade Decay (−20 % každých 10 let) |
| **Trvalá odměna od ~2126** | 724,784723787776 ZION/blok — navěky |
| **Těžební algoritmus** | Ekam Deeksha v3.2 (CPU/GPU, odolný vůči ASIC) |
| **Podpisová křivka** | Ed25519 |
| **Hashování** | BLAKE3 |
| **Formát adresy** | Bech32 (`zion1…`) |
| **Transakční model** | UTXO |
| **Konsensus** | Proof-of-Work (Nakamoto) |
| **L2 wrapped token** | wZION (ERC-20 na Base) |
| **Programovací jazyk** | Rust (Tokio async runtime) |

**Z každé odměny za blok putuje 10 % automaticky na dobročinné a vědecké účely:** 5 % do Humanitárního fondu a 5 % do fondu L5/L6 Issobella. Toto rozdělení vynucuje samotný protokol. Nelze jej změnit hlasováním DAO.

---

## 2. Proč svět potřebuje ZION

### Co nás zklamalo

Většina kryptoměnových projektů trpí stejnými neduhy jako tradiční finance — jen s jiným kabátem:

- **Insiderská alokace.** Venture kapitál a týmové tokeny vytvářejí strukturální nerovnost. Ti, kdo přišli první, vydělali nejvíc. Vy platíte jejich zisk.
- **ASIC centralizace.** Specializovaný hardware rychle vytlačí běžné uživatele. Těžba se koncentruje do několika obřích farem v zemích s levnou elektřinou.
- **Technologie bez smyslu.** V protokolu neexistuje žádný mechanismus, který by přerozděloval část hodnoty zpět společnosti. Filantropie je dobrovolná, často sebeproklamovaná a neověřitelná.
- **Šokové halvingy.** Události jako bitcoinový půlení každé čtyři roky způsobují náhlé otřesy na straně nabídky.

### Jak ZION odpovídá

| Neduh | ZION řešení |
|-------|-------------|
| Insider tokeny | Fair Launch — žádný předprodej, žádné ICO, žádné privátní kola |
| ASIC centralizace | Ekam Deeksha v3.2 — paměťově náročný, optimalizovaný pro CPU/GPU |
| Technologie bez smyslu | 10 % z každé odměny za blok vynuceno kódem |
| Nabídkové šoky | Decade Decay — postupné −20 % za dekádu + věčný tail |

### Pět pilířů

ZION vyrůstá z etických principů, které překládá do kódu:

- **Dharma** — projekt má účel přesahující finanční zisk.
- **Ahimsa** — neubližovat (Fair Launch, odolnost vůči ASIC).
- **Seva** — služba (humanitární desátek).
- **Satya** — pravda (open-source, auditovatelnost on-chain).
- **Karma** — co dáváš, to dostáváš (consciousness mining, odměna za věrnost).

---

## 3. Ekonomie, která dává smysl

### Tvrdý strop: 144 miliard ZION

Celková nabídka je **144 000 000 000 ZION**. Je to napevno zapsáno v genesis bloku a je neměnná. Žádné hlasování DAO nemůže strop zvýšit.

| Kategorie | Množství | Podíl |
|-----------|----------|-------|
| Těžební nabídka | 127 220 000 000 ZION | 88,35 % |
| Genesis premine | 16 780 000 000 ZION | 11,65 % |
| **Celkem** | **144 000 000 000 ZION** | **100 %** |

Atomická jednotka se jmenuje **flower**: **1 ZION = 1 000 000 000 000 flower** (12 desetinných míst). Veškeré účetnictví na řetězci pracuje s flowers jako `u64`.

### Decade Decay — mírný útlum místo šoků

Bitcoin každé čtyři roky půlí odměnu na polovinu. ZION místo toka používá **Decade Decay**: každých deset let (5 256 000 bloků) klesá odměna o **20 %**. Výsledkem je hladká, předvídatelná křivka, která udrží těžaře v motivaci přes sto let.

| Dekáda | Roky | Odměna za blok (ZION) | Emise za dekádu |
|--------|------|-----------------------|-----------------|
| 1 | 2026–2036 | 5 400,067 | ~28,38 mld. |
| 2 | 2036–2046 | 4 320,054 | ~22,71 mld. |
| 3 | 2046–2056 | 3 456,043 | ~18,17 mld. |
| 4 | 2056–2066 | 2 764,834 | ~14,53 mld. |
| 5 | 2066–2076 | 2 211,867 | ~11,63 mld. |
| 6 | 2076–2086 | 1 769,494 | ~9,30 mld. |
| 7 | 2086–2096 | 1 415,595 | ~7,44 mld. |
| 8 | 2096–2106 | 1 132,476 | ~5,95 mld. |
| 9 | 2106–2116 | 905,981 | ~4,76 mld. |
| 10 | 2116–2126 | 724,784723787776 | ~3,81 mld. |
| **Tail** | **2126+** | **724,784723787776** | **Navěky** |

Od roku ~2126 začíná **tail emission** — věčná minimální odměna **724,784723787776 ZION/blok**. Těžaři budou vždy motivováni zabezpečovat síť. Nikdy nenastane situace „pouze z poplatků".

### Rozdělení každé odměny

Každý nalezený blok je automaticky rozdělen protokolem:

| Příjemce | Podíl | Účel |
|----------|-------|------|
| **Těžaři (PPLNS)** | 89 % | Bezpečnost sítě |
| **Humanitární fond** | 5 % | Globální humanitární projekty |
| **Fond L5/L6 Issobella** | 5 % | Věda a vesmírný program |
| **Provozovatel poolu** | 1 % | Infrastruktura poolu |

Toto rozdělení je vynucováno on-chain od prvních bloků. První explicitně ověřený blok se spuštěným fee-splitem: **#465**.

### Genesis premine — transparentně

Při spuštění sítě bylo vytvořeno 16,78 miliardy ZION. Rozdělení je veřejné, adresy jsou v souboru `PREMINE_ADDRESSES_PUBLIC.txt`:

| # | Kategorie | Množství (ZION) | Účel |
|---|-----------|-----------------|------|
| 1–3 | OASIS + Golden Egg/XP | 4 950 000 000 | Herní odměny v L4 |
| 4–5 | L5 Free World Projects (repurposed) | 3 300 000 000 | 5 humanitárních projektů × 500M + 800M rezerva |
| 6 | DAO Treasury (hlavní) | 2 500 000 000 | Rezerva pro komunitní governance |
| 7 | DAO Grants & Bounties | 1 000 000 000 | Vývojářské granty |
| 8 | DAO Ecosystem Bootstrap | 500 000 000 | Růst ekosystému |
| 9 | Core Development Fund | 1 000 000 000 | Průběžný vývoj |
| 10 | Network Infrastructure | 1 000 000 000 | Seed nody a infrastruktura |
| 11 | Genesis Projects Steward | 590 000 000 | Doživotní péče o projekt |
| 12 | Humanitární — Children Future Fund | 1 440 000 000 | Okamžitý humanitární seed |

**Časová pojistka:** Veškerých 4 000 000 000 ZION v DAO treasury (#6–8) je uzamčeno do bloku **525 600** (přibližně jeden rok po genesis). On-chain vynucení v `V3/L1/core/src/validation.rs` krok 11.

---

## 4. Šest vrstev — jedna vize

ZION není jeden blockchain. Je to ekosystém šesti vrstev, kde každá vrstva může fungovat samostatně, ale společně tvoří něco většího.

```
┌──────────────────────────────────────────────┐
│  L6 — ZION Issobella    Vesmírná stanice LEO │
├──────────────────────────────────────────────┤
│  L5 — ZION Free World   Humanitární & věda   │
├──────────────────────────────────────────────┤
│  L4 — ZION OASIS        Herní svět (UE5)     │
├──────────────────────────────────────────────┤
│  L3 — NCL · WARP · AI     Distribuovaná AI   │
├──────────────────────────────────────────────┤
│  L2 — Bridge & DeFi     wZION · DEX · DAO    │
├──────────────────────────────────────────────┤
│  L1 — Core Chain        PoW · UTXO · P2P     │
└──────────────────────────────────────────────┘
```

### L1 — Core Blockchain

Srdce sítě. Rust + Tokio async runtime. LMDB databáze s paměťovým mapováním. UTXO model. P2P gossip protokol přes TCP. JSON-RPC 2.0 API. Stratum-style těžební sessions.

**Poplatky jsou 100 % spáleny.** Všechny transakční poplatky mizí z oběhu navždy. Síť je tak mírně deflační navíc k emisnímu plánu. Těžaři jsou odměňováni výhradně odměnou za blok, což udržuje jejich zájem v zabezpečení, nikoli v extrahování poplatků.

- Minimální poplatek: 1 000 flowers (0,001 ZION)
- Minimální sazba: 1 flower/bajt
- Max. velikost transakce: 100 000 bajtů
- Burn adresa: `zion1burn0000000000000000000000000000000dead`

### L2 — wZION Bridge & DeFi

**wZION** je ERC-20 token na EVM řetězcích. Každý wZION je krytý jedním ZION uzamčeným na L1 bridge adrese.

```
ZION L1  ──[lock]──→  Bridge Contract  ──[mint]──→  wZION (EVM)
wZION    ──[burn]──→  Bridge Contract  ──[unlock]──→  ZION L1
```

**Bezpečnost:** Validátoři 3-z-5 multi-sig. L1 ověření hlavičky bloku a Merkle důkazy. Rate limiting. Relayer „fail-closed" — pokud není dost podpisů, transakce se neprovede. Auto-pauza při anomálii.

**DeFi ekosystém:**
- Staking — 12 % APR, 7denní cooldown
- Farming — LP tokeny a odměny
- DEX trading — wZION/USDC na Uniswap V3
- Atomic swaps — důvěryhodné cross-chain HTLC
- Governance — DAO návrhy a hlasování s wZION

### L3 — NCL, WARP a AI

**NCL (Neural Compute Layer)** proměňuje těžební infrastrukturu v distribuovanou AI výpočetní síť. Těžaři mohou vedle klasické těžby zpracovávat AI inference úlohy a dostávat extra odměny.

**Hiran v2.2** je doménově specifický fine-tuned model pro ekosystém ZION:
- Základ: `unsloth/Meta-Llama-3.1-8B-Instruct`
- Metoda: QLoRA, 5 fází, max rank 64
- Dataset: 22 181 instruction/output párů
- Inferenční rychlost: ~40 tokenů/s na RTX 4090 (FP16)
- Integrace: `zion hiran` CLI, Docker služba `hiran-inference` (llama.cpp + CUDA, port 8002)

**WARP** umožňuje atomické swapy mezi ZION a tokeny napříč 7 rodinami řetězců: EVM, Cosmos IBC, Bitcoin, Solana, NEAR, Polkadot, TON.

### L4 — ZION OASIS Game World

OASIS je open-world herní zážitek v Unreal Engine 5, propojený s L1 tokeny. 8 Genesis území. 9 úrovní vědomí (Malkuth → Keter). 4,95 miliardy ZION odměn pro první hráče. XP zůstává off-chain; L1 zůstává čisté. *(Sloty 4 a 5 — 3,3 mld ZION — repurposed na L5 Free World Projects.)*

**Bonusové odměny v první dekádě (2026–2035):**

| Úroveň vědomí | Multiplikátor | Celková odměna/blok |
|---------------|---------------|---------------------|
| Physical (L1) | 1,0× | 5 400,07 ZION |
| Mental (L2) | 1,1× | 7 127,67 ZION |
| Aware (L3) | 1,2× | 7 283,82 ZION |
| Conscious (L4) | 1,3× | 7 440,00 ZION |
| Awakened (L5) | 1,5× | 7 754,51 ZION |
| Enlightened (L6) | 2,0× | 8 539,33 ZION |
| Transcendent (L7) | 3,0× | 10 108,96 ZION |
| Cosmic (L8) | 5,0× | 13 248,22 ZION |
| On The Star (L9) | 10,0× | 21 096,37 ZION |

Po roce 2035 je bonusový fond vyčerpán; těžba pokračuje základní odměnou.

---

## 5. Jak těžíte vy, ne jen korporace

### Algoritmus Ekam Deeksha v3.2

Název pochází ze sanskrtu: „Jedna iniciace". Je to proof-of-work algoritmus navržený tak, aby zůstal doménou běžných počítačů — ne průmyslových monster.

**Cíle:**
1. Odolnost vůči ASIC — paměťově náročné fáze znemožňují specializovaný hardware dominovat.
2. Přátelství k CPU/GPU — efektivní na běžném hardwaru včetně Apple Silicon NPU.
3. Šestifázový pipeline — žádná zkratka, žádný trik.

**Pipeline:**

```
Vstup: block_header ║ nonce (u64)
  │
  ├─ Fáze 1: Keccak-256        → 32b digest
  ├─ Fáze 2: SHA3-512          → 64b expanze
  ├─ Fáze 3: Golden Matrix     → difúze maticovým násobením
  ├─ Fáze 4: 256 KiB Scratchpad → paměťově náročné čtení/zápis
  ├─ Fáze 5: NPU Mixing        → vektorové operace na neuronové jednotce
  └─ Fáze 6: Cosmic Fusion     → finální hash redukce
  │
Výstup: 32b PoW hash
```

**Fáze 4 (Scratchpad)** je klíčová. 256 KiB pracovní paměti se vejde do L2 cache, ale vyžaduje pseudonáhodná závislá čtení, což poráží jak pipelining, tak skrývání latence paměti, které ASICy používají.

**Fáze 5 (NPU Mixing)** automaticky detekuje nejrychlejší AI backend: Apple CoreML, NVIDIA TensorRT, Intel OpenVINO nebo ONNX Runtime.

### Nastavení obtížnosti

ZION používá **LWMA (Linearly Weighted Moving Average)** s oknem 60 bloků:

- Cílový čas bloku: 60 sekund
- Max. změna obtížnosti: ±25 % na blok (celočíselná aritmetika)
- Přepočet: každý blok
- Sanity časového razítka: omezeno na ±120 s
- Min. obtížnost: 1 000

LWMA reaguje hladce na změny hashrate staré jen několik minut, což eliminuje oscilace a útoky zneužívající časová razítka.

### Adresy

Adresy používají kódování **Bech32** s lidsky čitelným prefixem `zion1`:

```
zion1q540v6y4f0s4v3n0f8t740t53494z56024u645c
```

Bech32 má vestavěnou detekci chyb a eliminuje záměnné znaky (0/O, l/1).

---

## 6. wZION a mosty do světa DeFi

### Proč bridge?

ZION L1 je uzavřený ekosystém — nemůže přímo komunikovat s Ethereum nebo jinými EVM řetězci. wZION je jako „obal": uzamknete ZION na L1, dostanete ekvivalentní wZION na Base/Arbitrum/BSC, s nímž pak můžete obchodovat na decentralizovaných burzách.

### Sítě

| Síť | Stav |
|-----|------|
| Base Sepolia (testnet) | Aktivní |
| Base Mainnet | Mainnet start |
| Arbitrum One | Mainnet start |
| BNB Smart Chain | Mainnet start |

### Smart kontrakty

- **wZION** — ERC-20 wrapped token
- **ZionBridge** — lock/mint a burn/unlock mechanismus
- **ZionStaking** — staking wZION za výnos
- **ZionFarm** — farming s LP tokeny
- **AtomicSwap** — důvěryhodné cross-chain swapy
- **ZionGovernance** — on-chain DAO hlasování (L2 zrcadlo)
- **ZionTreasury** — multi-sig správa pokladny
- **UniV3Pool** — wZION/USDC koncentrovaná likvidita na Uniswap V3

---

## 7. AI, která slouží síti

### NCL — distribuovaná AI síť

NCL transformuje těžební hardware v distribuovanou AI výpočetní síť. Těžaři mohou zpracovávat AI inference úlohy vedle těžby a získávat dodatečné NCL odměny.

**Životní cyklus úlohy:**

```
ncl.register   → těžař oznámí NCL kapacitu
ncl.get_task   → obdrží AI úlohu z poolu
ncl.submit     → odešle výsledek
ncl.status     → pool ověří a zaplatí
```

| Typ úlohy | Základní odměna | Ověření |
|-----------|-----------------|---------|
| Hash Chaining v1 | ~0,001 ZION | Deterministické (BLAKE3) |
| Embeddings | ~0,001 ZION | Vzorkování |
| LLM Inference | ~0,010 ZION | Vzorkování + reputace |
| Klasifikace obrázků | ~0,002 ZION | Hash modelu |
| Generování obrázků | ~0,020 ZION | Percepční hash |
| Převod řeči na text | ~0,005 ZION | CER/WER skóre |
| Trénink modelu | ~0,100 ZION | Konvergence loss |

**Časové rozvržení:** Výchozí 70 % těžba / 30 % NCL. Konfigurovatelné 50–90 % těžba. Těžba má vždy prioritu.

---

## 8. OASIS — hra s opravdovou hodnotou

OASIS není jen hra. Je to vrstva, kde herní ekonomika potkává reálné L1 tokeny. Hráči sbírají XP, postupují úrovněmi vědomí a získávají násobitele odměn v síti.

**Klíčové koncepty:**
- 8 Genesis území (Mount Zion, Cedar Forest, …)
- 9 úrovní vědomí (Kabbalah Sefira: Malkuth → Keter)
- 4,95 miliardy ZION odměn (3 genesis sloty × 1,65 miliardy, 10letá distribuce; sloty 4 a 5 repurposed na L5 Free World Projects)
- XP off-chain — SQLite `oasis.db`; L1 zůstává čisté

**REST API** (port 8094): zdraví, hráč, udělení XP, žebříček, guilda CRUD, mapa území, odměnové pooly — 9 endpointů.

**Status:** Specifikace Q3 2026, herní implementace Q4 2026+.

---

## 9. L5 a L6 — od země ke hvězdám

### L5 — ZION Free World

> *„Svoboda není darována — je vybudována blok po bloku."*

**Cíl:** 2030 | **Stav:** Vize a specifikace

L5 je humanitární a vědecká vrstva financovaná přímo blockchain protokolem. Jejím účelem je budovat infrastrukturu pro svobodné komunity, zkoumat kvantovou volnou energii a realizovat humanitární mise.

**Pilíře:**

1. **Výzkum volné energie** — kvantový a volný energetický výzkum, open-source hardware
2. **Humanitární mise** — čistá voda, vzdělání, zdravotnictví, potravinová bezpečnost
3. **Svobodné komunity** — energeticky nezávislé vesnice, mesh sítě, lokální ZION ekonomiky
4. **Vzdělání a osvěta** — open-source vzdělávací platformy, osvěta o consciousness mining

**Zdroje financování:**

| Zdroj | Mechanismus |
|-------|-------------|
| Odměna za blok | 5 % každého bloku → L5/L6 Issobella Fund (automaticky) |
| Humanitární desátek | 5 % každého bloku (automaticky) |
| DAO Grants | Hlasování komunity (variabilní) |
| L4 OASIS revenue | % z herní ekonomické aktivity (variabilní) |

### L6 — ZION Issobella

> *„Hvězda není cíl — je začátek."*

**Cíl:** 2040+ | **Stav:** Dlouhodobá vize

**ZION Issobella** (od ISS + vlastní jméno) je vrcholová vrstva — vědecká observatoř a výzkumná stanice na nízké oběžné dráze Země (LEO). Decentralizovaná governance přes ZION DAO. Veškerá vědecká data veřejná.

**Mise:**
- Astronomický výzkum (bez atmosférické distorze)
- Klimatický monitoring (podpora L5 Free World)
- Satelitní mesh síť — redundantní P2P ZION nody na oběžné dráze
- Výzkumné centrum — mikrogravitace, kvantové experimenty
- Vzdělání — živé streamy z vesmíru pro komunitu

**Financování:** L5/L6 Issobella Fund (5 % z každého bloku), tail emission (2126+), DAO Treasury, L4 OASIS NFT.

---

## 10. DAO — když komunita drží volant

### DAO Treasury

| Alokace | ZION | Účel |
|---------|------|------|
| Community Governance (hlavní) | 2 500 000 000 | Primární rezerva |
| Grants & Bounties | 1 000 000 000 | Vývojářské granty |
| Ecosystem Bootstrap | 500 000 000 | Růst ekosystému |

### Hlasování

- 1 ZION = 1 hlas (snapshot-vážené)
- Delegace: podporováno governance vrstvou
- Před-vykonávací pojistka: 48 hodin

| Typ návrhu | Kvórum | Trvání |
|------------|--------|--------|
| Parametrický návrh | 10 % | 7 dní |
| Treasury návrh | 15 % | 7 dní |
| Nouzový návrh | 20 % | 3 dny |
| Podmínka přijetí | votes_for > votes_against | — |

### Treasury výdaje

Multi-sig ochrana: **5 z 7 podpisů** nutných pro jakoukoliv treasury transakci.

### Neměnné parametry

DAO **nemůže** změnit:
- Celkovou nabídku (144B ZION)
- Genesis alokaci (16,78B ZION)
- Čas bloku (60 sekund)
- Těžební algoritmus (Ekam Deeksha v3.2)
- Typ konsensu (Proof-of-Work)
- Rozdělení odměny za blok (89/5/5/1 %)

### Fáze decentralizace

| Fáze | Časové období | Vlastnosti |
|------|---------------|------------|
| Fáze 1 | 2025–2026 | Snapshot hlasování, off-chain signaling |
| Fáze 2 | 2026–2027 | On-chain proposal lifecycle (MainNet) |
| Fáze 3 | 2027+ | Plná decentralizace; volitelně kvadratické hlasování (mimo konsensus vrstvu) |

---

## 11. Revenue systém — více zdrojů, větší stabilita

ZION V3 revenue systém je **vícekanálový ekonomický motor** se třemi primárními toky:

| Kanál | Alokace | Stav |
|-------|---------|------|
| **ZION kanonická těžba** | 50 % | On-chain výplaty aktivní (fee split 89/5/5/1) |
| **Multi-Algo externí** | 25 % | Externí Pool Proxy provozuschopný (revenue-proxy binárka) |
| **NCL AI výpočty** | 25 % | Telemetrie a sledování aktivní; integrace AI gateway v přípravě |

### Ověřené komponenty

- `RevenueCollector` — thread-safe (Arc<RwLock>), idempotentní bloky, circuit breaker
- `RevenueJournal` — append-only JSONL, denní rotace, replayable, atomická synchronizace
- `RevenueHealth` — per-source circuit breaker (10 selhání / 60s reset)
- `ProfitRouter` — 11 mincí, preference poolu, hystereze
- `StreamLayers` — consensus-safe telemetry wrappery, model 100 pracovních jednotek

### Externí Pool Proxy

Binárka `revenue-proxy` poskytuje transparentní Stratum mosty k externím poolům (2miners, MoneroOcean, ZPool) s:
- Substituční peněženkou v `mining.authorize` / `mining.subscribe` / `login`
- Frontou shares a reconnect smyčkou s exponenciálním backoffem
- Detekcí IP-banů a auto-failoverem
- Multi-coin start přes `ZION_PROXY_COINS` (např. `KAS,ETC,ALPH`)
- Per-coin listen porty (základ 9000)

### On-chain výplaty poplatků

Když je nalezen ZION blok, pool odesílá batch UTXO transakci platící:
- 5 % humanitární desátek
- 5 % Issobella fond
- 1 % pool poplatek

Při selhání jsou poplatky obnoveny přes `restore_fees()` a pokus je zopakován v dalším kole.

---

## 12. Bezpečnost a kryptografie

### Kryptografické primitiva

| Primitivum | Použití |
|------------|---------|
| **BLAKE3** | Hashování transakcí, Merkle utility, core hashing |
| **Ed25519** | Podpis transakcí a bloků |
| **Keccak-256 + SHA3-512** | Fáze pipeline konsensu Ekam Deeksha v3.2 |
| **RIPEMD-160** | Mezikrok při odvozování adresy |

### Bezpečnostní vlastnosti

- Max. hloubka reorgu: 10 bloků
- Soft finálnost: 60 bloků (~60 minut)
- Coinbase maturita: 100 bloků
- Peer banning: automatický ban při neplatných blocích (eskalační trvání)
- Rate limiting: max. 100 zpráv/60 s na peera
- Zeroize tajného klíče po podpisu (audit P1-17)
- Atomické zápisy LMDB — jedna transakce pro blok + UTXO aktualizace

### Historie auditů

Nezávislý bezpečnostní audit je naplánován na Q3 2026 (Trail of Bits / Halborn / OtterSec).

Interní auditní nálezy (všechny vyřešeny k 7. 5. 2026):

| Nález | Závažnost | Stav |
|-------|-----------|------|
| F1 — UTXO zachování hodnoty | Kritická | PR #20 ✅ |
| F2 — XOR Merkle root → BLAKE3 | Vysoká | Dispatcher + genesis aktivace ✅ |
| F3 — uniklé wallet klíče | Kritická | PR #18 ✅ |
| F3b — uniklé credentials v gitu | Kritická | `git filter-repo` + rotace ✅ |
| F4 — bridge unlock multisig na L1 | Střední | PR #22 ✅ |
| F5 — unwrap/expect hustota | Střední | PR #23 + #24 ✅ |
| F6 — V3-src archivy v repu | Střední | Úklid + rewrite historie ✅ |
| §3.2 — tx-hash malleabilita | Střední | PR #25 + v2 od genesis ✅ |
| §13 — native-ffi safety kontrakty | Střední | PR #28 ✅ |
| Relayer synthetic-proof kill | Střední | PR #27 ✅ |

---

## 13. Mainnet — co je hotové, co nás čeká

### Testovací pyramid (18. 5. 2026)

| Crate | Lib testy | Integrace | Aktivní (dev) | Ignorováno | Selhání |
|---|---|---:|---:|---:|---:|
| `zion-core` (L1) | 488 | — | 475 | 13 pomalých PoW | 0 |
| `zion-cosmic-harmony` (L1 PoW) | ~100 | — | 100 | 0 | 0 |
| `zion-pool` (L1) | 53 | 29 | 82 | 0 | 0 |
| `zion-miner` (L1) | 59 | — | 59 | 0 | 0 |
| `zion-native-ffi` (no-default) | 13 | — | 13 | 0 | 0 |
| `zion-native-ffi` (native-all, `--test-threads=1`) | 28 | — | 28 | 0 | 0 |
| `zion-bridge` (L2) | 130 | 63 | 193 | 0 | 0 |
| `zion-dao` (L2) | 40 | 25 | 65 | 0 | 0 |
| `zion-atomic-swap` (L2) | 18 | — | 18 | 0 | 0 |
| `zion-warp` (L3) | 251 | — | 251 | 0 | 0 |
| `zion-ncl` (L3) | 42 | 1 doc | 43 | 0 | 0 |
| `zion-ai-native` (L3) | 195 | — | 195 | 2 ignorováno | 0 |
| `zion-cli` | 21 | — | 21 | 0 | 0 |
| **Celkem** | | | **~1 470** | **15** | **0** |

### Clean Gate (18. 5. 2026)

- `cargo fmt --all --check` ✅
- `cargo clippy --workspace --all-targets -j1` ✅ (exit 0; pouze warnings)
- `cargo test --workspace --release -- --test-threads=1` ✅
- `cargo audit` ✅ 0 zranitelností

### Produkcční blockery

| Priorita | Položka | Stav |
|----------|---------|------|
| P0 | Rotace credentials + úklid historie | ✅ Hotovo 7. 5. 2026 |
| P1 | Nasazení nového řetězce (čistý datadir, genesis #0) | Probíhá |
| P1 | Bridge 3/5 provisioning validátorů | Čeká na ops |
| P2 | Externí bezpečnostní audit (Q3 2026) | Naplánováno |
| P2 | CI infrastruktura (GitHub Actions billing) | Čeká |
| P2 | E2E mainnet stress test (10k+ TX) | Naplánováno |
| P3 | Refaktoring lib.rs monolitu | Naplánováno |
| P3 | Prometheus SLO + alert pravidla | Naplánováno |

### Živá infrastruktura (12. 5. 2026)

**Pražský node (91.98.122.165) — AKTIVNÍ:**
- V3 mainnet node (výška: 26 910+)
- RPC endpoint: http://91.98.122.165:8443
- Prometheus metriky: http://91.98.122.165:9115/metrics
- Next.js website: https://91.98.122.165
- Pool server běží (porty 3333 Stratum + 8080 API)
- 12 Docker kontejnerů
- Izolovaný režim (1 peer — pouze sám sebou; ostatní servery v přípravě)

---

## 14. Právní vyloučení odpovědnosti

ZION je **open-source software** a **experimentální technologie** vydaná pod licencí MIT. ZION **není**:

- Cenným papírem podle MiCA nebo jakéhokoli jiného regulačního rámce
- Investičním produktem se zaručeným výnosem
- Licencovaným finančním instrumentem

Účast v síti ZION je **dobrovolná** a probíhá **na vlastní riziko**. Hodnota tokenu není zaručena. Cena může klesnout na nulu. Regulační prostředí se může změnit.

ZION je **komunitou provozovaný open-source protokol** a **není provozován jedinou vydávající společností** v této V3 linii.

Viz také:
- `legal/DISCLAIMER.md`
- `legal/TOKEN_NOT_SECURITY.md`
- `legal/RISK_DISCLOSURE.md`

---

## 15. Reference

| Zdroj | Popis |
|-------|-------|
| `V3/L1/core/src/emission.rs` | Konstituční emisní konstanty (flowers, decay, tail, fee split) |
| `V3/L1/core/src/genesis.rs` | Genesis validace a integrita rezerv |
| `V3/L1/core/src/difficulty.rs` | LWMA algoritmus obtížnosti |
| `V3/L1/cosmic-harmony/src/deeksha.rs` | Ekam Deeksha v3.2 kanonický PoW |
| `V3/L2/dao/src/proposal.rs` | DAO typy návrhů, kvórum, hlasovací okna |
| `docs/mainnet/MAINNET_CONSTITUTION.md` | Mainnet Constitution (zmrazený SHA-256) |
| `StatusV3.md` | Aktuální operační status a launch blockery |
| `V3/ROADMAP.md` | Implementační fáze a inventář mezer |
| `REVENUE_IMPLEMENTATION_PLAN.md` | Tracker doručení revenue pipeline |
| `AGENTS.md` | Příručka vývojáře/operátora |
| `github.com/Yose144/2.9.6` | Zdrojový kód (MIT licence) |

---

> *„Gate, Gate, Paragate, Parasamgate, Bodhi Svaha"*  
> — Dedicace genesis bloku, 2026

**ZION TerraNova v3.0 — MainNet Genesis**  
**© 2026 ZION Open-Source Contributors. MIT Licence.**
