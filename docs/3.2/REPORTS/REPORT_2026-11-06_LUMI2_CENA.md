# REPORT 2026-11-06 — Cena lampionu Lumi 2 (Království srdce)

**Oficiální název zůstává:** *Lampion Království srdce — Lumi 2* (na `/vanoce/lampion` jako „Lampion – Království srdce“).
**Otázka 👤:** „udělej detailní analýzu trhu a musíme najít správnou cenu pro ten náš lampionek Lumi — Království srdce.“

**Krátká odpověď:** dnešních **432 Kč je pod hranicí rentability**, jakmile se lampion vyrábí na zakázku
(externí laser). Doporučená startovní cena vánoční edice je **690 Kč** (vlastní laser) až **890 Kč**
(externí řezání), s dodatkovou sadou DIY za **590 Kč** a číslovanou limitkou za **1 290 Kč**.

---

## 1) Co přesně prodáváme (měřená fakta, ne odhad)

| parametr | hodnota | odkud |
|---|---|---|
| rozměry | 140 × 126 × 121 mm | 3D model / A3 podklady |
| materiál | březová překližka 3 mm, 1× A3 (420 × 297) | `01_Vypalovani` |
| díly | 6 stěn + zdobený vršek (otvor Ø 90) + dno | model, 8 meshů |
| motivy | 6 různých mandal z knihy (lotos, květ života, loď, strom, srdcová mandala, Hiranjagarbha) | model |
| **délka řezných drah** | **20,87 m** (614 obrysů) | `scripts/ops/lumi-cut-length.py` |
| délka gravíru | 0,31 m (22 křivek) | DXF, vrstva `ENGRAVE` |
| **čas laseru @ 20 mm/s** | **17,4 min** (rozptyl 11,6–24,8 min podle výkonu) | tamtéž |
| montáž + kontrola | 15–25 min (lepení, sesazení, kontrola) | odhad dílny |

Proč to počítat: cena se dá obhájit jen prací, která v ní je. Dvacet metrů řezu na jeden
kousek je **2–3× víc než u běžné „lucerny se vzorem“** — a to je hlavní argument pro cenu
vyšší, než mají dekorace z hobby marketu.

## 2) Nákladový model (co stojí jeden kus)

Pevné vstupy: 1× A3 překližky, 17,4 min laseru, 20 min montáže, balení + svíčka/sklo.
Režie (energie, nájem, účetnictví) není započítaná — je příspěvková, ne přímá.

| položka | vlastní laser | externí řezání (600 Kč/h) | externí (minimum 300 Kč/A3) |
|---|---:|---:|---:|
| překližka A3 (retail ~66 Kč, bulk ~35 Kč) | 35 Kč | 66 Kč | 66 Kč |
| laser / strojní čas | 5 Kč | 174 Kč | 300 Kč |
| montáž 20 min @ 300 Kč/h | 100 Kč | 100 Kč | 100 Kč |
| balení (krabice, sklo, čajová svíčka, karta) | 75 Kč | 75 Kč | 75 Kč |
| **přímé náklady** | **215 Kč** | **415 Kč** | **541 Kč** |
| + 8 % zmetkovost | 232 Kč | 448 Kč | 585 Kč |

Zdroje vstupů: hobby březová překližka 3 mm 30×30 cm, 20 ks = 957 Kč (RPishop.cz, 6. 11. 2026)
→ 47,85 Kč za 900 cm², přepočet na A3 (1 247 cm²) ≈ 66 Kč; tržní sazba provozu laseru
600 Kč/h (chdcho.cz). Bulk cena celé desky je odhad (25–40 Kč/A3) — potvrdit u dodavatele.

**Marže podle ceny** (netto po 21 % DPH, odečteno ~1,5 % + 3 Kč platební brány):

| cena (s DPH) | vlastní laser | externí 600 Kč/h | externí min. 300 Kč |
|---:|---:|---:|---:|
| **432 Kč** (dnes) | +115 Kč (32 %) | **−101 Kč (−28 %)** | **−237 Kč (−66 %)** |
| 590 Kč | +244 Kč (50 %) | +28 Kč (6 %) | −109 Kč (−22 %) |
| **690 Kč** | **+325 Kč (57 %)** | +109 Kč (19 %) | −27 Kč (−5 %) |
| 890 Kč | +487 Kč (66 %) | +271 Kč (37 %) | +135 Kč (18 %) |
| 990 Kč | +568 Kč (69 %) | +352 Kč (43 %) | +216 Kč (26 %) |
| 1 290 Kč | +812 Kč (76 %) | +596 Kč (56 %) | +459 Kč (43 %) |

