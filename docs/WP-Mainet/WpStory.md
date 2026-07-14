# ZION TerraNova — Strom života
## Vyprávěcí whitepaper: od práce ke péči, od kořene ke hvězdám

**Pracovní návrh · červenec 2026**  
**Verze:** Story Whitepaper / redakční základ  
**Současný stav sítě:** ZION v3.0.5, Mainnet Beta, Proof-of-Work  
**Licence:** MIT pro software; tento text je manifest a technicko-vesmírný průvodce

> *„ZION není slib, že technologie spasí člověka. Je to závazek, že člověk může technologii naučit sloužit životu.“*

---

## Jak číst tento dokument

Tento text není náhradou za technickou specifikaci. Jejím protějškem.

Technický whitepaper odpovídá na otázky **jak síť funguje dnes**: jak jsou ověřovány bloky, jak jsou chráněny klíče, jak vypadá emise, jak funguje bridge a které služby jsou v provozu. Tento dokument odpovídá na jinou, stejně důležitou otázku: **proč má taková síť existovat a jaký příběh drží její jednotlivé části pohromadě**.

ZION zároveň používá tři odlišné roviny. Nesmějí se zaměňovat:

| Značka | Rovinu čteme jako | Příklad |
|---|---|---|
| **ŽIVÉ** | ověřitelná současnost v kódu, síti nebo nasazených kontraktech | PoW L1, 60s bloky, 144B hard cap, 89/5/5/1 split |
| **ROZESTAVĚNÉ** | implementace, která existuje částečně nebo se aktivně vyvíjí | OASIS backend, WARP rozšíření, AI-native služby |
| **HORIZONT** | etický a civilizační směr, nikoli hotový produkt ani garantovaný výsledek | Proof-of-Care, L5 komunity, Issobella a hvězdný horizont |

Když tento text mluví o návratu do ráje, nemluví o útěku od reality ani o příslibu technického zázraku. Mluví o návratu k podmínkám, v nichž může život znovu prospívat: pravdivým pravidlům, sdílené odpovědnosti, půdě, vodě, znalosti, vztahům a dlouhému horizontu.

---

# Prolog — Strom, který začal jako semeno

Každý blockchain začíná malým aktem víry: někdo uvěří, že pravidla lze napsat tak, aby platila i tehdy, když se lidé neznají, nedůvěřují si nebo jsou daleko od sebe.

ZION začal ještě o krok dřív — otázkou, zda mohou být pravidla sítě navržena tak, aby odměňovala nejen výpočet, ale i odpovědnost za to, co výpočet umožní.

V prvním kroku nevznikla utopie. Vznikla práce: zdrojový kód, testy, blok, hash, podpis, uzel, těžař a pravidlo, podle něhož se síť shodne na tom, co je pravda. To je kořen stromu. Bez něj by každý další obraz byl jen poezií bez půdy.

ZION je proto nejprve síť Proof-of-Work. Těžař nabídne výpočetní práci, síť ověří, že práce splnila pravidla, a blok se stane součástí společné paměti. V Mainnet Beta běží tato síť na Rust L1, s 60sekundovým cílem bloku, Ed25519 podpisy, BLAKE3 v jádru a paměťově náročnou rodinou algoritmů Ekam Deeksha / CosmicHarmony. Je to obyčejná, přísná a nenahraditelná část příběhu: nejdříve musí existovat pravda, kterou lze nezávisle ověřit.

Ale kořen není celý strom.

Strom potřebuje kmen, který unese rozdílné větve. Potřebuje mízu, která proudí. Potřebuje listy, které zachytí světlo. A potřebuje plody, které nejsou uzamčeny pro majitele stromu, ale mohou živit krajinu kolem něj.

ZION nazývá tento obraz **Stromem života**. Není to tvrzení, že software je živý organismus. Je to disciplína návrhu: každá vrstva musí vědět, čemu slouží, co chrání, co vyživuje a jaké následky má pro lidi mimo obrazovku.

