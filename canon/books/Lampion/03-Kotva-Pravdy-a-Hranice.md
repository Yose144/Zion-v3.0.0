# 3 · KOTVA PRAVDY A HRANICE
## Registr knihy Lampion — co je Písmo, co produkt a co obraz

> *„Když se příběh srazí s faktem, opravíme příběh. Nikdy fakt."*

---

## §1 Co tato kniha tvrdí a na čem to stojí

| Tvrzení | Stav | Kotva | Co chybí |
|---|---|---|---|
| Verš „Choďte, dokud máte světlo…" je biblický | **Bible** | Jan 12,35 (volně); srov. Jan 12,36; 8,12; 11,9–10 | přesná citace podle jednoho vydání (ČEP / B21) při redakci |
| Tesař z Nazareta byl řemeslník (*tektón*) a jeho dílo zahrnovalo dřevo | **Bible** | Mk 6,3; Mt 13,55 | — |
| Tesař postavil loď zvanou Království srdce | **PŘÍBĚH** — midraš | `KralovstviSrdce/01–05` | — |
| Tesař vyrobí dřevěné tělo lucerny | **PŘÍBĚH** — autorská volba | `KralovstviSrdce/Kralovstvi_srdce_Nova_plavba_Balicek/Redakcni_pruvodce.md`, bod 2 | — |
| Lucerna ukazuje dvě věci: co je, a co by mohlo být; nesmějí se splést | **MÝTUS** — kanonický mechanismus | `Lumi/01`, `KruhBohyni/00-LODE-A-LUCERNA` §3 | — |
| Lumi je dětská podoba Elizabeth | **MÝTUS** — kanonické rozhodnutí Knihy Lucerny | `Lumi/05`, `Lumi/13` §1 | kulturní review |
| Druhá lucerna = nové tělo pro touž míru | **MÝTUS** — obraz této knihy | tato kniha | — |
| Šest vzorů odpovídá šesti předáním | **MÝTUS** — obraz této knihy | tato kniha, §4 kapitoly 02 | shoda s fyzickým pořadím dílů **není doložena** |
| Věta z Jan 12,35 byla nejdřív řečena dítěti s lucernou | **NOVÁ VRSTVA KORPUSU / MÝTUS** | tato kniha | výslovně se netvrdí jako historický fakt; srov. `KralovstviSrdce/09` (stejný typ vrstvy) |
| Lampion svítí svíčkou; bezpečnostní body platí | **ŽIVÉ** | `apps/MarketPlace/src/lib/fire-safety.ts` | — |
| Lampion má nadpřirozené vlastnosti, pochází z budoucnosti, je relikvie | **NEPLATNÝ NÁROK** | tato kniha, kap. 02 §10 bod 6 | — |
| Koupě lampionu přinese výnos, štěstí nebo ochranu | **NEPLATNÝ NÁROK** | `ZION_ONBOARDING_PUBLIC_CZ.md` §7 | — |

---

## §2 Tři vrstvy, které se v textu nesmějí slít

1. **Písmo.** Jedna věta z Jana 12,35. Cituje se krátce, s označením, že jde o volné znění; nepřidává se k ní „a Ježíš tím myslel…". Výklad patří do homilie, ne do produktu.
2. **Midraš.** Dílna, prkno, lucerna, cesta proti proudu. Literární obraz, který Písmo nevypráví. Čtenář si to má umět rozlišit sám — proto tabulka výše a prohlášení v `02-README`.
3. **Produkt.** Tři milimetry březové překližky, osm dílů, skleněná vložka, svíčka, dvacet metrů řezu. Skutečná věc, která hoří a může ublížit. Tady se nesmí básnit.

