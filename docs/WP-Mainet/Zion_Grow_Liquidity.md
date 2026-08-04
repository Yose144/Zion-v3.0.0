# Zion Grow & Zion Liquidity — ekonomický model

> **Status:** Koncept s částečnou implementací · Trinity engine ŽIVÉ · pool-side konverze PLÁN
> **Cíl:** Aby těžba ZION vytvářela hodnotu a likviditu — ne prodejní tlak

---

## Problém, který řešíme

Každá těžařská síť má stejný problém:

```
Těžař → vytěží minci → prodá na burze → zaplatí elektřinu
                                    ↓
                           prodejní tlak na cenu
                                    ↓
                           cena klesá → těžař prodává víc
                                    ↓
                           smyčka dolů
```

Bitcoin to řeší halvingem — odměna klesne na polovinu, prodejní tlak se sníží. Ale základní problém zůstává: **těžař musí prodat, aby zaplatil elektřinu.**

ZION to řeší jinak.

---

## Zion Grow — pozice, která roste sama

**Zion Grow** není funkce. Je to **to, co se stane tvé peněžence**, když těžíš s Trinity engine.

### Jak to funguje

1. Zapneš Trinity miner (`zion miner start`)
2. Tvůj hardware těží ZION (Stream 1) + externí mince (Stream 2/3)
3. Odměna přichází na tvou adresu — **v ZION**
4. Čím déle těžíš, tím víc ZION držíš
5. **Nemusíš nic prodávat.** Pozice roste sama, blok za blokem.

### Proč je to jiné než klasická těžba

| Klasická těžba | Zion Grow |
|----------------|-----------|
| Těžíš minci X → prodáš X → dostaneš $ | Těžíš → dostaneš ZION → držíš ZION |
| Prodejní tlak na cenu X | Žádný prodejní tlak — nic se neprodává |
| Musíš sledovat burzu | Nic nesleduješ — balance roste |
| 5 různých mincí v 5 peněženkách | 1 měna, 1 peněženka, 1 balance |
| Elektřina = musíš prodat | Elektřina = tvoje volba, ne nutnost |

### Co Zion Grow není

- **Není slib zisku.** ZION může mít nulovou hodnotu. Grow znamená "balance roste", ne "bohatneš".
- **Není úrok.** Není to staking, není to yield farming. Je to přímo odměna za práci.
- **Není pasivní příjem.** Hardware musí běžet. Elektřina se platí. Jde o to, že **výsledek práce zůstává v jedné měně, ne v pěti.**

