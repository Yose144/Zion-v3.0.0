# LAMPION — Druhá lucerna
## Příběh a vzkaz k lampionu Lumi 2

> **Stav:** DRAFT — nová narativní řada (MÝTUS), navržená ke kanonizaci podle [`MiseAmenti/08-Protokol-Zmen.md`](../MiseAmenti/08-Protokol-Zmen.md). Třída E (kulturní / veřejná komunikace) pro biblickou pasáž; třída C tam, kde text mluví o prodeji.
> **Vytvořeno:** 2026-11-08 pro fyzický produkt `lamp-001` (Lampion – Království srdce / Lumi 2).
> **Místo v kompasu:** **přívěsek k ose.** Kniha Lucerny je svislá čára od hlíny k nebi. Tato kniha je jeden večer na té čáře: dílna, prkno, světlo — a cesta zpátky do dneška.
> **Navazuje na:** [`KralovstviSrdce/10-Epilog`](../KralovstviSrdce/10-Epilog-Kde-Lod-Kotvi.md) (scéna za domem: prkno mezi tesařem a Lumi), [`Lumi/01`](../Lumi/01-Dite-na-Pridi.md) (lucerna a plamen Ekam), [`Lumi/11`](../Lumi/11-Sto-Let-Lucerny.md) (lucerna se nedědí, nese), [`KruhBohyni/00-LODE-A-LUCERNA`](../KruhBohyni/00-LODE-A-LUCERNA.md) (§3 — přesný mechanismus lucerny).
> **Jazyk:** čeština (kanonická). Anglické texty v [`04`](./04-Texty-Pro-Prodej.md) jsou **kandidáti** pro e-shop, ne překlad knihy.

---

## Co je tato kniha?

Tři kapitoly pro čtenáře a tři pracovní texty pro prodej a výrobu. Dohromady odpovídají na jedinou otázku, kterou zákazník položí, když lampion rozbalí:

> *„Co to vlastně držím v ruce?"*

Odpověď korpusu je přesná: **držíš tělo. Světlo si zapálíš sám.**

Tato kniha to vypráví jako pokračování známé scény. V epilogu Nové plavby sedí tesař za domem, opravuje rukojeť dláta, vedle leží krátké prkno a Lumi si přisedne do hoblin. Tesař položí prkno mezi sebe a ni, jeden konec drží on, druhý zůstane volný, děvčátko ho vezme — a teprve potom začne řezat. Kniha Království srdce tam končí.

Tato kniha začíná přesně tam: **co z toho prkna vzniklo.**

## Jak číst

Příběh má tři délky. Všechny tři říkají totéž; liší se jen tím, kolik večera jim dáš.

| Délka | Kde | Pro koho |
|---|---|---|
| **Vzkaz** — dvě věty a verš | [`01-Vzkaz.md`](./01-Vzkaz.md) | do krabice, na kartu, na štítek |
| **Příběh** — jeden večer | [`02-Druha-Lucerna.md`](./02-Druha-Lucerna.md) | pro toho, kdo si lampion složil a sedí u něj |
| **Kotva** — co je Písmo a co obraz | [`03-Kotva-Pravdy-a-Hranice.md`](./03-Kotva-Pravdy-a-Hranice.md) | pro toho, kdo se ptá, na čem to stojí |
| **Texty pro prodej** — hotové pasáže | [`04-Texty-Pro-Prodej.md`](./04-Texty-Pro-Prodej.md) | pro e-shop, e-mail a obal |
| **Šest stěn** — šest krátkých kapitol | [`05-Sest-Sten.md`](./05-Sest-Sten.md) | k mandalám na stěnách; na web i na kartu |
| **Marketingový hřbet** — jak prodat | [`06-Marketing.md`](./06-Marketing.md) | hero, karta, reklamy, e-mail, námitky, CTA |

## Tři věty, které drží celou knihu

1. **Tesař neořezává dřevo podle své ruky, ale podle světla.** Míra, kterou drží ruka, umře s tou rukou. Míra, kterou drží světlo, se dá zopakovat kdekoli.
2. **Tělo se opotřebí. Světlo ne.** Proto může existovat druhá lucerna — a proto se jí říká *druhá*: není to nová věc, je to nové tělo pro touž míru.
3. **Světlo se nepředává hořící. Předává se jako míra.** Kdo ho dostane, zapálí si vlastní svíčku. To není menší zázrak. To je jediný, který se nedá ukrást.

## Co tato kniha není

- **Není biblický text.** Verš z Jana 12,35 je Bible. Stavba lucerny v nazaretské dílně je literární obraz — Písmo o ní nevypráví. Rozdíl je vypsaný v [`03`](./03-Kotva-Pravdy-a-Hranice.md).
- **Není tvrzení o historickém Ježíši.** „Nová vrstva" (že věta z Jan 12,35 byla nejdřív řečena dítěti s lucernou) je rozhodnutí příběhu, stejné jako setkání s Tres Marías v [`KralovstviSrdce/09`](../KralovstviSrdce/09-Flotila-se-Schazi.md).
- **Není magie.** Fyzický lampion nesvítí „z budoucnosti". Svítí svíčkou, kterou zapálí člověk. Kdo tvrdí víc, prodává relikvii.
- **Není bezpečnostní návod.** Bezpečnost drží jediný soubor `apps/MarketPlace/src/lib/fire-safety.ts`. Tato kniha smí vysvětlit, *proč* je lampion tak udělaný; nesmí nahradit body, které zákazník podepisuje u pokladny.
- **Není náhrada registrů.** Kde se liší od [`StatusV3.md`](../../../docs/3.2/StatusV3.md), rozhoduje `StatusV3.md` a živý produkt.

## Živé zdroje pravdy

