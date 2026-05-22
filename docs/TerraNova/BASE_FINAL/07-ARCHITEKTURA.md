# Kapitola 07 — Architektura L1→L4: Od základního kamene k vědomé hře

> *„Kód je zákon jen tehdy, když víme, jaké hodnoty jsme do něj vložili.“*  
> — Terra Nova

---

## Proč architektura není detail

Architektura není jen technický výkres.

Je to způsob, jakým se záměr stane realitou.

Pokud chceš síť bez centra, musíš ji navrhnout bez jediného bodu selhání. Pokud chceš ekonomiku péče, musíš péči vložit do toku hodnoty. Pokud chceš komunitní governance, nestačí prohlášení — potřebuješ pravidla, audit, hlasování, rozpočty a možnost opravy.

Terra Nova proto popisuje vrstvy L1 až L4 jako jeden organismus:

| Vrstva | Role | Obraz |
|--------|------|-------|
| **L1** | Základní pravda řetězce | kostra a srdce |
| **L2** | Ekonomika a koordinace | krevní oběh |
| **L3** | Inteligence a komunikace | nervová síť |
| **L4** | Příběh, kultura, hra | představivost |

Bez L1 není důvěryhodný záznam.

Bez L2 není ekonomický pohyb.

Bez L3 není koordinace.

Bez L4 není příběh, který lidé chtějí žít.

---

## L1 — Terra Nova blockchain

### Proč vlastní řetězec

Nejjednodušší cesta by byla vzít existující blockchain, změnit logo a pár parametrů.

ZION zvolil těžší cestu: vlastní L1.

Důvod není technická pýcha. Důvod je kontrola nad základními pravidly. Pokud chceš zakódovat jinou ekonomiku od prvního bloku, potřebuješ řetězec, kde tyto hodnoty nejsou plugin, ale základ.

🟢 **REALITA 2026:** ZION L1 je vlastní blockchain psaný v Rustu. L1 nese konsensus, bloky, transakce, těžbu, odměny a historii sítě.

### Proof of Work jako práce, ne plýtvání

Proof of Work je často kritizovaný jako energetické plýtvání.

Ta kritika má smysl, pokud je těžba odpojená od etiky, decentralizace a užitečného účelu. Terra Nova proto klade otázku jinak:

**Jak má vypadat PoW, který chrání síť, zůstává dostupný běžným účastníkům a zároveň automaticky financuje péči a dlouhý horizont?**

ZION odpovídá přes vlastní těžební návrh a reward distribuci.

### Ekam Deeksha / Cosmic Harmony

Těžba hledá nonce, který vytvoří platný hash pod cílovou obtížností. Na této úrovni je princip podobný jiným PoW systémům.

Rozdíl je v tom, jak je práce navržená.

| Fáze | Role | Záměr |
|------|------|-------|
| Hiranyagarbha | počáteční hash | silný zárodek kandidáta |
| Galactic Matrix | paměťová práce | omezit čistě specializovanou výhodu |
| Stellar Harmony | iterace / míchání | stabilní výpočetní proces |
| Cosmic Proof | finální test | platnost bloku vůči targetu |

Smysl není tvrdit, že žádný hardware nikdy nezíská výhodu. Smysl je snížit asymetrii a udržet těžbu blíž lidem, kteří síť používají.

📋 **Technická disciplína:** Každé tvrzení o ASIC/GPU odolnosti musí být ověřované benchmarky, ne vírou. Algoritmus je hodnotové rozhodnutí, ale jeho dopady musí měřit data.

### Ekonomika bloku

ZION ekonomika je jednoduchá na čtení a hluboká v důsledcích.

```text
89 %  → miner
 5 %  → humanitární fond
 5 %  → Issobella fond
 1 %  → síťová infrastruktura
```

To není marketingová tabulka. Je to morální rozhodnutí převedené do protokolu.

**89 % minerovi:** práce má být odměněna přímo.

**5 % humanitární vrstva:** péče není volitelná sbírka až po zisku.

**5 % Issobella:** každý blok nese dlouhý horizont.

**1 % infrastruktura:** vize bez údržby se rozpadá.

### Poplatky, emise a dlouhá bezpečnost

L1 musí řešit nejen dnešní start, ale i dlouhou budoucnost.

Proto jsou důležité otázky:

- Jak se síť financuje, až klesá bloková odměna?
- Jak zůstane mining ekonomicky motivovaný?
- Jak se chrání proti centralizaci?
- Jak se poplatky chovají vůči celkové zásobě?

🟢 **REALITA 2026:** ZION pracuje s pevnou zásobou, emisním plánem, úpravou obtížnosti a modelem, kde transakční poplatky nepředstavují rentu centrální instituci.