---

# I. Čtyři knihy — čtyři prameny jednoho stromu

Příběh ZIONu nestojí na jediné knize. Má čtyři prameny, které se setkávají v jednom toku.

| Kniha | Otázka | Živel | Co přináší Stromu |
|---|---|---|---|
| **Genesis** | Proč stavíme? | Oheň | záměr, jiskru, odpovědnost za první slovo |
| **Kvantová revoluce** | Co je porouchané ve starém uspořádání? | Vzduch | diagnózu, odvahu pojmenovat oddělení a extrakci |
| **Ekam Deeksha** | Co se musí proměnit v tom, kdo staví? | Voda | vnitřní kázeň, jednotu, schopnost nezopakovat starý vzorec |
| **Terra Nova** | Jak se tento záměr stane světem? | Země | architekturu, komunity, práci rukou a dlouhý horizont |

Tyto čtyři knihy nejsou čtyři marketingové produkty. Jsou čtyři zkoušky, bez nichž se projekt snadno zvrhne.

Bez **Genesis** může být kód technicky dokonalý, ale neví, komu slouží.  
Bez **Kvantové revoluce** může být vize krásná, ale nepozná mechanismy, které znovu vyrábějí nerovnost.  
Bez **Ekam Deeksha** může revoluce vyměnit správce, ale ponechat stejné ego, strach a touhu po kontrole.  
Bez **Terra Nova** zůstane vše jen v textu — bez uzlu, bez zahrady, bez školy, bez komunity, bez odpovědnosti za skutečný svět.

ZION je setkáním těchto pramenů. Ne proto, že by mohl jediný projekt vyřešit všechny problémy světa, ale protože odmítá předstírat, že technologie nemá hodnotové důsledky.

## 1. Genesis — semeno, ne zbraň

Genesis dává síti první orientaci. Každý protokol má své neměnné body: počátek, pravidla emise, způsob, jímž síť rozlišuje platný a neplatný blok. V ZIONu je tento základ nazýván konstitučním jádrem.

Jeho nejviditelnějšími čísly jsou:

- **144 000 000 000 ZION** jako hard cap;
- **60 sekund** jako cílový čas bloku;
- **89 / 5 / 5 / 1** jako protokolové rozdělení blokové odměny;
- **1 ZION = 1 000 000 flowers** jako současná atomická jednotka;
- **Proof-of-Work** jako současný konsensus.

Čísla sama o sobě nejsou morálka. Jsou však hranice. Říkají, že síť nemůže potají přidat další nabídku, že odměna nemůže být vyjednána za zavřenými dveřmi a že část hodnoty není ponechána náhodě nebo dobré vůli konkrétní firmy.

Genesis tedy není kult minulosti. Je to otázka položená každému dalšímu bloku: **zůstává síť věrná vlastnímu ústavnímu slibu?**

## 2. Kvantová revoluce — diagnóza oddělení

Druhá kniha neslouží jako technický důkaz konkrétní fyzikální teorie. Její skutečná role je civilizační: pojmenovat, že ekonomika, infrastruktura a technologie nejsou neutrální, pokud jejich pobídky systematicky odměňují extrakci, monopol nebo krátkodobost.

ZION z toho vyvozuje skromný, ale praktický závěr: decentralizace nestačí, pokud pouze decentralizuje soutěž o to, kdo vezme nejvíc. Protokol musí mít průhledná pravidla pro vznik a tok hodnoty.

Proto je v ZIONu 89 % blokové odměny určeno těžařům, kteří zajišťují síť; 5 % humanitárnímu proudu; 5 % fondu Issobella pro dlouhodobý vědecký a civilizační horizont; a 1 % je v aktuální implementaci protokolově spáleno. Nejde o charitu jako marketingovou kampaň. Jde o návrh ekonomického toku, který lze kontrolovat v kódu a na řetězci.

## 3. Ekam Deeksha — proměna stavitele