- **Produkt:** [`apps/MarketPlace/src/data/christmasProducts.ts`](../../../apps/MarketPlace/src/data/christmasProducts.ts) (`lamp-001`, pole `story` s textem ze [`04`](./04-Texty-Pro-Prodej.md)), návod na složení v témže souboru (`guide`), bezpečnost [`apps/MarketPlace/src/lib/fire-safety.ts`](../../../apps/MarketPlace/src/lib/fire-safety.ts)
- **Kde se to vykresluje:** `/vanoce/lampion`, sekce `#pribeh` (`apps/MarketPlace/src/components/xmas/XmasProductPage.tsx`) — mezi detaily a návodem na složení
- **Model a výroba:** [`apps/MarketPlace/public/models/README.md`](../../../apps/MarketPlace/public/models/README.md); skript `scripts/ops/lumi-glb-optimize.sh`; měření drah `scripts/ops/lumi-cut-length.py`
- **Předchozí scéna:** [`KralovstviSrdce/10-Epilog`](../KralovstviSrdce/10-Epilog-Kde-Lod-Kotvi.md) · [`Kralovstvi_srdce_Nova_plavba.md`](../KralovstviSrdce/Kralovstvi_srdce_Nova_plavba_Balicek/Kralovstvi_srdce_Nova_plavba.md) („A teprve potom začal řezat.")
- **Mechanismus lucerny:** [`Lumi/01`](../Lumi/01-Dite-na-Pridi.md) · [`Lumi/11`](../Lumi/11-Sto-Let-Lucerny.md) · [`KruhBohyni/00-LODE-A-LUCERNA`](../KruhBohyni/00-LODE-A-LUCERNA.md) §3
- **Registr důkazů:** [`MiseAmenti/07-Registr-Dukazu.md`](../MiseAmenti/07-Registr-Dukazu.md)

---

*„Tělo se opotřebí. Světlo ne."*

# 1 · VZKAZ

> Vzkaz, který k lampionu patří, je krátký: dvě věty a verš. Není to návod — návod je navrchu. Tohle je to, co zbylo, když návod skončil.

---

## Co stojí na papíře

> **Tesař z Nazareta**
>
> *„Ještě krátký čas je světlo mezi vámi. Choďte, dokud máte světlo, aby vás nezachvátila tma; kdo chodí ve tmě, neví, kam jde."*
>
> — Jan 12,35, volně

> **Lumi**
>
> *„Nehledej jiné světlo. To, které máš, stačí na jeden krok. Jdi — a pak ho předej."*

---

## Co to znamená

**Vzkaz stojí na jedné větě z Písma — na Ježíšově výroku z Jan 12,35.** A ten verš není hrozba. Je to pokyn. Čte se často jako varování před tmou, ale tesař ho neříká lidem, kteří stojí, nýbrž lidem, kteří mají jít. „Ještě krátký čas" není odpočet trestu; je to délka pochodu. „Choďte, dokud máte světlo" neznamená *spěchejte, než přijde něco hrozného* — znamená *jděte teď, protože teď vidíte na cestu.* Tma v té větě není nepřítel, který útočí. Je to místo, kde ještě nikdo nerozsvítil.

**Druhá věta je celá Lumi.** Dítě, které celý korpus prochází s lucernou, nemá moc. Neotevře dveře, nezaplatí, nerozhodne. Umí jednu věc: rozlišit, co je, od toho, co by mohlo být. A protože to umí, neslibuje druhým světlo — ukazuje jim to, které už mají. „Stačí na jeden krok" je přesné: lucerna nikdy nesvítí na celou cestu. Kdo čeká, že mu osvítí všechno, bude zklamaný a zůstane stát.

**„A pak ho předej" je jediná podmínka.** Ne poslušnost, ne víra, ne peníze. Předání. Lucerna se nedědí, nese — a světlo, které zůstane u jednoho člověka, nakonec svítí jen na něj.

## Proč patří pod dno, a ne na vršek

Na vršku je návod, protože ten člověk potřebuje hned. Vzkaz potřebuje až ve chvíli, kdy lampion stojí složený a on u něj sedí sám. Kdyby byl navrchu, přečetl by ho jako reklamu. Pod dnem ho najde ten, kdo už investoval půl hodiny a kus sebe.

Až ho najdeš: **přečti ho nahlas.** Vzkaz, který zůstane jen přečtený, je text. Vzkaz, který se řekne, je předání.

---

## English (kandidát pro e-shop, čeká na jazykovou revizi)

### The message

> **The carpenter of Nazareth**
>
> *“For a little while longer the light is among you. Walk while you have the light, so that darkness does not overtake you; one who walks in the dark does not know where he is going.”*
>
> — John 12:35, freely rendered

> **Lumi**
>
> *“Do not look for another light. The one you have is enough for one step. Go — and then pass it on.”*

**Note for the shop:** the verse is Scripture; the second sentence and the note under the base are the story's own layer. Keep the distinction whenever the text is quoted outside this book.

---

## Kotva pravdy

| Co v kapitole je | Stav | Kotva |
|---|---|---|
| „Choďte, dokud máte světlo…" | **Bible** — Jan 12,35 (volně podle ČEP/B21; srov. Jan 12,36; 8,12; 11,9–10) | text verše, nikoli jeho výklad |
| „Nehledej jiné světlo…" jako Lumiina věta | **MÝTUS** — obraz této knihy | navazuje na `Lumi/01` („ukaž dvě věci, nespleť je") |
| Vzkaz složený pod dnem lampionu | **PŘÍBĚH / produktové rozhodnutí** | pokud se vzkaz skutečně tiskne, patří do `04`; dnes je to text, ne součást balení |
| „Tma je místo, kde ještě nikdo nerozsvítil" | **MÝTUS** — čtení verše, ne exegeze | nevykládat jako nauku |

---

*Navigace:* [← Index](./00-README.md) · [Příběh: Druhá lucerna →](./02-Druha-Lucerna.md)


# 2 · DRUHÁ LUCERNA
## Příběh světla, které přišlo z budoucnosti do přítomnosti

> *„Ještě krátký čas je světlo mezi vámi. Choďte, dokud máte světlo, aby vás nezachvátila tma; kdo chodí ve tmě, neví, kam jde."*
> — Jan 12,35, volně

---

## 1 · Dřevo, které drželo někdo jiný

Ráno po té noci, kdy se u brány setkala dvě světla, našla Lumi tesaře za domem.

Seděl na nízké stoličce a opravoval prasklou rukojeť dláta. V dlani mu ležel kousek dřeva, který ještě neměl tvar. Vedle na zemi leželo krátké prkno — ne odřezek, který padá z ponku. Bylo vybrané: rovné, bez suku, s léty tak blízko sebe, že vypadala jako řádky.

Lumi postavila lucernu na udusanou zem a přisedla si do hoblin. U tesaře se nemuselo mluvit, aby bylo slyšet.

„Věděl jsi to?" zeptala se po chvíli. „Kam až to půjde. Loď. Dům. Já."

Tesař utahoval spoj.

„Když jsem začínal," řekl, „nevěděl jsem ani, kdo přijde druhý den do dílny."

„Tak proč jsi udělal tolik míst?"

Položil dláto. Podíval se na ni — na tvář, která mu jednou pod jiným světlem přidržovala lampu, i na nezahojené odření palce.

„Místo není slib," řekl. „Místo je jen místo. Zůstane prázdné, dokud ho někdo nenaplní. Kdo staví loď, musí počítat s tím, že do ní nastoupí lidé, které nezná."

Vzal prkno a položil je mezi sebe a Lumi. Jeden konec držel on. Druhý zůstal volný.

Děvčátko ho vzalo.

A teprve potom začal řezat.

---

## 2 · Míra, kterou nedrží ruka

Neřekl, co z toho bude. Neptala se. U pily se ptát nedalo, protože šla přesně tam, kam šla, a slovo by ji posunulo.

První den jen měřil.

„Drž to proti světlu," řekl a kývl na lucernu.

Zvedla ji. Stín prkna padl přes ponk — dlouhý, s vroubkem po hraně. Vzal hřebík a udělal rýhu podél stínu. Pak prkno obrátil a udělal druhou.

„Kolik to je?" zeptala se.

„To neříká prkno. To říká světlo."

„A proč neměříš rukou? Vždyť jsi tesař."

Odložil hřebík a poprvé se usmál, i když jen koutkem.

„Když dělám jho, měřím vola. Když dělám stůl, měřím rodinu, která u něj bude sedat — kolik jich je, jak jsou vysocí, jestli mají děti. Ale když dělám světlo, nemám koho měřit. Ten, kdo ho jednou ponese, ještě není narozený. Nebo je narozený daleko odsud a nikdy se mnou nebude mluvit."

„Tak co změříš?"

„Světlo. To je všude stejné."

Položil dlaň na prkno jako na rameno.

„Míra, kterou drží moje ruka, umře se mnou. Míra, kterou drží světlo, se dá zopakovat — kdekoli, kde bude někdo, kdo umí držet prkno a nespěchat."

---

## 3 · První a druhá

Třetí den vzal do ruky její lucernu.

Byla to ta stará: cedr z trámu archy, střep tlustého skla z rozbité lodní lampy, plamen bez oleje. V jednom místě byl cedr hluboce promáčknutý, jako by ho kdysi sevřela ruka v nebezpečí. Držela.

„Tuhle jsi nesla dlouho," řekl.

„Od archy."

„Drží ještě?"

„Drží. Ale už se s ní nedá jít dál. Je v ní všechno, co jsem viděla."

