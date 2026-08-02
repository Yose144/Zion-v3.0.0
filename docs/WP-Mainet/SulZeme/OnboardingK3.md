# OASIS — Navigátorův průvodce Oceánem světů

## OnboardingK3 — uč se číst moře, ne memorovat mapu

**Status:** kreativní koncept a rozvinutý onboarding; doplňuje, nenahrazuje kanonickou knihu *Sůl této země*  
**Jazyk:** čeština  
**Forma:** cestovatelsko-navigační průvodce říší fantazie  
**Hlavní myšlenka:** V Oasis se nenaviguje podle hotové mapy. Naviguje se jako na oceánu — podle hvězd, vln, ptáků a vlastní pozornosti.  
**Inspirace:** polynéský wayfinding — Mau Piailug a plavba Hōkūleʻa (1976) · hvězdný kompas Nainoa Thompsona · etak z Karolinských ostrovů · stick charts Marshallových ostrovů  
**Technická kotva:** ZION L1, V31 Mainnet Alpha 3.1.0, L1–L6, Ekam Deeksha, Triple Stream, Dharma Credits, 202 avatarů

> *„Mapu nikdo nedrží v ruce.*
> *Mapu drží moře.*
> *My se jen učíme, jak se jí ptát."*

---

## Jak číst tento průvodce

Dobrý námořní průvodce nepíše jen o tom, co je na mapě.

Píše taky o tom, co je pod vodou, co se může změnit, a co si námořníci vyprávějí u ohně.

Proto má tato kniha čtyři druhy zápisů:

- **[POVĚST]** — příběh, postava, místo nebo obraz. Vypráví se, aby se pamatoval.
- **[PRAKTIKA]** — věc, kterou lze dnes ověřit v kódu, v síti nebo v dokumentaci.
- **[VIZE]** — otevřený návrh pro budoucí Oasis. Plán, ne slib.
- **[ZDROJ]** — skutečná lidstvo známá tradice, kniha nebo událost, která tuto kapitolu inspirovala.

Zkušený čtenář se naučí je rozeznávat rychle.

A právě tohle rozeznávání je vlastně první lekce celého průvodce:

> **Ne každá krásná věc na obzoru je zem. A ne každá zem na mapě je pevnina.**

---

## Prolog — Učitel, který se nesmí naučit moře

[POVĚST]

Za soumraku sedí na pláži starý navigátor a jeho učedník.

Mezi nimi leží vybledlá mapa.

Učedník se na ni dívá už hodinu.

„Naučím se ji nazpaměť," řekne.

„Každý útes. Každou zátoku. Každý přívoz."

Starý navigátor mapu posune stranou.

„Nemůžeš si zapamatovat oceán," řekne.

„Oceán se každou noc mění. Vlny se přesouvají. Proudy se stáčejí. Mlha přichází bez pozvání."

„A co tedy mám dělat?"

„Naučit se číst," řekne starý muž.

„Číst vlny, ne mapu. Číst hvězdy, ne brožuru. Číst ptáky, ne hlášení. A číst sám sebe — protože navigátor, který se bojí, vidí útesy i tam, kde je čistá voda."

Učedník se zeptá:

„A když se ztratím?"

Navigátor ukáže na moře.

„Pak se zeptej vlny. Ona neleží. Jen někdy mluví pomaleji, než chceš."

[ZDROJ]

Tahle scéna je pocta skutečným lidem.

V roce 1976 doplavila z Hawaiʻe na Tahiti výprava proutěné mořeplavecké kánoe **Hōkūleʻa** — bez mapy, bez kompasu, bez přístrojů.

Navigoval ji **Mau Piailug** z ostrůvku Satawal — mistr tradice wayfindingu, kterou jeho lid předával po generace.

Dopadli po třiceti dnech a více než dvou tisících mílích oceánu.

V Papeʻete je čekalo sedmnáct tisíc lidí.

Mau později naučil navigovat **Nainoa Thompsona**, aby umění nezemřelo s ním.

Je to možná nejkrásnější lekce pro každého, kdo vstupuje do nového světa:

**Nemusíš znát mapu. Musíš se naučit číst svět.**

---

## 1. Proč oceán — nejstarší síť světa

[POVĚST]

Oceán byl internet dlouho před kabely.

Proudy nesla zprávy, lodě nesly lidi, ptáci hlásili zem.