Kdo ty tři vrstvy slije (např. „požehnaná lucerna, která vás ochrání"), nedopustí se jen vkusové chyby — vypustí z textu pravdivostní štítek, kterým se celá řada korpusu drží.

---

## §3 Známé rozpory a místa k rozhodnutí

| # | Kde | Co | Doporučení | Třída |
|---|---|---|---|---|
| 1 | `christmasProducts.ts` (`guide`) vs. tato kniha | návod píše `Hiranjagarbha`, korpus `Hiranyagarbha` | sjednotit na přepis korpusu, nebo naopak a opravit korpus | B |
| 2 | `guide.steps` („Zkontrolujte vzory") vs. tato kniha | návod říká „v pořadí jako v příběhu", ale příběh pořadí dosud nedefinoval. Tato kniha ho definuje poprvé a její výčet se s návodem shoduje; fyzická orientace dílů ověřená není | ověřit na skutečném kusu a případně díly očíslovat | A |
| 3 | `02-Druha-Lucerna.md` §4 | tesař nechává okna prázdná, vzory vyřezávají „ruce po cestě" | pokud se to má tisknout jako fakt produktu, musí to být v `guide`; dnes je to jen obraz | B |
| 4 | `Lumi/01` vs. tato kniha | v Lucerně se plamen jmenuje *Ekam* a hoří bez oleje | tato kniha s ním nepracuje (lampion svítí svíčkou); nezaměňovat „plamen Ekam" s fyzickým plamenem | B |
| 5 | `lamp-001` cena a bonus | produkt nese 490 Kč / 70 560 ZION a knihu + Pass | kniha o ceně nemluví; čísla se berou z produktu, ne z knihy | C |
| 6 | bezpečnostní text | `fire-safety.ts` má vlastní verzi (`FIRE_CONSENT_VERSION`) | kniha smí vysvětlit *proč*, nikdy nenahrazuje body, které zákazník podepisuje | C |

---

## §4 Co tato kniha není

1. **Není Písmo.** Stavba lucerny v Nazaretě není v evangeliích. Rozdíl je vypsaný v každé kapitole, ne v poznámce pod čarou.
2. **Není relikvie ani požehnaný předmět.** Lampion je řemeslo. Kdo mu přisoudí moc, není „víc duchovní" — jen prodává jiné zboží, než které dodává.
3. **Není zdravotní ani bezpečnostní návod.** Bezpečnost drží `fire-safety.ts`; kniha ho nesmí nahradit ani oslabit.
4. **Není finanční sdělení.** O ceně, bonusu ani výnosu zde není ani slovo; čísla patří produktu a obchodu.
5. **Není nábor.** Vzkaz nikoho nevyzývá, aby věřil, vstoupil nebo zaplatil. Vyzývá k jedné věci: rozsviť a předej.
6. **Není náhrada registrů.** Při rozporu s `StatusV3.md`, `MiseAmenti/07` nebo produktovými daty platí ony.

---

## §5 Návrh změny podle `MiseAmenti/08` §3

```markdown
## Záměr
Doplnit korpus o krátkou narativní knihu k fyzickému produktu `lamp-001`
(Lampion – Království srdce / Lumi 2): vzkaz postavený na Jan 12,35 a příběh
o tom, jak dítě jménem Lumi nese světlo z budoucnosti do přítomnosti.
Cíl: dát zákazníkovi text, který odpovídá na „co to držím v ruce", aniž by
z produktu udělal relikvii nebo z Bible produktovou reklamu.

## Stav tvrzení
Písmo: Jan 12,35 (Bible). Produkt: osm dílů, 3 mm březová překližka,
skleněná vložka, svíčka/LED, ~20,9 m řezných drah (ŽIVÉ).
Příběh: dílna, prkno, druhá lucerna, šest předání (PŘÍBĚH / MÝTUS).
Nová vrstva: verš byl nejdřív řečen dítěti (MÝTUS — netvrdí se jako historie).
Vyloučeno: nadpřirozené vlastnosti předmětu, výnos, ochrana, léčba
(NEPLATNÝ NÁROK).

## Důvod
Produkt se prodává s knihou a Passem; bez textu k lampionu vzniká mezera,
kterou zaplní buď prázdno, nebo reklama. Kniha mezeru vyplňuje příběhem,
který drží stejné pravdivostní štítky jako ostatní řada.

## Rizika
Kulturní (biblická pasáž, motiv tesaře), náboženské čtení (relikvie),
bezpečnost (oheň a dřevo), obchodní (text nesmí slibovat účinek),
jazykové (přepisy jmen, pořadí vzorů).

## Hranice
Nevykládá Písmo. Netvrdí historii. Nepopisuje bezpečnostní postup místo
`fire-safety.ts`. Neuvádí cenu ani výnos. Netvrdí shodu pořadí vzorů
s fyzickými díly, dokud není ověřena.

## Review
Faktický editor (produktová data, verš, přepisy), bezpečnostní reviewer
(oheň, děti, LED), kulturní konzultant (třída E), public-copy review
před jakýmkoli výňatkem na web nebo do obalu.

## Rollback / oprava
Kniha zůstává DRAFT. Každý nárok lze snížit změnou štítku bez mazání textu.
Při rozporu s faktem se opraví příběh, nikdy fakt.
```

---

## §6 Další kroky

| Krok | Co | Gate | Stav |
|---|---|---|---|
| 1 | Ověřit pořadí šesti vzorů na fyzickém kusu a doplnit do `guide.steps` | produkt | ❌ |
| 2 | Sjednotit přepis `Hiranyagarbha` / `Hiranjagarbha` | redakce | ❌ |
| 3 | Rozhodnout, zda se vzkaz tiskne a vkládá pod dno | výroba | ❌ |
| 4 | Jazyková revize anglických textů v `04` | třída E | ❌ |
| 5 | Kulturní review biblické pasáže a „nové vrstvy" | třída E | ❌ |
| 6 | Případné napojení na detail produktu (`/vanoce/lampion`) po review | web | ✅ v kódu (`#pribeh` + `story.faces`), čeká review + deploy |
| 7 | Šest krátkých textů ke stěnám — `story.faces` (voda → země → srdce → plavba → nebe → předání) | web + karta | 🔄 v kódu, DRAFT |
| 8 | Kanonizace řady | `MiseAmenti/08` | 🔄 DRAFT |

---

*„Vzkaz není pro tebe. Je to vzkaz, který máš předat."*

*Navigace:* [← Druhá lucerna](./02-Druha-Lucerna.md) · [Index](./00-README.md) · [Texty pro prodej →](./04-Texty-Pro-Prodej.md)