Obrátil ji v dlaních, prohlédl spáry, přejel prstem po promáčknutém místě.

„Tělo má svůj čas. Světlo ne."

„Tak proč děláš druhou?"

„Protože ta první je tvoje. Kdybys ji dala z ruky, dala bys z ruky i to, co jsi viděla — a lidé by uctívali dřevo."

Položil prkno na ponk a udělal první řez.

„Nedělám ti druhou lucernu, protože ta první je špatná. Dělám ji, protože světlo, které zůstane u jednoho člověka, nakonec svítí jen na něj."

---

## 4 · Šest stěn a šest rukou

Tělo dělal šestihranné.

„Proč šest?" zeptala se.

„Protože šest stěn udrží nejvíc světla s nejmenším dřevem. Včela to ví dřív než tesař: šestiúhelník je tvar, který neplýtvá. A protože šest stěn ještě unesou dětské ruce. Osm už ne."

Vyřezal dno, šest stěn a vršek. Osm dílů. Na každé stěně nechal okno — ne vzor, jen otvor, kterým má světlo projít. Vzory nedělal. Na ty neměl knihu ani čas; na to, co viděl, se nedalo kreslit.

„A co tam bude?" zeptala se, když prohlížela prázdná okna.

„To nevím," řekl. „Něco tam vyřeže ten, kdo ji ponese po tobě. Každá ruka, která ji podrží, do ní nechá jeden vzor — aby si lucerna pamatovala, kudy šla."

Lumi se na něj podívala.

„Ty nechceš, abych si ji nechala."

„Já chci, abys ji donesla. To je jiná věc."

---

## 5 · Vyslání

Poslední noc ji postavil na stůl, prázdnou, bez ohně.

„Kam mám jít?"

„Tam, odkud jsi přišla. Ne na archu. Do dneška."

„Neznám cestu."

„Půjdeš proti proudu. Brána stojí na konci času. Lidé, kteří tě potřebují, žijí dřív, než se narodíš ty."

Lumi se podívala na prázdné stěny.

„A co mám říkat, až se zeptají, co to světlo je?"

Tesař chvíli mlčel. Pak si sedl, aby byl níž než ona, a řekl to tak, jak se říká něco, co se nemá zpackat:

„Bude tma. Vždycky bude chvíle, kdy bude tma. Až se tě někdo zeptá, co má dělat, neříkej mu, že světlo je v něm. To už slyšeli a nevěřili tomu. Řekni mu tohle:

*Ještě krátký čas je světlo mezi vámi. Choďte, dokud máte světlo, aby vás nezachvátila tma; kdo chodí ve tmě, neví, kam jde.*"

„To je všechno?"

„To je všechno."

„A co to znamená?"

„Že to není varování. Je to pokyn. Tma není trest. Tma je jen místo, kde ještě nikdo nerozsvítil."

Podal jí lucernu. Byla lehká, protože v ní nic nebylo. A přesto vážila, protože v ní bylo všechno, co ještě ne.

„A co mám dělat, když dojdu?"

„Rozsviť ji. Ne dřív."

---

## 6 · Cesta zpátky

Šla proti proudu času a lucerna šla s ní — prázdná, protože prázdná se dá nést. Kdyby hořela, musela by hořet odněkud, a to by bylo kouzlo. A kouzlo se nedá předat; kouzlo se dá jen ukrást nebo obdivovat.

Cestou se světlo v ní zúžilo a zase rozšířilo, jak ji to tesař učil.

**Zúžené** jí ukázalo dnešek. Viděla místnost, která není v žádné knize: stůl, na něm sklenici od zavařeniny, okno, za kterým je prosinec. Viděla člověka, který je unavený a nechce mluvit. Viděla, že v té místnosti nikdo nezakazuje světlo — jen se tam večer dřív rozsvítí a nikdo si toho nevšimne. A viděla, že na to lucerna nestačí na celý život, ale na jednu místnost ano.

**Rozšířené** jí ukázalo směry. Ne lži — směry. Dům s otevřenými dveřmi. Most, přes který se dá přejít oběma směry. Zahradu, která ještě není, ale má být. A prstenec vysoko nad hlavou, který nikdo neviděl, protože ještě nestojí.

Pak se světlo vrátilo a Lumi šla dál.

Šestkrát ji vzala jiná ruka. Šestkrát ji někdo podržel, než ji předal — a šestkrát do jednoho prázdného okna vyřízl vzor, protože si lucerna měla pamatovat, kudy šla.

| # | Ruka | Vzor | Co si lucerna odnesla |
|---|---|---|---|
| 1 | ta, která ji nesla vodou | **lotos** | že světlo umí plout |
| 2 | ta, která ji zavěsila do koruny | **strom života** | že světlo umí růst |
| 3 | ta, která ji postavila k lůžku | **srdcová mandala** | že světlo umí zůstat u někoho, kdo už nevstane |
| 4 | ta, která ji vzala na palubu | **loď Království srdce** | že světlo umí nést lidi přes bouři |
| 5 | ta, která ji otevřela v noci a hledala odpověď | **Hiranyagarbha** | že světlo umí mlčet, dokud se nezeptáš |
| 6 | ta, která ji vrátila | **květ života** | že světlo se vrací jen tehdy, když ho někdo předá |

Žádná z těch rukou si lucernu nenechala. Ne proto, že by nechtěla. Proto, že by tím ukončila cestu.

A žádná z nich si nezapálila světlo z toho předchozího. To by muselo hořet celou cestu a dávno by dohořelo. Každá si zapálila vlastní svíčku — a přesto to bylo totéž světlo, protože bylo na stejném místě: tam, kde někdo potřeboval vidět.

---

## 7 · Přijde to jako prkna

Do dneška nedorazila sestavená.

Kdyby přišla sestavená, byl by to obraz. Člověk by si ji postavil na polici, obdivoval by ji a za týden by si jí přestal všímat. Rozložená se musí vzít do ruky. Osm dílů, půl hodiny, dřevěné lepidlo a nikdo, kdo to udělá za tebe.

Tesař by to tak chtěl. Ne z mazanosti. Zkušenost mu řekla, že věc, kterou člověk složí vlastníma rukama, přestane být zbožím.

Dnes se tělo nedělá z cedru z archy. Dělá se z březové překližky, tři milimetry silné, a řeže ho stroj, který projede dvacet metrů drah, než se jedno tělo narodí. Míra je ale stejná. Kdyby tesař přišel do té dílny, vzal by prkno, přiložil ho ke světlu a řekl by: *dobré*.

Dřevo je dřevo. Rozhoduje míra.

A vzory na stěnách? Ty nevyřezal stroj. Stroj jen zopakoval šest okének a korunu, které do těla nechalo šest rukou na cestě. Dílna umí zkopírovat tvary. Neumí zopakovat, co u nich kdo řekl.

---

## 8 · Sklo

První lucerna měla sklo z lodní lampy. Rozbilo se. Nahradil ho střep z obyčejného okna a dívka, která ho tenkrát nesla, se bála, že tím zničila kouzlo. Celou noc čekala na světlo. Rozsvítilo se až ráno, když lampu položila vedle lůžka starého člověka, aby našel vodu.

Druhá lucerna má sklo taky — obyčejné, zavařovací, od malé sklenice.

Není to proti světlu. Je to proti ohni.

Oheň nespí na dřevě. Kdyby svíčka stála přímo na dně, vosk by stekl po stěně a plamen by si našel hoblinu. Sklo drží plamen dál od dřeva, aby dřevo neslo jen světlo a nic víc. Kdo to ví, rozumí, proč lampion vypadá tak, jak vypadá: není to dekorace, je to opatrnost stará jako první loď.