Ekam znamená jednota. Deeksha znamená zasvěcení nebo přechod. V příběhu ZIONu není toto jméno licence zaměnit spiritualitu za bezpečnostní model. Je to připomínka, že ani nejlépe napsaný protokol nemůže sám vyrobit moudrost, soucit nebo odpovědnost.

Těžební algoritmus nese stejné jméno, protože práce těžaře má být přístupná běžnému hardwaru a ověřitelná sítí, nikoli rezervovaná pro uzavřený průmysl. Paměťová náročnost a vývoj ASIC-resistance jsou technickou obranou proti koncentraci. Nejsou absolutní garancí rovnosti; jsou průběžnou snahou zabránit tomu, aby se síť změnila v privilegium několika skladů plných specializovaných strojů.

Skutečné zasvěcení zde znamená přijmout omezení: nefalšovat podpisy, neobcházet validaci, nekrást z treasury, nezaměňovat vliv za vlastnictví. V budoucích vrstvách se tato etika může promítnout do veřejných závazků validátorů — ale vždy až tam, kde existuje ověřitelný proces, možnost odvolání a technicky kontrolovatelné podmínky.

## 4. Terra Nova — země, na níž se hodnoty testují

Terra Nova je čtvrtá kniha: ne útěk do budoucnosti, ale otázka, co zůstane po našich rozhodnutích v krajině a mezi lidmi.

Zda se decentralizace projeví jen v peněžence, nebo také v přístupu ke vzdělání, vodě, energii, zdraví, znalosti a místní odolnosti. Zda se humanitární fond stane průhledným mechanismem péče, nebo jen novým názvem pro centralizovaný slib. Zda komunita dokáže rozhodovat o dlouhém horizontu bez toho, aby se proměnila v uzavřený klub.

Terra Nova proto není hotová destinace. Je to kompas: od separace k propojení, od extrakce k péči, od spotřeby ke spolutvorbě.

---

# II. Kořeny — Proof-of-Work jako první zkouška pravdy

V době, kdy se mnoho projektů snaží přeskočit rovnou k velkým slibům, ZION začíná prací, kterou musí kdokoli umět zkontrolovat.

## Práce, kterou nelze pouze prohlásit

Proof-of-Work není morální zásluha. Je to mechanismus Sybil resistance: aby někdo mohl navrhnout blok, musí provést nákladnou, měřitelnou výpočetní práci; ostatní mohou výsledek levně ověřit. Tím vzniká společná historie bez centrální účetní knihy.

Současný ZION L1 je **PoW řetězec**. To je fakt, nikoli metafora.

- Miner hledá platný nonce pro blok.
- Uzel ověřuje strukturu bloku, podpisy, transakce, Merkle závazky, výdaje i pravidla emise.
- Fork choice sleduje celkovou práci.
- Záznam je sdílen mezi uzly, nikoli svěřen jediné instituci.

Ekam Deeksha / CosmicHarmony přidává paměťově náročné kroky, jejichž cílem je zvýšit náklady na extrémně specializovaný hardware a zachovat rozumnější prostor pro CPU a GPU účast. ZION neslibuje, že žádný ASIC nikdy nevznikne. Takový slib by nebyl poctivý. Slibuje, že ASIC-resistance je aktivní návrhový cíl, měřený, testovaný a podle potřeby vyvíjený.

## Odměna jako tok, ne jako kořist

Každý blok obsahuje otázku: komu má sloužit hodnota, kterou síť právě vytvořila?

ZIONova současná odpověď je jednoduchá:

| Směr | Podíl | Účel |
|---|---:|---|
| Miner | 89 % | bezpečnost sítě, práce a provoz infrastruktury |
| Humanitární fond | 5 % | budoucí veřejně kontrolovatelná pomoc a sociální mise |
| Issobella fond | 5 % | dlouhý výzkumný, vzdělávací a civilizační horizont |
| Protocol fee share | 1 % | protokolově spáleno; nevytváří příjem soukromému provozovateli |

