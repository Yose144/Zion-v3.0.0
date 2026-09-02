# BODHI GAIA — Kapitola 7: Zahrada v OASIS a na webu
## Zrcadlo L4 ↔ L5 — jak se tři fyzické zahrady odrážejí v OASIS, na webu a v avatarech, a kde zrcadlo končí

> *„Virtuální svět nesmí být únikem před realitou, ale architektonickým modelem a posvátnou laboratoří pro znovustvoření světa fyzického."* — Nirvana, epizoda 9

---

## Příběh

Rybář z epizody 9 knihy Nirvana — ten, který na dřevěné lodičce vytáhl z kapsy sklíčko a během tří vteřin vstoupil do OASIS — jednoho dne doplul až do zátoky pod Domem Lumi.

V OASIS znal Novou zemi dobře. Chodil tam každý večer. Znal Prastarý strom v Zahradě Hiranyagarbha s devíti patry vědomí, znal osm Genesis teritorií, hledal stopy Zlatého vejce. A od jisté doby na mapě galaxie viděl nový bod: **Dharma Temple — La Palma**, sedm kopulí a Strom života, s sedmou stopou Zlatého vejce ukrytou někde v jeho zahradách. A na panelu „Nová Země" tři karty: Zahrada Genesis — *aktivní*, Dharma Temple — *příprava*, Te Pīko Ora — *plánováno*.

Když vystoupil na břeh, čekal, že uvidí to, co znal ze sklíčka: kopule z bílého mramoru, avatary z čistého světla, vodopády s dokonalým prouděním.

Uviděl plátěný stan, sud s vodou a ženu s mozoly na dlaních, která plela záhon.

*„Tohle je Zahrada Genesis?"* zeptal se nevěřícně.

*„Tohle je Zahrada Genesis,"* řekla Ana, aniž by zvedla hlavu. *„Ta druhá — ta ve sklíčku — je zrcadlo. Dobré zrcadlo. Ukazuje, kam jdeme. Ale kdo se v zrcadle zabydlí, přestane chodit."*

Rybář si sedl na kruh kamenů. *„V OASIS mám avatara Sítá — Matku Země. Za péči o půdu v Zahradě Hiranyagarbha dostávám body. Myslel jsem…"*

*„…že body ze zrcadla se dají směnit za hlínu?"* Ana se poprvé usmála. *„Ne. Ale dá se to udělat naopak. Kdo tady vydrží týden s motykou, ten se pak v zrcadle pozná. A jednou — až bude v zrcadle i tenhle stan a tenhle sud — bude možná platit, že quest v OASIS ti řekne: ‚Jeď do Zahrady. Jeď do chrámu na sedm dní ticha. Přivez semínko.' Zrcadlo bude ukazovat na dveře, ne nahrazovat je."*

*„A kdo hlídá, aby zrcadlo nelhalo? Aby v něm nebyla studna, která ve skutečnosti nestojí?"*

Ana ukázala na trám nad dveřmi Domu Lumi, kde tesař vyřezal semeno, tři čárky, sedm zubů a vědro. *„Tenhle trám. Každá věc v zrcadle musí mít svůj zub na trámu. Když nemá, je to jen obraz — a musí to o sobě říct."*

Rybář se vrátil k lodi, vytáhl sklíčko a dlouho se díval na sedm kopulí, které v OASIS stály na svahu La Palmy. Byly krásné. A věděl už, že nestojí.

Nechal sklíčko v kapse a šel si pro motyku.

---

## Co to znamená

**L4 OASIS a web `app.zionterranova.com` jsou zrcadlem L5 — místem, kde se tři fyzické zahrady poprvé ukazují lidem, kteří nikdy nebyli v Algarve, na La Palmě ani na Raiatea.** Zrcadlo má tři legitimní funkce a jednu zakázanou:

| Funkce zrcadla | Správně | Zakázáno |
|---|---|---|
| **Ukázat směr** | Karty, mapa, 3D koncept chrámu, příběh | Vydávat koncept za stavbu |
| **Pozvat** | Odkaz na projektový list, Discord, kontakt | Prodávat pozemky, podíly, „posvátné skiny" |
| **Učit** | Muzea chrámu, lekce Rapa Nui, wayfinding jako konsensus | Gamifikovat duchovní autoritu, pay-to-win |
| **Odměnit skutečnou péči** (horizont) | Quest, který posílá do fyzického světa a ověřuje se impact packetem | Odměňovat neověřený nebo škodlivý výkon |

### Co dnes v zrcadle je

