# 02 — Příběh a architektura
## Od čtyř základních knih přes Sůl Země a onboarding až k Nirvaně, NirvanaCloud a Mise Amenti

> **Účel:** sjednotit jazyk příběhu s jazykem architektury, aniž by se jeden vydával za druhý.  
> **Status:** redakční mapa. Všechny technické nároky musí projít přes [`03-Zivy-Zaklad-3.3.md`](./03-Zivy-Zaklad-3.3.md) a [`07-Registr-Dukazu.md`](./07-Registr-Dukazu.md).

---

## 1. Jedna cesta, devět bran

ZION není jedna kniha ani jedna aplikace. Je to cesta, která se dá číst z devíti propojených bran. Každá má jinou roli; žádná sama o sobě nestačí.

| Brána | Otázka | Přínos pro člověka | Technický protějšek |
|---|---|---|---|
| **Genesis** | *Proč vůbec stavíme?* | Hledá základní pravidla, která nelze libovolně změnit. | L1 konsensus, emisní pravidla, open source, genesis. |
| **Kvantová revoluce** | *Co je rozbité?* | Pojmenovává dluh, centralizaci, extrakci pozornosti a neověřitelné autority. | Diagnostika rizik; požadavek na transparentnost, decentralizaci a bezpečnost. |
| **Ekam Deeksha** | *Kdo se musí proměnit?* | Připomíná, že žádný protokol neodstraní strach, pýchu a odpovědnost za člověka. | Bezpečnostní omezení, etika, review, Dharma Validator jako pomocný filtr — ne jako morální autorita. |
| **Terra Nova** | *Jak se vize stane světem?* | Překládá hodnoty do konkrétních institucí, nástrojů a komunit. | Vrstvy L1–L6, node/pool, L2, L3, OASIS, Free World, Issobella. |
| **Sůl této země** | *Jak se pravidla ochutnají v běžném životě?* | Příběh o důvěře, smlouvě, mostu, arše a odpovědnosti. | Pravidlo „Příběh → Co znamená → Ověřitelná fakta“. |
| **Onboarding** | *Jak vstoupím bezpečně?* | Dává novému člověku postup: nejdřív pozorovat, ptát se, ověřit, až pak volit účast. | Explorer, lokální peněženka, node/miner, dokumentace a nápověda v kontextu. |
| **Nirvana a NirvanaCloud** | *Kam směřujeme, když nestavíme jen na příští kvartál?* | Představuje horizont Terra Nova, bardo změny, Šambhalu a Amenti jako obrazy dlouhé odpovědnosti. | Horizont L1–L6 a 2026–2126; nikdy release claim. |
| **Mise Amenti** | *Jak to vše držíme pohromadě přes generace?* | Převádí příběh na měřitelné závazky pravdy, svobody, péče, odolnosti a předání dál. | Tento corpus, evidence registr, release gates, bezpečnost a změnový protokol. |
| **Bodhi Gaia / Kniha Země** | *Jak se L5 dotkne hlíny?* | Sjednocuje tři fyzické zahrady L5 (Zahrada Genesis, Dharma Temple / Nová Bodhi Gaia, Te Pīko Ora), protokoly Země a úplný registr pravdy L5. | `docs/WP-Mainet/BodhiGaia/` (DRAFT); zrcadlí `public/V3/L5/docs/`, web `/terranova/*`, OASIS `WorldPanel`/`worlds.ts`. |

---

## 2. Čtyři knihy jako kompas, ne jako dogma

[`Road to Zion`](../marketing/ROAD_TO_ZION_CZ.md) používá čtyři světové strany. `MiseAmenti/` je nepřepisuje — pouze je zavádí jako standard pro rozhodování:

```text
                               SEVER
                              GENESIS
                    Proč stavíme? Co je neměnné?
                                  │
                                  │
  ZÁPAD ──────────────────────────┼────────────────────────── VÝCHOD
TERRA NOVA / NIRVANA              │                    KVANTOVÁ REVOLUCE
Jak stavíme svět?                  │                    Co už nefunguje?
                                  │
                                  │
                                  JIH
                            EKAM DEEKSHA
                 Kdo se stává stavitelem a jak nese odpovědnost?

                    STŘED: SŮL TÉTO ZEMĚ
          Pravda musí mít chuť v konkrétním životě, ne jen v teorii.
```

### Test kompasu pro každé rozhodnutí

Každý návrh 3.3 — nový agent, smart contract, ekonomická změna, herní quest, marketingová kampaň nebo výzkumný program — se před přijetím musí ptát:

1. **Genesis:** Je pravidlo transparentní, omezené a nezávisle ověřitelné?
2. **Kvantová revoluce:** Snižuje toto řešení centralizaci, dluhovou závislost, zneužití dat nebo manipulaci pozornosti — nebo je jen převléká?
3. **Ekam Deeksha:** Jaké lidské selhání, zneužití nebo omyl předpokládáme? Jak je omezeno bez idealizace lidí i AI?
4. **Terra Nova:** Má to konkrétní přínos pro člověka, komunitu, planetu či vědu? Kdo nese náklady a jak může odejít?
5. **Sůl:** Dokážeme to vysvětlit obyčejnému člověku bez nátlaku a bez skrývání rizik?

Pokud návrh neprojde některou otázkou, není připravený k propagaci ani k produkčnímu nasazení.

---

## 3. Onboarding: přechod od příběhu k vlastnímu ověření

Základní onboarding není funnel, který má člověka udržet co nejdéle. Je to **Hanumanův most**: dostatečně jednoduchý, aby po něm mohl přejít nováček; dostatečně poctivý, aby na něm neztratil orientaci.