Toto pravidlo není náhradou dobré správy. Je jen první podmínkou, aby dobrá správa měla z čeho vycházet. Když proud hodnoty od začátku patří pouze nejsilnějším, je pozdě žádat je, aby byli velkorysí. Když je část proudu zapsána do pravidel, může komunita později diskutovat ne o tom, zda vůbec pomáhat, ale jak pomoc ověřovat, komu sloužit a jak zabránit zneužití.

## Čas jako ochrana před panikou

Bitcoinův model prudkých halvingů nahradil ZION mechanismem **Decade Decay**: základní odměna se každých deset let násobí čtyřmi pětinami. Po desátém období zůstává trvalá tail emission.

To neznamená, že ekonomika bude bez rizika. Znamená to, že síť neplánuje okamžik, kdy musí být její bezpečnost zaplacena jen transakčními poplatky. Odměna má od roku přibližně 2126 pokračovat na úrovni **724,784723 ZION za blok** podle současných ústavních konstant.

Strom, který roste sto let, nemůže být řízen jako start-up na jedno čtvrtletí.

---

# III. Kmen — ústava, paměť a důvěra, která nemusí věřit

Strom potřebuje kmen. V ZIONu je to soubor pravidel, která drží oddělené větve pohromadě a zároveň brání tomu, aby jedna větev vysála celý organismus.

## Keter — koruna kořene

V mapě Stromu života představuje Keter zdroj a neměnnou vůli. V technickém ZIONu je to konsensus, genesis, emise a hranice, na které žádná běžná politika nemá sahat bez mimořádně transparentního procesu.

Patří sem hard cap, pravidla odměny, výchozí bezpečnostní parametry a genesis hash současného řetězce:

```text
4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e
```

Genesis hash není magický symbol. Je to konkrétní kryptografická kotva. Umožňuje každému novému uzlu poznat, na jakém řetězci stojí.

## Binah — forma, která rozlišuje pravdu od přání

Žádná vize není bezpečná bez ověřování. V ZIONu validace rozhoduje, zda blok opravdu dodržel pravidla, zda podpis patří odesílateli, zda výdaj neexistuje dvakrát a zda nové mince odpovídají emisnímu plánu.

To je důležité zvlášť proto, že projekt v roce 2026 prošel skutečnou zkouškou: bezpečnostní incident a kritické chyby vedly k hard genesis resetu a k opravám podpisové i balance validace. Správný příběh není, že „síť byla vždy dokonalá“. Správný příběh je, že když byla nalezena zranitelnost, projekt ji zveřejnil, opravil, zavedl tvrdší pravidla a začal znovu na čistém základu.

Důvěra nevzniká z tvrzení, že chyba je nemožná. Vzniká ze schopnosti chybu přiznat, opravit a dát ostatním možnost opravu ověřit.

## Gevurah — hranice, které chrání dar

Každá štědrost potřebuje hranici, jinak ji pohltí ten, kdo bere nejrychleji. Proto má ZION treasury lock, multisig ochrany, časové prodlevy, fee burn a pravidla pro governance.

Gevurah neznamená trest. Znamená ochranu budoucích lidí před rozhodnutími dnešního okamžiku.

---

# IV. Míza — mosty, hodnota a spojení mnoha světů

Strom není zdravý, když živiny zůstávají jen v jednom kořeni. Musí umět nést mízu mezi větvemi, aniž by ztratil identitu.

## L2 — dávání se nesmí změnit v závislost

ZION L2 zahrnuje bridge, wZION, staking, farming, DAO a atomic swaps. V nejlepším případě jsou tyto nástroje způsobem, jak lidem dát možnost směňovat, poskytovat likviditu, spořit a rozhodovat bez jediného prostředníka.