Detaily parametrů patří do technické dokumentace. V této knize je důležitý princip: ekonomika L1 má být čitelná, auditovatelná a hodnotově konzistentní.

---

## L2 — bridge, DeFi a DAO

L1 je suverénní základ.

Ale suverenita bez propojení se může stát izolací.

L2 proto řeší ekonomický pohyb: bridge, wrapped token, treasury, governance, DeFi nástroje a praktické financování projektů.

### wZION bridge

Wrapped token je most mezi světy.

ZION může žít na vlastní L1 a zároveň být reprezentován ve světě EVM přes wZION.

Základní princip:

```text
LOCK na ZION L1  →  MINT wZION na EVM síti
BURN wZION       →  UNLOCK ZION na L1
```

🟢 **REALITA 2026:** wZION / Base vrstva slouží jako most k širšímu DeFi ekosystému.

Bridge je ale vždy citlivé místo. Nejslabší část mnoha blockchain projektů nebyl konsensus, ale bridge.

Proto Terra Nova u bridge zdůrazňuje:

- více validačních vrstev;
- auditovatelné kontrakty;
- omezení rizika přes limity;
- transparentní monitoring;
- postupné navyšování kapacity, ne slepou expanzi.

### DeFi jako nástroj, ne kasino

DeFi může být užitečné: likvidita, směna, pojištění, granty, staking, transparentní treasury.

Může se ale také změnit v kasino s vyšší technickou složitostí.

Terra Nova rozlišuje:

| Použití DeFi | Smysl |
|--------------|-------|
| Likvidita wZION | umožnit vstup a výstup bez centralizované brány |
| Staking / locking | odměnit dlouhodobou účast |
| Treasury governance | financovat projekty transparentně |
| Granty | podpořit komunity, vývoj, medicínu, energii |
| Spekulace bez účelu | není cílem Terra Nova |

### DAO — pravidla, která komunita vidí

DAO není magie. Je to účetnictví, hlasování, pravidla a exekuce v otevřeném systému.

Dobré DAO nedělá z lidí roboty. Dává jim jasnější prostředí:

- kdo navrhl změnu;
- jaký má rozpočet;
- kdo hlasoval;
- jaké byly námitky;
- kdy se rozhodnutí vykonalo;
- kam odešly prostředky.

📋 **ROADMAP:** Terra Nova DAO má spojit blockchainovou transparentnost se sociokratickou praxí komunit. Ne všechno patří na řetězec; osobní konflikty a citlivá data ne. Ale rozpočty, granty a pravidla mají být dohledatelné.

Příklad:

Komunita chce solární systém. Energetický kruh připraví návrh, rozpočet, rizika a plán údržby. DAO otevře diskuzi. Pokud nejsou zásadní námitky a návrh splní pravidla treasury, prostředky se uvolní. Vše je auditovatelné.

---

## L3 — AI Native, WARP a nervová síť

L3 není další tokenová vrstva.

Je to koordinační vrstva.

L1 říká, co se stalo.

L2 říká, jak se pohybuje hodnota.

L3 pomáhá rozumět, co se děje napříč systémem.

### Hiranyagarbha jako znalostní nervový systém

Hiranyagarbha AI propojuje dokumentaci, komunitní znalosti, provozní data, návrhy DAO, energetické signály a zdravotní protokoly — s důrazem na lokální soukromí.

Její role není rozhodnout za lidi.

Její role je:

- shrnout složité návrhy;
- upozornit na rizika;
- najít související dokumenty;
- vysvětlit technické věci neprogramátorům;
- hlídat hranice kompetence;
- držet paměť komunity.

### WARP — propojení bez ztráty identity

Žádná síť není ostrov.

WARP je název pro širší propojení ZION s jinými sítěmi, protokoly a komunitní infrastrukturou.

| Propojení | Smysl |
|-----------|-------|
| EVM / Base | likvidita, wZION, DeFi nástroje |
| Bitcoin / atomic swaps | peer-to-peer směna bez centralizované burzy |
| Cosmos / IBC směr | interoperabilita mezi řetězci |
| Mesh / off-chain | komunikace komunit mimo běžnou infrastrukturu |
| Knowledge commons | sdílení postupů, dat a protokolů |

🟢 **REALITA 2026:** Základní bridge vrstva a relay směr existují jako součást technické stopy projektu.

📋 **ROADMAP 2027–2028:** Rozšiřovat interoperabilitu postupně, bezpečně a auditovatelně. Bridge a cross-chain systémy jsou rizikové; rychlost nesmí předběhnout bezpečnost.

---

