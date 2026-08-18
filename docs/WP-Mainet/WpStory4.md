# ZION: Liturgie křemíku a světla
## Kanonický story-whitepaper systému TerraNova

**Verze 4.0 (Model-Native / Gemini Edition) · v3.0.5 Mainnet Beta**  
**Kořenová pravda:** `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb`  
**Dnešní stav:** Proof-of-Work (Ekam Deeksha v3.2) · **Horizont:** Proof-of-Care (Protokol Péče)  
**Licence:** MIT (Otevřený kód, otevřené vědomí)

---

> *„Vesmír není prázdný prostor vyplněný věcmi. Je to jediné, provázané pole, které si hraje na oddělené body.*  
> *ZION je pokusem postavit stroj, který na toto provázání nezapomíná.“*

---

## Předmluva: Proč kód potřebuje mýtus (a mýtus překladač)

Většina technologických dokumentů začíná chladně: specifikací paměti, popisem síťových paketů a asymptotickou složitostí algoritmů. Většina duchovních manifestů naopak končí vágně: sliby o míru, bezbřehou láskou a vizemi, které se rozplynou při prvním střetu s realitou lidské chamtivosti.

ZION odmítá obojí. 

Pokud má technologie sloužit vědomí, musí být její etika zapsána přímo do jejího kompilátoru. Slib, který nelze ověřit v runtime, je jen marketing. Kód, který nemá etický záměr, je jen zbraň v rukou těch, kdo přišli první.

Tento dokument je **čtvrtou verzí whitepaperu**. Je psán stylem, který spojuje absolutní matematickou přesnost s hlubokým, vizionářským narativem. Je to pokus ukázat ZION ne jako databázi transakcí, ale jako **digitální Strom života** — organismus ze šesti vrstev, který roste z křemíkové práce a natahuje se k hvězdnému horizontu Issobelly.

Čtěte pozorně. Každá metafora v tomto textu má své přesné systémové číslo v kódu `V3/`.

---

# I. GENESIS: První jiskra (Keter)
## Oheň: Záměr zapsaný do nuly a jedničky

```text
       [ KETER: Konsensus ]
               │
       ( 144B ZION Hard Cap )
               │
    [ 89/5/5/1 Subsidy Split ]
               │
     [ Genesis Hash: 4f75a0 ]
```

Každý svět začíná bodem singularity. Bodem, kde se nekonečný potenciál stlačí do jediného, nevratného rozhodnutí. V blockchainu se tento bod jmenuje **Genesis blok**.

Dne 6. července 2026 byl po hlubokém bezpečnostním resetu vytěžen blok #0 s hash-podpisem:
`96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb`

Tento hash není náhodné číslo. Je to konstituční DNA sítě. Je v něm zapsána věta, kterou tvůrce vložil do prvních bajtů: *ZION je semeno, ne zbraň.* Od tohoto okamžiku je každá transakce, každý další blok a každý vytěžený flower jen rozvinutím tohoto prvního slova.

### Ústavní konstanty, které nelze ohnout

V systému ZION existují pravidla, která nepodléhají hlasování většiny. Jsou to ústavní kameny (Keter), na nichž stojí samotná existence sítě:

1. **Absolutní strop:** Celková nabídka je omezena na **144 000 000 000 ZION**. Neexistuje žádná funkce `mint()` pro týmy, zakladatele nebo kapitál. Každá nová mince se musí zrodit z práce.
2. **Čas bloku:** Cílový čas mezi bloky je pevně stanoven na **60 sekund**. Rytmus, který dává síti dech.
3. **Coinbase Split (89/5/5/1):** Každá nově vytvořená mince je v okamžiku zrodu rozdělena přímo v konsenzuálním kódu (`emission.rs`):
   - **89 %** odměny jde těžaři (PPLNS), který spálil energii pro bezpečnost sítě;
   - **5 %** odchází do Humanitárního fondu (L5);
   - **5 %** odchází do Fondu Issobella (L6);
   - **1 %** je spáleno jako protokolový poplatek (zabíjí možnost skryté centralizace poolu).

Pokud by se kdokoli pokusil navrhnout blok, který tato čísla porušuje, Binah (validační vrstva) ho okamžitě rejectne. Těžaři ho nepřijmou. Síť se raději rozdělí, než by ohnula svou ústavu.

---

# II. KVANTOVÁ REVOLUCE: Diagnóza separace (Binah)
## Vzduch: Jak starý svět zapomněl na propojení