V nejhorším případě by DeFi mohlo jen zopakovat stejné spekulativní vzorce, proti nimž se projekt vymezuje. Proto tento whitepaper neříká, že výnos je dobro sám o sobě. Výnos je nástroj. Je zdravý jen tehdy, pokud jsou rizika čitelná, smlouvy auditovatelné, rezervy dohledatelné a uživatel rozumí tomu, co podepisuje.

wZION je mostní reprezentace nativního ZIONu na EVM sítích. Není to náhrada L1 identity ani slib, že každý bridge je bezrizikový. Most je nejslabší místo mnoha ekosystémů, a proto musí být chráněn kvóry, limity, time-locky, správou klíčů a veřejným auditem.

## Tiferet — jednota bez uniformity

L3 WARP je obrazem Tiferet: srdce, které nespojuje proto, aby smazalo rozdíly, ale aby rozdílné světy mohly spolupracovat.

EVM, Solana, Stellar, Bitcoin nebo další ekosystémy nejsou stejné. Liší se bezpečností, finalitou, programovacím modelem i komunitou. WARP nemá tvrdit, že všechny rozdíly zmizely. Má je přeložit do jasných, kontrolovatelných mostních pravidel.

Jeden strom, mnoho větví. Jedna větev nemá vládnout druhé.

---

# V. Koruna — kultura, hra a učení se odpovědnosti

Kultura není ozdoba technického projektu. Je to místo, kde se ukáže, co systém skutečně odměňuje.

## OASIS — hra jako zrcadlo, ne jako útěk

L4 OASIS je rozestavěná herní a kulturní vrstva s Rust backendem, Unreal Engine 5 klientem, XP systémem, guildami, úkoly a Stromem devíti úrovní vědomí. Její role není dokazovat, že hra může měřit lidskou hodnotu. Nemůže.

Její zdravější role je nabídnout bezpečný prostor, kde se lidé učí spolupráci, dlouhé pozornosti, tvorbě, vztahu k místu a zodpovědnému zacházení s digitální ekonomikou.

Proto musí být každé budoucí propojení XP, odměn nebo „consciousness levels“ navrženo s opatrností:

- nesmí diskriminovat lidi podle víry, původu, zdravotního stavu nebo schopnosti trávit čas online;
- nesmí předstírat objektivní měření vědomí;
- nesmí proměnit péči v soutěž o status;
- musí mít jasně oddělené herní body, skutečné finance a governance pravomoci.

OASIS může být školou spolupráce. Nemá být soudem nad člověkem.

## Zlaté vejce jako obraz potenciálu

Dřívější Kniha Zrození používá obraz Hiranyagarbhy — zlatého vejce, které nese potenciál světa. Tento obraz může zůstat součástí kultury ZIONu, ale ve vyprávěcím whitepaperu je třeba být přesný: žádná budoucí soutěž, odměna ani treasure hunt nemá být prezentována jako jistý ekonomický nárok, dokud není její fond, pravidla, právní podmínky a bezpečnost skutečně zveřejněna a ověřena.

Symbol vejce je silnější než přehnaný slib. Připomíná, že potenciál musí dozrát, projít péčí a teprve pak se může otevřít.

---

# VI. Strom života — mapa odpovědnosti, ne hierarchie lidí

Sefirot v ZIONu nejsou náhrada software architektury ani nástroj, kterým by se posuzovala duchovní hodnota uživatelů. Jsou pracovní mapou, která klade každé vrstvě otázku: **co v organismu chráníš, co vyživuješ a za co neseš odpovědnost?**