Kanonická cesta z [`ZION — Nová civilizace`](../SulZeme/08-ZION-Nova-Civilizace.md) je zachována:

| Cesta | První bezpečný krok | Co nesmí být vyžadováno |
|---|---|---|
| **Pozorovatel** | Číst, prohlédnout explorer, porovnat veřejná tvrzení s kódem. | Nákup, registrace, odevzdání identity nebo víra. |
| **Hráč / objevitel** | Příběh, quest, překlad, bug report, malé přispění. | Finanční riziko nebo psychologický tlak. |
| **Stavitel** | Node, miner, test, dokumentace, review nebo dApp. | Představa, že vlastní technický přínos dává právo vládnout ostatním. |
| **Strážce / operátor** | Bezpečnostní review, monitoring, zálohy, incident response. | Přístup k tajemstvím nebo produkčním oprávněním bez nutnosti. |

**Žádná cesta není vyšší než jiná.** Síť, která pohrdá pozorovateli, přestává být ověřitelná. Síť, která nemá stavitele, se rozpadne. Síť, která nemá strážce, se neubrání. Síť, která nemá hráče a učící se lidi, ztratí důvod existovat.

---

## 4. Nirvana a NirvanaCloud: co přesně mají dělat

### Nirvana — západní horizont

[`docs/WP-Mainet/nirvana/`](../nirvana/00-README.md) je kniha cesty od paprsku Lumi přes Ararat a dům až ke globálnímu horizontu. Jejím úkolem je odpovědět na otázku: **„Jak vypadá svět, který stojí za dlouhodobé stavění?“**

### NirvanaCloud — hluboká mapa stavů

[`docs/WP-Mainet/NirvanaCloud/`](../NirvanaCloud/00-README.md) přidává Bhavačakru, pět Buddhů moudrosti, Bardo Thödol, Šambhalu a Síně Amenti jako **mapy stavů a přechodů**, ne jako doktrínu ani historickou autoritu.

Následující je kanonické rozlišení:

| Obraz | Správné použití | Zakázané použití |
|---|---|---|
| **Bhavačakra / šest světů** | Metafora pro systémové stavy pýchy, závisti, nedostatku, impulzivnosti, násilí a lidské možnosti. | Označovat lidi, národy nebo oponenty za „nižší bytosti“. |
| **Bardo** | Mapa pro bezpečné zvládání změn, incidentů, hard forků a restartů. | Romantizovat ztrátu dat, nehody nebo lidské utrpení. |
| **Šambhala** | Symbol dobrovolné, nenásilné společnosti s odpovědnou správou společných věcí. | Apokalyptické proroctví, vůdcovský kult nebo legitimace konfliktu. |
| **Pět Buddhů moudrosti** | Strukturní inspirace pro transformaci problémů v odpovědná omezení a funkce. | Tvrdit, že vrstvy ZIONu jsou buddhistické objekty nebo nahrazují praxi. |
| **Síně Amenti** | Mýtus nezničitelného archivu, paměti a předání vědění dál. | Vydávat Smaragdové desky za egyptologický důkaz nebo za technologický návod. |

---

## 5. Mapa vrstev L1–L6

Příběh není architektura, ale dobrý příběh může architekturu zpřístupnit. Toto je závazné, střízlivé mapování:

| Vrstva | Co je jejím civilizačním úkolem | Jaký obraz ji vysvětluje | Co nesmí příběh slibovat |
|---|---|---|---|
| **L1** | Bezpečný a ověřitelný základ vlastnictví, konsensu a paměti. | Ararat, skála, trup archy. | Že samotný blockchain vytvoří spravedlnost. |
| **L2** | Interoperabilita a bezpečný pohyb hodnoty mezi sítěmi. | Hanumanův most, WARP. | Že všechny chainy nebo swapy jsou již live. |
| **L3** | Pomoc s orientací, výpočtem a orchestrací pod lidským dohledem. | Hiranyagarbha, Maestro, hlas Amitábhy. | Že AI je vědomá, neomylná nebo samostatně oprávněná nakládat s penězi. |
| **L4** | Tvořivý prostor pro vzdělávání, hru, komunitu a kulturu. | OASIS, zahrada, chrám. | Že UE 5.7/WebGPU/Pixel Streaming jsou již dostupné. |
| **L5** | Transparentní humanitární a ekologické programy. | Prameny života, sůl v chlebu. | Že konkrétní projekty mají dopad bez veřejné evidence. |
| **L6** | Otevřený výzkum, dlouhý horizont, kosmický pohled a zkoumání. | Issobella, hvězdy, otevřený obzor. | Že hypotetická fyzika je hotová technologie nebo zaručený objev. |

---

## 6. Konec příběhu není „vítězství“

Mise Amenti se nepovažuje za dokončenou, až bude mít ZION nejvyšší cenu, nejvíce uživatelů nebo největší vliv. To by byl jen další svět devů či asurů z Bhavačakry.

Může se o ní mluvit jako o postupně naplňované tehdy, když:

- člověk může ověřit důležité tvrzení bez závislosti na autoritě;
- nové generace mají nástroje, vědění a právo systém opravit nebo opustit;
- lidská a technická infrastruktura přispívá k měřitelnému dobru a nezakrývá své škody;
- růst sítě nezhoršuje svobodu, bezpečnost nebo důstojnost lidí mimo síť;
- kritika je přivítána jako bezpečnostní signál, ne potrestána jako nepřítel.

To je koncovka příběhu, která nikdy není vlastnictvím jedné osoby: **ne ráj hotový zvenku, ale schopnost lidí dál společně opravovat svět zevnitř.**

---

*[Zpět na index Mise Amenti → `README.md`](./README.md)*