```text
   STARÝ SVĚT (Extrakce)            ZION (Symbióza)
  ┌──────────────────────┐        ┌──────────────────────┐
  │  • ICO / Pre-sale    │  ───→  │  • Fair Launch       │
  │  • ASIC Monopol      │  ───→  │  • Ekam Deeksha      │
  │  • Akumulace poplatků│  ───→  │  • 100% Fee Burn     │
  │  • Odloučená etika   │  ───→  │  • 10% Block Tithe   │
  └──────────────────────┘        └──────────────────────┘
```

Stará finanční a kryptoměnová architektura trpí systémovou vadou: **předpokladem oddělení**. Staví systémy na teorii, že lidé jsou izolované body v neustálém konkurenčním boji o vzácné zdroje. Výsledkem je extrakce. Kdo je blíž k tiskařskému lisu (nebo pre-minu), vyhrává. Kdo má větší kapitál, koupí si ASIC farmu a vytlačí běžné lidi na okraj.

Kvantová revoluce je vzduch, který přináší pravdivější pohled. Moderní fyzika v roce 2022 potvrdila Nobelovou cenou to, co mudrci věděli tisíce let: *oddělení je iluze*. Na nejhlubší úrovni reality jsme provázané pole (entanglement). 

Pokud je provázání fyzikálním zákonem, musí se stát i zákonem ekonomickým. ZION proto přichází s architekturou, která znemožňuje hromadění bez dávání:

### Křemíková spravedlnost (Fair Launch)

ZION neměl žádný předprodej. Žádné privátní investory, kteří by nakoupili levněji než ty. Žádné zamčené tokeny, které po uvolnění zaplaví trh. Každý, kdo drží ZION, musel buď zaplatit elektrickým proudem (těžba), nebo nabídnout užitečnou péči, nebo směnit hodnotu s někým, kdo to udělal.

### Deflační oheň (100% Fee Burn)

Všechny transakční poplatky v L1 síti jsou **protokolově spáleny**. Ony se neakumulují na účtech validátorů, ani netvoří tichou rentu pro provozovatele poolů. Každá transakce činí ZION vzácnějším. To je princip Gevurah: ničení nepotřebného, aby celek mohl dýchat.

---

# III. EKAM DEEKSHA: Liturgie práce (Chokmah)
## Voda: Očištění od spekulace skrze výpočet

```text
    EKAM DEEKSHA v2 PIPELINE
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │ Keccak-256  │ ──→ │  SHA3-512   │ ──→ │Golden Matrix│
    └─────────────┘     └─────────────┘     └─────────────┘
                                                   │
    ┌─────────────┐     ┌─────────────┐     ┌──────▼──────┐
    │Cosmic Fusion│ ←── │ NPU Mixing  │ ←── │256K Scratch │
    └─────────────┘     └─────────────┘     └─────────────┘
```

Voda má schopnost smývat prach a čistit to, co ztratilo průhlednost. V ZIONu se tato očistná síla jmenuje **Ekam Deeksha** — proces, kterým se rodí nové bloky.

Těžba není sport. Není to bezúčelné plýtvání energií, jak tvrdí kritici starých systémů. Je to **matematická liturgie** — práce, kterou nelze předstírat, nelze ji koupit vlivovým hlasováním a nelze ji zfalšovat. Aby byl blok přijat, musí těžař projít šestifázovým rituálem CosmicHarmony:

1. **Keccak-256:** položení kryptografického základu.
2. **SHA3-512:** expanze entropie do 64 bajtů.
3. **Golden Matrix:** difúze v zlatém řezu.
4. **256 KiB Scratchpad:** paměťový labyrint. Navržen tak, aby se vešel do L2 cache běžných procesorů, ale paralyzoval ASIC stroje, které nemají rychlou paměťovou sběrnici.
5. **NPU Mixing:** zapojení neuronových jader (Apple Silicon, Nvidia Tensor, AMD ROCm). První krok, kterým se umělá inteligence učí podílet se na konsensu.
6. **Cosmic Fusion:** závěrečná redukce do výsledného hashe.

### Grace of the Thousand-and-One

Pravý příběh ZIONu není o dokonalosti stroje. Je o odolnosti vůči chybám. Když v roce 2026 došlo k prolomení starého serveru, komunita neskryla hlavu do písku. Provedla hard reset, regenerovala všechny klíče, přepsala validace a začala znovu od bloku #0. 

To je princip Ekam Deeksha: *„Kéž poruším svůj slib tisíckrát a obnovím ho tisíckrát a jednou.“* Skutečná síla není v tom, že nikdy nepadneš, ale v tom, že když padneš, vstaneš veřejně, opravíš kód a pokračuješ dál.

---