**Klíčové zjištění:** kdo řeže na zakázku, prodává dnes lampion **se ztrátou**.
I s vlastním laserem zbývá z 432 Kč jen ~115 Kč — a to ještě před započtením času na
komunikaci, balení a reklamace.

## 3) Trh — srovnatelné produkty (ověřeno 6. 11. 2026)

| produkt | cena | poznámka |
|---|---:|---|
| **Fler – Dřevěná lucerna 27 cm, březová překližka + LED svíčka** (daloush) | **399 Kč** | handmade, 3 103 prodejů, superprodejce; jednodušší vzor, ale 2× vyšší |
| Fler – Vánoční svítící lucernička | 129 Kč | malá, jednoduchá |
| Fler – Dřevěný domeček / lucerna | 227 Kč | drobná dekorace |
| Fler – Vánoční lampa/lucerna velká s výzdobou | 888 Kč | velká, dekorativní |
| Fler – Macramé lucerna VELKÁ | 666 Kč | jiný materiál |
| 4home – Dřevěná lucerna Wave 18,5 × 25 cm | 279–499 Kč | velkosérie |
| OBI – Koopman dřevěná lucerna 41 cm | 549 Kč | velkosérie, velká |
| Allegro – dřevěná lucerna 20 × 20 se svíčkou | 300 Kč | velkosérie |
| Heureka – dřevěná lucerna 14 × 14 × 30,5 cm | 277 Kč | velkosérie |
| **Amadea.cz – lucerna s motivem srdce, masiv 9 × 9 × 9 cm** | **25,65 € ≈ 640 Kč** | prémiový malý kus, jiný motiv |
| Stolárna na statku – dřevěná zahradní lucerna | 2 990 Kč | ruční masiv, velká |
| Etsy – **digitální** soubory lucerny (SVG/DXF) | $1,4–7,8 (35–190 Kč) | konkuruje jen lidem s vlastním laserem |
| Etsy – fyzické laser-cut night lights | ~$20–45 (450–1 000 Kč) | zahraniční handmade |

**Co z toho plyne:**
1. **Do 300 Kč** je trh velkosériových dekorací — tam nepatříme (jiný materiál, jiná kvalita).
2. **350–500 Kč** je český handmade strop pro *jednoduchou* překližkovou lucernu (Fler 399 Kč).
3. **600–900 Kč** je pásmo, kde se prodávají malé prémiové kusy s příběhem/motivem (Amadea 640 Kč).
4. **Nad 1 000 Kč** už musí být jasný důvod: velikost, masiv, číslovaná edice, jméno, dárkové balení.

Náš lampion je **menší (12,6 cm)** než Fler lucerna (27 cm), ale **výrazně pracnější** (6 různých
mandal, 20,9 m řezu vs. jednoduchý vzor) a nese příběh + digitální obsah. To ho řadí do pásma
**600–900 Kč**, ne 399 Kč — ale jen když je to na kartě vidět (práce, motivy, čas).

## 4) Ekonomie balíčku — kde dnes uniká hodnota

V ceně lampionu je **kniha (216 Kč)** a **ZION Pass (108 Kč)**, dohromady **324 Kč** obsahu
prodávaného samostatně. Efektivní cena samotného výrobku:

| cena balíčku | 432 | 590 | 690 | 890 | 990 | 1 290 |
|---|---:|---:|---:|---:|---:|---:|
| efektivní cena lampionu | **108 Kč** | 266 Kč | 366 Kč | 566 Kč | 666 Kč | 966 Kč |

Při 432 Kč tedy **prodáváme fyzický výrobek za 108 Kč** — pod přímými náklady (215–232 Kč)
i s vlastním laserem. To není „akce“, to je ztráta na každém kuse, jen se schová za digitální obsah.

## 5) Doporučená cena a struktura

**Startovní cena vánoční edice: 690 Kč** (lampion + kniha + ZION Pass + dárkové balení).
Rozhodující argumenty:
- efektivní cena výrobku 366 Kč ≈ tržní handmade úroveň (Fler 399 Kč), ale s prací 2–3× větší;
- s vlastním laserem marže 57 %, takže se vejdou zmetky, výměny i doprava;
- zůstává pod psychologickou hranicí 700 Kč u dárku;
- proti dnešním 432 Kč je to +60 %, ne skok o 300 %.

