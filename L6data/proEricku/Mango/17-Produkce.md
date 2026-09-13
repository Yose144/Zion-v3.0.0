# 17 — Produkce — pipeline, milníky, rozhodnutí

> **DRAFT** — pracovní cesta od návrhu k filmu a případné hře. Nástroje nejsou vybrané; jejich dostupnost, podmínky a vhodnost se ověří před použitím.

## Přehled pipeline

```
A. Schválení významu a podoby → B. Modely + 12 klíčových obrazů → C. Animatik
→ D. Animace, hlas, zvuk → E. Osobní okamžik → F. První zastavení v OASIS
```

Každý krok má vlastní výstup a **rozhodovací bránu** — další krok se nedělá, dokud není schválen předchozí.

## Krok A — Schválení významu a podoby

**Cíl:** potvrdit, co pro vás tři filmy znamenají, jak vypadá Lumi, které vzpomínky použít a které zůstanou soukromé.

| Úkol | Výstup |
|---|---|
| Vybrat správnou **původní kresbu evoluZionu** | potvrzený originál + souhlas |
| Rozhodnout **věk, podobu, hlas Lumi** | schválená silueta |
| Vybrat **konkrétní Hisaishi nahrávku** a její část | pojmenovaná reference |
| Oddělit **použitelné osobní materiály** od soukromých | seznam schválených podkladů |
| Rozhodnout **podobu Ericky** ve filmu | silueta/ruce/stylizace/portrét |

**Brána:** Ericka pozná svůj příběh v návrhu? Pokud ne, zpátky — ne animovat dál.

## Krok B — Modely postav a 12 klíčových obrazů

**Cíl:** první storyboard, který nese film v obrazech.

| Úkol | Výstup |
|---|---|
| Model Lumi (silueta, výrazy, držení) | model sheet |
| Lucerna — hlavní rekvizita | návrh |
| 12 klíčových obrazů (K01–K12) | thumbnail storyboard |
| Návrhy prostředí (brána, dům, zahrada, stanice) | vizuální koncepty |
| Keporkak, Rosníci, mechanismus | vlastní siluety |

**Brána:** funguje příběh v obrazech bez slov? Pokud ne, dialogy zkrátit, ne přidat výklad.

## Krok C — Animatik

**Cíl:** ověřit **rytmus a délku** — devítiminutový film v pohybu.

| Úkol | Výstup |
|---|---|
| Sestříhat storyboard do času | animatik 16:9 |
| Temp track (interní) + pracovní hlasy | pracovní zvuk |
| Ověřit **oddělení epilogu** | veřejná pohádka stojí sama |
| Rozhodnout varianty „hlas vs. titulka" | rozhodnutí pro 07, 10 |
| Zkrátit výklad tam, kde obraz mluví | finální tempo |

**Brána:** drží film devět minut bez „plniva"? Pokud ne, zkrátit scénu, ne přidat efekty.

## Krok D — Animace, hlas a zvuk

**Cíl:** finální film — až po schváleném animatiku.

| Úkol | Výstup |
|---|---|
| Animace ~77 záběrů | finální obraz |
| Hudba (vlastní/licencovaná) | finální skladba |
| Nahrání hlasů (Yose, Lumi, Rádha) | hlasová stopa |
| Zvukový design (ambience, tužka, keporkak) | mix |
| Titulky a verze bez hudby | přístupnost |

**Brána:** práva k hudbě vyřešená **před** jakýmkoliv sdílením; epilog nikdy veřejně.

## Krok E — Osobní okamžik a rozhodnutí o sdílení

**Cíl:** film nejprve patří Erice.

| Úkol | Výstup |
|---|---|
| Předání podle jedné ze tří podob (A/B/C) | osobní okamžik |
| Rozhodnutí o sdílení — **jen s jejím souhlasem** | případná veřejná verze |
| Samostatná pohádka pro veřejnost — bez epilogu | veřejný master |

**Brána:** veřejnost vidí jen to, co **oba** chtějí sdílet; automaticky se nepřenáší nic.

## Krok F — První zastavení v OASIS

**Cíl:** z veřejně schválené podoby převést **bránu, lucernu a Lumi** do malé návštěvnické scény.

- Nejdřív jedna dokončená interakce na existující navigaci.
- Teprve potom rozšiřovat cestu DOMŮ.
- **Filmový dokument není implementace** — herní verze se navrhuje zvlášť.

## Milníky (pracovní)

| Milník | Obsah | Rozhodnutí |
|---|---|---|
| M1 | Krok A — schválené podklady | Ericka pozná příběh? |
| M2 | Krok B — storyboard | Obraz nese film? |
| M3 | Krok C — animatik | Drží tempo 9 minut? |
| M4 | Krok D — master | Práva, hlasy, mix hotové? |
| M5 | Krok E — osobní okamžik | Předáno; rozhodnutí o sdílení |
| M6 | Krok F — první zastavení | Herní adaptace zahájena |

## Organizace souborů (návrh)

```
proEricku/
├── mango.md                    # master námět (léčba)
├── Mango/
│   ├── 00-README.md            # tento index
│   ├── 01..10-*.md             # produkční listy scén
│   ├── 11-Epilog-Osobni.md
│   ├── 12-Postavy.md
│   ├── 13-Vytvarna-Bible.md
│   ├── 14-Hudba-a-Zvuk.md
│   ├── 15-Storyboard-Plan.md
│   ├── 16-OASIS-Navaznost.md
│   └── 17-Produkce.md
├── assets/                     # budoucí podklady (K01–K12, modely, reference)
│   ├── klíčové-obrazy/
│   ├── modely/
│   └── reference/
└── verze/                      # datované verze masterů
```

## Pravidla práce se soubory

- **Master námět** = `mango.md`; produkční listy = `Mango/`; změna časování → aktualizovat tabulku v `mango.md` §7.
- **Značky:** DRAFT, K OVĚŘENÍ, HORIZONT, SOUKROMÉ — viz [00-README](./00-README.md).
- **Záloha osobních podkladů:** mimo repozitář; `proEricku/` je v gitu jen proto, že repo je soukromé — **žádná veřejná kopie**.
- **Verze:** každý master export pojmenovat datem (`mango_2025-XX-XX.mp4`); temp track se **nikdy** nestane finální stopou.

## Rozhodnutí, která čekají (souhrn)

| # | Otázka | Kde se řeší |
|---|---|---|
| 1 | Konkrétní Hisaishi nahrávka a část | Krok A |
| 2 | Podoba, věk, hlas Lumi | Krok A/B |
| 3 | Podoba Ericky ve filmu | Krok A |
| 4 | Správná kresba evoluZionu | Krok A |
| 5 | Hlas vs. titulka (07, 10) | Krok C |
| 6 | Kde a kdy předání | Krok E |
| 7 | Veřejná verze — ano/ne a co | Krok E |
| 8 | První zastavení v OASIS | Krok F |

---

*„Budoucnost v tomto příběhu nepřichází pro odpověď. Přichází nám připomenout, že další stránku ještě můžeme napsat."*
