# OASIS Universe — vize a design vesmíru

> **Stav:** živý koncept / skica  
> **Cíl:** popsat vizuální a herní svět OASIS, který vzniká v `APP&WEB/OasisWeb` jako prototyp a později se převede do Unreal Engine 5.  
> **Technický rámec:** pravidla pro přenositelnost do UE5 jsou v [`AGENTS.md`](/AGENTS.md) — domain/adapters, žádný browser/Three kód v `src/domain/`.

---

## 1. Základní koncept

OASIS není jedna hra. Je to **multivrstevnatý metavers**, kde se prolínají:

- vesmírné MMO (EVE Online),
- fantasy RPG (WoW, LoL),
- akční FPS/arenas (Quake 3 Arena, Doom),
- otevřené sandboxy (GTA),
- kyberpunková realita ve 3. osobě,
- space opera (Star Wars, Star Trek),
- a v jádru celého — Matrix trilogie.

Hlavní myšlenka: **svět neomezených možností**. Galaxie je živá, plná civilizací, dimenzí, časových linií a interpretovaných "planet" — každá z nich může být jiným žánrem, jiným pravidlem, jinou realitou.

---

## 2. Galaxie — živá Mléčná dráha

Po intru a příletu hráče do středu galaxie se OASIS nejprve zobrazí jako **spirálová galaxie inspirovaná Mléčnou dráhou**.

- Galaxie je živá — rotuje, má spirálová ramena, prachové a plynné struktury, jádro.
- Hráč přilétá zvenčí a směřuje ke středu, kde stojí **Strom života** (aktuálně `TreeOfLife.tsx`).
- Galaxie není jen pozadí; je to **navigace** — každý hvězdný systém je místem, kam se dá cestovat.
- Může obsahovat tisíce až milióny hvězd; pro prototyp se začne s klíčovými systémy, zbytek se generuje procedurálně.

### 2.1 Hlavní hvězdné systémy (první vrstva)

Jádrem OASIS je náš místní kosmické sousedství a známé hvězdné systémy. Každý je osídlen pokročilejší civilizací a nabízí jiný typ světa:

- **Sirius** — bílý trpaslík, technokratická/spirituální civilizace.
- **Alpha Centauri** — nejbližší hvězdný soused, brána do galaxie.
- **Orion** — bojové a lovecké kultury, arénové světy.
- **Pleiady (Sedm sester)** — umělecká, hudební, mýtická civilizace.
- **Arcturus** — obři/oranžový obr, mudrci a architekti.
- *(a další: Vega, Antares, Betelgeuse, Tau Ceti, Proxima Centauri …)*

Každý systém může mít:
- orbitální stanice,
- planety různých typů (lava, ocean, ice, forest, cyber, industrial, temple),
- NPC frakce a questy,
- ekonomické cesty (těžba, obchod, diplomacie).

---

## 3. Vrstvy a dimenze — časoprostorové cestování

Sirius, Arcturus atd. jsou jen **první vrstva**. OASIS má jich víc:

- **Vrstva 1 — fyzická galaxie** (hvězdy, planety, letové vzdálenosti, EVE-like).
- **Vrstva 2 — paralelní dimenze** (různé verze stejných míst; Matrix, kvantové větvení).
- **Vrstva 3 — časové linie** (minulost/budoucnost, historické epochy, kolapsy a zlaté věky).
- **Vrstva 4 — mýtické/symbolické roviny** (podsvětí, nebe, akashické záznamy, avatárské sféry).
- **Vrstva 5 — hráčská kreativita** — vlastní dimenze, gildovní světy, modované planety.

Cestování mezi vrstvami je součástí hry — nejprve pomocí bran (stargate), později lodí, warp skoků, vědomí a klíčů.

---

## 4. Planety a herní světy — mix žánrů

Planety nejsou jen kulové modely. Každá planeta je **herní instance** s vlastními pravidly. Inspirace:

| Planeta / Svět | Žánr | Vibe |
|---|---|---|
| **Doom** | FPS / survival horror | peklo, démoni, těžká zbraňovka |
| **GTA** | otevřený sandbox / městský krimi | megacity, frakce, gangy, vozidla |
| **Quake 3 Arena** | arena shooter | turnaje, ranked arény, 1v1 |
| **WoW-like svět** | MMORPG | frakce, raidy, dungeony, tithe |
| **LoL-like aréna** | MOBA | 5v5, lanes, hrdinové |
| **Kyberpunková planeta** | 3rd person open world | neon, hackování, augmentace |
| **Star Wars sektor** | space opera | impérium vs. rebelové, světelné meče, hvězdné lodi |
| **Star Trek sektor** | průzkum / diplomacie | federace, první kontakt, morální volby |
| **Matrix jádro** | simulace / realita | déjà vu, červená pilule, agenti, kód |

> **Poznámka k IP:** jména jako Star Wars, Star Trek, GTA, Doom, Quake, WoW, LoL, EVE Online, The Matrix jsou většinou ochranné známky třetích stran. V OASIS je chápeme jako **žánrové inspirační archetypy** — konkrétní implementace budou buď vlastní reinterpretace, pastiche, parodie, nebo budou vyžadovat oficiální licence. Tento dokument slouží jako kreativní mapa, ne jako právní závazek.

---

## 5. Herní sloupky (gameplay pillars)

1. **Průzkum a cestování** — hvězdné lodi, stargate, warp, dimenze.
2. **Ekonomie a craft** — těžba ZION, obchod, territory control, gildové trezory.
3. **Boj a PvP/PvE** — FPS, RPG, MOBA, aréna — podle světa.
4. **Společnost a frakce** — guildy, rasy, civilizace, diplomacie, tithe.
5. **Příběh a questy** — Golden Egg, avatářské questy, consciousness levels, onboarding.
6. **Tvorba a modifikace** — hráči/gildy mohou zakládat vlastní malé světy/dimenze.
7. **Meta / Matrix vrstva** — odhalování, že celý OASIS je simulace, “červená pilule”, boj o pravdu.

---

## 6. Postup hráče

- Hráč začíná jako **pilgrim / objevitel** v centrální OASIS oblasti.
- Získává **avataře** (viz `AVATAR_ROSTER.md` a koncept avatárů) a **consciousness levels**.
- Může volit: obchodník, válečník, diplomat, průzkumník, mudrc, stavitel.
- Postupně odemyká hvězdné systémy, dimenze, časové linie.
- V jádru se dostane k **Matrix vrstvě** — rozhodnutí, co je realita.

---

## 7. Vztah k existujícím OASIS systémům

- **Avataři** — každý svět/dimenze může mít své avatářské linie.
- **Golden Egg** — je skryté v některé z dimenzí/vrstev; hledání ho táhne hráče napříč galaxií.
- **Territories** — planety/území, která gildy mohou ovládat.
- **Quests** — napříč hvězdnými systémy, dimenzemi a epochami.
- **Consciousness Levels** — odemykání vyšších vrstev realit.
- **Tithe** — ekonomický tok mezi světy.

---

## 8. Technický směr

- **Fáze 1 — OasisWeb (skica):** Next.js + React Three Fiber, abychom vizuálně otestovali galaxii, planety, přílety.
- **Fáze 2 — domain model:** všechny herní koncepty (světy, dimenze, cestování) se vyextrahují do `src/domain/`.
- **Fáze 3 — UE5 port:** domain se převede do Unreal Engine 5; komponenty se napíší jako Blueprinty/C++ nebo Puerts TypeScript.

Detaily architektury viz [`AGENTS.md`](/AGENTS.md) sekce “OASIS Web / UE5 — 3D universe portability rules”.

---

## 9. Otevřené otázky a další kroky

- [ ] Jaké jsou přesné herní mechaniky na každém světě?
- [ ] Jak se bude cestovat mezi hvězdnými systémy — animace, lodě, brány?
- [ ] Jak reprezentovat “Matrix jádro” herně a vizuálně?
- [ ] Jaký je vztah mezi ZION blockchain a ekonomikou OASIS?
- [ ] Budou existovat “uctívané” licence pro známé značky, nebo vše jako vlastní archetypy?
- [ ] Jaká je minimální MVP — jeden hvězdný systém + jedna planeta s jedním žánrem?

---

> **Toto je živý dokument.** Cokoliv přidáš — světy, frakce, mechaniky, příběh — piš sem.