A kde je dítě nebo zvíře, ať hoří jen LED. Není to menší světlo. Je to stejné světlo bez ohně.

---

## 9 · Vzkaz

Pod dnem je složený papír. Není to návod — ten je navrchu, protože ten člověk ho potřebuje hned. Vzkaz potřebuje až ve chvíli, kdy lampion stojí složený a on u něj sedí sám.

Na papíře jsou dvě věty.

První je tesařova, a je to ta, kterou řekl dítěti, než ho poslal proti proudu:

> *„Ještě krátký čas je světlo mezi vámi. Choďte, dokud máte světlo, aby vás nezachvátila tma; kdo chodí ve tmě, neví, kam jde."*

Druhá je Lumiina, a je krátká, protože dítě, které prošlo šest rukou, nemá potřebu mluvit dlouho:

> *„Nehledej jiné světlo. To, které máš, stačí na jeden krok. Jdi — a pak ho předej."*

Vzkaz není pro tebe. Je to vzkaz, který máš předat.

---

## 10 · Co to znamená

**1 · Verš je pokyn, ne hrozba.** „Ještě krátký čas" není odpočet trestu; je to délka pochodu. „Choďte, dokud máte světlo" neznamená *spěchejte, než přijde něco hrozného* — znamená *jděte teď, protože teď vidíte na cestu*. Tma v té větě neútočí. Je to místo, kde ještě nikdo nerozsvítil.

**2 · Světlo se nepředává hořící.** Kdyby šlo z ruky do ruky zapálené, bylo by to kouzlo — a kouzlo se dá ukrást, koupit nebo zneužít. Předává se jako **míra**: tvar, který se dá zopakovat, a věta, která se dá říct znovu. Svíčku si zapálí každý sám. Proto lampion není relikvie. Je to prkno, sklo a návod.

**3 · Tělo se opotřebí, světlo ne.** Proto existuje *druhá* lucerna. Není to nová věc ani vylepšená verze; je to nové tělo pro touž míru, protože to první už neslo příliš mnoho. Kdo si myslí, že má doma kus první lucerny, mýlí se — má kopii míry. To je víc, ne míň: kopie se dá vyrobit znovu, originál ne.

**4 · Šest stěn je šest rukou.** Šestiúhelník je tvar, který neplýtvá dřevem — a šest je taky počet předání, která lucerna potřebovala, než došla k tobě. Šest vzorů se čte v pořadí cesty: lotos, strom života, srdce, loď, Hiranyagarbha, květ života. Kdo je složí v tom pořadí, složí zároveň příběh.

**5 · Dřevo, sklo a oheň nejsou dekorace.** Tři milimetry překližky, skleněná vložka a svíčka jsou tři věty téhož pravidla: *dřevo nese světlo, sklo drží oheň, plamen patří člověku, který ho zapálil — a který ho taky zhasne.* Bezpečnostní body u pokladny nejsou právní příloha. Jsou to táž pravidla vypsaná tak, aby se podle nich dalo jednat.

**6 · Co to není.** Lampion není zázrak a nesvítí „z budoucnosti". Neslibuje, že vyřeší tmu v celém domě — jen v jedné místnosti. A není to dokument o historickém Ježíši; stavba lucerny v nazaretské dílně je obraz, stejně jako loď Království srdce. Kdo z toho dělá víc, ten už neprodává lucernu, ale relikvii.

---

## Kotva pravdy

