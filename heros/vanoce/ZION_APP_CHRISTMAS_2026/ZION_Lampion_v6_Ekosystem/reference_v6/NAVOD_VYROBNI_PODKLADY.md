# Instrukce pro AI: Království srdce / ZION Terra Nova

## Účel balíčku

Kompletní podklady šestihranné lucerny pro laserové vyřezání z jedné A3 desky nominální tloušťky 3 mm. SVG a DXF jsou editovatelné výrobní vektory v měřítku 1:1. PNG jsou náhledy, PDF a Markdown jsou návody. Nejde o hotový G-code pro konkrétní stroj.

Při navazující práci nejprve přečti tento dokument, prohlédni PNG a načti skutečné SVG/DXF. Výrobní geometrie je zdroj pravdy pro rozměry; nevytvářej ji znovu podle obrázku.

## Závazné požadavky uživatele

- **VŠECHNO SE PROŘEZÁVÁ. Žádné gravírování.** Platí i pro texty, symboly a dekor vršku.
- Bílé plochy v náhledu jsou otvory. Hnědá plocha je ponechané dřevo.
- Spodní pás každé stěny má výšku 20 mm. Je nosným pozadím pro průchozí text či symbol, nikoli deskou s povrchovým gravírem.
- Ponechané dřevo každé stěny musí tvořit jeden souvislý díl. Uzavřené vnitřky písmen a symbolů potřebují šablonové můstky; nesmějí vypadnout.
- Strom života nese **ZION / TERRA NOVA**. Srdcová mandala nese **Království / srdce**. Nezaměňovat.
- Šest bočních stěn, plné dno a horní šestihranná deska s otvorem Ø 90 mm. Vršek drží sestavu a má průchozí botanický dekor.
- Všech osm dílů musí zůstat na jedné A3. Doplňkový testovací proužek není devátý konstrukční díl.
- Zachovat schválený bohatý květinový mandalový styl: oblouky, listy, lotosy, plynulé křivky. Nenahrazovat jej hrubými paprsky, tyčkami, figurálními scénami ani mechanickými zjednodušenými ikonami.
- Hiranjagarbha je světelná koule na lotosu, ladící s ostatními mandalami.
- Uživatel zamýšlí skutečnou svíčku; **tepelná bezpečnost tohoto návrhu není ověřena**. Neprohlašovat, že samotný otvor ve vršku zajišťuje bezpečnost plamene.

Nové výslovné instrukce uživatele mají přednost. Bez takového zadání neměň konstrukční rozměry, přiřazení textů ani motivy ostatních dílů.

## Obsah a autorita souborů

| Soubor / složka | Úloha |
|---|---|
| `01_REZ/Lucerna_A3_POUZE_REZ_1na1.svg` | Preferovaný výrobní a editační zdroj. Jediná skupina CUT, červené uzavřené kontury. |
| `01_REZ/Lucerna_A3_POUZE_REZ_1na1.dxf` | Shodné kontury v mm na vrstvě CUT. Alternativa k SVG. |
| `02_NAHLEDY/Rozklad_A3.png` | Náhled všech dílů a jejich pořadí. |
| `02_NAHLEDY/Spodni_pasy_REZ.png` | Detail průchozích nápisů a symbolů s můstky. |
| `03_NAVOD/Navod_vyroba_a_montaz.pdf` | Třístránkový návod pro člověka. |
| `03_NAVOD/Navod.md` | Textový návod výroby a montáže. |
| `04_KONTROLA/Overeni_rozmeru.json` | Výsledky poslední kontroly geometrie. Po změnách již nemusí platit. |
| `04_KONTROLA/Kontrola_pasu.json` | Výsledky vytvoření průchozích pásů. Po jejich změně aktualizovat. |
| `04_KONTROLA/overeni.py` | Spustitelná kontrola současné struktury SVG/DXF. |
| `04_KONTROLA/SHA256.json` | Kontrolní součty obsahu tohoto balíčku, bez vlastního manifestu. |

SVG a DXF jsou alternativy téhož řezu. Neimportuj oba zároveň do laserového programu: způsobilo by to zdvojené řezy.

## Přesné rozměry

Vše v milimetrech. Souřadnice SVG: počátek nahoře vlevo, Y roste dolů. DXF: Y je převrácené přes výšku stránky, tedy `y_DXF = 297 - y_SVG`.

| Veličina | Hodnota |
|---|---:|
| A3 | 420 × 297 |
| Nominální tloušťka | 3 |
| Konstrukční délka strany na střednici stěn | 65 |
| Šířka stěny W | `65 - 3 / sqrt(3)` = 63,2679491924 |
| Výška těla stěny | 120 |
| Výška včetně horních i dolních jazýčků | 126 |
| Plný nosný pás před vyřezáním nápisů | 20 vysoký |
| Jazýček | 8 široký × 3 vysoký |
| Drážka | 8,1 × 3,1 |
| Rozteč středů jazýčků | 29 |
| Poloměr šestiúhelníku dna a vršku | 70 |
| Dno a vršek přes vrcholy | 140 |
| Dno a vršek přes plochy | 121,24355653 |
| Kruhový otvor vršku | Ø 90 |
| Apotéma střednice stěn | `65 * sqrt(3) / 2` = 56,291651246 |
| Složená výška | 126 |

### Lokální geometrie stěny

- Tělo: `x = 0 .. W`, `y = 3 .. 123`.
- Horní jazýčky: `y = 0 .. 3`; dolní: `y = 123 .. 126`.
- Středy dvojice jazýčků: `x = W/2 - 14,5` a `W/2 + 14,5`. Každý má polovinu šířky 4 mm.
- Pás pro texty/symboly: `y = 103 .. 123`.
- Můstky přidané do textů a symbolů mají nominální šířku 1,2 mm. To není garantovaná minimální šířka celého ornamentu ani fyzicky ověřená pevnost.