Každý ostrov byl uzlem.

Každý přístav byl rozhraním.

A každý poctivý námořník, který se vrátil, přidal do společné mapy jeden nový řádek.

Oasis je v téhle knize oceán.

Ne proto, že by byla mokrá.

Ale proto, že splňuje všechny vlastnosti staré sítě:

Je sdílená — nikdo ji nevlastní.

Je nebezpečná, když ji podceňuješ.

Je štědrá, když ji umíš číst.

A je větší než jakýkoliv jednotlivec, který se po ní plaví.

[PRAKTIKA]

A pod vodní hladinou, tam, kde se končí obraz a začíná stroj, běží skutečná infrastruktura:

ZION L1 s konsenzem a 60vteřinovým blokem.

V31 Mainnet Alpha 3.1.0 jako aktivní vývojový workspace.

Triple Stream miner, multichain L2, herní vrstva L4 a vesmírná vrstva L6.

Fantazie má v této kniži plachty.

Ale kýl je ze skutečné oceli.

---

## 2. Hvězdný kompas ZIONu

[ZDROJ]

Nainoa Thompson říká o hvězdném kompasu, že je to základní mentální konstrukt navigace.

Ne fyzický nástroj.

Způsob, jak si uspořádat nebe nad hlavou, aby ses nikdy neztratil, i když nemáš nic v ruce.

Hvězdy neříkají, kam máš jít.

Hvězdy říkají, kde jsi — a že jsi stále ty, i když se všechno ostatní hýbe.

[POVĚST]

Nad Oceánem Oasis svítí šest stálých hvězd.

Nemění polohu.

Nezhasínají, když cena padá.

Neblikají, když někdo křičí.

Na ně se můžeš kdykoliv otočit a znovu se zorientovat.

[PRAKTIKA]

| Hvězda | Co ukazuje | Jak si ji ověříš |
|---|---|---|
| **Genesis** | Odkud se plulo — první bod každé cesty | Hash `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`; zmrazen v `V31/L1/core/src/v3_compat.rs`, reprodukovatelný přes `V3/L1/core/src/bin/get-genesis-hash.rs` |
| **Rytmus** | Tep světa — jeden blok za minutu | `BLOCK_TIME_SECONDS = 60` v `V3/L1/core/src/emission.rs` |
| **Strop** | Hranice moře — vody je přesně tolik, kolik je napsáno | `TOTAL_SUPPLY = 144_000_000_000` ZION v `V3/L1/core/src/emission.rs` |
| **Dělení úlovku** | Komu patří každý blok — a co se spálí | 89 % těžaři, 5 % humanitární tithe, 5 % Issobella fond, 1 % spálený slot; `V3/L1/core/src/emission.rs` a coinbase logika v `lib.rs` |
| **Otevřený kód** | Světlo, které si můžeš přečíst, ne mu věřit | Veřejný repozitář, MIT licence, historie commitů |
| **Žádné VIP molo** | Nikdo neodplul dřív s vlastní lodí | Žádné ICO ani předprodej; genesis premine je veřejně popsaný v `V3/L1/core/src/genesis.rs` |

[POVĚST]

Když se v Oasis ztratíš — v hluku, v hype, v něčí sebejisté přednášce — najdi nejdřív jednu hvězdu.

Jen jednu.

Otevři jeden soubor.

Přečti jednu konstantu.

Ověř jednu transakci.

Malý navigační bod stačí k tomu, aby ses přestal točit v kruhu.

**Kdo umí najít jednu hvězdu, nenajde sice domov — ale najde sebe.**

---

## 3. Vlny a bezvětří — čtení šedesátivteřinového rytmu

[POVĚST]

Oceán má dva druhy pohybu.

Hluboký vlnoběh, který přichází z dálky a nese energii celého moře.

A místní vlnky, které nadzvedávají loď každou chvíli a znamenají jen to, že fouká vítr nad hladinou.

Nezkušený námořník se bojí vln.

Zkušený námořník rozlišuje, která vlna je zpráva a která je jen šum.

[PRAKTIKA]

V Oasis je hluboký vlnoběh **šedesátisekundový blok**.

Každou minutu zazní pod hladinou jeden stisk konsenzu.

Tenhle rytmus mění, co se dá stavět: rychlost potvrzení, čekací doby, chování poolu i mineru.