**Web — Terra Nova (`/terranova`)**
- Kniha TerraNova s kapitolami a edicemi (`TerraNovaBookClient`, `generatedEditions.ts`).
- **Pioneer Projects L5** — tři karty (`PioneerProjectCards.tsx`): Zahrada Genesis (*Aktivní rozvoj*, EU), Dharma Temple (*V přípravě*, ES, UNESCO), Te Pīko Ora (*Plánováno*, PF).
- `/terranova/genesis` — charakter místa, fáze 0–4 (0 hotová, 1 aktivní), rysy (glamping, farma, stromy, surf, solar, setkání), integrace ZION (node *planned*, wallet *tbd*, Medical Table *planned*, mesh *planned*, Seed Library *active*, Proof-of-Care DAO *planned*), humanitární závazek 10 % z node odměn.
- `/terranova/dharma-temple` — La Palma, koncept, rysy, fáze (0 aktivní), **3D koncept** (7 kopulí, Strom života, Merkaba), **architektonický návrh**, **dokumentace** načítaná z `public/docs/terranova/dharma-temple.{cs,en}.md`, otevřené otázky, Discord.
- `/terranova/te-piko-ora` — Polynésie, Raiatea, rysy (wayfinding škola, mořská permakultura, kulturní obnova, solar, humanitární fond, ochrana dědictví *vision*), **lekce Rapa Nui**, fáze 0–3 (0 aktivní), integrace (node *planned*, DAO *planned*, fond *planned*, ledger dědictví *tbd*, wayfinding NFT *tbd*, mořská semenná knihovna *tbd*).

**Web — L5 Free World (`/l5-free-world`)**
- Vysvětlení L5 jako fyzické vrstvy, kanonická fondová adresa, 5 % z každého bloku, sdílené protokoly, komunity.