> **Realita z kódu:** Stream 1 (ZION canonical) vyplácí ZION přímo. Stream 2/3 (AuxPoW) dnes forwarduje shares na externí pooly — odměna přijde v externí minci. Pool-side konverze na ZION je **plán**, ne dnešní realita. Víze v sekci [Zion Liquidity](#zion-liquidity--proč-to-posiluje-síť).

---

## Zion Liquidity — proč to posiluje síť

**Zion Liquidity** je mechanismus, který obrací klasický těžařský vzorec.

### Dnešní stav (koncept → plán)

```
Těžař → Trinity mine ZION + ERG + XMR
                    ↓
        Pool přijímá všechny shares
                    ↓
        Pool prodává ERG/XMR na burze
                    ↓
        Pool vyplácí těžaři ZION (ne USD, ne ERG)
                    ↓
        Těžař drží ZION → žádný prodejní tlak
```

**Co to dělá s ekonomikou sítě:**

1. **Těžba netlačí cenu dolů.** Těžař neprodává ZION — dostává ho.
2. **Likvidita roste.** Pool prodává externí mince → kupuje ZION na burze → hloubka likvidity roste.
3. **Cirkulace se zpomaluje.** ZION zůstává v peněženkách těžařů, ne na burzách.
4. **Síť je nezávislejší.** Těžař nepotřebuje burzu, aby dostal odměnu — potřebuje jen pool.

### Proč to ještě není implementováno

Pool-side konverze vyžaduje:
- **Exchange integraci** — pool musí umět prodat ERG/XMR/... a koupit ZION na burze nebo OTC
- **Cenovou ochranu** — konverze nesmí stát těžaře víc než 1-2 % (slippage)
- **Auditovatelnost** — těžař musí vidět, kolik externí mince se prodalo a kolik ZION dostal
- **ZionDex routing** — ideálně konverze přes vlastní DEX, ne externí burzu

> **Stav:** `docs/3.0.6/TRIPLE_STREAM_ZION_LIQUIDITY.md` popisuje mechanismus. Implementace je plánována na v3.0.8 (Zion Liquidity metrics) a v3.1.0 (plná pool-side konverze). Dnes pool forwarduje shares na externí pooly — těžař dostává externí minci na svém účtu u toho poolu.

---

## Proč je free verze nastavená jako Boost Streams

Veřejný repozitář a free CLI build používají `public_build` feature flag. Uživatel vidí "ZION + Boost", ne "ZION + ERG + XMR + KAS + ...".

**Tři důvody:**

### 1. ZION musí mít hodnotu

Pokud těžař vidí "těžím ERG", prodá ERG. Pokud vidí "Boost", ví že výsledek je ZION. **Branding určuje chování.** Boost = "tohle je bonus, který ti přináší ZION", ne "tohle je mince, kterou můžeš prodat".

### 2. Likvidita musí růst

Cíl Zion Liquidity je: **těžba vytváří kupní tlak na ZION, ne prodejní.** Pokud free verze ukazuje názvy mincí, těžař je prodá a ZION nikdy nezíská likviditu. Boost branding drží hodnotu v ekosystému.

### 3. Jednoduchost pro začátečníka

Začátečník nechce vybírat z 33 mincí. Chce zapnout a těžit. Boost = "zapni a běží". Plná kontrola je pro pokročilé.

---

## Open source + premium unlock

ZION je **open source pod MIT licencí**. Jádro, pool, miner, CLI — vše veřejné. Ale plná kontrola nad Trinity streamy je **premium vrstva**.

### Co je free (open source)

| Funkce | Stav |
|--------|------|
| ZION canonical mining (Stream 1) | ✅ Plně open source |
| Boost Streams (GPU + CPU, automatické) | ✅ Plně open source |
| Autonomous profit router | ✅ Plně open source (běží na pozadí) |
| `public_build` flag | ✅ Skrývá názvy mincí |
| Pool mining (Stratum v1) | ✅ Plně open source |
| Wallet, node, bridge, swap | ✅ Plně open source |
| CLI / TUI | ✅ Plně open source |

### Co je premium (odemčené)

| Funkce | Stav |
|--------|------|
| Názvy externích mincí v UI | 🔒 Premium |
| Manuální výběr mince (`--auxpow-pool` s coin) | 🔒 Premium |
| `ZION_STREAM3_FORCE_COIN` | 🔒 Premium |
| Profit data per mince (co je nejvýnosnější) | 🔒 Premium |
| Plná Desktop App (Electron GUI) | 🔒 Premium |
| ZionDex / DeFi / DAO UI v desktopu | 🔒 Premium |
| MarketPlace / OASIS embedded views | 🔒 Premium |
| Auto-updater | 🔒 Premium |

### Jak se odemkne

**Možnosti (kombinovatelné):**

1. **Licence** — jednorázový nákup Desktop App (např. $20-50). Generuje licenční klíč, který odemkne plné streamy.
2. **NFT** — DAO vydá limitovanou sérii NFT (na Base L2). Držitel NFT má odemčené plné streamy. NFT je přenositelné — dá se prodat.
3. **DAO stake** — uživatel stakne wZION v DAO governance kontraktu. Nad určitým prahem (např. 10 000 ZION) se odemknou plné streamy. Stake je refundable.

**Doporučený model:** NFT + DAO stake. NFT pro jednorázové uživatele, stake pro dlouhodobé členy komunity. Licence jako fallback pro non-crypto uživatele.

### Proč ne všechno free?

- **1% pool fee** je základní monetizace — pokrývá provoz poolu a serverů.
- **Premium unlock** financuje vývoj: exchange integrace pro Zion Liquidity, Zion Grow dashboard, Desktop App údržba.
- **Open source jádro** zůstává důvěryhodné — kód je veřejný, auditovatelný, forkovatelný. Premium je **vrstva nad**, ne uzamčení jádra.
- **Kdo nechce platit**, může těžit ZION canonical (Stream 1) zdarma. Plná síla Trinity je bonus, ne podmínka.

---

## Ekonomický model — jak to drží pohromadě

```
                    ZION EKOSYSTÉM
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    TĚŽAŘ             POOL             DAO TREASURY
         │                │                │
    Trinity engine    1% pool fee      Premium revenue
    (3 streamy)       (burn/deflační)  (NFT/stake/licence)
         │                │                │
    ZION na adresu    Spáleno navěky   Vývoj, grants,
    (Zion Grow)       (-1% každý blok)  humanitární fond
         │
    ┌────┴────┐
    │         │
  Free      Premium
  (Boost)   (plné streamy)
    │         │
  ZION     ZION + externí
  pouze    mince (viditelné)
```

**Tok hodnoty:**

1. Těžař zapne Trinity → 3 streamy běží
2. Stream 1: ZION canonical → 89% odměny na těžaře, 5% humanitární, 5% Issobella, 1% burn
3. Stream 2/3: externí mince → pool forwarduje na externí pool → (plán: konvertuje na ZION)
4. Pool fee: 1% z každého bloku se spálí (deflační tlak)
5. Premium: NFT/stake/licence → DAO treasury → vývoj + grants
6. Výsledek: **těžař drží ZION, síť má likviditu, DAO má prostředky na vývoj**

---

## Roadmapa

| Verze | Co přináší | Stav |
|-------|-----------|------|
| v3.0.6-beta | Trinity engine, Triple Stream, Boost Streams | ✅ ŽIVÉ |
| v3.0.7 | Zion Grow dashboard (vizuální růst pozice) | ⏳ PLÁN |
| v3.0.8 | Zion Liquidity metrics (hloubka likvidity) | ⏳ PLÁN |
| v3.1.0 | Plná pool-side konverze na ZION, veřejný launch | ⏳ PLÁN (31. 12. 2026) |
| v3.1.0+ | Desktop App premium unlock (NFT/stake/licence) | ⏳ PLÁN |

---

## Ověřitelná fakta

| Tvrzení | Realita v kódu | Zdroj |
|---------|----------------|-------|
| Trinity engine běží | 3 paralelní streamy v `MinerRuntime` | `V31/L1/miner/src/runtime.rs:39-478` |
| 33 externích mincí | `ExternalCoin` enum s algoritmy a pool prefs | `V31/L1/cosmic-harmony/src/profit.rs:47-81` |
| Autonomous profit router | WhatToMine API, 15% hysteresis | `V31/L1/miner/src/autonomous.rs` |
| Boost Streams branding | `public_build` feature flag skrývá mince | `AGENTS.md:124-135` |
| Pool-side konverze na ZION | DOKUMENTOVÁNO, ne implementováno | `docs/3.0.6/TRIPLE_STREAM_ZION_LIQUIDITY.md` |
| Zion Grow = balance roste | MARKETINGOVÝ NÁZEV pro akumulaci ZION | `WpStory6.md:83-95` |
| Zion Liquidity = no sell pressure | EKONOMICKÝ KONCEPT, plán pro v3.0.8-3.1.0 | `WpStory6.md:97-113` |
| 1% pool fee burn | Vynuceno konsensem, konstituční | `V31/L1/core/src/emission.rs:56-57` |
| Premium unlock | PLÁN — NFT/stake/licence model | Tento dokument |

---

*→ Viz také: [Trinity Engine — technická specifikace](./Trinity_Engine.md)*

*→ Zpět na [Paluba](./SulZeme/Paluba.md) · [Sůl této země](./SulZeme/00-README.md)*

*Gate, Gate, Paragate, Parasamgate, Bodhi Svaha.*