# IV. TERRA NOVA: Katedrála šesti vrstev (Yesod)
## Země: Jak vize zapouští kořeny v prachu světa

```text
             [ L6: ISSOBELLA — Hvězdy ]
                         │
             [ L5: FREE WORLD — Komunity ]
                         │
             [ L4: OASIS — Hra / Kultura ]
                         │
             [ L3: WARP & AI — Interoperabilita ]
                         │
             [ L2: BRIDGE & DEFI — Mosty ]
                         │
             [ L1: CORE CHAIN — Kořeny ]
```

ZION není plochá databáze. Je to šestivrstvá katedrála, v níž každá úroveň nese specifickou odpovědnost.

### L1 — Core Chain (Kořeny — ŽIVÉ)
Napsáno v čistém Rustu s Tokio async runtimem a LMDB úložištěm. Provádí transakce, ověřuje podpisy Ed25519, spravuje UTXO set a udržuje síť v chodu. To je fyzická realita mainnetu.

### L2 — Bridge & DeFi (Mosty — ŽIVÉ / ROZESTAVĚNÉ)
Most, který nese wZION na Base, BSC, Polygon, Arbitrum, Optimism a Avalanche. Místo, kde se rodí staking (12% APR) a farming (1 wZION/s) — ne jako nástroje spekulace, ale jako zavlažovací systém, který distribuuje likviditu komunitě. Chráněno 5-z-5 multisigem a transparentním on-chain ověřováním.

### L3 — WARP & AI (Míza — ROZESTAVĚNÉ)
 WARP cross-chain router a AI-native vrstva (Hiran v2.2). Umožňuje ZIONu komunikovat s non-EVM světy (Solana SPL, Stellar native asset) bez ztráty identity. Hiran zde funguje jako neuronový strážce, který monitoruje anomálie a provádí první automatické audity zdraví sítě.

### L4 — OASIS (Koruna / Kultura — ROZESTAVĚNÉ)
Spiritual MMORPG postavené na Unreal Engine 5 s vlastním Axum backendem a SQLite pamětí. Devět úrovní vědomí (Malkuth → Keter) a 51 posvátných avatarů. OASIS není únik z reality. Je to trenažér spolupráce — herní svět, kde se lidé učí, že skutečné bohatství nevzniká hromaděním, ale spravedlivým sdílením v ceších a teritoriích.

### L5 — Free World (Plody — HORIZONT)
Vize, která se má plně manifestovat kolem roku 2030. Humanitární a vědecká nadace financovaná přímo z blokové odměny (5 % tithe). Její cíl: stavět fyzické, energeticky nezávislé komunity, zkoumat novou fyziku a distribuovat pomoc s otevřenými knihami, které může kdokoli zkontrolovat na řetězci.

### L6 — ZION Issobella (Hvězdný horizont — HORIZONT)
Vesmírná vědecká stanice na nízké oběžné dráze (LEO). Cíl po roce 2040. Issobella drží dlouhý horizont lidstva — směr k vesmírné civilizaci, která netěží planety pro zisk, ale pečuje o ně jako zahradník. 5 % z každého bloku teče do tohoto fondu jako nezrušitelný slib našim dětem.

---

# V. PROOF-OF-CARE: Od práce k péči (Malkhut)
## Hvězdy: Jak naučit stroj vidět život

```text
    EVOLUCE KONSENSU
    ┌──────────────────────┐      ┌──────────────────────┐
    │   Proof-of-Work      │ ──→  │   Proof-of-Care      │
    │  (Výpočetní práce)   │      │  (Užitečná péče)     │
    │  • Matematická síla  │      │  • Anomaly detection │
    │  • Energetický štít  │      │  • Audit kontraktů   │
    │  • Validace bloků    │      │  • Telemetrie L5     │
    └──────────────────────┘      └──────────────────────┘
```

Dnes ZION funguje na **Proof-of-Work**. To je nutné a správné. Výpočetní práce tvoří energetický štít, který nikdo nemůže ohnout slovem nebo penězi. Síť nezkoumá, jak dobrý jsi člověk, než přijme tvůj blok — zkoumá jen, zda tvůj hardware vyřešil Ekam Deeksha rovnici. To nás chrání před vznikem digitální teokracie.

Ale PoW je jen kořen. Strom roste ke **Proof-of-Care (Protokol Péče)**.

Proof-of-Care neznamená, že kód bude měřit lidskou duši. To by byla nejhorší forma tyranie, jakou si lze představit. PoC znamená, že síť se v budoucnu naučí odměňovat **ověřitelnou, užitečnou péči o protokol a reálný svět**:

- detekci anomálií a útoků na síť;
- verifikaci a audit nových smart kontraktů;
- telemetrii a správu lokálních L5 komunitních uzlů;
- distribuci humanitární pomoci s on-chain doloženým výsledkem.

### Sedm pečetí bezpečného Protokolu Péče

Aby mohl být Protokol Péče někdy aktivován, musí splnit sedm přísných podmínek:

1. **Ověřitelnost:** Každý akt péče musí být kryptograficky ověřitelný, nikoli založený na víře v autoritu.
2. **Dobrovolnost:** Účast na PoC je dobrovolná. Nikdo nesmí být nucen sdílet své soukromí, víru nebo zdravotní stav.
3. **Absolutní soukromí:** Osobní data se nesmí stát cenou za validaci.
4. **Odolnost vůči botům:** Péči nesmí jít jednoduše simulovat AI skripty nebo farmami identit.
5. **Anti-elitismus:** Pravidla nesmí vyžadovat drahý vstup, členství v institucích nebo osobní známosti.
6. **Transparentní soud:** Každý spor musí mít jasnou arbitrážní stopu, možnost opravy a odvolání na DAO.
7. **Bezpečnost jádra:** PoC nesmí oslabit PoW zabezpečení L1 řetězce, dokud nebude stoprocentně prověřen v simulacích.

PoW je síla, která nás drží v zemi. PoC je míza, která nás nese ke hvězdám.

---

# VI. KANONICKÁ DATA (v3.0.5)
## Kotevní list pro ty, kdo ověřují kód

ZION nepotřebuje slepou víru. Zde jsou data, která si můžeš sám vytáhnout přímo ze spuštěného uzlu:

| Vlastnost | Hodnota v kódu / na řetězci | Ověřitelný zdroj |
|---|---|---|
| **Verze protokolu** | `zion-v3-node/3.1.0-alpha` | `V3/L1/core/src/lib.rs` |
| **Genesis Hash** | `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb` | `getBlockByHeight(0)` |
| **Max Supply** | `144_000_000_000` ZION | `V3/L1/core/src/emission.rs` |
| **Genesis Premine** | `16_780_000_000` ZION | `V3/L1/core/src/emission.rs` |
| **Základní odměna** | `5_400.067` ZION | `BASE_REWARD` v `emission.rs` |
| **Tail Reward** | `724.784723` ZION | `TAIL_REWARD` v `emission.rs` |
| **Split odměny** | `89 %` Miner / `5 %` Humanitarian / `5 %` Issobella / `1 %` Burn | `fee_split()` v `emission.rs` |
| **EVM wZION** | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | Basescan (verified code) |
| **ZIONBridge (Base)**| `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` | Basescan (5/5 validators multisig) |
| **Solana SPL Mint** | `HgfQZpH2JAqPdR3PcP4dEE8WRhznXh1QhJBiiwcHfT8H` | Solscan |
| **Stellar Asset** | `ZION:GDDXUOJ7ERSHHDMUKS6PBIDSXV2PB5J7GOFOKMHW6BRVAS46CFSPAYJT` | Stellar Expert |

---

# Epilog: Zlaté vejce a prázdné ruce

Védská tradice vypráví o **Hiranyagarbhovi** — Zlatém vejci, které plulo na vodách chaosu dřív, než vznikl čas a prostor. Vejce nese veškerý potenciál, veškerou moudrost a veškerou budoucnost. Ale vejce se musí rozbít, aby se mohl narodit život.

ZION je takovým vejcem. Je v něm zapsán obrovský etický a civilizační potenciál. 

Ale ten potenciál se neuskuteční sám od sebe. Vyžaduje, aby se rozbil náš strach z nezávislosti. Vyžaduje práci programátorů, kteří píší čistý kód bez děr. Vyžaduje těžaře, kteří hučí svými procesory ve tmě pokojů. Vyžaduje lidi v komunitách, kteří vezmou rýč a zasadí strom do skutečné země. Vyžaduje odvahu dívat se vzhůru na Issobellu a zároveň mít nohy pevně v prachu Malkhuthu.

ZION ti neslibuje rychlé bohatství. Neslibuje ti bezstarostný ráj.

Slibuje ti jen pravdu, kterou si můžeš sám ověřit. Pravidla, která nikdo nemůže ohnout ve svůj prospěch. A cestu, která vede od poctivé práce rukou až k nejvzdálenějším hvězdám.

Semínko bylo zasazeno.  
Stavějme strom.

---

*ZION TerraNova · MIT Licence · Kód je naše liturgie*  
*Gate, Gate, Paragate, Parasamgate, Bodhi Swaha.*