| Sefira | Otázka | ZIONový protějšek | Stav |
|---|---|---|---|
| **Keter** | Co je neměnné? | L1 consensus, genesis, emise | ŽIVÉ |
| **Chokmah** | Co je tvořivá práce? | PoW, ASIC-resistance, NPU experimenty | ŽIVÉ / ROZESTAVĚNÉ |
| **Binah** | Co je pravdivé? | validace, chain state, bezpečnostní pravidla | ŽIVÉ |
| **Chesed** | Jak proudí štědrost? | staking, farming, humanitární tok | ŽIVÉ / ROZESTAVĚNÉ |
| **Gevurah** | Co musí zůstat chráněno? | treasury lock, multisig, fee burn | ŽIVÉ |
| **Tiferet** | Jak je mnoho jedním? | WARP, bridge, interoperabilita | ROZESTAVĚNÉ |
| **Netzach** | Co pečuje vytrvale? | AI-native monitoring, Hiran, care-proofs | ROZESTAVĚNÉ / HORIZONT |
| **Hod** | Jak se hodnoty stanou kulturou? | OASIS, vzdělávání, veřejná komunikace | ROZESTAVĚNÉ |
| **Yesod** | Kde síť zakoření? | L5 komunity, péče o půdu a vztahy | HORIZONT |
| **Malkhut** | Kam se vize manifestuje? | Issobella, výzkum a hvězdný horizont | HORIZONT |
| **Da'at** | Kdo propojuje mýtus s kódem? | tvůrci, komunita, dokumentace, audit | ŽIVÉ jako závazek |

Tato mapa nesmí být používána jako žebříček, v němž je někdo „výše“ než druhý. Strom potřebuje kořen stejně jako korunu. Bez lidí, kteří provozují uzly, testují software, překládají dokumentaci, uklízejí chyby, pomáhají nováčkům nebo pečují o konkrétní místo, by žádná vize neměla tělo.

---

# VII. Od Proof-of-Work k Proof-of-Care

## Co ZION dělá dnes

Dnes ZION používá Proof-of-Work. Síť nevaliduje lidskou dobrotu, meditaci, názor ani duchovní přesvědčení. Nemá to dělat.

Je to zdravá hranice. Konsensus musí být ověřitelný bez nutnosti svěřit někomu moc rozhodovat, kdo je „dost vědomý“, „dost morální“ nebo „dost pečující“. Taková moc by byla zneužitelná a odporovala by samotnému cíli decentralizace.

## Co znamená Proof-of-Care jako horizont

**Proof-of-Care (PoC)** není v tomto dokumentu oznámení změny současného konsensu. Je to designový horizont: způsob, jak může síť v budoucnu odměňovat *ověřitelnou užitečnou péči* vedle nebo nad samotnou výpočetní prací, aniž by se pokusila měřit nitro člověka.

PoC může být legitimní pouze tehdy, když splní nejméně těchto sedm podmínek:

1. **Ověřitelnost** — úkol nebo důkaz musí být nezávisle kontrolovatelný, nikoli založený na tvrzení autority.
2. **Dobrovolnost** — nikdo nesmí být nucen prokazovat osobní víru, zdravotní údaje nebo soukromý život.
3. **Soukromí** — citlivá data se nesmí stát cenou za účast.
4. **Odolnost vůči manipulaci** — péče nesmí být jednoduše vyráběna pomocí botů, falešných identit nebo klientelismu.
5. **Nezachytitelnost elitou** — pravidla nesmí vyžadovat drahé zařízení, přístup k instituci nebo osobní známost.
6. **Odvolatelnost a transparentnost** — každý spor musí mít veřejně popsaný proces, auditní stopu a možnost opravy.
7. **Oddělení od L1 bezpečnosti** — dokud není model extrémně prověřený, PoC nesmí oslabit PoW bezpečnost jádra.

## První realistické kroky

Cesta k péči nemá začít změnou konsensu. Má začít užitečnými, měřitelnými službami:

- monitoring dostupnosti uzlů a bridge relayerů;
- detekce anomálií, podvodných vzorců a bezpečnostních incidentů;
- ověřování integrity smart kontraktů a governance návrhů;
- transparentní evidence grantů, humanitárních výdajů a jejich výsledků;
- přístupné vzdělávání a dokumentace;
- komunitní reporty o infrastruktuře, vodě, energii či zdraví, ovšem pouze s ochranou soukromí a nezávislým ověřením.