### Rozmístění na A3

| Díl | Umístění SVG |
|---|---|
| Stěna 1 | lokální počátek (10, 14) |
| Stěna 2 | (79, 14) |
| Stěna 3 | (148, 14) |
| Stěna 4 | (10, 150) |
| Stěna 5 | (79, 150) |
| Stěna 6 | (148, 150) |
| Vršek | střed (302, 76) |
| Dno | střed (302, 218) |
| Testovací proužek | obdélník (386, 30) až (410, 103) |

Výrobní SVG obsahuje 9 cest v tomto pořadí: stěny 1–6, vršek, dno, proužek. Každá cesta obsahuje vnější obrys a všechny vnitřní otvory.

## Motivy a spodní otvory

| Stěna | Horní motiv | Spodní výřez |
|---|---|---|
| 1 | Srdce v lotosu | ÓM |
| 2 | Květ života | jin-jang |
| 3 | Lotos | peace |
| 4 | Strom života | ZION / TERRA NOVA |
| 5 | Srdcová mandala | Království / srdce |
| 6 | Hiranjagarbha na lotosu | zářící slunce |

## Pravidla editace vektorů

1. Načti původní geometrii a uchovej kopii pro porovnání.
2. Měň jen uživatelem určenou oblast. Například při změně nápisu zachovej obrys stěny, jazýčky a všechny otvory nad páskem.
3. Rozlišuj vyříznuté otvory od ponechaného dřeva. Značka vypadá bíle, protože jde o díru.
4. Text převeď na křivky a doplň můstky pro písmena s uzavřenými středy. Žádné závislosti na fontu v konečném SVG/DXF.
5. Po booleovských operacích sjednoť obrysy. Neponechávej překryté či duplicitní řezné úseky, otevřené cesty, volné ostrůvky nebo pouhý bodový dotyk.
6. Připrav současně nový SVG i odpovídající DXF. Vrstvy pouze CUT; výplň náhledu není výrobní gravír.
7. Zkontroluj pohled na skutečné exportované vektory. Náhled nesmí zobrazovat starý motiv místo nového.
8. Aktualizuj náhledy, návody, výsledky kontrol a kontrolní součty. Do výsledného ZIPu nevkládej neplatné staré výrobní verze.

## Opakovatelná kontrola

Z kořenové složky rozbaleného balíčku:

```bash
python -m pip install shapely ezdxf
python 04_KONTROLA/overeni.py
```

Skript čte soubory z `01_REZ` a uloží `04_KONTROLA/Overeni_rozmeru.json`. Zkontroluje rozměr stránky, platné polygonové obrysy, 9 dílů na desce, shodné obrysy stěn, 24 dvojic jazýček–drážka, překryvy stěn v půdorysu při tloušťce 3 mm, kruhový otvor, propojení po simulaci kerfu 0,3 mm a souhlas pořadí i souřadnic SVG/DXF.

**Omezení skriptu:** parser očekává konkrétní export: cesty M/L/Z, pořadí vnější obrys a potom otvory, 9 cest v pořadí výše, shodné pořadí obrysů a vrcholů v DXF. Při změně pořadí cest, použití Bezierových křivek, oblouků nebo transformací je nutné parser korektně rozšířit. Nemaž neúspěšné kontroly jen proto, aby skript prošel. Strukturální rozdíl exportu není automaticky chyba geometrie; musí se ověřit nezávisle.

Kontrola porovnání SVG/DXF používá toleranci 0,00008 mm pro zaokrouhlení souřadnic. To je numerická přesnost souborů, nikoli přesnost laserového stroje. Kontrola propojení není certifikace pevnosti a neověřuje všechny minimální šířky.

Po změně nápisů ověř navíc jejich čitelnost, správné přiřazení ke stěnám, ponechání nosného okraje a napojení každého vnitřního ostrůvku na hlavní díl.

## Výroba a montáž

- Import v mm, 100 %. Kontrolní šířka dna přes vrcholy je 140 mm.
- Neškáluj obálku dílů na celou A3. Na desce jsou záměrné okraje a mezery.
- Testovací drážky shora: 2,8 / 2,9 / 3,0 / 3,1 / 3,2 mm. Zkoušet na skutečné desce.
- Kerf není kompenzovaný. Skutečnou tloušťku i šířku řezu je nutné změřit; není přípustné slibovat přesné fyzické lícování jen z nominálního rozměru.
- Nejprve vnitřní otvory a texty, potom vnější obrysy. Žádný gravír.
- Bez parametrů konkrétního stroje nevymýšlej univerzální výkon a rychlost. Jde o výrobní vektory, ne strojový program.
- Sestavit nasucho: stěny texty dolů do dna, poté vršek. Teprve po kontrole slepit. Svislé hrany nemají zubové spoje. Konstrukce počítá s lepením.

## Co nepředstírat

Digitálně ověřeno neznamená fyzicky vypáleno. Zkušební řez, pevnost malých můstků a tepelná bezpečnost skutečné svíčky zatím ověřeny nejsou. Tyto informace musí zůstat pravdivé i při změně názvu balíčku na finální.

## Příklad zadání pro navazující AI

> Načti NAVOD_PRO_AI.md a oba výrobní vektory. Uprav pouze [konkrétní motiv/oblast]. Zachovej rozměry, spoje, A3 a požadavek POUZE ŘEZ. Texty a symboly musí mít můstky a tvořit s deskou souvislý díl. Aktualizuj SVG i DXF, vykresli skutečný export, proveď kontrolu geometrie, oprav dokumentaci a zabal kompletní aktuální soubory do ZIPu. Označ neověřené fyzické vlastnosti pravdivě.