## L4 — OASIS: hra jako vědomý příběh

Lidé nežijí jen v ekonomice.

Žijí v příbězích.

Hry jsou dnes jedním z nejsilnějších nosičů příběhu. Dokážou učit, vtahovat, spojovat a formovat představivost. Mohou ale také vytvářet závislost, grind a prázdné odměny.

OASIS je L4 vrstva Terra Nova: kulturní a herní prostředí, které má učit skrze zkušenost.

Ne *play-to-earn*.

**Play-to-evolve.**

### Proč hra

Dobrá hra není únik z reality. Je to simulace, ve které se člověk učí jednat.

Mýtus, rituál a hra byly vždy propojené. Dítě se učí světu hrou. Dospělí si předávali hodnoty příběhem. Iniciace byla často strukturovaná zkušenost, ne přednáška.

OASIS chce tuto starou funkci přenést do digitálního světa:

- quest jako otázka;
- mapa jako učení;
- avatar jako archetyp;
- spolupráce jako strategie;
- odměna jako symbol pochopení, ne jen farmení.

### Golden Egg

🌟 **HORIZONT:** Golden Egg je koncept velké vzdělávací výzvy uvnitř OASIS.

Smysl není rozdat tokeny nejrychlejším grinderům.

Smysl je vytvořit kolektivní cestu přes texty, kultury, matematiku, historii, etiku a duchovní tradice.

Pokud je ve hře ukryto „vejce“, pak jeho hledání nemá být loterie. Má to být vzdělávací pouť.

Pravidlo návrhu:

**Spolupráce musí být výhodnější než izolovaná soutěž.**

Protože to je lekce, kterou má OASIS učit.

### Sacred Avatars

OASIS může pracovat s archetypy z různých kultur: Hanuman, Ardžuna, Padmasambhava, White Buffalo Calf Woman, Merlin, Quetzalcoatl a další.

Tady je nutná pokora.

Kulturní symboly nejsou skin do marketingu. Každý avatar musí být zpracovaný s respektem, kontextem a vědomím původu.

Cíl není smíchat tradice do povrchní koláže.

Cíl je ukázat, že různé kultury nesou různé brány k odvaze, službě, moudrosti, pravdě a péči o Zemi.

### Consciousness Levels v OASIS

Consciousness Levels nemají být jen herní XP.

Pokud by CL šlo nafarmit hodinami u obrazovky, celý princip by se zhroutil.

CL má odrážet širší přínos: službu komunitě, znalost, schopnost spolupráce, etické rozhodování, reálné projekty a dlouhodobou odpovědnost.

| Úroveň | Směr vývoje |
|--------|-------------|
| CL1 | základní účast a pochopení pravidel |
| CL3 | aktivní příspěvek komunitě |
| CL6 | schopnost navrhovat a držet složité systémy |
| CL9 | dlouhý horizont, služba přesahující osobní prospěch |

OASIS může CL zobrazovat a zpřítomňovat. Nemá ho falšovat.

### Play-to-Evolve

Play-to-Earn často selhal proto, že přesunul motivaci od hry k extrakci.

Lidé nehráli, aby se učili nebo radovali. Hráli, aby farmili.

Play-to-Evolve má opačný záměr:

| Play-to-Earn | Play-to-Evolve |
|--------------|----------------|
| grind pro odměnu | cesta k porozumění |
| inflace tokenů | vzácné odměny za skutečný průlom |
| soutěž o výnos | spolupráce a moudrost |
| čas jako zdroj k vytěžení | čas jako prostor proměny |

Hra má být dobrá tehdy, když z ní člověk odchází bdělejší, ne prázdnější.

---

## Jak L1–L4 drží jeden celek

Architektura Terra Nova není hromada modulů.

Je to vrstvený systém:

```text
L1  →  pravda řetězce
L2  →  ekonomický pohyb
L3  →  inteligentní koordinace
L4  →  kulturní příběh a učení
```

Když L1 selže, není důvěra.

Když L2 selže, není tok hodnoty.

Když L3 selže, není koordinace.

Když L4 selže, není důvod, proč by se lidé chtěli účastnit.

Terra Nova potřebuje všechny čtyři.

Základní kámen. Krev. Nervy. Příběh.

---

*[← Kapitola 06: Medicína](./06-MEDICINA.md)* | *[→ Kapitola 08: Svět Svobody](./08-SVOBODA.md)*

---

> *„Kód může vynutit pravidlo. Jen kultura může nést smysl pravidla.“*  
> — Terra Nova

> *„Genesis blok je technická událost. Ale zárodek je vždy víc než data, ze kterých začíná.“*  
> — Terra Nova, 2026