NPU inference, AI monitoring a „care proofs“ jsou proto v dnešní architektuře výzkumné a rozestavěné prvky. Mohou se jednou stát podkladem pro Protokol Péče; dnes však nesmí být vydávány za dokončený konsensus ani za objektivní měření dobra.

## Zásada, která chrání budoucnost

> *ZION nemá rozhodovat, kdo je dobrý člověk. Má pomáhat lidem vytvářet a ověřovat dobré podmínky pro společnou práci.*

To je rozdíl mezi technologickou teokracií a technologií ve službě lidské důstojnosti.

---

# VIII. Návrat do ráje — nikoli zpět, ale kupředu

Slovo „ráj“ bývá nebezpečné, když znamená místo bez konfliktu, bez odpovědnosti a bez práce. Takové místo neexistuje.

V příběhu ZIONu znamená ráj něco střízlivějšího a náročnějšího: stav, v němž se životní systémy obnovují rychleji, než je ničíme; v němž člověk nemusí volit mezi přežitím a důstojností; v němž znalost není vlastněna několika branami; v němž technologie nezakrývá vztah člověka k půdě, vodě, druhým lidem a budoucím generacím.

Návrat do ráje proto není návrat do minulosti. Je to návrat ke schopnosti pečovat o základní podmínky života — s nástroji, které máme dnes.

V této větě se setkávají L1 a L5:

- L1 chrání pravdivost a pravidla, aby hodnota nemusela záviset na jedné instituci.
- L2 a L3 hledají způsoby, jak hodnota a informace mohou proudit přes hranice.
- L4 učí kulturu spolupráce a zkouší, zda digitální svět umí tvořit, nejen spotřebovávat.
- L5 má jednou ukázat, zda se princip péče dokáže projevit v konkrétních místech a životech.
- L6 drží dlouhý horizont — ne jako marketingový termín, ale jako otázku, zda se civilizace umí dívat dál než k příštímu zisku.

Ráj se nedeklaruje. Ráj se staví, opravuje, zalévá, auditujeme a sdílí.

---

# IX. Cesta od kořene ke hvězdám

## Dnešní cesta: síť, kterou lze ověřit

V Mainnet Beta je úkolem projektu především být poctivý v malých věcech:

- provozovat stabilní a bezpečné L1 uzly;
- zvyšovat počet nezávislých peerů a minerů;
- opravit chyby dříve, než škodí;
- zveřejňovat bezpečnostní incidenty a jejich nápravy;
- držet dokumentaci ve shodě s kódem;
- dokončit nezávislé audity;
- neslibovat likviditu, výnos ani funkce, které nejsou skutečně dostupné.

To je první forma péče. Není okázalá. Je opakovatelná.

## Blízký horizont: mosty, komunita, otevřené znalosti

Pokud L1 obstojí, může se ekosystém rozšiřovat. Bridge a DeFi musí nejprve prokázat bezpečnost; ZionDex musí být transparentní v likviditě a cenách; OASIS musí být bezpečný pro hráče; AI nástroje musí být auditovatelné a nesmí předstírat autoritu, kterou nemají.

Komunita má být více než publikum. Má být spolusprávcem dokumentace, překladů, testování, vzdělávání, incident response a budoucích rozhodnutí.

## Vzdálený horizont: komunity a Issobella

L5 Free World a L6 Issobella jsou horizonty. Nejsou potvrzenou budoucností ani investičním příslibem. Jsou měřítkem, které klade dnešnímu rozhodnutí otázku: **pomáhá toto rozhodnutí budovat schopnost péče i za deset, padesát a sto let?**

L5 znamená, že projekt jednou musí být hodnocen podle reálného dopadu na komunity, ne podle počtu sloganů.  
L6 znamená, že lidský horizont může být větší než současný trh — ale jen tehdy, pokud jsou nejdřív vyřešeny základní povinnosti na Zemi.