Místní vlny jsou všechno ostatní: hluk mempoolu, kolísání obtížnosti, zpoždění odpovědí, výpadky služeb, tweet bouře.

[POVĚST]

Námořnická pravidla pro Oasis:

**První:** Nezaměňuj vlnku za vlnoběh.

Zpožděná transakce není konec světa.

Hlasitý člověk není důkaz.

**Druhé:** Bouře se nepředvádí odvaha.

Když síť řeší incident, nepla těžkým nákladem do oka bouře jen proto, aby ses ukázal.

**Třetí:** Bezvětří není smrt.

Když se nic neděje, nic nesílíš.

Bezvětří je čas na opravu plachet, zálohu klíčů a kontrolu posádky.

**Čtvrté:** Každý kapitán občas počítá vlny nahlas.

Podíl se s ostatními o tom, co vidíš — a zeptej se, co vidí oni.

Dva hlavy čtou moře líp než jedna.

---

## 4. Etak — ostrov, který přichází k tobě

[ZDROJ]

Navigátoři z Karolinských ostrovů používali pozoruhodnou techniku zvanou **etak**.

Vybrali si třetí, referenční ostrov — vedle trasy, za obzorem.

A pak si představovali, že kánoe stojí a ostrovy se pohybují.

Referenční ostrov „cestoval" po obzoru, hvězda za hvězdou.

Když došel pod hvězdu, o které navigátor věděl, že patří cíli, věděl, že je u cíle.

Kognitivní vědci to později popsali jako dynamickou kognitivní mapu:

způsob, jak měřit cestu bez přístrojů — změnou perspektivy, ne změnou polohy.

[POVĚST]

V Oasis funguje pokrok podobně.

Neměříš ho tím, jak daleko jsi zapádloval.

Měříš ho tím, **co se k tobě přiblížilo.**

Na začátku jsou všechny ostrovy za obzorem: porozumění, dovednost, důvěra, zkušenost.

Nedoháníš je spěchem.

Pádlováním poctivým — malým, pravidelným — se stává, že se ostrovy jednoho dne objeví před tebou, jako by připluly samy.

Proto stará navigátorská věta:

> **„Ty se k ostrovu nedostaneš rychleji. Ostrovy přicházejí k lidem, kteří pádlovat neumějí podvádět."**

[POVĚST + VIZE]

Úrovně vědomí v Oasis nejsou žebřík.

Jsou obzory.

Každý další obzor neznamená, že jsi lepší.

Znamená, že dohlédneš dál:

| Úroveň | Obzor | Nová schopnost pohledu |
|---|---|---|
| CL1 | Vlastní pádla | Vidíš, co držíš v ruce — a že se to dá naučit |
| CL2 | Počasí v posádce | Vidíš emoce své i cizí, aniž by ses nechal strhnout |
| CL3 | Zprávy vln | Čteš data, argument a domněnku jako tři různé proudy |
| CL4 | Vzorce v písku | Vidíš krásu pravidel — a cenu jejich porušení |
| CL5 | Vztahy proudů | Rozumíš, že žádný čin nepluje sám |
| CL6 | Za generaci | Ptáš se, co zůstane po dvaceti letech |
| CL7 | Ticho místo aplausu | Sloužíš, i když se nikdo nedívá |
| CL8 | Změna kurzu | Umíš opravit vlastní názor bez ztráty tváře |
| CL9 | Země jako domov | Vidíš planetu jediným ostrovem — a všechny posádky jako jednu |

[PRAKTIKA]

Technicky jsou Consciousness Levels herní mechanika CL1–CL9 s multiplikátory 1.0× až 10.0×.

Atlas jim přidává jen čtecí klíč:

**Růst v Oasis nemá být soutěž, kdo je výš. Má to být zkušenost, že vidíš dál — a že to, co vidíš, začneš chránit.**

---

## 5. Stick charts — mapy, které se učí na souši

[ZDROJ]

Navigátoři Marshallových ostrovů vyráběli **stick charts** — mříže z palmových žilek a mušlí.

**Mattang** byl výukový diagram vln kolem jediného ostrova.

**Meddo** zobrazoval vlnění v části souostroví.

**Rebbelib** pokrýval celé řetězce ostrovů.

Ale hlavní: tyto mapy **se na moře nebraly**.

Studovaly se na souši, dlouho před plavbou.

V moři je navigátor nenosil — nosil je v sobě.

