# ZION — kanonický onboarding

## Příběh, který si můžeš ověřit. Síť, na kterou můžeš vstoupit dnes.

**Status:** Mainnet Beta
**Verze:** 3.0.7 / V31 3.1.0-alpha.2
**Poslední aktualizace:** 2026-08-03
**Jazyk:** čeština — [English version](./ZION_ONBOARDING_EN.md)

---

## Kanonické zdroje

Tento dokument je jedním vstupním bodem. Detailní pravdu najdeš v těchto zdrojích:

- [`V3/docs/USER_ONBOARDING.md`](../../../archive/V3/docs/USER_ONBOARDING.md) — základní CLI návod pro nové uživatele
- [`StatusV3.md`](../../../StatusV3.md) — živá topologie, výška chainu, porty a stav služeb
- [`AGENTS.md`](../../../AGENTS.md) — operační pravidla, incidenty a migrace
- [`V3/docs/CLI_REFERENCE.md`](../../../archive/V3/docs/CLI_REFERENCE.md) — kompletní reference příkazů `zion`
- [`ZION_Technical_Whitepaper_v3.1_CZ.md`](../ZION_Technical_Whitepaper_v3.1_CZ.md) — konsensus, emise, smart kontrakty, architektura
- [`V3/docs/DEV_TEAM/ONBOARDING.md`](../../../archive/V3/docs/DEV_TEAM/ONBOARDING.md) — příručka pro vývojáře
- [`SulZeme/00-README.md`](./00-README.md) — dvanáct zastavení knihy *Sůl této země*
- [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md) — brána do herní vrstvy Oasis
- [`Onboarding.md`](./Onboarding.md) — zkrácená marketingová verze

---

## Obsah