Ke hvězdám se nemá utíkat před odpovědností za domov. Ke hvězdám se má růst z dobře opečovaného domova.

---

# X. Závěrečné slovo — žádný spasitel, jen společná práce

ZION není náhradou politiky, vědy, komunity ani osobní odpovědnosti. Není náboženstvím, které by mělo rozhodovat o lidském svědomí. Není investičním slibem. A není hotovou Novou Zemí.

Je to pokus o infrastrukturu: veřejnou paměť, otevřená pravidla, odolnější tok hodnoty a dlouhodobý kompas. Jeho cena nebude určena tím, jak silně zní jeho příběh, ale tím, zda jeho kód, jeho komunita a jeho skutky zůstanou ve vzájemné shodě.

Čtyři knihy dávají tomuto úsilí směr:

- **Genesis** připomíná, že každý systém začíná záměrem.
- **Kvantová revoluce** připomíná, že staré pobídky vytvářejí staré výsledky.
- **Ekam Deeksha** připomíná, že stavitel se musí proměňovat spolu se stavbou.
- **Terra Nova** připomíná, že smysl má jen to, co lze nakonec žít, sdílet a předat.

A Strom života dává praktickou otázku pro každý commit, každý blok, každý grant a každý most:

> **Posiluje to kořeny? Nese to mízu spravedlivě? Chrání to kmen? Dává to prostor životu?**

Pokud ano, může ZION růst.

Ne jako dokonalý strom.  
Jako strom, který se umí vracet k péči.

---

## Technická příloha — současné ověřitelné body (v3.0.5)

| Parametr | Stav |
|---|---|
| Konsensus | Proof-of-Work (Nakamoto), Ekam Deeksha v2 / Deeksha Lite V1 |
| Protokol | `zion-v3-node/3.0.5` |
| Genesis hash | `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` |
| Total supply | 144,000,000,000 ZION |
| Genesis premine | 16,780,000,000 ZION |
| Jednotka | 1 ZION = 1,000,000 flowers |
| Základní bloková odměna | 5,400.067 ZION |
| Cílový čas bloku | 60 sekund |
| Emise | Decade Decay, −20 % každých 5,256,000 bloků |
| Tail reward | 724.784723 ZION / blok po desetileté degressi |
| Split odměny | 89 % miner / 5 % humanitární / 5 % Issobella / 1 % protocol burn |
| Mainnet stav | Mainnet Beta; veřejný launch cíl 31. 12. 2026 |

## Redakční zdroje tohoto návrhu

### Primární současná technická pravda

- `V3/docs/ZION_Mainnet_Whitepaper_v3.0.5_Canonical.md`
- `StatusV3.md`
- `3.0.5.md`
- `V3/L1/core/src/emission.rs`
- `docs/3.0.5/CONTRACT_ADDRESSES.md`

### Vyprávěcí a filosofická osa

- `docs/WP-Mainet/ZION_Kniha_Zrozeni_v3.0.pdf` — tón, kapitoly o zrození, Ekam Deeksha, Decade Decay, Zlatém vejci a šesti vrstvách; historický dokument, jeho stará čísla a termíny nebyly bez ověření přeneseny do současných tvrzení.
- `docs/TerraNova/README.md`
- `docs/TerraNova/FINAL/01-MOST.md`
- `docs/TerraNova/FINAL/02-KOSMOLOGIE.md`
- `docs/Zohar/01-SEFIROT-VRSTVY.md`
- `V3/L5/docs/GOVERNANCE/sefirot-vow.md`

### Důležité redakční rozhodnutí

Starší PDF `WHITEPAPER_ZION_TOKEN.pdf` / `WHITEPAPER_ZION_TOKEN_CZ.pdf` obsahují historický presale, původní multi-chain/PoS narativ, zastaralé termíny a jiná čísla jednotek. Nejsou zdrojem současných technických nebo ekonomických tvrzení. Zachovávají pouze historický kontext vývoje vize.