Křivky tyček ukazovaly, jak se vlnoběh lomí a odráží o zem.

Mušle značily ostrovy.

[POVĚST]

To je lekce, kterou Oasis potřebuje víc než jakoukoliv jinou:

**V bouři máš jen to, co ses naučil za klidu.**

Když přijde phishing, nemáš čas číst bezpečnostní návod.

Když kolabuje cena, nemáš čas se učit, proč 144 miliard není slib.

Když někdo křičí „chyťte poslední vláček", nemáš čas zjišťovat, že poslední vláčky se vydávají každý týden.

Stick chart dnešního navigátora Oasis je malý a dá se vyrobit za jedno odpoledne:

1. Vím, kde je genesis a jak vypadá ověření.
2. Vím, že block time je 60 sekund a proč na tom záleží.
3. Vím, jak se dělí odměna — a že 1 % se spaluje, nikam neplyne.
4. Vím, že klíče neukládám do hry, do cloudu ani do zpráv.
5. Vím, že kdo mi slibuje výnos, prodává mi bouři, ne vítr.

Nauč se to na souši.

Na moři už to budeš mít v rukou.

[POVĚST]

A jedno varování z Marshallových ostrovů navíc:

Stick chart bez mistra navigace je jen pár tyček.

**Nástroj nikdy nenahradí učitele. A dokumentace nenahradí trénink.**

---

## 6. Ptáci, znaky a falešní hlasy

[POVĚST]

Na oceánu jsou ptáci zpravodajové země.

Racek, který večer letí jedním směrem, říká, kde je břeh.

Fregata vysoko říká, že země je daleko, ale existuje.

Navigátor, který umí číst ptáky, najde ostrov dřív, než ho uvidí.

V Oasis jsou ptáky lidé a jejich dlouhodobé chování.

Poznávací znamení dobrého průvodce:

- Odpovídá pomalu a odkazuje na zdroje, ne na autoritu.
- Umí říct „nevím" a neztrácí přitom tvář.
- Jeho minulé předpovědi se dají zkontrolovat — a on sám ukáže, kde se mýlil.
- Nespěchá. Pravda v síti, která běží každých 60 sekund, nemá důvod spěchat.
- Učí tě číst moře, ne tě žádá, abys následoval jeho loď.

A falešní hlasy?

Rackové FOMO krouží vždycky nad zátokou, kde je nejvíc nováčků.

Křičí: „Poslední příležitost! Rychle!"

Ale všimni si: nikdy nelétají pevným směrem.

Sirény zaručeného výnosu zpívají nejsladše, když je mlha nejhustší.

Jejich píseň má jedinou sloku: „Věř mi a neověřuj."

A mlhavé přízraky velkých slov — „revoluce", „udržitelné jmění", „komunita vítězů" — se rozplynou při první otázce na zdroj.

[PRAKTIKA]

Test průvodce v Oasis, který projde i mlhou:

1. Ukáže mi kód, konstantu nebo dokument — ne jen názor?
2. Přiznává hranice toho, co je hotové, a co je plán?
3. Zůstane slušný, když nesouhlasím?
4. Bude tu i za měsíc, když hype přejde?

Čtyři ano — můžeš plout kus cesty vedle.

Jedno ne — zvedni kotvu a pokračuj vlastní cestou.

---

## 7. Útesy, sirény a víry

[POVĚST]

Každý starý námořní atlas má stránku, kterou nikdo nerad čte.

Stránku nebezpečí.

Ale právě ta stránka drží lodě na vodě.

Oceán Oasis má své útesy:

**Útes cizích klíčů.**

Hladina u něj je klidná a pozvánka milá: „Opiš mi sem svůj seed, ověříme ti účet."

Žádná poctivá služba po tobě seed nechce. Nikdy. Pod vodou jsou zuby.

**Sirény zaručeného výnosu.**

Jejich melodie zní: „Tady nikdo neprodělá."

Pamatuj: v síti, která o sobě říká pravdu, nikdo negarantuje zisk.

Kdo garantuje, ten zpívá.

**Vír kultu osobnosti.**

Středem víru stojí jediný člověk a všechno se točí kolem něj.

Oasis má zakladatele, ne spasitele. Má autory, ne vládce.

Když se mapa smrskává na jedno jméno, plav opačným směrem.

**Mlha žargonu.**