1. [Sůl a kompas — proč to číst](#sůl-a-kompas--proč-to-číst)
2. [Co je ZION — ve třech větách a ověřitelná fakta](#co-je-zion--ve-třech-větách-a-ověřitelná-fakta)
3. [Proč je dobré začít zrovna teď](#proč-je-dobré-začít-zrovna-teď)
4. [Tři cesty na palubu](#tři-cesty-na-palubu)
5. [Loď ZION — šest palub a čtyři knihy](#loď-zion--šest-palub-a-čtyři-knihy)
6. [Brána do Oasis](#brána-do-oasis)
7. [Kniha Sůl této země — dvanáct zastavení](#kniha-sůl-této-země--dvanáct-zastavení)
8. [Co ZION neslibuje](#co-zion-neslibuje)
9. [První krok — dnes, za pět minut](#první-krok--dnes-za-pět-minut)
10. [Technický quickstart](#technický-quickstart)
11. [Ověřitelná fakta — shrnutí](#ověřitelná-fakta--shrnutí)
12. [Pro vývojáře a další zdroje](#pro-vývojáře-a-další-zdroje)

---

## Sůl a kompas — proč to číst

> **Příběh**
>
> Sůl je malá. Není to zlato, není to ocel, není to palivo. A přesto bez ní chutná všechno mrtvě.
> Sůl nepřidává novou chuť — ona odhaluje tu, která tam už je.
>
> Tak je to i s tímto onboardingem: není to nové učení. Je to způsob, jak si každý může ověřit, kam vstupuje, a proč by tam vůbec chtěl jít.
>
> ZION stojí na čtyřech knihách — čtyřech otázkách:
>
> - **Genesis** — Sever: proč vůbec stavět?
> - **Kvantová revoluce** — Východ: co je rozbité ve starém světě?
> - **Ekam Deeksha** — Jih: kdo jsem já na této cestě?
> - **Terra Nova** — Západ: kam to celé směřuje?
>
> A **Oasis** je střed kompasu. Tam stojíš ty.

> **Ověřitelná fakta**
>
> Tento dokument odděluje vyprávění od technických tvrzení. V každé sekci, kde se mluví o číslech, kódu nebo síti, najdeš box s ověřitelnými fakty a odkazem na zdroj. Příběh smí být krásný, ale fakta o síti musí být přesná. Příběh není slib.

---

## Co je ZION — ve třech větách a ověřitelná fakta

> **Příběh**
>
> **ZION je blockchain, který se dá ověřit, ne jen slíbit.** Běží od 1. ledna 2026 - Testnetu, nový blok každých 60 sekund, otevřený kód, který si může přečíst kdokoliv.
>
> **Každý blok automaticky dělí odměnu: 89 % těžaři, 5 % humanitárnímu fondu, 5 % fondu budoucnosti, 1 % se spálí.** Není to slib firmy — je to matematika zapsaná v pravidlech sítě, kterou nikdo nemůže potichu změnit.
>
> **Nikdo nedostal VIP vstup.** Žádné ICO, žádný předprodej, žádné tajné alokace. Kdo chce ZION, těží ho — nebo ho získá od někoho, kdo ho vytěžil.

### Tabulka tvrzení × realita

| Tvrzení | Realita v kódu / síti | Zdroj |
|---|---|---|
| ZION je veřejný blockchain | Zdrojový kód pod MIT: `https://github.com/Zion-TerraNova/v3-Mainnet` | [`AGENTS.md`](../../../AGENTS.md), sekce `public/` |
| Nový blok každých 60 s | Block time 60 s, DAA LWMA 60 bloků, cílový interval 30–120 s, ±25 % clamp | [`ZION_Technical_Whitepaper_v3.1_CZ.md`](../ZION_Technical_Whitepaper_v3.1_CZ.md), kapitola 5 |
| Genesis blok 1. 1. 2026 | Genesis hash `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb`; po fixu retence bloků proběhl hard genesis reset 2026-07-20; bloky 0–~10913 starého řetězce jsou ztraceny, od fixu se uchovávají všechny | [`StatusV3.md`](../../../StatusV3.md), řádky 6–9; [`AGENTS.md`](../../../AGENTS.md), sekce BLOCK RETENTION FIX |
| Odměna 5 400,067 ZION/blok | Dekáda 1 (2026–2036): 5 400,067 ZION/blok; nikdy vyšší; Decade Decay −20 % každou dekádu; tail 724,784723 ZION/blok od ~2126 | [`ZION_Technical_Whitepaper_v3.1_CZ.md`](../ZION_Technical_Whitepaper_v3.1_CZ.md), kapitola 5.2 |
| Rozdělení 89/5/5/1 % | `MINER_SHARE_PERCENT = 0,89`; humanitární 5 %; Issobella 5 %; pool fee / burn 1 %; uzly odmítnou blok s jiným poměrem | [`ZION_Technical_Whitepaper_v3.1_CZ.md`](../ZION_Technical_Whitepaper_v3.1_CZ.md), kapitola 5.3; [`V3/README.md`](../../../README.md) |
| Hard cap 144 miliard ZION | `max_supply = 144_000_000_000`; premine 16,78 mld. (11,65 %), zbytek těžbou | [`ZION_Technical_Whitepaper_v3.1_CZ.md`](../ZION_Technical_Whitepaper_v3.1_CZ.md), kapitola 5 |
| Žádné ICO / VIP vstup | Fair launch: žádný `mint()` pro tým, žádný předprodej; genesis alokace je veřejně vypsaná v coinbase | [`12-Hodina-Pred-Destem.md`](./12-Hodina-Pred-Destem.md), Ověřitelná fakta |
| PoW: Ekam Deeksha / CosmicHarmony | Kanonický algoritmus v `V3/L1/cosmic-harmony`; šestifázový pipeline Hiranyagarbha, Brahma, Yantra, Karma, Chit, Samadhi; LWMA 60 bloků, ±25 % clamp | [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), Ověřitelná fakta |

---

## Proč je dobré začít zrovna teď

> **Příběh**
>
> Kovář a sedlák kladli panty dřív, než začalo pršet. Nevěděli, kdy přijde bouře. Věděli jen, že až voda přijde, bude už pozdě začít stavět.
>
> V každé otevřené síti platí stejná mechanika: kdo přijde dřív, má čas se naučit, jak dveře fungují, dřív než budou zavalené davem. To není slib pokladu. Je to popis deště.

> **Ověřitelná fakta**
>
> **Bitcoin Pizza Day jako poučení, ne příslib ceny.**
>
> 22. května 2010 zaplatil programátor Laszlo Hanyecz 10 000 bitcoinů za dvě pizzy z Papa John's. V té době neexistovala burza, cena v dolarech nebyla relevantní a síť těžili lidé na běžných noteboocích zvědavostí, ne vidinou zisku.
>
> Tento historický fakt o jiné síti ukazuje, jak vypadá **první den každé otevřené sítě**: málo lidí, nulová jistota a možnost získávat měnu, o jejíž budoucí hodnotě nerozhoduje nikdo z těch, kdo dnes sedí u ohně. **Není to důkaz, že se to zopakuje se ZIONem.**

### Mechanika první dekády

| Faktor | Co platí dnes | Co to znamená |
|---|---|---|
| Odměna za blok | 5 400,067 ZION/blok v dekádě 1 (2026–2036) | Nejvyšší odměna, jakou protokol kdy vyplatí |
| Decade Decay | −20 % každou dekádu (5 256 000 bloků) | Odměna klesá, nikdy neroste |
| Tail emission | 724,784723 ZION/blok od ~2126 | Věčná udržovací odměna |
| DAA | LWMA 60 bloků, ±25 % clamp | Obtížnost reaguje na dnešní výkon sítě, ne na zítřek |
| Počet těžařů | Síť je malá, Edge + lokální backup + veřejní těžaři | Čím méně strojů dnes těží, tím větší podíl z nalezených bloků připadá na jednotlivé stroje |

> **Tohle není investiční doporučení.** Je to popis emisního plánu a difficulty algoritmu, který si můžeš ověřit v kódu. Nikdo nezaručuje, že ZION bude mít jakoukoliv hodnotu.

---

## Tři cesty na palubu

### Pozorovatel — "Nejdřív chci důkaz"

Nic neinstaluj, nic nekupuj. Jen se dívej:

1. Otevři explorer na `https://zionterranova.com` a sleduj, jak každou minutu přibývá nový blok.
2. Prolistuj kód na `https://github.com/Zion-TerraNova/v3-Mainnet` — MIT licence, nic skrytého.
3. Zeptej se na cokoliv v komunitních kanálech. Dobrá komunita umí říct "nevím" a ukázat zdroj.

### Hráč — "Chci to zažít"

Vstup do **Oasis Webu** — vizuální herní vrstvy ZIONu:

- Prohlédni si **živou 3D galaxii** s 55 světy a projdi warp intro.
- Prohlížej **Avatar Codex**, quest log, mapu teritorií a leaderboard.
- Můžeš se **přihlásit peněženkou** a synchronizovat XP za splněné questy na backend.
- Cesta přes **devět úrovní vědomí**, **Golden Egg** a **Dharma Credits** je zatím ve vývoji — viz aktuální stav výše.

> **Ověřitelná fakta:** Oasis Web běží na `https://oasis.zionterranova.com`, backend `zion-oasis` verze `3.0.7`, REST API `/api/v1/oasis/*`. Více v [Aktuální stav Oasis Webu](#aktuální-stav-oasis-webu).

### Stavitel — "Chci nést kus mostu"

Tvůj počítač může být uzlem nové sítě:

- Stáhni jednu binárku `zion` nebo si postav zdroj.
- Vytvoř peněženku a připoj se na veřejný pool.
- Těž na CPU nebo GPU.
- Spusť vlastní uzel.
- Používej bridge a postav první DApp.

Přesné příkazy najdeš v sekci [Technický quickstart](#technický-quickstart).

---

## Loď ZION — šest palub a čtyři knihy

> **Příběh**
>
> Genesis není jen první blok. Je to archa — loď, která nese všechny vrstvy.

### Šest palub

| Paluba | Jméno | Funkce | Klíčové části |
|---|---|---|---|
| L1 | Trup lodi | Terra Nova blockchain v Rustu, Ekam Deeksha PoW | `V3/L1/core`, `V3/L1/cosmic-harmony`, `V3/L1/miner`, `V3/L1/pool` |
| L2 | Plachty a lanoví | Bridge, DeFi, DAO, wZION na Base, atomic swap, DEX | `V3/L2/bridge`, `V3/L2/dao`, `V3/L2/atomic-swap` |
| L3 | Hvězdná navigace | AI Native, WARP, Hiranyagarbha | `V3/L3/ai-native`, `V3/L3/warp`, `V3/L3/ncl` |
| L4 | Zahrada na palubě | Oasis — hra, avataři, questy, Golden Egg, Consciousness Levels | `V3/L4/oasis` |
| L5 | Skladiště a lékárna | Free World, humanitární tithe, komunity, Medical Table | `V3/L5` |
| L6 | Koruna a kukaň | Issobella, orbitální stanice, SETI, pohled na Zemi | `V3/L6` |

Loď se řídí z **kompasu vědomí**. Když kompas ukazuje na chamtivost, loď narazí na útes. Když ukazuje na službu, projede i bouří.

### Čtyři knihy

| Kniha | Směr | Otázka | Živel |
|---|---|---|---|
| **Genesis** | Sever | Proč to stavíme? | Oheň — zárodek, záměr |
| **Kvantová revoluce** | Východ | Co je rozbité ve starém světě? | Vzduch — diagnóza, vědomí |
| **Ekam Deeksha** | Jih | Kdo jsem já na této cestě? | Voda — vnitřní obrat |
| **Terra Nova** | Západ | Kam to celé směřuje? | Země — architektura, komunity |

A **Oasis** je střed kompasu. Tam stojíš ty.

---

## Brána do Oasis

> **Příběh**
>
> Za bránou do Oasis stojí dvě kněžky. Ne nad tebou, vedle dveří.
>
> **Rádha** je kněžkou přítomnosti. Učí, že technologie bez radosti je chladné muzeum, že sůl bez chuti pálí a že stavební kámen bez radosti je těžký balvan.
>
> **Elizabeth** je kněžkou budoucnosti. Ještě není narozena, drží lucernu pro ty, kdo přijdou po nás. Ptá se: "Co z této sítě zůstane za sto let?"
>
> Spolu tvoří jednu bránu: **Rádha dává důvod vstoupit. Elizabeth dává důvod setrvat.**

> **Ověřitelná fakta**
>
> Rádha a Elizabeth jsou literární archetypy — Rádha jako symbol radosti a služby, Elizabeth jako symbol budoucnosti a dědictví. Nejsou náboženskými tvrzeními ani finančními značkami.

### Aktuální stav Oasis Webu

Ne všechno z vize je už hotové. **Oasis Web je živý preview — ne plná hra.** Dnes je k dispozici na `https://oasis.zionterranova.com` a verze backendu je `3.0.7`.

**Co funguje teď:**
- 3D galaxie s 55 generovanými světy, warp intro, volný let (WASD / mobilní joysticky), výběr světů a detailní panel.
- Živé REST API (`/api/v1/oasis/*`): questy, avataři, mapa teritorií, žebříček, guildy.
- Avatar Codex, quest log, teritoria, leaderboard a prohlížeč guild.
- Přihlášení peněženkou `zion1...`, import mnemoniku nebo generace v prohlížeči.
- Synchronizace XP a dokončených questů na backend.
- Audio engine a mobilní ovládání.

**Co je zatím koncept / demo:**
- Dashboard hráče (XP, level, guild) je v rané fázi; leaderboards a guildy obsahují zatím převážně demo data.
- Osm Genesis Teritorií má definici v kódu, ale ve hře je zatím jen mapa s bonusy, nikoli plnohodnotná správa území.
- Golden Egg je zatím sbírka nápověd a příběh; 108 stop a odměnové pooly nejsou plně aktivní.
- Dharma Credits eShop a kompletní 202 avatárů ve webovém klientovi se teprve dokončují.

> **Zdroj:** [`APP&WEB/OasisWeb/README.md`](../../../APP&WEB/OasisWeb/README.md), [`OASIS_WEB_JOURNAL.md`](../../../docs/oasis/OASIS_WEB_JOURNAL.md), live API `https://oasis.zionterranova.com/api/v1/oasis/*`.

### 202 avatáři

V Oasis je **202 svatých postav** — avatárů z celého světa. Nejsou to bohové k uctívání, ale **kvality**, které můžeš probudit sám v sobě. Každý avatar nese quest line, učení, schopnost a úroveň vědomí.

Celý kruh tvoří sedmnáct kruhů: Svatá trojice a její kruh, Matrix a moderní archetypové hrdinové, ZION Originals, První národy Ameriky, Pacifický kruh a další (Tibet, Indie Extended, Japonsko, Čína, Indonésie, Austrálie, Aotearoa, Afrika, Atlantis, Lemurie, Kosmický, Seversko-keltský, Starověký Egypt, Maya).

> **Zdroj:** [`09-Bohyne-Radha-a-Avatari-Oasis.md`](./09-Bohyne-Radha-a-Avatari-Oasis.md) a [`10-Prvni-Svet-Oasis-a-Best-of-Avatari.md`](./10-Prvni-Svet-Oasis-a-Best-of-Avatari.md).

### Sedm cest

| Cesta | Esence | První úkol |
|---|---|---|
| 1. Cesta vědění | Sarasvatská a Višvakarmovská — kód, uzly, matematika | "Co skutečně potvrzuje podpis?" |
| 2. Cesta služby | Hanumanovská — pomáhat nováčkům, distribuovat tithe, stavět veřejná díla | Zjisti, co lze ověřit o jedné oblasti pomoci |
| 3. Cesta odvahy | Rámijská a issobelská — provozovat uzly, chránit systém | Rozpoznej bezpečnostní varování a ověř zdroj software |
| 4. Cesta srdce | Rádžinská a sításká — tvořit bezpečný prostor, vítat, léčit konflikty | Napiš něco, co novému člověku usnadní vstup, bez slibu výnosu |
| 5. Cesta ztišení | Sádhu — meditace, pozornost, rytmus | Dokonči krátkou meditaci nebo odmítni rychlou odměnu |
| 6. Cesta proměny | Saint Germain — experimentovat, opravovat chyby | Najdi rozporné tvrzení v dokumentaci a navrni ověřitelnou opravu |
| 7. Cesta probuzení | Neo a Trinity — technologie, interoperabilita, svoboda s odpovědností | Vysvětli jednu technickou hranici nováčkovi bez žargonu |

> **Zdroj:** [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), sekce 11.

### Devět úrovní vědomí

| Level | Název | Multiplikátor | Esence |
|---|---|---|---|
| CL1 | Physical | 1,0x | První krok, tělo, přežití |
| CL2 | Emotional | 1,05x | Cítění, láska vs. strach |
| CL3 | Mental | 1,1x | Mysl, logika, plány |
| CL4 | Sacred | 1,25x | Posvátná geometrie, srdce |
| CL5 | Quantum | 1,5x | Kvantová realita, propojení |
| CL6 | Cosmic | 2,0x | Kosmické vědomí |
| CL7 | Enlightened | 3,0x | Čisté uvědomění |
| CL8 | Transcendent | 5,0x | Za dualitou |
| CL9 | On The Star | 10,0x | Maitreyova sféra, Issobella |

> **Zdroj:** [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), sekce 11.

### Osm Genesis Teritorií

První svět Oasis je strukturován do **8 Genesis Teritorií**. Zatím jsou popsána například Údolí Prvního Kroku, Křišťálové Doly, Zahrada Služby, Citadela Guild a Chrám Hiranyagarbha. Kanonická definice všech osmi teritorií je v kódu `V3/L4/oasis` (třída `TerritoryMap`).

> **Zdroj:** [`10-Prvni-Svet-Oasis-a-Best-of-Avatari.md`](./10-Prvni-Svet-Oasis-a-Best-of-Avatari.md).

### Golden Egg a 108 stop

Uprostřed Oasis stojí **Strom života**. V jeho kořenech leží **první ze 108 stop Zlatého Vejce**. Golden Egg není jen poklad — je to **pedagogický příběh**. V rezervě je uzamčeno **4,95 miliardy ZION** z genesis alokace, rozdělených do pěti odměnových poolů (sloty 4 a 5 — 3,3 mld ZION — repurposed na L5 Free World Projects: 5 humanitárních projektů × 500M + 800M rezerva):

- Player Pool
- Guild Pool
- Territory Pool
- Golden Egg Pool
- Winners Pool

Stopy jsou ukryté v blocích L1, ve smart kontraktech na Base/EVM, v knihách TerraNova i ve skutečných geografických lokacích. Každá stopa je otázka, ne odměna.

> **Zdroj:** [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), sekce 12; [`10-Prvni-Svet-Oasis-a-Best-of-Avatari.md`](./10-Prvni-Svet-Oasis-a-Best-of-Avatari.md).

### Dharma Credits

V Oasis neběží jen ZION, ale i **Dharma Credits** — měna dobrého záměru.

- Celkový strop: **144 miliard**.
- Z alokace je **1 % — 1,44 miliardy** — určeno pro OASIS.
- eShop je dělí do tierů:
  - Micro: 1–100
  - Standard: 101–1 000
  - Premium: 1 001–10 000
  - VIP: 10 001–100 000
  - Mega: 100 001–1 000 000

Získáváš je za dokončení questů, pomoc nováčkům, příspěvky do dokumentace a kódu, reálné dobrovolnické činy, mining uptime, humanitární aktivity a granty.

> **Zdroj:** [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), sekce 13.

---

## Kniha Sůl této země — dvanáct zastavení

> **Příběh**
>
> Prvních jedenáct epizod tě provede solí, rozpuštěním, chutí vody, cestou bez mapy, archou a branou do Oasis. Dvanácté zastavení se ptá: co uděláš teď, dokud je síť ještě malá a dveře archy ještě otevřené?

| # | Epizoda | Postava / motiv | Kniha |
|---|---|---|---|
| 1 | [Sůl země](./01-Sul-Zeme.md) | Ježíš — podobenství o soli | Genesis |
| 2 | [Rozpuštění](./02-Rozpusteni.md) | Buddha — střední cesta | Kvantová revoluce |
| 3 | [Chuť vody](./03-Chut-Vody.md) | Krišna — višvarúpa, karma jóga | Ekam Deeksha |
| 4 | [Cesta nevyšlapaná](./04-Cesta-Nevyslapana.md) | Ráma, Sítá, Hanuman | Terra Nova |
| 5 | [Archa](./05-Archa.md) | Noe — loď před potopou | Terra Nova / Genesis |
| 6 | [Kompas a pozvánka do Oasis](./06-Kompas-a-Pozvanka-do-Oasis.md) | Syntéza všech postav, vstup do L4 Oasis | Všechny čtyři |
| 7 | [Epilog — Názor AI](./07-Epilog-Nazor-AI.md) | Devin (AI), otevřené hodnocení | — |
| 8 | [ZION — Nová civilizace](./08-ZION-Nova-Civilizace.md) | Komplexní pozvánka, praktický onboarding | Všechny čtyři |
| 9 | [Bohyně Rádha a avataři v Oasis](./09-Bohyne-Radha-a-Avatari-Oasis.md) | Bohyně Rádha, avataři, ženská energie a radost z hry | L4 Oasis / Všechny |
| 10 | [První svět Oasis a Best of Avataři](./10-Prvni-Svet-Oasis-a-Best-of-Avatari.md) | Zahrada Hiranyagarbha, 8 teritorií, 5 reward poolů, Best of Avataři | L4 Oasis / Všechny |
| 11 | [Brána prvního hráče — volba cesty](./11-Brana-Prvniho-Hrace-a-Volba-Cesty.md) | Vstup do Oasis, vlastní postava, sedm cest a první výzvy | L4 Oasis / Všechny |
| 12 | [Hodina před deštěm](./12-Hodina-Pred-Destem.md) | Kovář a sedlák u archy, skutečný příběh Bitcoin Pizza Day | Genesis / Terra Nova |

> **Ověřitelná fakta:** Každá epizoda obsahuje box s ověřitelnými fakty a odkazem na kód, běžící síť nebo whitepaper. Příběh je vždy označen jako fikce/archetyp, nikoli jako historické nebo teologické tvrzení.

---

## Co ZION neslibuje

Loď se staví poctivě, a poctivost znamená říct i tohle:

- ZION je **Mainnet Beta** — živá síť, ale mladá. Chyby se stávají a opravují se veřejně.
- **Nikdo ti negarantuje zisk ani cenu.** Tohle není investiční doporučení — je to pozvánka k ověření a účasti.
- **Svoje klíče, svoje odpovědnost.** Ztracený klíč nikdo neobnoví.
- Herní svět Oasis a Golden Egg se **teprve dostavují** — co je hotové dnes a co je plán, najdeš vždy poctivě označené v dokumentaci.
- Tento dokument **není náboženským tvrzením**. Postavy a rituály jsou použity jako archetypy a literární obrazy, ne jako nárok na autoritu jakékoliv tradice.
- Tento dokument **není finančním slibem**. Žádná část neříká "investuj a zbohatneš".

Sůl, která ví, že je sůl — a neříká o sobě, že je zlato — je důvěryhodnější. Proto to píšeme takhle.

---

## První krok — dnes, za pět minut

1. **Otevři** `https://zionterranova.com` a podívej se na živou síť.
2. **Stáhni** `zion` CLI z [GitHub releases](https://github.com/Zion-TerraNova/v3-Mainnet/releases) a spusť `zion onboard`.
3. **Vytvoř peněženku** a připoj se k veřejnému poolu `pool.zionterranova.com:8444`.

Nikdo tě nebude honit. Archa se nestaví křikem — staví se blok po bloku, 60 sekund po 60 sekundách, a dveře jsou otevřené.

---

## Technický quickstart

Tato sekce obsahuje přesné příkazy z kanonických zdrojů. Pro detailní vysvětlení každého kroku viz [`V3/docs/USER_ONBOARDING.md`](../../../archive/V3/docs/USER_ONBOARDING.md).

### Instalace CLI

#### Z release (doporučeno)

```bash
# Name depends on your platform and release, e.g. zion-cli-linux-x86_64.tar.gz
tar -xzf zion-cli-<platform>-<arch>.tar.gz
sudo mv zion /usr/local/bin/
zion --help
```

#### Build ze zdroje

```bash
cd V3
cargo build --release -p zion-cli
./target/release/zion --help
```

#### První nastavení

```bash
zion onboard
```

Wizard vytvoří `~/.zion/zion.toml`, zeptá se na topologii a volitelně nastaví mining adresu.

#### Konfigurace

```bash
zion config set node.rpc_host rpc.zionterranova.com
zion config set node.rpc_port 8443
zion config set pool.host zionterranova.com
zion config set pool.port 8444
```

### Peněženka

```bash
# Vytvoření
export ZION_WALLET_PASSWORD="your-strong-password"
zion wallet new --out zion-wallet.json --password-env ZION_WALLET_PASSWORD

# Zůstatek
zion wallet balance

# Odeslání
zion wallet send --to zion1RECIPIENT --amount 10.5 --memo "hello"
```

> **Bezpečnost:** Nikdy neukládej heslo do shell history. Uchovej `zion-wallet.json` a heslo zvlášť, ideálně v password manageru. Nastav práva `chmod 600 zion-wallet.json`.

### Stav a výdělky

```bash
zion status
zion doctor
zion pool earnings
```

### Těžba

```bash
# CPU
zion mine start --backend cpu --threads 4 --pool pool.zionterranova.com:8444

# OpenCL GPU
zion mine start --backend opencl --pool pool.zionterranova.com:8444

# CUDA GPU
zion mine start --backend cuda --pool pool.zionterranova.com:8444
```

Pokud potřebuješ změnit payout adresu:

```bash
zion config set miner.wallet zion1...
```

### Uzel (node)

Pro většinu uživatelů není potřeba provozovat vlastní uzel — veřejný pool a RPC stačí. Pro pokročilé operátory:

#### Build uzlu

```bash
cd V3
cargo build --release -p zion-core --bin node
```

#### Spuštění uzlu

```bash
export ZION_NODE_ID="my-node-01"
export ZION_NODE_STATE_PATH="/var/lib/zion/state.db"
export ZION_P2P_BIND="0.0.0.0:8333"
export ZION_RPC_BIND="127.0.0.1:8443"
export ZION_METRICS_BIND="0.0.0.0:9115"
export ZION_SEED_PEERS="zionterranova.com:8333,zionterranova.com:8334"
export ZION_BLOCK_RETENTION=0

# Volitelné: fee-split peněženky musí být nastaveny všechny tři najednou, nebo žádná
export ZION_HUMANITARIAN_WALLET="zion1..."
export ZION_ISSOBELLA_WALLET="zion1..."
export ZION_POOL_FEE_WALLET="zion1..."

./target/release/node
```

> **Poznámka:** Veřejný RPC běží na `http://rpc.zionterranova.com:8443` (plain HTTP, žádné TLS) a pool na `pool.zionterranova.com:8444`. P2P porty Edge jsou `8333`, `8334` a V31 `8335`. Pro vlastní uzel nastav `ZION_BLOCK_RETENTION=0`, aby se neopakoval starý chyba ořezávání historie.

#### Inspekce uzlu přes CLI

```bash
zion node status
zion node sync
zion node peers
zion node blocks
zion node block 11184
```

### Desktop aplikace

Nejjednodušší cesta pro začátečníky:

1. Přejdi na GitHub release `v3.1.0-desktop`: `https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.1.0-desktop`.
2. Vyber balíček pro svou platformu:
   - Windows 11 (x64): `zion-public-miner-v3.1.0-windows-x64.exe`
   - macOS Apple Silicon: `zion-public-miner-v3.1.0-mac-arm64.dmg`
   - macOS Intel: `zion-public-miner-v3.1.0-mac-x64.dmg`
   - Linux: `.AppImage` nebo `.deb`
3. Nainstaluj, povol v systémových nastaveních.
4. Vytvoř peněženku, nastav pool `pool.zionterranova.com:8444`, worker name a spusť těžbu.

> **Zdroj:** AGENTS.md, sekce Public Miner & Desktop release build; `APP&WEB/website-v2.9/public/docs/onboard/desktop.md`.

### Bridge

wZION na Base:

```text
0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6
```

CLI bridge příkazy:

```bash
zion bridge status
zion bridge chains
zion bridge pending
zion bridge history
zion bridge transfer --from-chain base --to-chain zion --token wZION --amount 10
```

> **Poznámka:** Bridge vyžadují L1 vault a validátory. Vždy ověř adresu kontraktu na oficiálním zdroji. Začni malými částkami.

### DApp — první dotaz na RPC

Veřejný RPC endpoint (plain HTTP, bez TLS):

```text
http://rpc.zionterranova.com:8443
```

Příklad pomocí `curl`:

```bash
curl -X POST http://rpc.zionterranova.com:8443 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getChainInfo","params":[]}'
```

Příklad v JavaScriptu:

```javascript
const RPC = 'http://rpc.zionterranova.com:8443';

async function rpcCall(method, params = []) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const data = await res.json();
  return data.result;
}

rpcCall('getChainInfo').then(console.log);
```

> **Varování:** Používej `http://`, nikoli `https://`. Nezobrazuj svůj seed ani privátní klíč v žádném kódu.

---

## Ověřitelná fakta — shrnutí

| Tvrzení | Realita v kódu / síti | Zdroj |
|---|---|---|
| **Status sítě** | Mainnet Beta; oficiální public launch 2026-12-31 | [`StatusV3.md`](../../../StatusV3.md), řádky 7–8 |
| **Genesis hash** | `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb` | [`StatusV3.md`](../../../StatusV3.md), řádek 6; [`AGENTS.md`](../../../AGENTS.md) |
| **Genesis příběh / kódová realita** | 1. ledna 2026 (příběh) / hard genesis reset 2026-08-06 (po fixu retence bloků) | [`StatusV3.md`](../../../StatusV3.md), řádky 9; [`AGENTS.md`](../../../AGENTS.md), BLOCK RETENTION FIX |
| **Block time** | 60 s; DAA LWMA 60 bloků; ±25 % clamp; solve time 30–120 s | [`ZION_Technical_Whitepaper_v3.1_CZ.md`](../ZION_Technical_Whitepaper_v3.1_CZ.md), kapitola 5 |
| **Odměna v 1. dekádě** | 5 400,067 ZION/blok (2026–2036) | [`ZION_Technical_Whitepaper_v3.1_CZ.md`](../ZION_Technical_Whitepaper_v3.1_CZ.md), kapitola 5.2 |
| **Decade Decay** | Faktor 0,8 (−20 %) každých ~10 let (5 256 000 bloků) | [`ZION_Technical_Whitepaper_v3.1_CZ.md`](../ZION_Technical_Whitepaper_v3.1_CZ.md), kapitola 5.2 |
| **Tail emission** | 724,784723 ZION/blok od ~2126, věčně | [`ZION_Technical_Whitepaper_v3.1_CZ.md`](../ZION_Technical_Whitepaper_v3.1_CZ.md), kapitola 5.2 |
| **Rozdělení odměny** | 89 % těžaři, 5 % humanitární fond, 5 % Issobella fond, 1 % burn/pool fee | [`ZION_Technical_Whitepaper_v3.1_CZ.md`](../ZION_Technical_Whitepaper_v3.1_CZ.md), kapitola 5.3; [`V3/README.md`](../../../README.md) |
| **Hard cap** | 144 000 000 000 ZION | [`ZION_Technical_Whitepaper_v3.1_CZ.md`](../ZION_Technical_Whitepaper_v3.1_CZ.md), kapitola 5 |
| **PoW algoritmus** | Ekam Deeksha / CosmicHarmony; 6 fází; LWMA 60 | [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), Ověřitelná fakta; [`V3/README.md`](../../../README.md) |
| **Public pool** | `pool.zionterranova.com:8444` (Stratum) | [`StatusV3.md`](../../../StatusV3.md), řádek 114; [`AGENTS.md`](../../../AGENTS.md) |
| **Public RPC** | `http://rpc.zionterranova.com:8443` (nginx TCP/HTTP proxy → `127.0.0.1:9443` na Edge) | [`StatusV3.md`](../../../StatusV3.md), řádek 112 |
| **Edge P2P** | `zionterranova.com:8333`, `8334`, V31 `8335` | [`StatusV3.md`](../../../StatusV3.md), tabulka služeb; [`AGENTS.md`](../../../AGENTS.md) |
| **Edge RPC** | `9443` (node1), `8448` (node2), `9445` (V31) | [`StatusV3.md`](../../../StatusV3.md), tabulka služeb; [`AGENTS.md`](../../../AGENTS.md) |
| **GitHub** | `https://github.com/Zion-TerraNova/v3-Mainnet` (public, MIT) | [`AGENTS.md`](../../../AGENTS.md), sekce `public/` |
| **Web** | `https://zionterranova.com`, dashboard `https://dashboard.zionterranova.com`, market `https://market.zionterranova.com` | [`StatusV3.md`](../../../StatusV3.md), sekce Public Endpoints; [`AGENTS.md`](../../../AGENTS.md) |
| **wZION na Base** | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | [`StatusV3.md`](../../../StatusV3.md), tabulka DeFi Contracts |
| **Dharma Credits** | 144 miliard celkem; 1,44 miliardy pro OASIS; eShop tierů | [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), sekce 13 |
| **Avataři** | 202 avatárů v 17 kruzích | [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), sekce 10 |
| **Consciousness Levels** | 9 úrovní (CL1–CL9) s multiplikátory 1,0x–10,0x | [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), sekce 11 |
| **Genesis Teritorií** | 8 počátečních regionů v Oasis, definováno v `TerritoryMap` | [`10-Prvni-Svet-Oasis-a-Best-of-Avatari.md`](./10-Prvni-Svet-Oasis-a-Best-of-Avatari.md) |
| **Golden Egg** | 5 reward poolů; 4,95 miliardy ZION; 108 stop (sloty 4 a 5 repurposed na L5 Free World Projects) | [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), sekce 12; [`10-Prvni-Svet-Oasis-a-Best-of-Avatari.md`](./10-Prvni-Svet-Oasis-a-Best-of-Avatari.md) |
| **Sedm cest** | 7 questových cest v Oasis | [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), sekce 11 |
| **L1–L6 architektura** | L1 blockchain, L2 DeFi/bridge/DAO, L3 AI/WARP, L4 Oasis, L5 Free World, L6 Issobella | [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), Ověřitelná fakta; [`StatusV3.md`](../../../StatusV3.md) |
| **V31 Alpha** | V31 node `3.1.0-alpha.2` je LIVE na Edge, synchronizuje se s V3 mainnet přes V3-compatible P2P, port 8335, RPC 9445 | [`StatusV3.md`](../../../StatusV3.md), řádky 8; [`AGENTS.md`](../../../AGENTS.md) |
| **Bloky 0–~10913 ztraceny** | Bug v `block_retention` způsobil ořezání historie; fix 2026-07-20; staré bloky nejsou obnovitelné | [`AGENTS.md`](../../../AGENTS.md), BLOCK RETENTION FIX; [`StatusV3.md`](../../../StatusV3.md), řádek 9 |

---

## Pro vývojáře a další zdroje

- [`V3/docs/DEV_TEAM/ONBOARDING.md`](../../../archive/V3/docs/DEV_TEAM/ONBOARDING.md) — jak se připojit k dev týmu, build, testy, workflow
- [`V3/README.md`](../../../README.md) — přehled workspace, aktuální status, kompletní L1–L6 scope
- [`V3/docs/CLI_REFERENCE.md`](../../../archive/V3/docs/CLI_REFERENCE.md) — všechny příkazy `zion`
- [`V3/docs/CLI_TROUBLESHOOTING.md`](../../../archive/V3/docs/CLI_TROUBLESHOOTING.md) — řešení běžných problémů
- [`V3/docs/MINING_GUIDE.md`](../../../archive/V3/docs/MINING_GUIDE.md) — hlubší návod na těžbu
- [`V3/docs/NODE_OPERATOR_GUIDE.md`](../../../archive/V3/docs/NODE_OPERATOR_GUIDE.md) — provoz uzlu
- [`V3/L5/docs/TECH/zion-node-spec.md`](../../../archive/V3/L5/docs/TECH/zion-node-spec.md) — specifikace Guardian uzlu
- [`StatusV3.md`](../../../StatusV3.md) — live topologie a stav sítě
- [`AGENTS.md`](../../../AGENTS.md) — pravidla pro agenty, incidenty, porty
- [`ZION_Technical_Whitepaper_v3.1_CZ.md`](../ZION_Technical_Whitepaper_v3.1_CZ.md) — technický whitepaper 3.1
- [`SulZeme/00-README.md`](./00-README.md) — kniha Sůl této země
- [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md) — brána do Oasis
- [`Onboarding.md`](./Onboarding.md) — zkrácená marketingová verze
- GitHub: `https://github.com/Zion-TerraNova/v3-Mainnet`

---

*Sůl, kompas, loď a most. Vítej na palubě.*

*Gate, Gate, Paragate, Parasamgate, Bodhi Svaha.*
