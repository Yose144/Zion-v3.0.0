# 5 · Uzel, který není bod

## Příběh

Přišel písař. Měl v ruce seznam a v seznamu čísla, protože písaři mají vždycky seznam a vždycky čísla.

*„Dvanáct pozemských uzlů,"* řekl. *„Třináctý na vodě. Měsíc nad nimi. Když teď přidáte flotilu, jaké číslo dostane? Čtrnáct?"*

Navigátor mu seznam nevzal.

*„Uzel není číslo,"* řekl. *„Uzel je místo, kam se dá vrátit. Číslo je jen to, jak si je počítá ten, kdo tam nebyl."*

Písař chvíli psal a pak zvedl hlavu: *„Takže je to uzel?"*

*„Je to uzel, který není bod,"* řekl navigátor. *„Jako archa. Akorát archa je čára po vodě a flotila je čára nahoru."*

A pak to vysvětlil tak, jak se vysvětlují jen věci, které se nedají napsat do tabulky:

Dvanáct pozemských uzlů jsou **piny**. Máš je na mapě, dáš na ně prst a řekneš: tady. Archa je **linie** — nemá pin, protože pluje; kdybys ji přibil na jedno místo, přestala by být archou. Matrix je **zrcadlo** — nedrží zem, drží obraz země, a proto je na Měsíci a ne na mapě.

A flotila? Flotila je **osa**. Svislá čára, ne vodorovná. Začíná v LUMI, končí v Issobelle, a mezi tím není prázdno — mezi tím je cesta. Kdo ji zakreslí do mapy jako bod, zakreslí si ji špatně: buď ji položí na pevninu (a ta loď tam není), nebo ji položí na dráhu (a ten bod se každou hodinu posune).

*„Takže do L5 nepatří,"* řekl písař pomalu.

*„Do L5 patří svým spodním koncem,"* řekl navigátor. *„Do L6 svým horním. Kdybych si měl vybrat, kam ji zapíšu, zapíšu ji tam, kde je víc místa pro to, co ještě neexistuje."*

*„A to je?"*

*„Nebe."*

Písař položil pero a udělal jednu věc, kterou dělají jen dobří písaři: **nenapsal číslo.** Napsal do seznamu řádek bez pořadí — *L6 · Nebeská flotila · pohyblivý uzel, neregistrováno* — a pod něj malým písmem: *„spočítá se, až bude co počítat."*

Když odešel, dítě se zeptalo: *„A jak poznáme, že to uzel opravdu je?"*

Navigátor ukázal na lucernu na konci rámu.

*„Až zhasne a bude muset někdo dojít nahoru, aby ji zapálil. Dokud se najde někdo, kdo dojde, je to uzel. Až se nenajde, bude to jen těžký kus kovu, který se točí kolem planety — a takových už kolem Země pár je."*

## Co to znamená

**Nebeská flotila je uzel L6, ale není to čtrnáctý bod.** Rozdíl není slovíčkaření:

| Vrstva | Co drží | Jak se pozná na mapě | Kolik |
|---|---|---|---|
| **L5** | povrch — zahrady, chrámy, lidé | 12 pinů na pevnině | 12 |
| **L5** | voda — archa (pohyblivý uzel) | **žádný pin** — linie na hladině | 1 |
| **L6** | nebe — stanice Issobella (prstenec) | dráha, ne bod | 1 |
| **L6** | nebe — **Nebeská flotila** (pohyblivý uzel) | **žádný pin** — svislá osa mezi LUMI a Issobellou | tento svazek |
| **—** | Měsíc — Matrix (zrcadlo) | selenografické souřadnice, ne pozemské | 1 |

Z toho plynou tři věci, které platí i pro budoucí aplikaci:

1. **Na Zemi se nic nemění.** Dvanáct pozemských uzlů zůstává dvanáct; archa zůstává na vodě; Matrix zůstává na Měsíci. Flotila nepřidává pin — přidává **trasu**.
2. **Flotila se kreslí tam, kde se hýbe.** Ve scéně patří do prostoru mezi Novou Zemí a stanicí, ne na povrch. Kdyby se objevila na pevnině, byla by to lež o dva řády.
3. **Registr není číslo.** Zápis `nabukano` (stav `vision`, 0 ZION) neříká „čtrnáctý". Říká „uzel, který se počítá, až bude co počítat."

A poslední věc, kterou tahle kapitola dluží čtenáři: **flotila není nový svět.** Je to obsluha osy, kterou korpus pojmenoval už dřív — *„jedno jméno drží dole zahradu a nahoře nebe"* ([Lumi 08–09](../Lumi/00-README.md)). Kniha tedy nepřidává mýtus. Přidává **čtvrtý trup k třem, které už měly jméno, a dok, který jim chyběl.**

## Z Písma a tradice

- **Gn 28,12** — žebřík mezi zemí a nebem jako místo setkání, ne jako bod na mapě.
- **Sk 17,28** — *„v něm žijeme, hýbeme se a jsme"*; uzel, který se hýbe, není v korpusu protimluv — je to starý obraz vztahu, ne majetku.
- **Korpus** — *„osmý bod sítě, který není bod, ale linie"* ([Nirvana · Epizoda 13](../nirvana/13-Tres-Marias.md)); *„jak nahoře, tak dole"*, dvanáct pozemských uzlů a jejich obraz na Měsíci ([MATRIX.md](../../../docs/3.3/MATRIX.md)); Lumi jako jediná **svislá** čára kompasu ([Lumi 00](../Lumi/00-README.md)).
- **Korpus** — stanice Issobella je HORIZONT s roadmapou 2030–2045+; žádný modul neexistuje ([Issobella 10](../Issobella/10-Kotva-Pravdy-a-Hranice.md)).

## Kotva pravdy

| Co v kapitole je | Stav |
|---|---|
| Dvanáct pozemských pinů + archa (bez pinu) + Matrix (zrcadlo) | **Korpus** — `freeworld-sites`: `body: 'ocean'` a `body: 'moon'` znamenají žádný pin na glóbu |
| Flotila jako **svislá osa** mezi LUMI (L5) a Issobellou (L6) | **VIZE / PŘÍBĚH** — obraz této knihy |
| Zápis do L6, ne mezi pozemské uzly | **NÁVRH** — `nabukano`, stav `vision`, **neregistrováno**, 0 ZION |
| „Uzel je místo, kam se dá vrátit" | **PŘÍBĚH** — definice této knihy, navazující na archu |
| Lucerna, která zhasne a musí se zapálit | **PŘÍBĚH** — obraz údržby vztahu, ne technický postup |
| Že flotila existuje, létá nebo je registrovaná | **NETVRDÍME** — nic z toho není |

---

*Tady svazek nekončí; jen se vrací na začátek — k jménu, které bylo poníženo, a k lodi, která veze lidi domů.*

- [→ Zpět na rejstřík](./00-README.md)
- [→ Připojení k Issobelle](./06-Pripojeni-k-Issobelle.md)
- [→ Jméno na kýlu: Království srdce](../KralovstviSrdce/00-README.md)
- [→ Osa: Lumi — Cesta domů](../Lumi/00-README.md)
- [→ Nebe: Issobella — Kniha Nebe](../Issobella/00-README.md)
- [→ Co už pluje: Tres Marías](../nirvana/13-Tres-Marias.md) · [Archa](../nirvana/14-Archa.md)