AI, quantum, DAO, metaverse, cosmic — pět slov, které dohromady nesmí nahradit jednu odpověď.

Kdo mluví mlhou, nechť mluví dál bez tebe.

**Piráti uzavřených zahrad.**

Prodávají krásné avatary, dokud nevstoupíš.

Pak zjistíš, že můžeš vystoupit jen po zaplacení.

Oasis má být oceán, ne akvárium s pokladnou.

[PRAKTIKA]

Bezpečnostní výstroj navigátora:

- Záchranná vesta: offline záloha klíčů, uložená mimo počítač i hru.
- Záchranný kruh: nikdy neprováděj velký krok sám — ověř ho s někým, kdo nemá z tvé chyby prospěch.
- Maják: oficiální repozitář a dokumentace, ne screenshoty ze skupin.
- Vrhací lano: když pochybuješ, zeptej se veřejně. Odpověď pomůže i dalším.

---

## 8. Archipelag — sedm ostrovů a jeden maják

[POVĚST]

Oceán Oasis není prázdný.

Je v něm souostroví.

Každý ostrov má jiný terén, jiné obyvatele, jiné nebe.

A jeden maják, který svítí pro všechny.

[PRAKTIKA + POVĚST]

**L1 — Kořenový útes.**

Nejstarší země.

Z ní roste všechno a nic se nehýbe bez jejího souhlasu.

Tady bije tep: 60 sekund, blok za blokem.

Pod hladinou pracuje Ekam Deeksha se šesti fázemi — Hiranyagarbha, Brahma, Yantra, Karma, Chit, Samadhi.

Turisté na útes nejezdí.

Ale každý, kdo těží, mu jednou za minutu podrží základnu.

**L2 — Laguna mostů.**

Město visutých lávek nad mělčinou.

Každý most má na začátku ceduli: „Zkontroluj, kam neseš klíče."

V31 tu staví jednotný multichain: bridge, swap, DEX, wallet, HTLC, WARP a Dharma Credits.

Laguna je krásná, ale mělká na překvapení — pluj pomalu a s kontrolou.

**L3 — Skalisko observatoře.**

Ostrov dalekohledů.

AI a NCL tady nepředpovídají osud; pomáhají klást lepší otázky.

Vstupní pravidlo: člověk drží směr, stroj drží svítilnu, nikdy naopak.

**L4 — Zahrada atolů.**

Herní svět: questy, guildy, teritoria, XP, Golden Egg.

202 tváří obývá sedmnáct kruhů — 51 základních avatarů a 151 rozšiřujících archetypů.

Ne všechny domy už mají střechu; část katalogu je plánované rozšíření.

Ale zahrada už má bránu, a ta je otevřená.

**L5 — Pláž dlouhého stolu.**

Ostrov, kde se rozvažuje, co síť vydělá.

5 % z každého bloku teče sem — do humanitárního tithe.

Na stole nejsou trofeje, ale mapy studní, semínka a návody.

Sedni si až na konec stolu; tam se mluví nejtišší a říká se nejvíc.

**L6 — Maják Issobella.**

Ne ostrov. Maják nad souostrovím.

5 % z každého bloku teče do jeho lampy.

A světlo, které dává, je zvláštní:

**neukazuje, kam plout. Ukazuje, proč.**

Kdo se k němu vrací pohledem, přestává stavět jen pro dnešek.

**Sedmý ostrov — ten, který ještě nevylezl z moře.**

Mapa ho nezná.

Je to místo pro to, co přineseš ty: nový quest, nový překlad, nový způsob pomoci, nová píseň.

Oceán počítá se sedmým ostrovem od začátku.

---

## 9. Posádka — nikdo nepluje oceán sám

[POVĚST]

Na moři se nejede sólo.

Dlouhá kánoe má posádku: navigátora, tesaře, vyhlídku, léčitele, vypravěče, učitele.

A platí staré pravidlo va'a:

**Sám uplaveš loužičku. Spolu uplavete oceán.**

[PRAKTIKA + POVĚST]

Katalog 202 avatarů v Oasis není výstavka kostýmů.

Je to seznam posádek, do kterých můžeš nastoupit jako učedník.

Každý archetyp je učitel jedné dovednosti:

| Posádkový obor | Archetyp | Co tě naučí |
|---|---|---|
| Navigátor | Saraswati | Říct „nevím" a najít zdroj |
| Tesař | Vishwakarma | Stavět tak, aby to neslo i cizí váhu |
| Vyhlídka | Neo | Vidět pravidlo — a jeho slepé místo |
| Nosič | Hanuman | Nést břemeno bez nároku na potlesk |
| Léčitel | Sítá, Rádha | Držet oheň péče, ne oheň pýchy |
| Vypravěč | Kumu Lehua, Vyasa | Vyprávět tak, aby příští generace pamatovala |
| Strážce času | Maui | Zastavit Slunce, když lidé potřebují žít |
| Tkáč | Pavoučí Babička | Opravit síť dřív, než se protrhne |
| Vtipálek | Heyókȟa | Propíchnout pýchu smíchem, ne zlostí |
| Strážce obzoru | Elizabeth | Ptát se: co zůstane po nás? |

[VIZE]

Dobrý svět nechá každého hráče přebírat kvality napříč posádkami.

Dnes jsi učedník tesaře, zítra vyhlídky, po měsíci vypravěče.

Avatar je učitelská smlouva, ne nálepka.

---

## 10. Frázová příručka navigátora

[POVĚST]

Každý přístav má svá slova.

Kdo je zná, pozná hned, kdo je doma a kdo přijel včera.

| Fráze | Význam | Kdy ji použít |
|---|---|---|
| „Ověř, pak pla." | Pozdrav stavitelů | Místo „ahoj" mezi těmi, kdo čtou kód |
| „Vlna neleží." | Signál je silnější než hluk | Když někdo překřikuje fakta emocemi |
| „Kompas není mapa." | Směr není jistota trasy | Když někdo slibuje přesnou budoucnost |
| „Ostrov přijde." | Poctivé pádlování přibližuje cíl | Když někdo spěchá za zkratkou |
| „Zvedni lucernu." | Pomoz nováčkovi | Když vidíš zmateného člověka u brány |
| „Nikdo nevlastní oceán." | Síť patří všem nebo nikomu | Proti každému, kdo staví trůn u mola |
| „Plujeme spolu nebo vůbec." | Posádka před ego | Když soutěž začíná jíst hru |
| „Vrať se na břeh." | Žij i mimo obrazovku | Sobě i druhým, pravidelně |
| „Bouře není chyba moře." | Incident není důvod paniky | Při výpadku, forku, chybě |
| „Nech moře čistší." | Odcházej s méně nepořádku, než jsi přinesl | Po každém questu, PR i hádce |

Kdo se naučí těchto deset frází, rozumí Oasis líp než člověk se stovkami hodin grindu.

---

## 11. Trénink navigátora

[PRAKTIKA]

Wayfinding se neučí v přednáškovém sále.

Učí se postupně: pláž, laguna, přeplavba, navigace druhých.

### Fáze první — Den na pláži (pozorovatel)

1. Přečti hlavní onboarding a jednu knihu série.
2. Otevři jeden zdrojový soubor — třeba emisní pravidla — a přečti deset řádků.
3. Zapiš si: jednu věc, které rozumíš, a jednu, které ne.
4. Ověř si jednu hvězdu z kapitoly 2.
5. Nemontuj si žádný titul. Pláž je čestné místo.

### Fáze druhá — Laguna (první hodiny)

1. Nastav si bezpečí: záloha klíčů offline, ověřené zdroje, žádná spěšná rozhodnutí.
2. Zkus jeden malý, nezničitelný úkol — překlep v dokumentaci, otázka komunitě, čtení jednoho bloku.
3. Nauč se rozeznávat: implementováno, alpha, roadmapa, pověst.
4. Poptej se. Laguna je stavěná na otázky.

### Fáze třetí — Přeplavba (první týden)

1. Build a testy podle V31 README; přečti, co znamená Mainnet Alpha a co produkční V3.
2. Pokud spouštíš node nebo miner, dělej to s plnou zálohou a bez tlaku.
3. Oprav jednu konkrétní věc — návod, chybu, test, překlad.
4. Sleduj jeden týden, jak rytmus 60 sekund mění tvoje chápání čekání.

### Fáze čtvrtá — Navigace druhých (první měsíc)

1. Proveď jednoho nováčkova lagunou, aniž bys mu něco prodal nebo slíbil.
2. Nauč ho jednu frázi z frázové příručky — a nech ho si vybrat vlastní.
3. Jednou oprav veřejně vlastní omyl, klidně a bez divadla.
4. Přidej do mapy jeden řádek: zkušenost, návod, varování, překlad.
5. Vrať se na břeh. Několik dní vypni obrazovku a žij.