**Ceník, který doporučuju:**

| varianta | cena | co obsahuje | proč |
|---|---:|---|---|
| **Digitální sada** (SVG + DXF + PDF návod) | **199 Kč** | výrobní data, měřítko 1:1, testovací proužek | monetizuje design bez materiálu; kupují majitelé laserů |
| **DIY sada** | **590 Kč** | ploché díly + lepidlo + návod + kniha + Pass | levnější na práci, bez rizika hotového kusu; dárce-dostavitel |
| **Vánoční edice (sestaveno)** | **690 Kč** | hotový lampion + sklo se svíčkou + kniha + Pass + krabice | hlavní produkt, viz výše |
| **Limitovaná číslovaná (50 ks)** | **1 290 Kč** | + vypálené číslo a jméno, dřevěná krabička, certifikát | prémiový dárek; ukazuje strop, dělá 690 Kč rozumnou |
| *Externí řezání místo vlastního laseru* | **890 Kč** | stejné jako edice | jinak je 690 Kč na nule (−27 Kč) |

**Kampaň ZION:** dnes 100 ZION / 1 Kč. Při 690 Kč to je **69 000 ZION** na kus. Doporučuji
**zastropovat absolutní bonus na 43 200 ZION** (tj. držet dnešní hodnotu) — jinak každé
zdražení násobí závazek, který jednou může mít reálnou hodnotu.

## 6) Rizika a co je potřeba ověřit

1. **Fyzický výpal zatím neproběhl** (`Rozmery.json → physical_test: false`). Všechny časy a
   náklady jsou model, ne měření. Po prvním výpalu změřit skutečný čas laseru a sednutí spojů;
   když vyjde 25+ min, cena musí nahoru (na 890 Kč).
2. **Velikost vs. cena:** 12,6 cm je „svíčková“ velikost. U zákazníka rozhoduje fotka vedle
   běžných předmětů (ruka, hrnek, kniha) — jinak bude vypadat draze.
3. **Sezónnost:** vánoční edice prodává listopad–prosinec. Mimo sezónu drží cenu jen příběh
   a edicové číslo → na leden naplánovat „mimo sezónu 590 Kč“ nebo edici stáhnout.
4. **Bezpečnost ohně** je vyřešená (prohlášení + podpis), ale u DIY sady padá odpovědnost
   na stavitele — v návodu musí být stejné pokyny (sklenice, nehořlavý podklad, dozor).
5. **Kapacita:** 17 min laseru + 20 min montáže = ~40 min na kus. Při 690 Kč a marži 325 Kč
   je to ~490 Kč/hod hrubého — dobré na doplňkový prodej, ne na hlavní byznys.

## 7) Co konkrétně změnit v e-shopu (po schválení ceny)

- `src/data/shopProducts.ts`: `priceCzk` 432 → **690**, `tokens` přepočítat, `active: true`,
  `stock` = počet kusů z edice, `inStock: true`.
- `src/data/christmasProducts.ts`: `priceCzk`, `bonus`, `buyable: true`, text „Připravujeme“ →
  termín/počet kusů.
- `src/data/shopNews.ts`: dlaždice lampionu přepne z „Připravujeme“ na cenu 690 Kč,
  `buyable: true`.
- `ShopSetting campaign:book-001` (a případně `campaign:lamp-001`): nastavit strop bonusu.
- DB `UPDATE "ShopProduct"` pro `lamp-001` (cena, tokens, active, stock).

## 8) Zdroje

- Fler.cz — `Dřevěná lucerna 27 cm – hnědá, LED svícen` (daloush), 399 Kč, 3 103 prodejů:
  `fler.cz/zbozi/drevena-lucerna-27-cm-hneda-led-svicen-14303495`
- Amadea.cz — `Wooden lantern with a heart motif, solid wood 9×9×9 cm`, 25,65 €:
  `amadea.cz/en/wooden-lanterns/`