**OASIS Web (`oasis.zionterranova.com`)**
- Panel **„Nová Země"** (`WorldPanel.tsx`, `NOVA_ZEME_PROJECTS`) — tři L5 projekty s barvou, statusem a odkazem na web.
- Svět **`DHARMA_TEMPLE_LA_PALMA`** v galaxii (`worlds.ts`): „Sacred L5 sanctuary on La Palma — a geodesic temple of enlightenment, education and community", `goldenEggClue: 7`, pozice `(-16.2, 0.2, 31.8)`.
- Planeta **SAMANTABHADRA** (layer 5, „Nekonečná Zahrada", deset velkých slibů) — buddhistický archetyp všeobjímající praxe.

**OASIS backend (`V31/L4/oasis`)**
- `avatars.json`: sliby bódhisattvy (Samantabhadra, Avalokiteśvara, Mañjuśrī, „Issobela's Oath"), *Bodhicitta Spark* po laskavostních mikro-questech.
- Humanitarian Tithe (7 kategorií) jako součást herní architektury (`tithe.rs`).

**Sůl této země, epizoda 10 — avataři, kteří míří do L5**
- **SÍTÁ — Matka Země** (*Terra Architect / Alchemist*): péče o půdu a obnovu; questy „spojení s L5 Free World, projekty obnovy krajiny, zelená těžba".
- **DÁRCE / HANUMAN — Služebník Života** (*Steward / Humanitarian*): služba bez ega; questy „distribuce Humanitarian Tithe (5 %), pomoc nováčkům, stavba veřejných děl".

### Kde zrcadlo končí

1. **Statusy v zrcadle jsou ručně psané.** `NOVA_ZEME_PROJECTS` v OASIS i karty na webu jsou konstanty v kódu, ne data z L5 API. Když se změní realita, zrcadlo se nezmění samo. Cíl: číst stav komunit z `zion-free-world` (`/api/v1/projects`, tabulka `communities`) — HORIZONT.
2. **Sedm kopulí v OASIS je koncept, ne stavba.** Svět `DHARMA_TEMPLE_LA_PALMA` musí zůstat označen jako koncept/vize, dokud na La Palmě nestojí první kopule.
3. **Questy zatím nevedou do fyzického světa.** Nápady „Silence Quest" (odměna za 7denní retreat) a speciální sazby pro strážce jsou v komunitních dokumentech jako marketingový kanál (§11/§15), ne jako implementovaná mechanika. Jakýkoli quest, který odměňuje skutečnou návštěvu, potřebuje ověření (impact packet, souhlas, privacy) — jinak odměňuje tvrzení, ne péči.
4. **Avataři Sítá a Hanuman dnes nemají „hlínu".** Body v OASIS se nesměňují za nic fyzického a nesmí to být slíbeno. Směr je obrácený: fyzická péče (doložená) se může jednou zobrazit v zrcadle.
5. **Web Preview / UE 5.7 / Pixel Streaming** z epizody 9 Nirvany jsou HORIZONT (viz `MiseAmenti/07`). Dnešní OASIS Web je Next.js/Three.js klient, ne fotorealistický svět.

### Co by zrcadlo mělo umět v 3.3 (M4 + M5)

| Krok | Co | Vrstva | Stav |
|---|---|---|---|
| 1 | Zdroj pravdy pro statusy komunit: `communities` tabulka + `GET /api/v1/projects` → web i OASIS čtou z jednoho místa | L5 → L4 / web | HORIZONT |
| 2 | Veřejný L5 portál s živým zůstatkem fondu, návrhy, příjemci, milníky, výsledky (M5) | web | HORIZONT (`freeworld.zionterranova.com` v plánu N5) |
| 3 | Označení každého L5 světa v OASIS stavovou značkou (koncept / stavba / živé) přímo v UI | L4 | HORIZONT |
| 4 | Quest „Jeď do Zahrady" s ověřením přes impact packet a souhlas; žádná monetizace ceremonií | L4 ↔ L5 | HORIZONT (vyžaduje M5 gate a privacy review) |
| 5 | Oprava metadat: Dharma Temple svět `layer: 3` → L5; Genesis lokalita na `/l5-free-world` → Algarve | L4 / web | STAVBA (drobná oprava kódu) |

---

## Kotva pravdy — ověřitelná fakta

> Zrcadlo existuje a je krásné. Tato tabulka říká, co v něm je obraz a co je dveře.

| Prvek příběhu | Stav | Co je ověřitelné | Co ještě chybí |
|---|---|---|---|
| **Tři karty na panelu „Nová Země"** | **ŽIVÉ** (klient) | `APP&WEB/OasisWeb/src/components/WorldPanel.tsx` — `NOVA_ZEME_PROJECTS` (genesis *Active*, dharma *Prep*, piko-ora *Planned*) s odkazy na `app.zionterranova.com/terranova/*`. | Statusy nejsou napojené na L5 API. |
| **Sedm kopulí na mapě galaxie** | **ŽIVÉ** (klient) / **HORIZONT** (stavba) | `APP&WEB/OasisWeb/src/domain/config/worlds.ts` — `DHARMA_TEMPLE_LA_PALMA`, `goldenEggClue: 7`. | Svět má `layer: 3` místo L5; není označen jako koncept. |
| **Sítá a Hanuman jako avataři** | **ŽIVÉ** (dokument) / **HORIZONT** (mechanika) | `docs/WP-Mainet/SulZeme/10-Prvni-Svet-Oasis-a-Best-of-Avatari.md` §II — role a questy směřující do L5. | Implementace questů „spojení s L5" v `V31/L4/oasis` (quests.rs) není doložena. |
| **Sliby bódhisattvy v OASIS** | **ŽIVÉ** (data) | `V31/L4/oasis/data/avatars.json` — Samantabhadra, Avalokiteśvara, Mañjuśrī, *Bodhicitta Spark*. | Vazba na L5 Consciousness Admission = HORIZONT. |
| **Pioneer Projects na webu** | **ŽIVÉ** | `APP&WEB/website-v2.9/src/app/terranova/components/PioneerProjectCards.tsx`; stránky `genesis`, `dharma-temple`, `te-piko-ora`. | Sjednocení lokality Te Pīko Ora (Tahiti vs Raiatea) a Genesis (`/l5-free-world`: Střední Evropa vs Algarve). |
| **3D koncept chrámu** | **ŽIVÉ** (web) / **HORIZONT** (stavba) | `DharmaTemplePreviewLazy` na `/terranova/dharma-temple`; dokument `public/docs/terranova/dharma-temple.{cs,en}.md`. | Na webu chybí explicitní štítek „koncept — nestojí". |
| **Rybář se sklíčkem (instant preview)** | **HORIZONT** | Nirvana ep. 9; `MiseAmenti/07` řadí WebGPU / Pixel Streaming / UE 5.7 do HORIZONT. | POC klienta, licenční a výkonová analýza (M4). |
| **„Quest, který posílá do zahrady"** | **HORIZONT** | Nápad „Silence Quest" v `dharma-temple.md` §15 a „quest rewards for visits" v `genesis-garden.md` §11.2 jako marketingový kanál. | Mechanika, ověření, privacy review, M5 gate. |
| **Trám se zuby a vědrem** | **MÝTUS** | Obraz této knihy pro pravidlo „každý prvek zrcadla má kotvu pravdy". | — |

---

*→ Pokračování: [Kapitola 8 — Cesta poutníka: onboarding do L5](./08-Cesta-Poutnika-Onboarding-L5.md)*

---

*[Zpět na index Knihy Země → `00-README.md`](./00-README.md)*