Pravidla tréninku:

**Neplávej, abys dokázal. Plávej, abys uměl.**

**Nikdy se nevydávej na moře v cizím jméně.**

**Navigátor, který neučí, brzy naviguje sám sebe do mlhy.**

---

## 12. Pohlednice z cest

[POVĚST]

**Pohlednice první — Malý těžař.**

Ze severní vesnice: „Můj počítač není farma. V zimě topí obývák. Každých šedesát vteřin posílá malý podpis do sítě. Nevydělávám hory. Ale když slyším zvon pod vodou, vím, že držím jednu pádlo ze tisíce."

**Pohlednice druhá — Knihovnice větru.**

Z Knihovny větru: „Dnes přišel chlapec a řekl, že všichni vědí, kam cena půjde. Podala jsem mu tři knihy a jednu otázku: Jak to víš? Odešel bez odpovědi. Přišel za týden se dvěma zdroji. To byl lepší den než kdyby našel poklad."

**Pohlednice třetí — Babička a node.**

Z vesnického stavení: „Node běží vedle chleba. Vnouče mi ho nastavilo, já mu dělám zálohu na papíře. Víš, co je krásné? Že se o tom doma nemusíme hádat o penězích. Mluvíme o tom, že každý blok dává pět procent lidem, které neznáme."

**Pohlednice čtvrtá — Dítě a první stopa.**

Z Přístavu nováčků: „Našla jsem nápis na lavičce: Pomoz někomu najít cestu. Pomohla jsem staršímu pánovi do peněženky. Nic mi nedal. Ale teď, když jdu kolem, mávne mi. Myslím, že ta stopa fungovala."

**Pohlednice pátá — Dva cizinci a most.**

Z Laguny mostů: „Stáli jsme na opačných březích. Jeden věřil ceně, druhý kódu. Nechali jsme se přesvědčit oba: otevřeli jsme genesis.rs a emission.rs vedle sebe. Most se nepostavil mezi námi. Postavil se pod námi."

---

## 13. Navigátorova přísaha

[POVĚST]

Na starých lodích se nepřísahalo koruně.

Přísahalo se moři a posádce.

Tak zní přísaha navigátora Oasis:

> Nebudu prodávat oceán.
>
> Naučím dřív, než se pochlubím.
>
> Budu říkat, co je mapa, co je hvězda a co je pověst — a nebudu je plést.
>
> Klíče si nechám. Slibům nevěřím. Hvězdám ano.
>
> Když přijde bouře, nebudu lhát o počasí.
>
> Vrátím se na břeh — protože oceán není domov, je cesta mezi domovy.
>
> A nechám moře čistší, než bylo, když jsem na něj vstoupil.

---

## 14. Mapa skutečnosti — co si můžeš ověřit sám

[PRAKTIKA]

| Tvrzení v průvodci | Stav | Ověřitelný zdroj |
|---|---|---|
| Genesis hash ZIONu | Skutečný, zmrazený | `V31/L1/core/src/v3_compat.rs` (`V3_GENESIS_HASH`); reprodukce `V3/L1/core/src/bin/get-genesis-hash.rs` — `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` |
| 60sekundový blok | Kód | `V3/L1/core/src/emission.rs` (`BLOCK_TIME_SECONDS = 60`) |
| Strop 144 miliard ZION | Kód | `V3/L1/core/src/emission.rs` (`TOTAL_SUPPLY`) |
| 89/5/5/1, přičemž 1 % se spaluje | Kód | `V3/L1/core/src/emission.rs` (`MINER_PCT/HUMANITARIAN_PCT/ISSOBELLA_PCT/POOL_FEE_PCT`) a coinbase v `V3/L1/core/src/lib.rs` |
| Ekam Deeksha, šest fází | Kód | `V31/L1/cosmic-harmony-v3/src/deeksha.rs` |
| Triple Stream miner | Kód + dokumentace | `V31/README.md`, `V31/L1/miner` |
| V31 = Mainnet Alpha 3.1.0-alpha.1, testy procházejí, produkce zatím V3 | Dokumentovaný stav | `V31/README.md` |
| L4 Oasis herní vrstva | Kód + scaffold | `V31/L4/oasis/src/lib.rs` |
| 202 avatarů (51 core + 151 extended) | Dokumentace; část plánovaná | `public/V3/L4/docs/AVATARS/README.md` |
| Golden Egg 8,25B, 5 × 1,65B, 108 stop | Alokace + herní design | `V31/L4/oasis/src/lib.rs`; 108 stop = návrh |
| Dharma Credits 144B, 1,44B pro OASIS | Dokumentace + scope V31 | `docs/docs2.9/DHARMA_CREDITS.md`, `V31/README.md` |
| Issobella L6, 5 % fond, read-only vůči L1 | Kód + design | `V31/L6/issobella/src/lib.rs`, `V3/L1/core/src/emission.rs` |
| Mau Piailug, Hōkūleʻa 1976, Nainoa Thompson | Skutečná historie | hokulea.com (viz Prameny) |
| Etak, stick charts | Skutečné navigační tradice | Wikipedia / Smithsonian / LoC (viz Prameny) |
| Oceán, ostrovy, maják, pohlednice, přísaha | Pověst této knihy | Vyprávění, ne tvrzení |