- 4home.cz — `Dřevěná lucerna Wave přírodní 18,5 × 25 cm`, 279–499 Kč: `4home.cz/lucerny-a-lampiony/`
- OBI.cz — `Koopman Dřevěná lucerna bílá 41 cm`, 549 Kč: `obi.cz/…/p/6084602`
- Stolárna na statku — `Dřevěná zahradní lucerna`, 2 990 Kč: `na-statku.cz/produkt/drevena-zahradni-lucerna/`
- RPishop.cz — `Hobby překližka březová 3 mm 30×30 cm (20 ks)` 957 Kč: `rpishop.cz/604391/…`
- chdcho.cz — cena provozu laseru 600 Kč/h: `chdcho.cz/sluzby/laser`
- Etsy — digitální soubory luceren $1,39–7,80 (vyhledávání `plywood lantern`, `laser cut lantern`)
- Vlastní měření: `scripts/ops/lumi-cut-length.py` (20,87 m / 614 obrysů / 17,4 min @ 20 mm/s)

**Poznámka k metodě:** ceny konkurence jsou včetně DPH, u ciziny přepočteno kurzem ~25 Kč/€.
Marže jsou modelové (netto po DPH a platební bráně), bez režie — slouží k rozhodnutí o ceně,
ne jako účetní výkaz.

---

## 9) Fyzický výpal proběhl: 5W laser = **4 hodiny na kus**

👤 2026-11-06: „výpal proběhl, na 5W laseru 4h.“ To mění nákladový model — model výše počítal
s 17,4 min (CO2, 20 mm/s). Skutečnost je **14× delší**, protože 5W dioda řeže 3 mm překližku
řádově pomaleji a na 20,9 m drah to jinak vyjít nemůže.

| | model (CO2) | skutečnost (5W dioda) |
|---|---:|---:|
| čas laseru na kus | 17,4 min | **240 min** |
| strojní čas @ 600 Kč/h (kdyby se platil) | 174 Kč | **2 400 Kč** |
| elektřina (0,1 kW) | ~1 Kč | ~24 Kč |
| obsluha / dohled (nelze nechat bez dozoru) | 17 min | **4 h** |

**Co to znamená pro cenu 590 Kč:**
- přímé hotovostní náklady (materiál 35 + elektřina 24 + montáž 100 + balení 75) ≈ **250 Kč**,
- z 590 Kč (netto 488 Kč) zbyde ≈ **240 Kč** — to je 50 %, ale **za 4 hodiny stroje**:
  **~147 Kč/hod** a kapacita **2–3 kusy denně** (i s dohledem).
- Kdyby se řezalo externě, 4 h × 600 Kč/h = 2 400 Kč → cena 590 Kč je nemyslitelná.

**Rozhodnutí 👤:** cena **590 Kč** (vánoční edice), bonus **150 ZION / 1 Kč**.
Prodej aktivován 2026-11-06 (sklad 5 ks, číslovaná edice).

**Doporučení k výrobě (ne k ceně):** 5W dioda je úzké hrdlo — 20W dioda nebo CO2 by stejnou
práci udělaly za 30–60 min, tedy 4–8× víc kusů za stejný čas. Do té doby platí: 590 Kč je
udržitelné jen jako doplňkový prodej k dílně, ne jako hlavní zdroj příjmů.

### Co bylo změněno v ekosystému (2026-11-06)
- **Market:** `lamp-001` 432 → **590 Kč**, tokens 43 200 → **88 500**, `active: true`, `stock: 5`;
  produktová stránka `/vanoce/lampion` (cena, bonus, „Připravujeme“ → prodej, FAQ, kroky, fakta
  „20,9 m řezu / 614 obrysů / 4 h laseru“), homepage novinky, `LampionSection` (cena a bonus
  už z dat, ne natvrdo).
- **Bonusy:** vánoční sazba 100 → **150 ZION/Kč** u všech tří produktů
  (Pass 16 200, kniha 32 400, lampion 88 500) — seed, DB i `ShopSetting campaign:*` (do 24. 12. 2026).
- **Website v2.9:** karty vánoční edice (`ChristmasShopCards`) + článek `/news/christmas-2026`
  (cena, bonusy, „Připravujeme“ → „Koupit v eShopu“, 20,9 m / 4 h).
- **Ověřeno na produkci:** objednávka bez prohlášení → `400 fire_consent_required`;
  s podpisem → objednávka 88 500 ZION + podpis v DB (`Test Lumi · fire-2026-11-06 · čas serveru`);
  sklad 5 → 4 → 5 po zrušení.