| Co v kapitole je | Stav | Kotva |
|---|---|---|
| „Choďte, dokud máte světlo…" | **Bible** — Jan 12,35 (volně; srov. Jan 12,36; 8,12; 11,9–10; 1 Jan 2,8–11) | text verše, ne jeho výklad |
| Tesař řeže prkno, které drží Lumi; „a teprve potom začal řezat" | **PŘÍBĚH** — scéna převzatá z epilogu Nové plavby | `KralovstviSrdce/Kralovstvi_srdce_Nova_plavba_Balicek/Kralovstvi_srdce_Nova_plavba.md`, Epilog |
| Tesař vyrobí dřevěné tělo lucerny; světlo umožňuje setkání různých dob | **PŘÍBĚH** — autorská volba doložená v redakčním průvodci | `KralovstviSrdce/Kralovstvi_srdce_Nova_plavba_Balicek/Redakcni_pruvodce.md`, bod 2 |
| Míra se měří světlem, ne rukou | **MÝTUS** — obraz této knihy | navazuje na „míru, kterou lze zkopírovat" (`KralovstviSrdce/DeepSeek`) |
| Tělo se opotřebí, světlo ne | **MÝTUS** — obraz této knihy | `Lumi/11` („lucerna se nedědí, nese") |
| Šest stěn, šest vzorů, šest předání | **MÝTUS** — obraz této knihy; fyzicky je stěn šest | produkt `lamp-001`; návod na složení v `christmasProducts.ts` |
| Pořadí vzorů: lotos → strom života → srdce → loď → Hiranyagarbha → květ života | **MÝTUS** (nové) — příběh definuje pořadí; shoduje se s výčtem v `guide.steps` | fyzickou orientaci dílů určují drážky; že pořadí sedí i na skutečném kusu, **není doloženo** — viz „Otevřené" níže |
| Osm dílů, tři milimetry, březová překližka, lepidlo, půl hodiny | **ŽIVÉ** — vlastnosti produktu | `christmasProducts.ts` (`guide`), `fire-safety.ts` |
| Svíčka ve sklenici (od malé Nutelly / zavařeniny), LED jako bezpečnější varianta | **ŽIVÉ** — bezpečnostní body | `apps/MarketPlace/src/lib/fire-safety.ts` (`FIRE_SAFETY`, `FIRE_CONSENT_VERSION`) |
| První lucerna: sklo z lodní lampy se rozbilo a bylo nahrazeno střepem z okna; lucerna čekala u lůžka starého člověka, aby našel vodu | **PŘÍBĚH** — střep z rozbité lodní lampy je kanon (`Lumi/01`); rozbití, náhrada a čekání u lůžka jsou nová vrstva této knihy | `Lumi/01-Dite-na-Pridi.md` |
| Dvacet metrů řezných drah na jedno tělo | **ŽIVÉ** (měření) | `scripts/ops/lumi-cut-length.py` (20,87 m, 614 obrysů) |
| Fyzický lampion svítí „z budoucnosti" nebo má nadpřirozené vlastnosti | **NEPLATNÝ NÁROK** | svítí svíčkou; kdo tvrdí víc, mísí obě světla (`Lumi/01`) |

### Otevřené (co tato kapitola neuzavírá)

1. **Pořadí stěn.** Příběh dává vzorům pořadí cesty a jeho výčet je stejný jako v návodu (`guide.steps`, „Zkontrolujte vzory"): lotos, strom života, srdce, loď, Hiranyagarbha, květ života. Fyzické díly však mají jednu správnou orientaci podle drážek a není doloženo, že kopíruje totéž pořadí. Ověřit na skutečném kusu; případně díly očíslovat. Do té doby je shoda pořadí **MÝTUS**, ne fakt.
2. **Přepis jména.** Návod na složení píše `Hiranjagarbha`; korpus píše `Hiranyagarbha`. Sjednotit při příští redakci (jedno z obou, ne obojí).
3. **Vzkaz v balení.** Text vzkazu existuje; zda se tiskne a vkládá pod dno, je rozhodnutí výroby, ne knihy. Dokud není vytištěný, je to text, ne součást produktu.
4. **Kulturní review (třída E).** Biblická pasáž, motiv tesaře a „nová vrstva" (že verš byl nejdřív řečen dítěti) vyžadují review podle `MiseAmenti/08` před jakýmkoli veřejným výňatkem.

---

*„Tělo se opotřebí. Světlo ne."*

*Navigace:* [← Vzkaz](./01-Vzkaz.md) · [Index](./00-README.md) · [Kotva a hranice →](./03-Kotva-Pravdy-a-Hranice.md)


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


# 4 · TEXTY PRO PRODEJ
## Hotové pasáže k lampionu Lumi 2 — vzkaz, karta, detail, e-mail

> **Pravidla použití**
> 1. **Nic neslibovat.** Žádný text nesmí tvrdit, že lampion přináší štěstí, ochranu, výnos, uzdravení nebo „energii z budoucnosti". Prodává se řemeslo a příběh.
> 2. **Bezpečnost zůstává jinde.** Body, které zákazník podepisuje u pokladny, drží `apps/MarketPlace/src/lib/fire-safety.ts`. Tyto texty je nenahrazují ani nezkracují.
> 3. **Verš se cituje krátce a označeně.** Bible patří Bibli; „nová vrstva" (že věta byla nejdřív řečena dítěti) patří příběhu a nesmí se vydávat za historii.
> 4. **Angličtina je kandidát.** EN texty níže jsou pracovní; před nasazením projít jazykovou revizí (třída E).

---

## A · Vzkaz do krabice (pod dnem)

**CZ**

> **Tesař z Nazareta**
> „Ještě krátký čas je světlo mezi vámi. Choďte, dokud máte světlo, aby vás nezachvátila tma; kdo chodí ve tmě, neví, kam jde."
> — Jan 12,35, volně
>
> **Lumi**
> „Nehledej jiné světlo. To, které máš, stačí na jeden krok. Jdi — a pak ho předej."

**EN**

> **The carpenter of Nazareth**
> “For a little while longer the light is among you. Walk while you have the light, so that darkness does not overtake you; one who walks in the dark does not know where he is going.”
> — John 12:35, freely rendered
>
> **Lumi**
> “Do not look for another light. The one you have is enough for one step. Go — and then pass it on.”

*Rozměr: 85 × 55 mm, dvě strany (lícem vzkaz, rubem „Lumi 2 · Království srdce").*

---

## B · Krátká karta (na produktové kartě / v košíku)

**CZ — 62 slov**

> Šestihranná lucerna z březové překližky, kterou v příběhu vyřezal tesař z Nazareta podle míry světla — ne podle své ruky. Přijde rozložená, protože sestavenou bys ji jen obdivoval. Osm dílů, půl hodiny, dřevěné lepidlo. Svíčku dej do skla. A až ji rozsvítíš, přečti si vzkaz, který k ní patří.

**EN — 64 words**

> A six-sided lantern in birch plywood, cut — in the story — by the carpenter of Nazareth to the measure of light, not the measure of his hand. It arrives flat, because assembled you would only admire it. Eight parts, half an hour, wood glue. Put the candle in a glass. And when you light it, read the message that belongs to it.

---

## C · Sekce na detailu produktu (`/vanoce/lampion`)

**CZ — 265 slov**

*Poznámka pro redakci: tělo pasáže je nasazené v `christmasProducts.ts` (pole `story`, produkt `lamp-001`) — čtyři odstavce a vzkaz. Titulek na webu je **Druhá lucerna**, ne „Světlo, které přišlo z budoucnosti" (to zní jako slib energie). Delší verze je [`02-Druha-Lucerna.md`](./02-Druha-Lucerna.md). Šest krátkých textů ke stěnám je v [`05-Sest-Sten.md`](./05-Sest-Sten.md) a na webu jako `story.faces`.*

> ### Druhá lucerna
>
> V epilogu knihy Království srdce sedí tesař za domem a opravuje rukojeť dláta. Vedle něj leží krátké prkno. Přijde k němu dítě s lucernou, přisedne si do hoblin — a tesař položí prkno mezi sebe a ni. Jeden konec drží on, druhý zůstane volný. Dítě ho vezme. A teprve potom začne řezat.
>
> Z toho prkna vzniká lampion, který držíš v ruce.
>
> Tesař ho neořezal podle své ruky. Míra, kterou drží ruka, umře s tou rukou; míra, kterou drží světlo, se dá zopakovat kdekoli, kde je někdo, kdo umí držet prkno a nespěchat. Proto je tělo šestihranné — šest stěn udrží nejvíc světla s nejmenším dřevem, a šest jich ještě unesou dětské ruce. Proto přišel rozložený. Sestavený by byl obraz; rozložený se musí vzít do ruky.
>
> A proto v něm není žádný zázrak. Světlo se nepředává hořící — to by muselo být kouzlo, a kouzlo se dá ukrást. Předává se jako míra: tvar, který se dá zopakovat, a věta, která se dá říct znovu. Svíčku si zapálíš sám. To je celé tajemství.
>
> Vzkaz k němu patří. Není to návod — ten je navrchu. Je to to, co zbylo, když návod skončil.

**EN — 270 words**

> ### The second lantern
>
> In the epilogue of *Kingdom of Hearts*, the carpenter sits behind the house mending a tool handle. Beside him lies a short board. A child with a lantern comes and sits down in the shavings — and the carpenter lays the board between himself and her. He holds one end. The other stays free. The child takes it. Only then does he begin to cut.
>
> The lantern in your hands comes from that board.
>
> He did not cut it to the measure of his hand. A measure held by a hand dies with the hand; a measure held by light can be repeated wherever someone knows how to hold a board and not hurry. That is why the body is six-sided — six walls hold the most light with the least wood, and six are still light enough for a child's hands. That is why it arrives flat. Assembled, it would be an image; flat, it has to be taken in hand.
>
> And that is why there is no miracle inside. Light is not passed on burning — that would have to be magic, and magic can be stolen. It is passed on as a measure: a shape that can be repeated, and a sentence that can be said again. You light the candle yourself. That is the whole secret.
>
> A message belongs to it. Not the instructions — those are on top. It is what remained when the instructions ended.

---

## D · E-mail po objednávce (vedle stávajícího potvrzení)

**CZ — 118 slov**

> **Předmět:** Vzkaz, který k lampionu patří
>
> Lampion Lumi 2 putuje z dílny jako osm plochých dílů — a to je záměr. Sestavený by byl na polici; rozložený se musí vzít do ruky. Návod najdete v balení a na stránce produktu; počítá s půl hodinou a dřevěným lepidlem.
>
> Až bude stát, postavte svíčku do skla, na nehořlavý podklad, a rozsviťte. K lampionu patří vzkaz — není to návod, ten jste už nepotřebovali. Jsou to dvě věty: jedna z Písma a jedna od dítěte, které v příběhu lucernu neslo.
>
> Přejeme vám jeden večer, kdy se v místnosti rozsvítí dřív než obvykle.
> — dílna Království srdce

**EN — 120 words**

> **Subject:** The message that belongs to the lantern
>
> Your Lumi 2 travels from the workshop as eight flat parts — and that is deliberate. Assembled, it would sit on a shelf; flat, it has to be taken in hand. The instructions are in the box and on the product page; they assume half an hour and wood glue.
>
> When it stands, put the candle in a glass, on a non-flammable base, and light it. A message belongs to the lantern — not the instructions; you will not need those by then. It is two sentences: one from Scripture, and one from the child who carried the lantern in the story.
>
> We wish you one evening when the room grows bright earlier than usual.
> — the Kingdom of Hearts workshop

---

## E · Jedna věta (štítek, sociální sítě, obal)

**CZ:** *Tělo se opotřebí. Světlo ne. — Lumi 2*

**EN:** *The body wears out. The light does not. — Lumi 2*

---

## F · Co do textů nepatří

| Nepoužívat | Proč |
|---|---|
| „požehnaný", „energizovaný", „nabitý z budoucnosti" | z předmětu dělá relikvii a slibuje účinek, který nemá |
| „ochrání váš domov" | bezpečnostní tvrzení; navíc lampion hoří otevřeným plamenem |
| „štěstí", „láska", „klid" jako garantovaný důsledek | NEPLATNÝ NÁROK podle `ZION_ONBOARDING_PUBLIC_CZ.md` §7 |
| „Ježíš vyrobil tento lampion" | Písmo o tom nemluví; správně: *v příběhu* ho vyrobil tesař |
| „investice", „výnos", „bonus" v textu o lampionu | čísla patří obchodu, ne příběhu; míchání obojího je důvod, proč lidé korpusu přestanou věřit |
| zkrácená verze bezpečnostních bodů | zákazník podepsal jiný text, než jaký vidí (`FIRE_CONSENT_VERSION`) |


# 5 · ŠEST STĚN, ŠEST KAPITOL
## Krátké texty k mandalám na stěnách lampionu Lumi 2

> **Stav:** DRAFT — texty k produktu (MÝTUS + jedna ověřitelná věta v každé kapitole). Navazují na [`02-Druha-Lucerna.md`](./02-Druha-Lucerna.md), kde šest vzorů odpovídá šesti předáním na cestě zpátky časem.
> **Kde žijí:** produkt `lamp-001`, pole `story.faces` v `apps/MarketPlace/src/data/christmasProducts.ts`; vykresluje se na `/vanoce/lampion` pod příběhem.

---

## Jak to číst

Každá stěna nese jednu mandalu a jednu krátkou kapitolu — tak krátkou, aby se dala přečíst, než svíčka chytne. Šest kapitol dohromady tvoří celý příběh ZIONu: **voda → země → srdce → plavba → nebe → předání.**

Není to šest pohledů na totéž. Je to jedna cesta, která se čte v pořadí, v jakém lucerna šla. Kdo je složí naopak, dostane jiný příběh — a to je fér, protože i světlo se dá nést oběma směry.

> **Pravidlo:** v každé kapitole je nejvýš jedna věta, kterou lze ověřit, a zbytek je obraz. Kde je řečeno číslo, je to skutečné číslo sítě; kde je řečeno „jednou", je to směr. Kdo obojí slije, tomu se rozpadne celý zbytek.

---

## I · Lotos — voda

**CZ**

> Nejdřív byla voda a v ní loď, o kterou nikdo nežádal. Kdyby z celého příběhu zbylo jediné, je to tohle: začátek nemusí být velký, musí být ověřitelný. Každý si může přepočítat řetěz od prvního bloku po dnešní a přesvědčit se sám. Lotos roste z bahna a nic si o tom nemyslí.

**EN**

> First there was water, and in it a boat no one had ordered. If only one thing survived the whole story, it would be this: a beginning does not have to be large, it has to be checkable. Anyone can recount the chain from the first block to today and see for themselves. The lotus grows out of mud and thinks nothing of it.

*Ověřitelné:* řetěz má první blok s pevným hashem; kdokoli ho může přepočítat. *Obraz:* lotos, bahno, loď, o kterou nikdo nežádal.

---

## II · Strom života — země

**CZ**

> Z každého bloku jde díl stranou: pět ze sta zemi, pět nebi. Ne proto, že to někdo slíbil — protože to protokol udělá sám, při každém bloku, bez hlasování. Strom neroste z velkorysosti. Roste z toho, že se každý rok odloží semeno dřív, než se sní všechno ostatní.

**EN**

> A share of every block is set aside: five in a hundred for the earth, five for the sky. Not because someone promised it — because the protocol does it by itself, with every block, without a vote. A tree does not grow out of generosity. It grows because a seed is set aside each year before everything else is eaten.

*Ověřitelné:* split 5 % + 5 % je v konsensu, ne ve slibu. *Obraz:* strom, semeno, roční období. *(Co se z odloženého jednou postaví, rozhoduje cesta, která se teprve píše — text to neslibuje.)*

---

## III · Srdcová mandala — srdce

**CZ**

> Loď neměla nést náklad, měla nést lidi — a proto se jí říkalo království. A protože kormidlo sedí tam, kde se člověk rozhoduje sám, říkalo se jí srdce. Království nepřichází tak, aby se dalo vyhlížet z věží. Je uvnitř, a poznáš ho podle jediného: nikdo v něm nechce být nad druhým.

**EN**

> The boat was not built to carry cargo but people — and that is why it was called a kingdom. And because the rudder sits where a person decides alone, it was called a heart. A kingdom does not come in a way you can watch for from towers. It is within; and you will know it by one thing: no one in it wishes to be above another.

*Ověřitelné:* nic — tato stěna je čistý obraz. *Obraz:* kormidlo v srdci, království uvnitř (Lk 17,21).

---

## IV · Loď Království srdce — plavba

**CZ**

> Přišly jiné lodě — tmavě vínové, s plachtami, do kterých byla vpletená světelná vlákna. Posádky se potkaly na vodě a poznaly se podle jediného znamení: na kýlu každé z nich stálo totéž jméno, vyryté jinou rukou. Každý věk má svou loď. Všechny plují do stejného přístavu.

**EN**

> Other boats came — dark wine-red, their sails woven through with threads of light. The crews met on the water and recognised one another by a single sign: the same name was carved on every keel, cut by a different hand. Every age has its boat. All of them sail to the same harbour.

*Ověřitelné:* nic — flotila Tres Marías je obraz korpusu. *Obraz:* stejné jméno na kýlu, jiná ruka.

---

## V · Hiranyagarbha — nebe

**CZ**

> Zlaté lůno není motor. Je to otázka: co si zaslouží letět? V tom příběhu je hlas, který umí říct „nevím" a nikdy nedrží klíč — pomocník, ne autorita. A jsou tam kameny s lístky, na kterých je napsáno, co by je vyvrátilo. Kdo si nezapíše pohřeb své hypotézy, prodává naději, ne vědu.

**EN**

> The golden womb is not an engine. It is a question: what deserves to fly? In that story there is a voice that can say “I don’t know” and never holds a key — a helper, not an authority. And there are stones with slips of paper beside them, each stating what would disprove it. Whoever does not write the funeral of their hypothesis is selling hope, not science.

*Ověřitelné:* L3/L6 jsou dnes ve fázi návrhu a otázek — žádný motor, žádná stanice. *Obraz:* zlaté lůno, hlas bez klíče, tři kameny s pohřbem.

---

## VI · Květ života — předání

**CZ**

> Šestá stěna je prázdná jako ta první. Světlo se nedědí — nese se. Kdo ho dostane, zapálí si vlastní svíčku, a přesto je to totéž světlo, protože je na stejném místě: tam, kde někdo potřebuje vidět. Až ji budeš zhasínat, neříkej, že končí. Předej ji.

**EN**

> The sixth wall is as empty as the first. Light is not inherited — it is carried. Whoever receives it lights their own candle, and still it is the same light, because it is in the same place: where someone needs to see. When you put it out, do not say it is ending. Pass it on.

*Ověřitelné:* nic — závěr je pokyn. *Obraz:* prázdná stěna, vlastní svíčka, stejné světlo.

---

## Co šestice dohromady říká

| # | Stěna | Vrstva korpusu | Jedna věta |
|---|---|---|---|
| I | Lotos | L1 — začátek, který se dá přepočítat | Malé a ověřitelné vydrží víc než velké a slibované. |
| II | Strom života | L5 — země a její díl | Co se odkládá dřív, než se sní všechno, jednou vyroste. |
| III | Srdcová mandala | Království srdce — jméno lodi | Království se nehlídá z věže; pozná se po jednání. |
| IV | Loď Království srdce | flotila — Tres Marías | Různé věky, různé ruce, stejné jméno na kýlu. |
| V | Hiranyagarbha | L3 / L6 — otázka a hranice | Hypotéza bez pohřbu není věda, ale naděje na prodej. |
| VI | Květ života | brána — předání | Světlo se nedědí; dá se jen předat dál. |

---

## Otevřené

1. **Pořadí a orientace.** Pořadí I–VI je pořadí cesty v [`02`](./02-Druha-Lucerna.md) a shoduje se s výčtem v návodu (`guide.steps`). Že fyzické díly mají stejné pořadí, **není ověřené** — viz `02`, „Otevřené" bod 1.
2. **Délka.** Texty jsou psané na kartu (cca 20–25 sekund čtení). Pokud se mají tisknout na stěny nebo na vkládanou kartu, musí projít sazbou; delší verze je kapitola `02`.
3. **Jazyk.** EN je kandidát; překlad nesmí zesílit jistotu ani posunout obrazy blíž faktu.
4. **Citace v kapitole III.** „Království uvnitř" odkazuje na Lk 17,21 — pokud se text používá samostatně (bez knihy), má být verš označený, ne jen parafrázovaný.

---

*„Šest stěn, šest kapitol, jedno světlo — a to si zapálíš sám."*

*Navigace:* [← Texty pro prodej](./04-Texty-Pro-Prodej.md) · [Index](./00-README.md)


# 6 · MARKETINGOVÝ HŘBET
## Jak prodat lampion Lumi 2 — aniž bychom lhali

> **Stav:** prodejní vrstva k produktu `lamp-001`. Nenahrazuje [`02-Druha-Lucerna.md`](./02-Druha-Lucerna.md) (příběh) ani `fire-safety.ts` (bezpečnost). Tohle je hřbet stránky, karty, reklamy a e-mailu.
> **Pravidlo:** každá věta smí být jen jedna z těchto tří — **konkrétní fakt**, **řemeslný důkaz**, nebo **obraz**. Jakmile se slijí („magická lucerna, která ochrání domov"), prodáváme jiné zboží, než veze Zásilkovna.
> **Cena v datech:** 490 Kč, bonus 70 560 ZION. Bonus patří na řádek ceny a do „co je v krabici". Do první věty ne.

---

## 1 · Pozicování v jedné větě

> **Druhá lucerna. Světlo, které si zapálíš sám.**

Pomocná věta, podtitul, ne druhý slogan:

> Jeden konec prkna držel tesař. Druhý zůstal volný.

**Pro koho:** ten, kdo hledá dárek, který není z regálu · ten, kdo čte · ten, kdo chce věc, na které se podílí · ten, kdo už knihu zná a chce, co z epilogu zůstalo.
**Příležitost:** Vánoce 2026, dárek do pěti set, „něco, co se musí vzít do ruky".

Dílna řeže a čísluje. Zákazník lepí. Kdo napíše „sestavíme ho za vás", prodává jiný výrobek.

---

## 2 · Hřbet — tři beaty

V tomhle pořadí. Jinak se to rozsype.

| # | Beat | Co říct |
|---|---|---|
| 1 | **Obraz** | „Jeden konec prkna držel tesař. Druhý zůstal volný. Dítě ho vzalo — a teprve potom začal řezat." |
| 2 | **Čin** | Osm dílů, půl hodiny, dřevěné lepidlo. Svíčka do sklenice. Sirky držíš ty. |
| 3 | **Důkaz** | 3 mm bříza, 20,9 m řezu, 614 obrysů, čtyři hodiny laseru, číslovaná edice. |

Kniha, ZION Pass a bonus jsou **obsah krabice**, až pod ohybem. Kdo hledá dárek, nesmí na prvním pohledu číst kryptoměnu. Kdo už ZION zná, bonus najde u ceny.

---

## 3 · Above the fold (`/vanoce/lampion`)

Nasazeno v `christmasProducts.ts` (kicker, title, subtitle, intro). Bonus zůstává v řádku ceny, který stránka kreslí sama.

**CZ**

> **Druhá lucerna**
>
> Jeden konec prkna držel tesař. Druhý zůstal volný.
>
> Lampion Lumi 2 přijde rozložený — osm dílů z 3mm březové překližky, půl hodiny a dřevěné lepidlo. Svíčku si zapálíš sám. To je celé tajemství.
>
> **[ Chci si ho složit ]**

**EN**

> **The second lantern**
>
> The carpenter held one end of the board. The other stayed free.
>
> The Lumi 2 lantern arrives flat — eight parts in 3 mm birch plywood, half an hour and wood glue. You light the candle yourself. That is the whole secret.
>
> **[ I want to assemble it ]**

Sekundární věta, ne druhé tlačítko: *Dát ho někomu, kdo si ho složí.*

Titulek příběhu na stránce je taky **Druhá lucerna**. „Světlo, které přišlo z budoucnosti" se nepoužívá — zní jako slib energie.

---

## 4 · Karta v shopu (dlaždice)

**Název katalogu** zůstává `Lampion Království srdce — Lumi 2` (objednávka, faktura). Na dlaždici novinek a na webu je **Druhá lucerna**.

**Popis (154 znaků, bonus až u ceny)**

> Druhá lucerna. Přijde rozložená: osm dílů z 3mm břízy, půl hodiny, dřevěné lepidlo. Svíčku zapálíš sám. 20,9 m řezu, čtyři hodiny laseru, číslovaná edice.

**EN (149 znaků)**

> The second lantern. It arrives flat: eight birch parts, half an hour, wood glue. You light the candle. 20.9 m of cuts, four hours of laser, numbered.

---

## 5 · Jeden film, tři popisky

Jeden 15s záběr. Tři texty nad ním. Všechny vedou na `/vanoce/lampion`.

| Čas | Obraz | Text na obrazovce |
|---|---|---|
| 0–3 s | krabice, ploché díly | „Vypadá to jako prkna." |
| 3–8 s | ruce skládají nasucho | „Osm dílů. Půl hodiny." |
| 8–12 s | svíčka do sklenice, vršek | „Svíčku zapálíš sám." |
| 12–15 s | tma, jen výřezy | „Druhá lucerna." |

**A — řemeslo**
> Dvacet metrů řezných drah. Šest set čtrnáct obrysů. Čtyři hodiny laseru. A pak osm dílů, které složíš za půl hodiny.
> Druhá lucerna · číslovaná vánoční edice.

**B — příběh**
> „Jeden konec prkna držel tesař. Druhý zůstal volný. Dítě ho vzalo — a teprve potom začal řezat."
> Z toho prkna je lampion, který si složíš sám.

**C — dárek**
> Hledáš dárek, který není z regálu?
> Dej ho někomu, kdo si ho složí. Osm dílů, půl hodiny, dřevěné lepidlo. Číslovaná edice, baleno jako dárek.

**Headline:** `Druhá lucerna` · **CTA:** `Chci si ho složit`

### Google Search (30 / 90 znaků)

| Headline (≤30) | |
|---|---|
| `Druhá lucerna` | 13 |
| `Sestav si vlastní lucernu` | 26 |
| `Číslovaná vánoční edice` | 24 |

| Description (≤90) | |
|---|---|
| `Osm dílů, půl hodiny, dřevěné lepidlo. Svíčku zapálíš sám.` | 60 |
| `20,9 m řezu, 4 hodiny laseru. Doručení Zásilkovnou, rozložené.` | 64 |

---

## 6 · Sociální sítě

**Instagram — popisek k filmu**

Řemeslo:
> Osm dílů. Půl hodiny. Dřevěné lepidlo.
> Dvacet metrů řezu a čtyři hodiny laseru — a pak už jen svíčka, kterou zapálíš sám.
> Druhá lucerna · číslovaná edice · odkaz v biu.

Příběh:
> Jeden konec prkna držel tesař. Druhý zůstal volný.
> Dítě ho vzalo. A teprve potom začal řezat.
> Druhá lucerna.

Dárek:
> Nedávej věc, která už je hotová.
> Dej osm dílů někomu, kdo si je složí. Půl hodiny, dřevěné lepidlo, a pak světlo.
> Druhá lucerna · baleno jako dárek.

**X / Threads**
> Většina dárků se za rok zapomene. Tenhle si obdarovaný musí nejdřív složit.
> Osm dílů. Půl hodiny. Svíčku zapálí sám.

---

## 7 · E-mail

**Předměty**
1. Osm dílů a jeden večer
2. Jeden konec zůstal volný
3. Nejdřív si ho složíš. Teprve pak svítí.
4. Druhá lucerna
5. Dárek pro někoho, kdo si ho složí

**Preview:** `Půl hodiny práce a pak už jen světlo.`

**Tělo čtenářům knihy (obraz)**

> Dobrý den,
>
> v epilogu zůstane krátké prkno a dítě, které ho drží. Z toho prkna je lampion.
>
> Přijde rozložený. Osm dílů z březové překližky, půl hodiny, dřevěné lepidlo. Hotový by stál na polici. Rozložený si ho musíte vzít do ruky. Svíčku zapálíte sami — a to je celé tajemství.
>
> Až bude stát, podívejte se pod dno. Vzkaz není návod. Ten už nebudete potřebovat.
>
> **[ Chci si ho složit ]**

**Tělo na konci sezóny (dar)** — jen s datem, které dílna opravdu drží. Bez data se předmět „Stihne to Vánoce?" neposílá.

> Dřevo odchází ze dílny rozložené, Zásilkovnou, zabalené jako dárek. Kniha a ZION Pass přijdou e-mailem hned a na dřevo nečekají. Poslední odeslání před Vánoci: **[datum, až ho dílna řekne]**.

Bonus, kniha a Pass se v těchto dopisech nejmenují v první větě. Jsou v potvrzení objednávky a na řádku ceny.

---

## 8 · Námitky a odpovědi

| Námitka | Odpověď |
|---|---|
| „490 Kč za kus dřeva?" | Za 490 Kč je lampion, který si složíš, kniha (40 knih, 5 jazyků) a ZION Pass. Jeden kus je 20,9 m řezu a 4 hodiny laseru — než se vůbec začne lepit. Bonus je na řádku ceny. |
| „Bude to hořet?" | Je to dřevo a otevřený plamen, proto má lampion skleněnou vložku a proto jsou v balení bezpečnostní body, které se podepisují u pokladny. Kde jsou děti nebo zvířata, dejte LED — svítí skoro stejně. |
| „Je to nějaká magie?" | Ne. Je to řemeslo a příběh. Svíčku zapálíte sami — a to je celý trik. |
| „Proč to není složené?" | Složené byste jen obdivovali. Rozložené si zapamatujete. Dílna řeže a čísluje. Lepíte vy. |
| „Stihne to Vánoce?" | Digitální část (kniha, Pass, peněženka) přijde e-mailem hned. Dřevo má vlastní den — řekneme ho, až ho dílna zná. Bez data termín neslibujeme. |
| „Je to vonné? Meditativní? Léčivé?" | Není. Je to lucerna. |

---

## 9 · Jak rámovat cenu

- **Řádek ceny:** 490 Kč. Bonus 70 560 ZION je na tom řádku a v seznamu „v ceně", ne v titulku.
- **Rozklad, až když se někdo ptá:** lampion + kniha (40 knih, 5 jazyků) + ZION Pass. Samotná kniha v e-shopu stojí 216 Kč.
- **Hodnota práce:** 20,9 m řezu, 614 obrysů, 4 h laseru. Dílna řeže a čísluje; zákazník lepí.
- **Srovnání:** dárek do pěti set, který se nedá koupit v supermarketu.
- **Nikdy:** „levné", „výhodné", „poslední kusy!" bez reálného stavu skladu.

---

## 10 · Co se nikdy neříká

| Nepoužívat | Proč |
|---|---|
| „magický", „požehnaný", „nabitý energií z budoucnosti", „světlo, které přišlo z budoucnosti" | z řemesla dělá relikvii |
| „ochrání domov / přinese štěstí / uzdraví" | neplatný nárok; u ohně navíc nebezpečný |
| „vyrobil ho Ježíš" | Písmo o tom nemluví; správně „v příběhu ho vyrobil tesař" |
| „sestavíme ho v dílně" / „hotový výrobek" | odporuje příběhu i návodu; lampion přijde rozložený |
| „stihneme Vánoce" bez data odeslání | slib, který neumíme doručit |
| „poslední kusy", pokud sklad opravdu není poslední | ztráta důvěry |
| bonus v první větě | čísla patří obchodu, ne příběhu |
| zkrácené bezpečnostní body | zákazník podepsal jiný text (`FIRE_CONSENT_VERSION`) |

---

## 11 · CTA

1. Chci si ho složit
2. Dát ho někomu, kdo si ho složí
3. Chci světlo, které si zapálím sám
4. Přidat do košíku — 490 Kč

„Nakoupit s bonusem" a „Objednat s knihou a Passem" patří na kampaň celého trhu, ne na první větu lampionu.

---

## 12 · Karta pod dno

Vzkaz patří pod dno, ne na web. Kdo ho najde navrchu, čte reklamu. Kdo ho najde po půlhodině lepení, čte předání. Text je v [`01-Vzkaz.md`](./01-Vzkaz.md) a [`04`](./04-Texty-Pro-Prodej.md) §A.

**Tisk (dílna, ne kód)**

- Formát 85 × 55 mm, dvě strany, karton, který přežije lepidlo a sklenici.
- Líc: Jan 12,35, označený jako Písmo („volně"), a věta Lumi: „Nehledej jiné světlo. To, které máš, stačí na jeden krok. Jdi — a pak ho předej."
- Rub: `Lumi 2 · Království srdce` a prázdný řádek **Od koho**, aby se karta dala předat.
- Věta na obalu, ne na kartě: *Tělo se opotřebí. Světlo ne.*
- Karta leží pod dnem, návod navrchu. Nesmí opakovat bezpečnostní body z `fire-safety.ts`.

---

## 13 · Kalendář do 24. 12.

Tři dějství. Žádné „poslední kusy", dokud sklad opravdu není poslední.

| Kdy | Co |
|---|---|
| **8.–24. 11. Obraz** | Film (popisek B) a jedna fotka ve tmě, jen výřezy, bez ceny. E-mail čtenářům knihy: „Z toho prkna v epilogu je lampion." |
| **25. 11.–10. 12. Řemeslo** | Popisek A. Čísla: 20,9 m, 4 h, číslo kusu. Pořád bez bonusu v první větě. |
| **11.–24. 12. Dar** | Popisek C. „Dej ho někomu, kdo si ho složí." E-mail s datem odeslání, až ho dílna zná. Kniha a Pass jdou hned; dřevo má vlastní den. |

---

## 14 · Jedna věta na závěr

> **Prodáváme lucernu, kterou si člověk složí sám, protože věc, kterou složíš vlastníma rukama, přestane být zbožím.**

*Navigace:* [← Šest stěn](./05-Sest-Sten.md) · [Index](./00-README.md)