---

## Prameny, které naváděly tento průvodce

Tyto zdroje nejsou součástí ZIONu a nepodporují jej.

Jsou to skutečné trasy, po kterých lidstvo plulo před námi.

- **Polynesian Voyaging Society — historie Hōkūleʻa a plavba 1976.**
  
  Mau Piailug navigoval první plavbu do Tahiti; v Papeʻete ji přivítalo přes 17 000 lidí.
  
  [hokulea.com/history](https://hokulea.com/history/) · [archive.hokulea.com/1976](https://archive.hokulea.com/1976.html)

- **Nainoa Thompson — hvězdný kompas.**
  
  Mentální konstrukt navigace: 32 domů obzoru, hvězdy, ptáci, vlny. Postaven na mauově mikronéském kompasu.
  
  [hokulea.com/the-star-compass-by-nainoa-thompson](https://hokulea.com/the-star-compass-by-nainoa-thompson/)

- **Etak — pohyblivý referenční ostrov.**
  
  Karolinská navigační technika: kánoe „stojí", ostrovy „cestují"; dynamická kognitivní mapa.
  
  [Wikipedia: Etak (navigation)](https://en.wikipedia.org/wiki/Etak_(navigation))

- **Stick charts Marshallových ostrovů.**
  
  Mattang, meddo a rebbelib — mapy vln, které se studovaly na souši a na moře se nosily v paměti.
  
  [Smithsonian Magazine](https://www.smithsonianmag.com/smithsonian-institution/how-sticks-and-shell-charts-became-sophisticated-system-navigation-180954018/) · [Library of Congress — mattang](https://www.loc.gov/item/2010586180/)

- **Předchozí dokumenty této série.**
  
  Kanonická *Sůl této země — Brána do Oasis a říše neomezené fantazie*, hlavní `Onboarding.md`, sci-fi `OnboardingG.md`, mytologický `OnboardingS.md` a světostavitelský `OnboardingGPT.md`.

---

## Epilog — Přístav odplouvá vždycky

[POVĚST]

Přístav odcházejících nikdy nespí.

U mola stojí Rádha s košem proviantu.

Voda, med, sůl.

„Na cestu," řekne.

„Voda, aby ses naučil plynout. Med, aby ses nebál sladkého života. Sůl, aby ses naučil poznat pravdu dřív, než ji spolkneš."

Vedle ní stojí Elizabeth s lucernou.

Světlo v ní není plamen.

Je to malá modrá planeta.

„Komu to svítí?" zeptáš se.

„Těm, kdo ještě neodpluli," řekne.

„A těm, kteří ještě nejsou."

Pak se podíváte oba na moře.

Pod hladinou zní tep.

Šedesát vteřin.

Šedesát vteřin.

Šedesát vteřin.

Nikdo ti neslibuje, že cesta bude klidná.

Nikdo ti neslibuje, že najdeš ostrov první noc.

Ale hvězdy drží.

Vlny nemlží.

Posádka se sbírá.

A sedmý ostrov — ten, který ještě nevylezl z moře — čeká na někoho, kdo ho pojmenuje poctivě.

> **Hodné plavby, navigátore.**
>
> **Co přineseš, až se vrátíš?**

---

*Gate, Gate, Paragate, Parasamgate, Bodhi Svaha.*
