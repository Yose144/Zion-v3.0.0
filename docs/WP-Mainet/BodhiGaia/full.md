# BODHI GAIA — Kapitola 1: Semeno a sůl
## Jak se sůl smlouvy stala semenem — a proč 5 % z každého bloku nikdo nemusí schválit

> *„Sůl chrání, co už je. Semeno tvoří, co ještě není. Smlouva, která má přežít potopu, potřebuje obojí."*

---

## Příběh

Prvního večera na Terra Nova, když už hořel oheň v Domě Lumi a na stole ležela miska hrubé soli, přišla k ohni žena v zeleném šatu s věncem z polního kvítí. Poutníci ji znali z příběhů — říkali jí **Sítá**, Matka Země, ta, která v Sůl této země šla s Rámou a Hanumanem po cestě nevyšlapané.

Nesedla si k ohni. Klekla si k prahu, kde končila podlaha z cedrových trámů a začínala holá hlína Nové země. Vzala hrst soli ze stolu a hrst hlíny z prahu a držela je vedle sebe v otevřených dlaních.

*„Vidíte?"* řekla. *„Tohle je sůl. Nesli jste ji od Galilejského jezera. Chrání chléb před zkázou, dává chuť vodě a je znamením smlouvy. Ale sůl nikdy nic nevypěstuje. Když ji zasadíte, půda umře."*

Pak otevřela druhou dlaň. V hlíně leželo jediné tmavé semeno. Nikdo nevěděl, odkud ho má — někteří říkali, že ho nesla z archy, jiní, že ho našla na břehu mezi kameny.

*„A tohle je semeno. Nechrání nic. Je to nejzranitelnější věc na světě. Ale jediné umí udělat to, co sůl nikdy neumí: z jednoho udělat tisíc."*

Tesař, který stavěl Dům Lumi, se zeptal: *„Co s ním chceš udělat?"*

*„Zasadit ho. Ne tady u ohně, kde je teplo a bezpečno. Venku. Do země, která ještě nikdy nedala úrodu."*

*„A kdo se o něj bude starat, když odejdeme dál na západ stavět mosty a chrámy?"*

Sítá se usmála. *„Proto jsem přišla. Chci, abychom si dali slib, který nezávisí na tom, kdo si co pamatuje. Z každého kusu chleba, který kdy tato země upeče, se odloží malý díl — ne pro krále, ne pro chrám, ne pro obchodníka. Pro zemi samotnou. Pro vodu, strom a semeno. A ten díl se odloží **dřív**, než někdo vůbec stihne rozhodnout, jestli se mu dnes chce dávat."*

*„Jak velký díl?"*

*„Pět z každé stovky. Pět pro zemi, pět pro hvězdy, jedno pro ty, kdo hlídají cestu. Zbytek tomu, kdo chléb upekl."*

Tesař se dlouho díval do ohně. Pak vzal dláto a do horního trámu nad dveřmi, hned vedle zlatého paprsku protínajícího vlnu, vyřezal malé semeno s kořínkem. *„Aby to nikdo nemohl přepsat, až zapomeneme, proč jsme to slíbili."*

Té noci Sítá zasadila semeno na svahu pod domem. Nikdo z poutníků nevěděl, co z něj vyroste. Ale všichni věděli jedno: **od teď každý blok chleba nese kus země v sobě.**

Ráno, když vyšli z domu, viděli, že na svahu zůstala Sítá sedět celou noc. Ne aby semeno hlídala — to nešlo. Aby ho **viděla**. *„Semeno nepotřebuje strážce,"* řekla, když k ní přišli. *„Potřebuje svědky. Věci, na které se nikdo nedívá, umírají potichu."*

A tak vznikla první z protokolů Země: **nic, co se dává zemi, se nesmí dávat potichu.**

---

## Co to znamená

**Kapitola 1 je o jediné technické větě, která drží celou vrstvu L5: 5 % z každého vytěženého bloku ZION patří humanitárnímu fondu Země, a to je zapsáno v konsensu L1 — ne v rozpočtu, ne ve stanovách, ne v dobré vůli.**

Rozdíl mezi solí a semenem je rozdíl mezi dvěma modely dobročinnosti:

| Model „soli" (starý svět) | Model „semene" (ZION L5) |
|---|---|
| Dar se rozhoduje *po* vzniku hodnoty. Někdo musí chtít. | Podíl se odděluje *při* vzniku hodnoty. Nikdo nemusí chtít. |
| Závisí na dárcích, kampaních a náladě trhu. | Závisí pouze na tom, zda síť produkuje bloky. |
| Tok je viditelný jen správcům fondu. | Tok je viditelný komukoliv s block explorerem — každý blok, každý výstup. |
| Sůl chrání, co už existuje (kapitál dárce). | Semeno tvoří, co ještě není (studna, strom, mesh). |

Konkrétně:

1. **Coinbase každého bloku má pevné výstupy.** Výstup 0 patří těžaři (89 %), výstup 1 humanitárnímu fondu L5 (5 %), výstup 2 vědeckému fondu L6 Issobella (5 %) a výstup 3 — po aktivaci — poolu odměn pro provozovatele uzlů (1 %; před aktivací je tento díl spálen). Toto pořadí není zvyk; je to kód v `v3_template.rs`.
2. **Adresa fondu je kanonická a veřejná.** `zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8` je zakódována v jádru (`v3_compat.rs`), v CLI (`zion node start --human`), v dashboardu i na webu. Žádný operátor ji nemůže tiše vyměnit bez změny konsensu.
3. **Semeno potřebuje svědky, ne strážce.** Proto L5 nezačíná výplatami, ale **trackerem**: služba `zion-free-world` čte každý blok a eviduje, co do fondu přiteklo. Pro 3.2.0 bylo rozhodnuto (gate G10), že L5 běží jako *read-only fund tracker + DAO proposal bridge* — fond roste, ale žádná služba L5 nemá klíč k tomu, aby z něj sama něco odeslala. To není nedostatek. To je první protokol Země: *nic se nedává potichu*.
4. **Dávat dřív, než se rozhodne.** Tím, že je podíl oddělen konsensem, mizí nejčastější selhání humanitárních systémů: únava dárců. Síť, která těží, dává. Síť, která přestane těžit, přestane dávat — a to je poctivé; nikdo neslibuje víc, než blok dokáže vytvořit.

> **Přesnost místo patosu:** při dnešní výši subsidy ~5 400,067 ZION jde do fondu Země ~270,003 ZION na blok, přibližně každých 60 sekund. Nikdo neví, jakou to bude mít cenu. Víme jen, kolik ZIONu to je a kam to jde.

---

## Kotva pravdy — ověřitelná fakta

> Semeno z příběhu má v síti přesný protějšek: jeden výstup v každém coinbase.

| Prvek příběhu | Stav | Co je na síti ZION ověřitelné | Co ještě chybí |
|---|---|---|---|
| **„Pět z každé stovky pro zemi"** | **ŽIVÉ** | Emisní split 89 / 5 / 5 / 1 v `V31/L1/core/src/emission.rs` a `v3_template.rs`; výstup `coinbase_humanitarian` v každém nativním bloku, viditelný přes `getBlockByHeight` → `transactions[].outputs`. | Nic — je v konsensu. |
| **„Aby to nikdo nemohl přepsat"** | **ŽIVÉ** | Kanonická L5 adresa `zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8` je hard-coded v `V31/L1/core/src/v3_compat.rs`; totéž v `docs/PREMINE_ADDRESSES_PUBLIC.txt`, `HARD_RESET_PLAYBOOK.md`, dashboardu a webu `/l5-free-world`. | Změna adresy = změna konsensu (třída D v protokolu změn). |
| **„Semeno potřebuje svědky"** | **ŽIVÉ** | `zion-v31-free-world.service` active na Edge (`127.0.0.1:8095`), skenuje L1 coinbase každých 60 s; `GET /api/v1/fund/balance`, `GET /metrics`; nginx `/api/free-world/` (operator-only). | Veřejný portál s živým grafem toků; nezávislý audit skeneru proti explorer datům. |
| **„Nic se nedává potichu"** | **ŽIVÉ** (rozhodnutí) | Gate G10: žádná automatická výplata z L5; spend pouze přes DAO návrh → hlasování → timelock → guardian multisig (`docs/3.2/L5_L6_ACTIVATION_PLAN.md`). | DAO UI/UX pro L5 návrhy; DAO exekuce dnes nestaví ani nevysílá výplatní transakci (`V31/L2/dao/src/runtime.rs` — summary-only). |
| **„Jedno pro ty, kdo hlídají cestu"** | **STAVBA** | Node reward 1 % je v kódu s `node_reward_activation_height = u64::MAX` (default vypnuto); před aktivací je díl spálen. | Konkrétní activation height a on-chain evidence 4-výstupového coinbase. |
| **„Kus země v každém bloku chleba"** | **ŽIVÉ** (číslo je dynamické) | Každý blok přidá ~270 ZION do fondu; celkový zůstatek se čte z chainu (explorer `/explorer`, adresa fondu), ne z této stránky. | Historická čísla v starších textech (např. „přes 23 600 plateb") jsou snímky v čase — vždy ověřit `getStatus`/explorer. |
| **Sítá, tesař, semeno z archy** | **MÝTUS** | Archetypy ze Sůl této země (ep. 4 a 10). | — |

> **Známý rozpor k opravě:** kapitola 6 knihy TerraNova ([`06-L5-SVOBODA.md`](../../TerraNova/06-L5-SVOBODA.md)) uvádí historických **10 %** do humanitárního fondu. Kanonický split je **5 % L5 + 5 % L6**; TerraNova kapitola je historický text a musí být označena nebo opravena (viz [kap. 9](./09-Kotva-Pravdy-a-Hranice.md)).

---

*→ Pokračování: [Kapitola 2 — Tři stromy, jedna zahrada (L5 Free World)](./02-Tri-Stromy-Jedna-Zahrada.md)*

---

*[Zpět na index Knihy Země → `00-README.md`](./00-README.md)*

# BODHI GAIA — Kapitola 2: Tři stromy, jedna zahrada
## Kořen, kmen a koruna — L5 Pentagram jako architektura, ne jako dekorace

> *„Strom nevyroste na jednom místě najednou. Nejdřív kořen ve tmě, pak kmen, který vydrží vítr, a teprve nakonec koruna, která nese plody. Kdo chce korunu bez kořene, dostane květinu ve váze."*

---

## Příběh

Ze semene, které Sítá zasadila pod Domem Lumi, nevyrostl jeden strom.

Když se poutníci po roce vrátili ze západu — od mostů WARP a od Zlatého lůna Hiranyagarbha — našli na svahu tři sazenice. Rostly z jednoho kořene, ale každá jinam: jedna k moři, jedna k horám a jedna k vodě, která stékala ze svahu do zátoky.

Sítá nebyla nikde. Místo ní seděl u sazenic **Hanuman** — Služebník Života, ten, kdo v Sůl této země stavěl most a v Prvním světě Oasis rozdával desátek chudým. Přinášel vodu ve dvou vědrech a zaléval všechny tři stejně.

*„Proč tři?"* ptal se tesař.

*„Protože země není jedna,"* odpověděl Hanuman. *„Tam dole u moře je půda písčitá, slaná a větrná. Kdo tam chce žít, musí umět pracovat v hlíně a číst vlny. Nahoře v horách je půda z popela sopky — teplá, úrodná, ale mlčenlivá; kdo tam chce žít, musí umět mlčet. A tam v zátoce je půda, která polovinu roku nepatří nikomu, protože ji bere moře; kdo tam chce žít, musí umět plout bez mapy."*

*„Takže tři zahrady."*

*„Tři **místa**. Jedna zahrada. Kořen, kmen, koruna. Kdo přijde poprvé, přijde k moři — tam je brána, práce, jídlo a lidi, kteří ho naučí držet motyku. Kdo potřebuje víc než motyku, půjde do hor — tam je ticho, ze kterého se lidé vrací jiní. A kdo už ví, kdo je, půjde k vodě — tam se učí, jak vést kánoi, ve které nikdo není kapitán."*

Tesař se rozhlédl po třech sazenicích. Byly malé. Žádná z nich nebyla ani do pasu.

*„A kdy z toho bude strom?"*

Hanuman postavil vědra na zem. *„Až přestaneš tuhle otázku klást a začneš nosit vodu."*

Té zimy poutníci poprvé pochopili, co znamenala Sítina věta o svědcích. Sazenice k moři přežila, protože ji lidé chodili denně zalévat — byla nejblíž domu. Sazenice v horách přežila, protože tam pršelo. Sazenice u vody přežila jen tak tak: dvakrát ji vzala voda a dvakrát ji někdo znovu zasadil o kus výš.

Na jaře vyryl tesař do trámu nad dveřmi vedle semene tři malé čárky. Kořen, kmen, koruna. Země, oheň, voda.

---

## Co to znamená

**L5 Free World není jeden projekt. Je to síť fyzických komunit, které sdílí protokoly, ale liší se místem, rolí a energií.** Původní trojice tří stromů se rozšířila na pentagram pěti uzlů — přibylo Srdce (Bohemia) a Akáša (Lanka). Pět uzlů tvoří **L5 Pentagram**:

| Uzel | Element | Archetyp stromu | Role v síti | Místo | Energie |
|---|---|---|---|---|---|
| **Zahrada Genesis** | Země | **Kořen** | Base Camp — vstupní brána, farma, práce, oceán | Algarve, Portugalsko | Pohyb, surf, ranní světlo |
| **Dharma Temple** | Oheň | **Kmen** | Svatyně — ticho, praxe, vzdělání, hloubka | La Palma, Kanárské ostrovy | Klid sopky, noc, hvězdy |
| **Te Pīko Ora** | Voda | **Koruna** | Naplnění — hojnost, integrace, mořská permakultura | Raiatea, Francouzská Polynésie | Tok, věčné poledne |
| **Golden Republic Bohemia** | Vzduch | **Srdce** | Governance lab — kruh rozhodování, česká moudrost (sůl, most, Zlatý býk, Přemysl Oráč, Libuše, Karel IV), protokol Zlatá republika | Čechy, Česká republika | Most, most mezi tradicí a experimentem |
| **Bodhi Lanka** | Akáša / Éter | **Éter** | Láska — Rama-Sita, Sri Maha Bodhi (nejstarší žijící strom, 288 př. n. l.), Rama Setu most, Bhakti protokol, Ajurvéda | Srí Lanka | Láska, bhakti, nejstarší kořen |

Proč zrovna těchto pět:

1. **Kořen musí být první a nejblíž.** Zahrada Genesis je v EU, dostupná autem i letadlem, s mírným klimatem a nízkou právní bariérou (portugalská `Associação`). Kdo se má do L5 dostat poprvé, potřebuje místo, kde se dá přijet na týden, spát ve stanu, kopat záhon a odjet. Proto je Genesis *Base Camp*.
2. **Kmen dává tvar.** Dharma Temple není farma s meditací navíc. Je to místo, kde se **ticho stává protokolem**: 21denní tichý retreat pro každého strážce před převzetím role, žádná elektronika v Dharma Circle, 48 hodin reflexe před každým velkým rozhodnutím. Tvar, který drží, když přijde vítr.
3. **Koruna přichází naposled — a nesmí být slíbena dřív.** Te Pīko Ora je nejdál, právně nejsložitější (cizinci v Polynésii nemohou přímo vlastnit půdu) a kulturně nejcitlivější (posvátná Raiatea, marae Taputapuātea). Proto je označena jako **Vize / Příprava** a její fáze začínají nejpozději (2027–2028). Kdo by ji prodával jako hotový ráj, lže.
4. **Srdce spojuje.** Golden Republic Bohemia je governance lab — kruh rozhodování, kde se česká moudrost (sůl, most, Zlatý býk, Přemysl Oráč, Libuše, Karel IV) setkává s experimentem. Protokol Zlatá republika zkouší, jak se rozhoduje, když nikdo není nad druhým. Vzduch je element, který nese hlas — a hlas je to, co komunita potřebuje, aby neztuchla.
5. **Éter je nejstarší kořen.** Bodhi Lanka je místo, kde strom, pod kterým se probudil Buddha, stojí dodnes — Sri Maha Bodhi, zasazený 288 př. n. l., nejstarší žijící strom s dokumentovaným původem. Rama-Sita a Rama Setu most jsou paměť lásky jako mostu. Bhakti protokol a Ajurvéda přinášejí, co žádný jiný uzel nemá: kontinuitu péče starou tisíce let. Akáša je element, který drží všechny ostatní — prostor, ve kterém stromy rostou.

### Jeden kořen, pět míst — sdílený kód

Všechny pět uzlů implementují **stejné základní protokoly** (podrobně v [kapitole 6](./06-Protokoly-Zeme.md)): Guardian Node s dělením 90/10, semennou knihovnu, Medical Table, LoRa/Meshtastic mesh, sociokratickou DAO, vědomé přijímání členů a slib péče. To je „jeden kořen": kdo se naučí governance v Genesis, rozumí governance na La Palmě. Kdo si vymění semínka v Portugalsku, může si je vyměnit na Raiatea. A kdo se naučí kruh rozhodování v Bohemii, rozumí kruhu v Lankě.

### Stejné fáze pro každý uzel

| Fáze | Název | Cíl | Typická délka |
|---|---|---|---|
| 0 | **Zárodek** (Seed) | Právní základ, první strážci, přístup k půdě | 3–12 měsíců |
| 1 | **Kořeny** (Roots) | Energie, voda, základní jídlo, přístřeší | 6–18 měsíců |
| 2 | **Komunita** (Community) | Stálí obyvatelé, governance, ZION node | 12–24 měsíců |
| 3 | **Síť** (Network) | Propojení s ostatními L5 uzly, sdílené protokoly | 18–36 měsíců |
| 4 | **Výzařování** (Radiance) | Retreaty, vzdělávání, mezinárodní hosté | 24–60 měsíců |

> **Hanumanova věta „až začneš nosit vodu"** je v technickém jazyce M5 z Exekuční charty: fáze se nepovyšuje prohlášením, ale evidencí — smlouvou na půdu, fotkou s původem a souhlasem, rozpočtem, on-chain referencí a nezávislým reportem.

### Mystická mapa (pouze jako obraz)

V [`docs/Zohar/01-SEFIROT-VRSTVY.md`](../../Zohar/01-SEFIROT-VRSTVY.md) odpovídá L5 sefiře **Yesod** — *Základ*, generativní spojení mezi vizí (Keter) a manifestací (Malkhut). „Bez Yesod by ZION zůstal v cloudu. S Yesod se stává zemí pod nohama." Slib péče této sefiry zní: *„I vow to care for this land as I would care for my own body."* Je to obraz, ne pravidlo konsensu.

---

## Kotva pravdy — ověřitelná fakta

> Pět sazenic existuje. Žádná z nich není strom.

| Prvek příběhu | Stav | Co je ověřitelné | Co ještě chybí |
|---|---|---|---|
| **Pět uzlů jedné sítě** | **STAVBA** | Živé komunitní dokumenty `public/V3/L5/docs/COMMUNITIES/{genesis-garden,dharma-temple,te-piko-ora}.md` s právní formou, infrastrukturou, rozpočty, riziky a fázemi; index v `public/V3/L5/docs/README.md`. | Dokumenty datovány 2026-05-21 — vyžadují refresh stavů (fáze, rozpočty, kontakty); komunitní dokumenty pro Bohemia a Lanka v přípravě. |
| **Kořen — Zahrada Genesis** | **STAVBA** | Status 🟡 *Active development*; Fáze 0 (tým, scouting, právní rešerše, rozpočet, zkušební záhony 0,1 ha) označena hotová; Fáze 1 aktivní. Web `/terranova/genesis`. | Pozemek (koupě/nájem), registrace entity, GPS, nezávislý důkaz. |
| **Kmen — Dharma Temple** | **STAVBA / HORIZONT** | Status 🔵 *Preparation*; architektonický koncept (Merkaba, 7 kopulí) a kurikulum retreatů; web `/terranova/dharma-temple` s 3D náhledem a dokumentací. | Pozemek, právní entita, zakládající strážci, financování Fáze 0–1. |
| **Koruna — Te Pīko Ora** | **HORIZONT** | Status 🔵 *Vision / Preparation*; právní a kulturní analýza, agrolesnický a mořský model; web `/terranova/te-piko-ora`. | Polynéský partner, ostrov, právní forma, tým; Fáze 0 plánována 2026–2027. |
| **Srdce — Golden Republic Bohemia** | **HORIZONT** | Governance lab, protokol Zlatá republika; web `/terranova/golden-republic-bohemia`. | Pozemek, právní entita, zakládající kruh, kurikulum governance retreatů. |
| **Éter — Bodhi Lanka** | **HORIZONT** | Bhakti protokol, Ajurvéda, Sri Maha Bodhi jako archetyp; web `/terranova/bodhi-lanka`. | Pozemek, právní entita, partner v Srí Lance, tým; Fáze 0 plánována 2027–2028. |
| **Sdílené fáze 0–4** | **ŽIVÉ** (rámec) | Tabulka fází v `public/V3/L5/docs/README.md` a shodně na webových stránkách všech projektů. | Evidence přechodu mezi fázemi pro každý uzel (impact packet). |
| **„Jeden kořen" — sdílené protokoly** | **HORIZONT** | Specifikace v `public/V3/L5/docs/{TECH,GOVERNANCE,PROTOCOLS}/`. | Žádný Guardian Node ani mesh v L5 komunitě dnes neběží (instalace plánována Fáze 2: 2027–2028). |
| **Panel „Nová Země" v OASIS** | **ŽIVÉ** (klient) | `APP&WEB/OasisWeb/src/components/WorldPanel.tsx` — `NOVA_ZEME_PROJECTS` s uzly, statusy `Active / Prep / Planned` a odkazy na web. | Statusy jsou ručně psané konstanty; nemají zdroj v L5 API. |
| **Hanuman zalévá tři sazenice** | **MÝTUS** | Archetyp Služebníka Života (Seva) ze Sůl této země, ep. 10. | — |
| **Yesod ↔ L5** | **MÝTUS** | `docs/Zohar/01-SEFIROT-VRSTVY.md`, sekce 9. | — |

---

*→ Pokračování: [Kapitola 3 — Zahrada Genesis (Base Camp, Algarve)](./03-Zahrada-Genesis.md)*

---

*[Zpět na index Knihy Země → `00-README.md`](./00-README.md)*


# BODHI GAIA — Kapitola 3: Zahrada Genesis
## Base Camp · Algarve, Portugalsko — farma na hranici dvou světů a první strom zasazený jako rituál

> *„Sázení stromů není PR aktivita. Je to rituál zakořenění. Každý strom, který tu vyroste, tu bude dál, když tenhle tým dávno odejde."*

---

## Příběh

První, kdo sešel ze svahu pod Domem Lumi až k moři, byla mladá žena, která na arše dělala to, co nikdo jiný nechtěl — vyprazdňovala kýbly s vodou z podpalubí. Říkali jí **Ana**. Neuměla číst mapu, neuměla kázat a neuměla stavět mosty. Uměla dvě věci: pracovat rukama a plavat v studené vodě.

Došla na místo, kde končila hlína a začínal písek. Vítr tam foukal ze západu bez přestání a v noci bylo slyšet, jak se vlny lámou o útesy. Půda byla chudá, slaná, plná kamení. Kdokoliv jiný by šel dál.

Ana si klekla, vzala do dlaní hrst země — jako to udělala Sítá — a ucítila, že je teplá. *„Tady,"* řekla nikomu.

Za týden měla první záhon. Za měsíc přišli tři lidé z Domu Lumi, protože slyšeli, že „dole u moře někdo pěstuje rajčata a večer surfuje". Za půl roku stál na svahu nad zátokou první plátěný stan, u něj sud s vodou a kolem něj kruh kamenů, na kterém se dalo sedět.

Ana tomu místu neříkala chrám ani svatyně. Říkala mu **Zahrada** — a protože to byla první zahrada Nové země, přidali k tomu ostatní slovo **Genesis**.

Když se tesař přišel podívat, čekal farmu. Našel něco jiného: místo, kde se lidé ráno v šest scházeli u kruhu kamenů, rozdělili si práci — kdo dnes kope, kdo vaří, kdo jde pro vodu, kdo opravuje plot — a večer, když slunce zapadalo do Atlantiku, seděli na stejném kruhu a mluvili o tom, co se nepovedlo.

*„Tohle není farma,"* řekl tesař.

*„Ne,"* odpověděla Ana. *„Tohle je brána. Farma je jen způsob, jak ji udržet otevřenou. Kdo sem přijde, nemusí věřit v nic. Musí jen umět přiložit ruku k dílu a vydržet vítr. Když to vydrží týden, může odejít nahoru do hor za tichem nebo dál k vodě za kánoí. A když ne — odjede domů s dlaněmi plnými mozolů a vůní rozmarýnu. I to stačí."*

Toho večera zasadili společně první strom — olivu, protože vydrží sucho, vítr i sůl. Ana řekla jen jednu větu, která se pak stala pravidlem Zahrady:

*„Tenhle strom bude dávat olej, až tu z nás nikdo nebude. Sázíme v biologickém čase, ne v čase účetních."*

Tesař vyřezal do kůlu u brány tři znaky: vlnu, motyku a olivový list. Pod ně napsal: **Base Camp**.

---

## Co to znamená

**Zahrada Genesis je první fyzický uzel Terra Nova v Evropě — eko-farma na atlantickém pobřeží Algarve, kde se protíná organické zemědělství, surf, off-grid technologie a komunitní život. Její role v L5 Free World je Kořen: Base Camp, vstupní brána, místo, kam se dá přijet poprvé.**

Záměrem není dokonalost. Záměrem je **reálný provoz otevřený lidem** — farma, která roste spolu s lidmi, ne bez nich.

### Charakter místa: hranice dvou světů

Zahrada Genesis stojí na hranici tichého vnitrozemí farmy a divokého atlantického pobřeží. Tato dualita — ticho půdy a energie oceánu — je záměrná. Projekt hledá lidi, kteří umí pracovat v hlíně i surfovat vlny. Farmáře i surfaře. Stavitele i meditující.

### Co Zahrada dělá (Fáze 1 — Kořeny)

| Oblast | Plán Fáze 1 | Plán Fáze 2 |
|---|---|---|
| **Energie** | 5 kWp PV + 10 kWh LiFePO4 baterie (~20 kWh/den v létě), DC mikrosíť pro světla, solární ohřev vody | 15 kWp + 30 kWh + grid fallback (~60 kWh/den) |
| **Voda** | Vrt 80–120 m, 5 m³ nádrž, pískový filtr + UV, kořenová čistírna šedé vody, kompostovací toalety | Vrt + dešťová voda, 20 m³ podzemní cisterna, biodigestor |
| **Jídlo** | 0,5 ha organicky + agrolesnictví; 20 % kalorické soběstačnosti; kuřata, včely | 2 ha syntropické agrolesnictví + keyline; 50 %; kozy, kachny, akvaponie |
| **Ubytování** | 8–12 hostů: safari stany, jádro týmu v opravené budově | 20–30 hostů: dřevěné eko-chaty, komunitní jurta |
| **Stromy** | Fíkovník, granátovník, citrusy, oliva; krycí plodiny | Olivový olej, víno, sušené bylinky, sazenice jako tržní plodiny |
| **Semenná knihovna** | Katalog lokálních odrůd | Výměna s Dharma Temple a dalšími L5 uzly |

### Ekonomika, která nelže

Zahrada je **ekonomicky autonomní a protokolově zarovnaná**. Nežije z fondu L5; žije z toho, co vyprodukuje:

| Příjem | Fáze 1 | Fáze 2 | Fáze 3 |
|---|---|---|---|
| Glamping / eko-turistika | 70 % | 50 % | 35 % |
| Farmářské produkty (trh, CSA) | 10 % | 20 % | 25 % |
| Workshopy / retreaty | 10 % | 15 % | 20 % |
| Odměny ZION Guardian node | 5 % | 10 % | 15 % |
| Granty / crowdfunding | 5 % | 5 % | 5 % |

Cíl Fáze 1: 50 000 EUR/rok, break-even při 120 nocích/měsíc. Pracovní výměna (25 h/týden = ubytování + jídlo) je omezena na 2 pracovní hosty na 4 platící, aby farma měla ruce i příjem.

### Vazba na ZION

- **Guardian Node** (Fáze 2, cíl 2027): mini-PC (Intel N100 / Ryzen embedded), 15–25 W — vejde se do solárního rozpočtu; Starlink + 4G failover + LoRa relay. Dělení odměn **90 % operátor / 10 % komunitní pokladna**.
- **Pokladna:** multisig 3-z-5 (operační 2-z-3, rezerva 3-z-5 cold, desátek auto-forward měsíčně, fond semenné knihovny).
- **Governance:** sociokratické kruhy (Obecný → Provoz / Finance / Komunita / Expanze), rozhodování souhlasem („žádná odůvodněná námitka"), double-linking. Výdaje > 5 000 EUR jdou do on-chain návrhu (7 dní, 60 %). Přijetí nového strážce: 14 dní, souhlas.
- **Role strážců:** Farm, Hospitality, Tech (remote OK), Finance (remote OK), Community — minimálně 6 měsíců on-site pro role na místě.

### Fáze

| Fáze | Období | Stav | Klíčové body |
|---|---|---|---|
| 0 — Zárodek | 2025 Q3–Q4 | ✅ | Tým 3 strážců, scouting Algarve, právní rešerše (Associação vs Cooperativa), rozpočet 50 000 EUR, zkušební záhony 0,1 ha |
| 1 — Kořeny | 2026 | 🟡 | Pozemek (koupě / dlouhodobý nájem), registrace, solar 5 kWp, vrt, glamping 4–6 jednotek, 0,5 ha, první platící hosté (Q3 2026), ZION wallet + DAO rámec |
| 2 — Komunita | 2027 | 🔵 | Guardian node, stálé bydlení 3–5 chat, měsíční program, LoRa mesh, Medical Table pavilon, propojení s Dharma Temple |
| 3 — Síť | 2028 | 🔵 | 2 ha, semenná síť 3+ uzlů, vzdělávací centrum, surf škola, druhý uzel v Portugalsku |
| 4 — Výzařování | 2029+ | 🔵 | Retreat centrum 40+ hostů, ZION platby jako výchozí, knowledge commons, 1 % přebytku → L6 |

### Rizika, která se nezamlčují

Sucho a nedostatek vody (vrt + déšť + šedá voda), **letní požáry** (protipožární pásy, zásoby vody, evakuační plán, pojištění), odchod klíčového strážce (cross-training, dokumentace), volatilita ZIONu (pokladna v stablecoinech + ZION), neúroda (polykultura, semenná diverzita), úraz hosta (pojištění, první pomoc).

---

## Kotva pravdy — ověřitelná fakta

> Zahrada Genesis je nejdál ze všech tří uzlů — a přesto je to stále sazenice, ne strom.

| Prvek příběhu | Stav | Co je ověřitelné | Co ještě chybí |
|---|---|---|---|
| **Místo u moře, kde se pěstují rajčata** | **STAVBA** | `public/V3/L5/docs/COMMUNITIES/genesis-garden.md`: status 🟡 *Active development*, Fáze 0 hotova (zkušební záhony 0,1 ha), Fáze 1 aktivní; web `/terranova/genesis` (Fáze 0 „done", Fáze 1 „active", organická farma / sázení stromů / solar „active"). | Přesné GPS a výměra (pozemek v jednání), registrovaná entita, nezávislý důkaz (fotky s původem, smlouva). |
| **Brána otevřená každému** | **STAVBA** | Karta *Pioneer Projects* na `/terranova` a v OASIS panelu „Nová Země" (status *Active*). Kanály: web `newearth.cz/V2/camp.html`, Instagram `@terranova_project`, Discord. | Veřejný rezervační/onboarding tok, ceník na webu, pravidla pracovní výměny zveřejněná v CZ/EN. |
| **Plátěný stan, sud s vodou, kruh kamenů** | **STAVBA** | Plán ubytování (safari stany 🟡 objednány, jádro týmu 🟡 renovace), vodní systém (vrt + 5 m³) a energie (5 kWp) ve Fázi 1. | Realizační evidence (instalace, faktury/rozpočet, foto) — dnes jen plán. |
| **Oliva zasazená „v biologickém čase"** | **STAVBA** | Sázení stromů (fíkovník, granátovník, citrus, oliva) v plánu Fáze 1; web uvádí *Tree planting — active*. | Počet, druhy a přežití stromů jako součást impact packetu. |
| **Kruh, kde se ráno rozdělí práce** | **HORIZONT** | Sociokratická struktura kruhů a rozhodovací tabulka v komunitním dokumentu (§6). | Zavedení kruhů v praxi, zápisy, první on-chain návrh pokladny. |
| **Guardian node ve stanu** | **HORIZONT** | Specifikace hardware, spotřeby, konektivity a splitu 90/10; instalace plánována **Fáze 2 (2027)**. Web: *ZION Node — planned*, *Guardian Wallet — tbd*. | Žádný L5 node dnes neběží; provozní rewardy 10 % → pokladna nelze ověřit. |
| **Semenná knihovna** | **STAVBA** | Web `/terranova/genesis` uvádí *Seed Library — active*; dokument: „neformální výměna" → katalog. | Katalog odrůd, partneři výměny (Banco Português de Germoplasma Vegetal), první výměna s Dharma Temple (cíl 2028). |
| **Ekonomika: 50 000 EUR / 120 nocí** | **HYPOTÉZA** | Break-even a příjmový model v §4 komunitního dokumentu; marketingové persony, kanály a sezónní ceník (§11); EU granty LEADER / Erasmus+ / LIFE ve fázi rešerše (§12). | Skutečné účetnictví po první sezóně; žádná z grantových žádostí není podána. |
| **Ana, olivový list na kůlu** | **MÝTUS** | Postava vytvořená pro tuto knihu; motiv „biologický čas" je citát z komunitního dokumentu a webu. | — |

> **Známý rozpor k opravě:** stránka `/l5-free-world` označuje lokalitu Genesis Garden jako *Střední Evropa* (`L5FreeWorldCopy.centralEurope`), zatímco komunitní dokument, `/terranova/genesis`, karty Pioneer Projects i OASIS panel uvádějí **Algarve, Portugalsko**. Web je třeba sjednotit (viz [kap. 9](./09-Kotva-Pravdy-a-Hranice.md)).

---

*→ Pokračování: [Kapitola 4 — Dharma Temple: Nová Bodhi Gaia (La Palma)](./04-Dharma-Temple-Nova-Bodhi-Gaia.md)*

---

*[Zpět na index Knihy Země → `00-README.md`](./00-README.md)*


# BODHI GAIA — Kapitola 4: Dharma Temple — Nová Bodhi Gaia
## Svatyně · La Palma, Kanárské ostrovy — Merkaba ze dřeva a světla, sedm kopulí a Strom života jako osa

> *„Dharma není cesta od světa. Je to způsob, jak být ve světě jinak."*

---

## Příběh

Kdo vydržel v Zahradě Genesis týden a přesto zůstal neklidný, tomu Ana ukázala na jih, kde se nad mořem tyčil ostrov s vrcholem ztraceným v oblacích. *„Tam. Ale nejdi tam kvůli výhledu. Jdi tam, až budeš mít v hlavě tolik hluku, že už neuslyšíš vlastní dech."*

Ostrov byl zelený jako nic, co kdy poutníci viděli. Půda z popela sopky byla černá, teplá a tak úrodná, že stromy rostly, jako by je někdo tahal k nebi. Ze svahů tekla voda. V noci bylo nebe tak tmavé, že Mléčná dráha vrhala stín.

A na svahu v půli cesty mezi mořem a vrcholem, ve výšce, kde se sluneční jih potkává s deštivým severem, stál **chrám, který nebyl z mramoru**.

Poutníci znali chrámy starého světa: kamenné, těžké, se zlatem a hlídači u dveří. Tento byl jiný. Sedm kopulí ze dřeva, bambusu a skla — jedna velká uprostřed a šest menších v kruhu okolo — spojených krytými chodbami, mezi nimiž rostly zahrady a leskla se voda jezírka. Na střechách kopulí ležely solární panely jako šupiny. Kopule nevypadaly postavené; vypadaly **vyrostlé** — jako by někdo zasadil sedm semen geometrie a nechal je vyklíčit.

Uprostřed hlavní kopule nebyl oltář. Byl tam **strom**.

Živý strom, který rostl skrz podlahu a jehož koruna se dotýkala vrcholu klenby, kde bylo sklo, aby na ni padalo světlo. Kolem kmene byl kruh z čediče a na něm seděli lidé — mlčky.

Přišel k nim muž s prostou holí, kterého poutníci znali ze Sůl této země jako **Sádhu**, Poutníka Ticha. Nemluvil hned. Počkal, až dech příchozích zpomalí.

*„Tomu stromu říkáme Bodhi Gaia,"* řekl nakonec. *„Bodhi je probuzení. Gaia je Země. Pod stromem Bodhi seděl kdysi jeden člověk, dokud se neprobudil. Tady sedíme pod stromem, dokud se neprobudí Země — to znamená: dokud se neprobudíme k ní. Ne k nebi. K půdě, ze které ten strom pije."*

*„Proč sedm kopulí?"* zeptal se tesař, který nemohl přestat počítat trámy.

*„Protože sedm je celistvost. Ta uprostřed je pro ticho. Těch šest okolo je pro učení: o zemi, o vědění, o geometrii, o řemesle, o přírodě a o budoucnosti. Kdo přijde, projde všemi. Dítě i starý člověk. Malí Buddhové i ti, co si na Buddhu nevzpomínají."*

*„A ta stavba — dva propletené jehlany, které vidím v půdorysu?"*

*„Merkaba. Nebe a země propletené, vůz světla. Ale nenech se zmást slovy. Je to jen geometrie, která drží střechu s nejmenším množstvím dřeva. Posvátné na tom není to, že je to trojúhelník. Posvátné je, že to nespadne."*

Poutníci zůstali. Někdo sedm dní, někdo čtrnáct, někdo dvacet jedna. Ráno pracovali v syntropické zahradě na svahu — sázeli banány mezi avokáda, papáje mezi kávu, sekali biomasu a nechávali ji ležet, aby krmila půdu. Odpoledne mlčeli. V noci chodili na hřeben dívat se na sopku, která před lety hořela, a na hvězdy, které svítily bez konkurence.

Když odcházeli, dostal každý semínko z místní odrůdy a malou dřevěnou destičku s vyřezaným znakem. *„Ne jako trofej,"* řekl Sádhu. *„Jako připomínku, že ses vrátil jiný. A že se to dá zapomenout."*

---

## Co to znamená

**Dharma Temple je spirituální a vzdělávací uzel sítě Terra Nova — Svatyně, Kmen L5 Free World. Místo, kde fyzická soběstačnost a vnitřní praxe rostou ze stejného kořene.** Zatímco Zahrada Genesis je brána (pohyb, práce, oceán), Dharma Temple je hlubší zastavení pro ty, kdo potřebují víc než farmu. Oba projekty jsou uzly téže sítě: jiná energie, stejný záměr.

### La Palma — La Isla Bonita

Nejzelenější z Kanárských ostrovů, biosférická rezervace UNESCO, národní park Caldera de Taburiente, 700–1 500 mm srážek ročně, vulkanická půda, která drží teplo i vlhkost, a noci tak tmavé, že tu stojí jedna z nejlepších observatoří světa (Roque de los Muchachos, 2 396 m). Doporučená poloha: západní strana, 400–800 m — rovnováha slunce a deště. A také **skutečné riziko**: Cumbre Vieja soptila v roce 2021.

### Architektura Nové Bodhi Gaia

| Prvek | Popis | Symbolika (obraz, ne doktrína) |
|---|---|---|
| **1 hlavní kopule** | Chrám osvícení, hlavní sál, meditace, obřady | Střed, ticho |
| **6 menších kopulí** | Muzea a chrámy poznání v kruhu: *Země* (půda, ekologie, permakultura), *Vědění* (knihovna, archiv), *Poznání / Geometrie* (posvátná geometrie, matematika, filozofie), *Příroda a řemesla* (tradiční techniky, místní kultura), *Budoucnost a technologie* (free energy, DAO governance, ZION), + meditační prostor | Sedm částí bytí, sedm planet, sedm čaker |
| **Strom života — Bodhi Gaia** | Živá osa chrámového okrsku, bod spojení s přírodou | Probuzení k Zemi |
| **Merkaba** | Půdorysná geometrie dvou propletených tetraedrů | Spojení nebe a země, vůz světla |
| **Kryté chodby, zahrady, jezírko, obvodový ochoz** | Propojení kopulí, vodní prvek, ochranný kruh | Jednota, cyklus |

**Konstrukce a materiály:** geodetické kopule (lehké, pevné, úsporné), dřevo, bambus, sklo, kámen; trojitá / ETFE fólie jako translucidní plášť; solární panely integrované do střech; sběr a filtrace dešťové vody; pasivní ventilace; kruhový základ z kamene; kompost; zahrady léčivých rostlin jako součást programu.

### Ticho jako protokol

Dharma Temple se od ostatních uzlů liší tím, že **ticho je součástí governance**:

- Každý strážce absolvuje **21denní tichý retreat** před převzetím role.
- V Dharma Circle **žádná elektronika**; velká rozhodnutí mají **48 hodin reflexe**.
- Nový strážce projde 30denním zkušebním retreatem před zápisem do DAO.
- Kruhy: *Praxe* (ranní praxe, retreaty), *Země* (syntropická zahrada, infrastruktura), *Finance*, *Komunita* (přijímání, konflikt, protokoly ticha), *Vědění* (dokumentace, semenná knihovna).

### Kurikulum

| Program | Délka | Pro koho | Struktura |
|---|---|---|---|
| **Kořeny ticha** | 7 dní | Každý | Příchod → Tělo → Dech → Ticho → Srdce → Integrace → Odchod; práce v zahradě, lesní koupel v laurisilvě, chůze pod hvězdami, ohňová ceremonie, semínko na rozloučenou |
| **Prohloubení** | 14 dní | Vracející se | + studium Satipaṭṭhāna sutty, noční vigilie na hřebeni sopky (bezpečná zóna), tvorba z vulkanické hlíny a přírodních barev, den služby (obnova krajiny), práce se sny, osobní plán praxe, symbolická dřevěná destička |
| **Transformace** | 21 dní | Na pozvání | Osobní mentoring, vlastní design praxe |

### Infrastruktura a ekonomika

| Oblast | Fáze 1 | Fáze 2 |
|---|---|---|
| **Energie** | 8 kWp PV + mikro-hydro 2 kW (~35 kWh/den) | 15 kWp + 5 kW hydro + 40 kWh baterie; hydro běží v noci, když solar spí |
| **Voda** | Dešťová (100 m² střech → 70 m³/rok) + pramen, 30 m³ cisterna, filtr + UV, kořenová čistírna | 300 m² sběr, 100 m³ cisterna, uzavřený okruh → akvaponie, biodigestor |
| **Jídlo** | Syntropické agrolesnictví 0,3 ha (banán, avokádo, papája, batáty), 15 % soběstačnost | 1,5 ha vícepatrový potravní les (7+ vrstev, Götschova metoda), 60 % |
| **Ubytování** | 6–10 hostů: meditační buňky, eko-chaty pro dva, jádro týmu 5–8 | 20–30 hostů: skupinová jurta, sál Dharmy 80 m², buňky 3–5 |
| **Příjmy (Fáze 1)** | Retreaty 60 %, buňky 20 %, workshopy 10 %, farma 5 %, node 5 % | Cíl 120 000 EUR/rok |

Mikro-hydro vyžaduje posouzení vlivu na životní prostředí (kanárské vodní zákony jsou přísné). Právní cesta: `Asociación` → `Fundación`; půda: dlouhodobý nájem s předkupním právem (arras).

### Vazba na ZION

- **Guardian Node** (Fáze 2, cíl 2028), redundantní napájení solar + hydro, split 90/10 → komunitní pokladna.
- **Pokladna** multisig 3-z-5 jako v Genesis + fond programu Dharmy.
- **Medical Table:** ošetřovna → holistický pavilon → wellness centrum; endemická léčivá flóra (*Bosea yervamora*, dračinec, kanárská levandule); spolupráce s Universidad de La Laguna.
- **Mesh + vulkanický protokol:** LoRa/Meshtastic s napojením na seismická data a nouzové vysílání (Cumbre Vieja); evakuační stupně zelená / žlutá / oranžová / červená; zálohy klíčů mimo ostrov.
- **Observatoř:** dark-sky turistika, „Celestial Silence" (noční meditace u vyhlídky), hostování astronomů.

### Propojení se Zahradou Genesis

| Dimenze | Zahrada Genesis | Dharma Temple |
|---|---|---|
| Energie místa | Atlantický vítr, oceán, pohyb | Vulkanické ticho, hory, vnitřní praxe |
| Role | Base Camp — vstup | Svatyně — hlubší zastavení |
| Ekonomická vazba | Hosté odesíláni na tiché retreaty | Hosté odesíláni na aktivní farmářské pobyty |
| Výměna | Olivový olej, víno, sušené bylinky → kuchyně chrámu | Subtropické ovoce, léčivé byliny → trh Zahrady |
| Sdílené | Semenná knihovna, knihovna nástrojů, výcvik strážců | ← totéž |

---

## Kotva pravdy — ověřitelná fakta

> Kopule z příběhu existují jako 3D model a půdorys. Na La Palmě zatím nestojí ani jedna.

| Prvek příběhu | Stav | Co je ověřitelné | Co ještě chybí |
|---|---|---|---|
| **Chrám ze sedmi kopulí, Merkaba, Strom života** | **HORIZONT** (koncept) | Architektonický koncept v `APP&WEB/website-v2.9/public/docs/terranova/dharma-temple.{cs,en}.md` (podtitul *Nová Bodhi Gaia*), interaktivní 3D náhled a půdorys na `/terranova/dharma-temple` (`DharmaTemplePreviewLazy`), obrázek `/images/dharma-temple/concept-og.png`. | Pozemek, stavební povolení, statika, rozpočet stavby; žádná kopule nestojí. |
| **Ostrov, sopka, laurisilva, observatoř** | **ŽIVÉ** (fakta o místě) | La Palma: UNESCO biosférická rezervace, 700–1 500 mm srážek, Cumbre Vieja 2021, Roque de los Muchachos — veřejně ověřitelné; shodně v komunitním dokumentu i na webu. | Konkrétní lokalita (sever / jih / výška) není vybrána. |
| **Sádhu a lidé sedící pod stromem** | **HORIZONT** | Kurikulum 7 / 14 / 21 dní, ceník a pravidla pracovní výměny v `public/V3/L5/docs/COMMUNITIES/dharma-temple.md` §12. | První retreat plánován na Q4 2027; žádný host, žádný učitel, žádný strážce zatím nezapsán. |
| **Ticho jako protokol (21 dní, 48 h, bez elektroniky)** | **HORIZONT** | Governance model §6 komunitního dokumentu. | Zakládající tým (5 strážců) neexistuje; právní entita (`Asociación`) neregistrována. |
| **Syntropická zahrada na svahu** | **HORIZONT** | Design guild pro klima La Palmy (§14: banánový kruh, subtropický sad, léčivý kout; Götschovy principy). | Půda, první výsadba (plán Fáze 1, 2027). |
| **Solar na kopulích, voda z hor** | **HORIZONT** | Energetický a vodní plán (§3); mikro-hydro s EIA. | Realizace; povolení pro hydro. |
| **Svět Dharma Temple v OASIS** | **ŽIVÉ** (klient) | `APP&WEB/OasisWeb/src/domain/config/worlds.ts` — id `DHARMA_TEMPLE_LA_PALMA`, popis „Merkaba geodesic temple with 7 domes, Tree of Life and meditation gardens", `goldenEggClue: 7`; panel „Nová Země" ve `WorldPanel.tsx` (status *Prep*). | Svět je v datech označen `layer: 3` — má být L5 (viz [kap. 9](./09-Kotva-Pravdy-a-Hranice.md)); žádná herní vazba na fyzický retreat. |
| **Semínko a dřevěná destička na rozloučenou** | **HORIZONT** | Rituál „seed gift" a symbolická destička v kurikulu (§12.1–12.2). | — |
| **Vulkanický protokol, zálohy mimo ostrov** | **HORIZONT** | Tabulka protokolu (§13.2), evakuační stupně, IGN / Cabildo alerty. | Seismometr, mesh, pojištění — vše ve fázi koncept. |
| **Merkaba jako „vůz světla", Bodhi jako probuzení** | **MÝTUS** | Symbolika převzatá z návrhového dokumentu; kniha netvrdí náboženskou platnost ani lineage. | — |

> **Věta z Exekuční charty, která tu platí nejvíc:** *„Žádné monetizované ‚posvátné skiny', žádná gamifikace duchovní autority."* Dharma Temple v OASIS smí být místem učení a hry, ne obchodem s osvícením.

---

*→ Pokračování: [Kapitola 5 — Te Pīko Ora (Koruna, Raiatea)](./05-Te-Piko-Ora.md)*

---

*[Zpět na index Knihy Země → `00-README.md`](./00-README.md)*


# BODHI GAIA — Kapitola 5: Te Pīko Ora
## Koruna · Raiatea, Francouzská Polynésie — živý pupek, kokosová palma jako Strom života a wayfinding jako konsensus

> *„Iorana. Zde je písek, zde je moře, zde je skála. Zde končí mapa. A zde začíná pravda."*

---

## Příběh

Třetí sazenice — ta u vody, kterou dvakrát vzalo moře — nakonec vyrostla nejvýš. Ale ne tam, kde ji zasadili.

Když poutníci po letech doplouvali k zátoce pod Domem Lumi, nenašli strom. Našli **kánoi**. Dlouhou, dvojitou, s plachtou z pandánových listů, a v ní ženu s tmavou kůží a tetováním na pažích, které vypadalo jako mapa — jen bez pevniny. Nečekala je na břehu. Čekala na vodě.

*„Jmenuji se Hina,"* řekla. *„Ta třetí sazenice není strom. Je to palma. A palma neroste na svahu. Roste tam, kde její kořeny pijí slanou vodu a koruna nese slunce. Nastupte."*

Plula bez kompasu, bez mapy a bez hvězd, protože byl den. Tesař se jí zeptal, jak ví, kam plout.

*„Nevím to. Čtu to,"* odpověděla. *„Vlny přicházejí ze tří směrů a jen jeden z nich nese echo ostrova. Ptáci ráno letí od pevniny a večer k ní. Mraky nad lagunou jsou zespodu zelené. A když se všechny tyto znaky shodnou — a teprve tehdy — otočím kormidlo. Když se neshodnou, čekám. Neshoda není chyba. Je to chybějící znak."*

*„To zní jako to, co dělají naše uzly,"* řekl tesař. *„Nikdo nevěří jedinému zdroji. Všichni musí souhlasit, než se řetěz posune."*

*„Vy tomu říkáte konsensus. My tomu říkáme *fa'atere* — a děláme to tři tisíce let."*

Ostrov, ke kterému doplouvali, měl horu uprostřed, lagunu okolo a útes, který lagunu chránil před oceánem. V údolí, kde řeka vtékala do laguny, stálo několik domů bez stěn s střechami z listí, kamenná platforma a — palmy. Stovky palem. Každá měla u paty malý kamenný kruh a na něm jméno.

*„Když se u nás narodí dítě,"* vysvětlovala Hina, *„odstřihne se pupeční šňůra — *piko* — a pohřbí se. Na ni se zasadí strom. Dítě je pak celý život spojeno s tím stromem a s tou zemí. Strom je jeho živý předek. Tohle,"* ukázala na palmy, *„není sad. Je to rodokmen. Každý, kdo tu zůstal déle než jednadvacet dní, tu má palmu se svým jménem."*

*„Proč tomu místu říkáte Te Pīko Ora?"*

*„*Te* je *to*. *Pīko* je pupek, střed, místo původu. *Ora* je život, zdraví, spása. **Živý pupek.** Místo, ze kterého život vytéká a kam se vrací. Vy jste přišli z východu hledat Novou zemi. Ale nová země není na konci mapy. Je tam, kde se člověk znovu naváže na půdu, jako dítě na strom."*

Večer je Hina posadila do kruhu a podala misku s hořkým nápojem z kořene. *„Tady se rozhoduje. Nic, co se rozhodne mimo tento kruh, neplatí. Nikdo tu není kapitán. Ale jednou za měsíc vyplujeme na lagunu v kánoi — bez papíru, bez světel — a rozhodnutí přijde z rytmu pádel a ticha mezi slovy."*

Tesař se rozhlédl po palmách. *„A co když se lidem nechce pádlovat?"*

Hina se zasmála a ukázala na východ, přes oceán. *„Tam je ostrov, kde lidé přestali pádlovat. Vykáceli všechny palmy, aby postavili sochy svých předků. Když došly stromy, nemohli postavit kánoe, a když nemohli postavit kánoe, nemohli odplout. Zbylo jich sto jedenáct. Ale jejich písmo — *rongorongo* — přežilo. My se tu učíme obojí: hojnost i varování. Dvě tváře jedné vlny."*

Tesař vyřezal do stěžně kánoe kruh s tečkou uprostřed — pupek — a nad něj palmovou korunu. A vedle malým písmem: **Ráj je iluze. Toto je skutečnost.**

---

## Co to znamená

**Te Pīko Ora je třetí uzel L5 Free World — Koruna, naplnění, „plně projevený ZION". Kde Zahrada Genesis je kořen (země, začátek) a Dharma Temple kmen (oheň, cesta), Te Pīko Ora je květ a plod (voda, dovršení).** A zároveň je to uzel, který je nejdál, nejsložitější a nejcitlivější — proto je označen jako **Vize / Příprava** a **ne** jako hotový ráj.

### Jméno a kosmologie

| Slovo | Jazyk | Význam |
|---|---|---|
| **Te** | tahitština | určitý člen |
| **Pīko** | proto-polynéština | pupek, pupeční šňůra, střed, bod původu |
| **Ora** | tahitština | život, zdraví, blaho, spása |

**Rituál piko:** šňůra se odstřihne bambusovým nožem, *whenua* (placenta — doslova „země") se pohřbí, na ni se zasadí strom (kokos nebo chlebovník), dítě je navždy spojeno se stromem a zemí. Je to „blockchain Polynésie": neměnný živý záznam původu, zapsaný ne v kódu, ale ve dřevě, listu a plodu.

**Polynéský Genesis blok (obraz):** *Ta'aroa* (zdroj v skořápce) = protokol; *Tāne* (ten, kdo přináší světlo) = uzel; kokosová palma = Strom života; *va'a* (kánoe) = DAO — všichni pádlují, nikdo není kapitán; *fetu'u* (hvězdy) = konsensus — čtení mnoha znaků, ne jednoho GPS.

### Raiatea — posvátné srdce Polynésie

Pět souostroví, 118 ostrovů, 4 miliony km² oceánu. Raiatea je místo, odkud podle tradice vyplouvali první osadníci na Havaj, Nový Zéland a Rapa Nui; marae **Taputapuātea** je světové dědictví UNESCO. Cíl Fáze 1: údolí **Opoa** u Taputapuātea nebo pobřeží u zátoky **Fa'aroa** (řeka + laguna + hora). Tahiti (Teahupo'o) jako provozní záloha, Huahine a Markézy jako horizont 2030+.

### Kokosová palma jako Strom života

| Část | Polynésky | Užití | Obraz |
|---|---|---|---|
| Plod | *nī* | jídlo, voda, olej, mléko | hlava — „nápoj nesmrtelnosti" |
| List | *rau* | střecha, koše, stín | paže — ochrana |
| Kmen | *tūmū* | dřevo, most, sloup | páteř — spojení země a nebe |
| Kořen | *a'a* | lék, vlákno | nohy — zakotvení |
| Vlákno | *pulu* | provaz, kompost, palivo | kůže |
| Skořápka | *ivi* | miska, nádoba | lebka — paměť |
| Míza | *miti* | nápoj, ocet | krev — společenství |

100 palem = ~400 l kokosového oleje ročně = záložní palivo na měsíce. **Triáda kokos–ryba–taro** (listy → mulč → taro; odpad z tara → krmení rybníků; voda z rybníků → zálivka; slupky → provazy → pasti) je tři tisíce let stará permakultura.

### Wayfinding jako governance

| Polynéský pojem | Protějšek v ZION | Integrace |
|---|---|---|
| *Ari'i* (náčelník) | facilitátor strážců | rotační, ne dědičný |
| *Ra'atira* (stařešina) | držitel DAO hlasu | váha podle reputace |
| *Tu'a* (pracovník) | přispěvatel / host | může si vysloužit *ra'atira* |
| *Tapu* (posvátné, omezené) | permissioned akce | multisig prahy, posvátná místa |
| *Noa* (volné) | veřejné akce | výchozí stav |
| *Māna* (autorita) | reputační skóre | získává se službou, nekupuje se |
| *Hui* (shromáždění) | DAO návrh | pravidelný, obřadní, konsensuální |
| *Va* (vztah, prostor mezi) | protokol / smart contract | prostor, kde teče hodnota |

Rozhodování: denní provoz — rotující *ari'i* se souhlasem kruhu; pokladna — rada *ra'atira*; *tapu* — jednomyslnost strážců + konzultace stařešinů; přijímání hostů — kruh + revize *tatau*.

**Lekce Rapa Nui** (obě tváře vlny, výuka je součástí kurikula):
1. Nosná kapacita je zákon, ne doporučení.
2. Dunbarovo číslo (~150) je přirozená hranice *ahu* — překroč ji a řetěz se láme.
3. Rotační autorita (*tangata manu*) > dědičná moc.
4. Neměnné záznamy (*rongorongo*) přežijí politické cykly.
5. Obnova je možná — Rapa Nui přežila redukci na 111 obyvatel.

### Infrastruktura, právo, ekonomika

| Oblast | Fáze 1 | Fáze 2 | Fáze 3 |
|---|---|---|---|
| **Energie** | 10 kWp + 20 kWh | 25 kWp + 50 kWh, bionafta z kokosu | 40 kWp + 100 kWh, plovoucí solar na laguně |
| **Voda** | 50 m³ cisterna + pramen | 150 m³, malá RO | 300 m³ + solární odsolování 1 000 l/den |
| **Jídlo** | agrolesnictví *mara*, 100 palem, 30 % | rybníky *vāvā*, řasy *limu*, 60 % | uzavřený okruh, perly, 90 % |
| **Ubytování** | *fare pote'e*, *fare va'a*, 8–12 hostů | bungalovy, stromové *fare*, 25–40 | plovoucí *fare*, 60–80 + 15–20 rezidentů |
| **Právo** | Association Loi 1901 (Papeete) | SCI s místním partnerem (bail emphytéotique) | customary partnerství *mā'ohi* |
| **Příjmy** | eko-lodge 50 %, wayfinding škola 15 %, kultura 15 % | + mořská permakultura 20 %, perly 10 % | export řas / perel, cíl 400 000 EUR/rok |

**Desátek:** Te Pīko Ora dává **15 % z veškerého přebytku** (ne jen z node rewardů) místním polynéským komunitám, ochraně oceánu a klimatické odolnosti Pacifiku — víc než standardních 10 %, protože Polynésie je na frontové linii změny klimatu.

**Vazba na ZION:** Guardian Node v námořním provedení (IP67+, ochrana proti soli a vlhku), Starlink primárně (4G jen na Tahiti), instalace Fáze 2 (2028); DAO s polynéskou vrstvou; *tatau* jako symbolický (ne nutně kožní) živý ledger role, vstupu a přínosu; wayfinding škola v partnerství s *Fa'afaite*; napojení na havajskou linii **KNIHA-LEHUA**.

### Fáze

| Fáze | Období | Stav | Klíčové body |
|---|---|---|---|
| 0 — Zárodek | 2026–2027 | 🔵 | Tým 5 strážců včetně polynéského stařešiny / poradce, scouting Raiatea, Association Loi 1901, partnerství *mā'ohi*, rozpočet 80 000 EUR, Starlink objednávka |
| 1 — Kořeny | 2027–2028 | 🔵 | Nájem půdy, první *fare pote'e*, 10 kWp, 50 m³, 100 palem + sad, první hosté Q4 2028 („Wayfinding Immersion"), kánoe *va'a* |
| 2 — Komunita | 2029 | 🔵 | Guardian node, rybníky a řasy, malá perlová kooperativa, wayfinding škola, LoRa, 150 000 EUR/rok |
| 3 — Síť | 2030 | 🔵 | Plovoucí *fare*, export, výměna rostlin s Havají / NZ / Cookovy o., 400 000 EUR/rok, mentorství druhého pacifického uzlu |
| 4 — Výzařování | 2031+ | 🔵 | Centrum polynéského ZIONu, knowledge commons, 3+ nové pacifické uzly, 1 % přebytku → L6 |

### Rizika

Cyklony (listopad–duben; stavby odolné cyklonům, evakuace na Tahiti), bělení korálů, spor o nájem půdy (právní review, požehnání stařešinů), závislost na dovozu (kokosový olej, solar), zdravotní evakuace (Air Tahiti, vrtulník), **kulturní necitlivost** (polynéský stařešina v radě, výcvik *tapu*), výpadek Starlinku, volatilita ZIONu (pokladna v EUR + XPF + ZION).

---

## Kotva pravdy — ověřitelná fakta

> Kánoe z příběhu ještě nevyplula. Palmy nejsou zasazené. To, co existuje, je mapa — a poctivé přiznání, kde mapa končí.

| Prvek příběhu | Stav | Co je ověřitelné | Co ještě chybí |
|---|---|---|---|
| **Ostrov, laguna, marae, wayfinding** | **ŽIVÉ** (fakta o místě a kultuře) | Raiatea, Taputapuātea (UNESCO), Fa'afaite (Tahitian Voyaging Society), Te Mana O Te Moana — veřejně ověřitelné a odkazované v komunitním dokumentu §11. | Souhlas a partnerství s konkrétní místní komunitou; žádný kontakt není doložen. |
| **Palmy se jmény, rituál piko** | **HORIZONT** | „Genesis Planting" (palma pro každého strážce / hosta 21+ dní) v `public/V3/L5/docs/COMMUNITIES/te-piko-ora.md` §8.1; 100 palem v plánu Fáze 1 (2027–2028). | Půda, výsadba, katalog. |
| **Hina a kánoe bez kapitána** | **HORIZONT** | Wayfinding Council (měsíční governance v kánoi, §8.2), *awa* kruh (§8.4), polynéská governance mapa (§6.2); na webu `/terranova/te-piko-ora` jako *Wayfinding škola — planned*. | Tým, kánoe, škola; Fáze 0 začíná 2026–2027. |
| **Rongorongo a „ostrov, kde přestali pádlovat"** | **ŽIVÉ** (historická fakta) / **MÝTUS** (rámec) | Lekce Rapa Nui jsou součástí webové stránky (`RAPA_NUI_LESSONS`) a kurikula; historie Rapa Nui je veřejně doložená. | — |
| **Právo: cizinec nesmí vlastnit půdu** | **ŽIVÉ** (právní stav) | Analýza §3 komunitního dokumentu (Association Loi 1901 → SCI + místní partner → customary *mā'ohi*); právní forma na webu jako otevřená otázka. | Registrace entity, nájemní smlouva, souhlas stařešinů. |
| **Kokos–ryba–taro, rybníky, řasy, perly** | **HORIZONT** | Mořská permakultura §4.3.2, povolení *Direction des Ressources Marines* jako otevřená otázka. | Vše; první rybníky plán Fáze 2 (2029). |
| **15 % přebytku Pacifiku** | **HORIZONT** (závazek) | §6.4 komunitního dokumentu. | Přebytek neexistuje; závazek bude ověřitelný až s účetnictvím a on-chain toky. |
| **Guardian node v soli a vlhku** | **HORIZONT** | Specifikace námořního provedení §6.1; web *ZION L1 Node — planned*, *Cultural Heritage Ledger — tbd*, *Wayfinding NFT / CL — tbd*. | Instalace Fáze 2 (2028). |
| **Havajská linie** | **MÝTUS / STAVBA (dokumentace)** | `docs/TerraNova/hawaii/KNIHA-LEHUA/` (7 kapitol + Kruh avatarů Pacifiku) a `docs/TerraNova/hawaii/*.md` (Kumulipo, ahupua'a, aloha–pono–lōkahi, ho'oponopono). | Sdílené „pacifické protokoly" mezi Havají a Raiatea jsou otevřená otázka (§10). |
| **Karta v OASIS a na webu** | **ŽIVÉ** (klient) | `WorldPanel.tsx` — *Te Pīko Ora, Tahiti · Francouzská Polynésie, Planned*; web `/terranova/te-piko-ora` (*Plánováno 2027+*). | Web uvádí lokalitu „Tahiti", komunitní dokument preferuje **Raiatea** — sjednotit, až bude ostrov vybrán. |
| **Hina, tetování jako mapa bez pevniny** | **MÝTUS** | Postava vytvořená pro tuto knihu; motiv *tatau* jako živého ledgeru pochází z §5.2 komunitního dokumentu. | — |

> **Věta, kterou nesmíme zapomenout:** *„Je tohle ráj?" — „Ne. Ráj je iluze. Te Pīko Ora je skutečnost. A skutečnost je lepší."* Dokud skutečnost nestojí, nesmí ji nikdo prodávat jako ráj.

---

*→ Pokračování: [Kapitola 6 — Protokoly Země (sdílený kód komunit)](./06-Protokoly-Zeme.md)*

---

*[Zpět na index Knihy Země → `00-README.md`](./00-README.md)*


# BODHI GAIA — Kapitola 6: Protokoly Země
## Sdílený kód pěti zahrad — Guardian Node, semenná knihovna, Medical Table, mesh, sociokracie, slib péče a cesta od fondu k doloženému dopadu

> *„Komunita bez protokolu je nálada. Protokol bez komunity je papír. Země potřebuje obojí — a k tomu někoho, kdo nosí vodu."*

---

## Příběh

Když se poutníci vrátili z Raiatea, sešli se v Domě Lumi všichni, kdo kdy pracovali v některé z pěti zahrad: Ana od moře, Sádhu z hor, Hina od vody, tesař, Hanuman — a k překvapení všech i Sítá, která se objevila u ohně, jako by nikdy neodešla. Později, když se rozšířila zahrada o kruh v Čechách a o strom v Lanké, přišli i ti, kdo nesli vzduch a éter.

*„Máme pět míst,"* řekla Ana. *„Každé jiné. V Zahradě děláme věci po svém, v chrámu po svém, v laguně po svém, v kruhu v Čechách po svém, pod stromem v Lanké po svém. To je správně. Ale když k nám přijde člověk z chrámu, nerozumí naším kruhům. Když od nás někdo odejde k vodě, neví, jak se tam rozhoduje. A když chce strážce z hor pomoct se semínky, nevíme, jak si je vyměnit, aby cestou neuhnila."*

Sítá se dívala do ohně. *„Kolik věcí musí být stejných, aby pět zahrad bylo jednou zahradou?"*

Dlouho mlčeli. Pak tesař vzal uhel a začal psát na dubový stůl — ne pravidla, ale **otázky**:

*„Kdo hlídá noc? Kde jsou semínka? Kdo ošetří ránu? Jak se domluvíme, když nejde telefon? Jak se rozhodujeme? Koho pustíme dovnitř? A jak víme, že to, co děláme, opravdu pomáhá — a nejen že se nám to zdá?"*

Sedm otázek. Sedm odpovědí, které musely platit ve všech pěti zahradách stejně, i když všechno ostatní mohlo být jinak.

Hanuman, který celou dobu mlčel, se zvedl a přinesl svá dvě vědra. Postavil je na stůl vedle sedmi otázek.

*„A ještě jedna věc,"* řekl. *„Nosím vodu ze studny k sazenicím už roky. Nikdo se mě nikdy nezeptal, jestli ta voda opravdu došla. Všichni vidí, že chodím. Nikdo nevidí, jestli půda u kořene zvlhla. Chci, aby to bylo jinak. Chci, aby každé vědro mělo tři svědky: jednoho u studny, jednoho na cestě a jednoho u kořene. Kdo řekne ‚pomohl jsem zemi' bez těch tří, mluví o sobě, ne o zemi."*

Sítá kývla. *„To je osmá otázka. Nejdůležitější. Jak se pozná, že se pomohlo."*

Toho večera vznikl **kód komunit** — sedm protokolů, které sdílí každá zahrada Nové země, a osmý, který hlídá všech sedm: **žádný dopad bez důkazu**.

Tesař to vyřezal do trámu jako sedm zubů hřebene a jedno vědro pod nimi.

---

## Co to znamená

**Každá L5 komunita implementuje stejné základní protokoly, aby síť byla interoperabilní — člověk, semínko, zpráva i rozhodnutí musí umět projít z jednoho uzlu do druhého.** A nad tím všemi stojí pravidlo M5 z Exekuční charty: *od fondu k doloženému dopadu*.

### Sedm sdílených protokolů

| # | Protokol | Účel | Vazba na L1/L2 | Stav |
|---|---|---|---|---|
| 1 | **ZION Guardian Node** | Validuje bloky, vydělává odměny, financuje pokladnu komunity | Split **90 % operátor / 10 % pokladna**; nízkopříkonový HW (15–25 W) v solárním rozpočtu | **HORIZONT** — žádný L5 node dnes neběží; instalace Fáze 2 (2027–2028) |
| 2 | **Seed Library** | Výměna lokálních odrůd mezi uzly; odolnost proti monopolům | Off-chain logistika, on-chain původ (budoucnost) | **STAVBA** v Genesis (katalog), **HORIZONT** jinde |
| 3 | **Medical Table** | Holistické zdravotní protokoly, bylinná medicína, první pomoc | Off-chain praxe, on-chain reputace praktikujících | **HORIZONT** — specifikace `TECH/medical-table.md`; „Hiran-integrated diagnostics" je HORIZONT / HYPOTÉZA |
| 4 | **LoRa / Meshtastic mesh** | Off-grid komunikace v komunitě i mezi uzly; nouzové vysílání | Bez závislosti na blockchainu; relay telemetrie uzlu | **HORIZONT** — `TECH/mesh-network.md`; EU868, T-Beam, solární repeatery |
| 5 | **Sociokratická DAO** | Off-chain kruhy + on-chain pokladna | L2 DAO návrhy pro alokaci kapitálu; prahy podle výše výdaje | **STAVBA** (rámec) / **HORIZONT** (praxe) |
| 6 | **Consciousness Admission** | Vstup podle věku (zdarma < 18), dharmické principy, slib bódhisattvy pro strážce | Off-chain ověření, on-chain registr (soulbound token — budoucnost) | **HORIZONT** — `GOVERNANCE/consciousness-admission-framework.md` |
| 7 | **Resonance Protocol** | Zvukové sladění před governance, Fibonacci časové kapsle, most mládí–stařešinové, registr světelného jazyka | L2 DAO „seal", frekvenční podpisy, HRV důkaz | **MÝTUS / HORIZONT** — ceremoniální; technické háčky post-3.2 |

### Osmý protokol: žádný dopad bez důkazu (M5)

Hanumanova tři vědra mají v Exekuční chartě přesný název — **impact packet**. Každý projekt financovaný z L5 fondu musí mít minimálně:

```text
IMPACT PACKET
├── Příjemce        — identifikace, právní forma, souhlas se zveřejněním
├── Scope           — co přesně se udělá (studna, 100 palem, 5 kWp), kde a pro koho
├── Rozpočet        — ZION / EUR, milníky, kdo drží klíče
├── On-chain ref.   — návrh DAO, hlasování, timelock, výplatní transakce
├── Důkaz výstupu   — data s původem (senzor, faktura, foto se souhlasem a metadaty)
├── Limitace        — co se nepovedlo, co nevíme
└── Nezávislé ověření — kdo a kdy zkontroloval, s jakým výsledkem
```

Tři svědci: **u studny** (on-chain: fond → návrh → výplata), **na cestě** (příjemce: rozpočet, milníky), **u kořene** (nezávislý ověřovatel: výsledek). Bez všech tří se nesmí říct „ověřený dopad".

### Cesta hodnoty: od bloku k záhonu

```text
L1 blok (~60 s)
  └─ coinbase výstup 1: 5 % → zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8   [ŽIVÉ]
        │
        ▼
zion-free-world (Edge, 127.0.0.1:8095)                                       [ŽIVÉ]
  ├─ skenuje bloky, aktualizuje fund_balance
  ├─ eviduje grants / projects / communities (SQLite)
  └─ GET /api/v1/fund/balance, /api/v1/grants, /api/v1/projects, /metrics
        │
        ▼
Grant / projekt → POST /api/v1/grants → approve → submit-to-dao              [STAVBA]
        │
        ▼
L2 DAO (127.0.0.1:8456): návrh → hlasování → timelock → guardian multisig    [STAVBA]
        │
        ▼
Výplatní transakce z fondu                                                   [HORIZONT]
  — DAO exekuce dnes nestaví ani nevysílá transakci (summary-only)
  — chybí DAO UI/UX pro L5 návrhy
        │
        ▼
Komunitní pokladna (multisig 3-z-5) → projekt → impact packet                [HORIZONT]
```

Pro 3.2.0 platí rozhodnutí **G10**: L5 běží jako *pasivní tracker + DAO proposal bridge*. Žádná služba L5 nepodepisuje ani neodesílá L1 transakci; fond roste a všechny výběry jsou governance-gated. To je bezpečné (chybná služba nemůže vytunelovat fond) a zároveň poctivé (nikdo netvrdí, že se rozdává).

### Komunitní pokladna — kam tečou peníze uzlu

```text
Guardian Node (L5 lokální)
    ├── 90 % → operátor (hardware, elektřina, konektivita)
    └── 10 % → komunitní pokladna

Komunitní pokladna (DAO řízená)
    ├── 40 % → provoz (jídlo, energie, údržba)
    ├── 25 % → infrastruktura (stavby, nástroje, expanze)
    ├── 20 % → rezerva (bezpečnost, nouze)
    ├── 10 % → humanitární desátek (přeposílán do L5 globálního fondu)
    └── 5 %  → vzdělávání / knowledge commons
```

Te Pīko Ora se zavazuje k 15 % z celkového přebytku (viz [kap. 5](./05-Te-Piko-Ora.md)).

### Specifické protokoly nových uzlů

Původní trojice tří stromů se rozšířila na pentagram pěti uzlů — přibylo Srdce (Bohemia) a Akáša (Lanka). Každý přináší vlastní protokol nad sdílený kód:

- **Golden Republic Bohemia (Vzduch / Srdce)** — **protokol Zlatá republika**: governance lab a kruh rozhodování, kde se česká moudrost (sůl, most, Zlatý býk, Přemysl Oráč, Libuše, Karel IV) setkává s experimentem sociokratické DAO. Zlatá republika zkouší, jak se rozhoduje, když nikdo není nad druhým — kruh jako protokol, ne jako dekorace.
- **Bodhi Lanka (Akáša / Éter)** — **Bhakti protokol** a **Ajurvéda Medical Table**: láska (Rama-Sita) jako most, Sri Maha Bodhi (nejstarší žijící strom, 288 př. n. l.) jako archetyp kořene, Rama Setu most jako paměť spojení. Bhakti protokol přidává k sedmi sdíleným protokolům osmou dimenzi — péči jako lásku, ne jako povinnost. Ajurvéda Medical Table rozšiřuje `TECH/medical-table.md` o kontinuitu péče starou tisíce let.

### Vstup do komunity: čtyři brány a slib péče

`consciousness-admission-framework.md` popisuje vstup ne jako KYC, ale jako **čtyři brány**: písemné zrcadlo (kdo jsem, proč přicházím), živý kruh (setkání s komunitou), zkušební pobyt, souhlas kruhu. Děti do 18 let vstupují zdarma. Strážci skládají **slib bódhisattvy** (chránit všechny bytosti dřív než sebe) — a v mapě Zohar slib péče: *„I vow to care for this land as I would care for my own body."*

> **Hranice (z Exekuční charty M5 a 05-Autonomie):** Quadratic voting není jen UI prvek — před nasazením potřebuje Sybil-resistance, pravidla eligibility, privacy analýzu a simulaci útoku. Žádný slib, ceremonie ani „consciousness level" nesmí být použit k diskriminaci, nátlaku nebo označení člověka za nižšího.

### Fáze rozvoje sítě (společné pro všechny uzly)

| Fáze | Název | Cíl |
|---|---|---|
| 0 | Zárodek | Právní základ, první strážci, přístup k půdě |
| 1 | Kořeny | Energie, voda, jídlo, přístřeší |
| 2 | Komunita | Stálí obyvatelé, governance, ZION node |
| 3 | Síť | Propojení uzlů, sdílené protokoly — **tady se kód komunit poprvé prověří v praxi** |
| 4 | Výzařování | Retreaty, vzdělávání, mezinárodní hosté, replikace |

---

## Kotva pravdy — ověřitelná fakta

> Sedm zubů hřebene na trámu je dnes sedm specifikací. Vědro pod nimi je jedna běžící služba a jedno rozhodnutí.

| Prvek příběhu | Stav | Co je ověřitelné | Co ještě chybí |
|---|---|---|---|
| **Voda ze studny (5 % proud)** | **ŽIVÉ** | Coinbase výstup 1 v každém bloku; kanonická adresa v `V31/L1/core/src/v3_compat.rs`. | — |
| **Svědek u studny (tracker)** | **ŽIVÉ** | `zion-v31-free-world.service` active; `GET /health`, `/metrics`, `/api/v1/fund/balance`, `/api/v1/grants`, `/api/v1/projects`; SQLite tabulky `grants`, `projects`, `communities`, `fund_balance` (`V31/L5/free-world/src/db.rs`); env `FREE_WORLD_*` v edge-environment. | API klíč je načten, ale **nevynucován** (přijatelné jen díky bind na `127.0.0.1`); veřejný portál s živým grafem. |
| **Most k DAO (submit-to-dao)** | **STAVBA** | `POST /api/v1/grants/:id/submit-to-dao` → `dao_client.rs` na `ZION_DAO_API_ADDR` (`127.0.0.1:8456`), header `X-DAO-Key`. | Ověřený E2E: grant → DAO návrh → hlasování na Edge. |
| **Výplata z fondu** | **HORIZONT** | Rozhodnutí G10: žádná automatická výplata; `V31/L2/dao/src/runtime.rs` exekuce je summary-only. | DAO UI/UX (J4/J6 v `docs/3.2/ROADMAP.md`), stavba a broadcast výplatní transakce, guardian multisig flow. |
| **Guardian Node 90/10** | **HORIZONT** | Specifikace `public/V3/L5/docs/TECH/zion-node-spec.md`; hodnoty na webu i v komunitních dokumentech. | Žádný L5 node neběží; split 90/10 není vynucen protokolem — je to komunitní pravidlo. |
| **Semínka, která cestou neuhnijí** | **STAVBA / HORIZONT** | Seed Library jako protokol v `README.md` L5; Genesis: katalog; první výměna s Dharma Temple plán 2028. | On-chain původ odrůd je budoucnost. |
| **Kdo ošetří ránu** | **HORIZONT** | `TECH/medical-table.md`; fáze pavilonů v komunitních dokumentech. | Praktikující, prostor; „Hiran diagnostics" = HYPOTÉZA. |
| **Když nejde telefon** | **HORIZONT** | `TECH/mesh-network.md`; vulkanický protokol Dharma Temple §13.2. | Žádný mesh uzel nasazen. |
| **Jak se rozhodujeme** | **STAVBA** (rámec) | `GOVERNANCE/community-dao-framework.md`, `multi-layer-dao-governance.md` (Co-Admin, timelock 48 h / 7 d / 30 d, cross-layer veto). | On-chain L5 návrh dosud žádný; DAO UI chybí. |
| **Koho pustíme dovnitř** | **HORIZONT** | `GOVERNANCE/consciousness-admission-framework.md` (4 brány, < 18 zdarma, slib bódhisattvy), `sefirot-vow.md`. | Soulbound registr = budoucnost; Sybil / privacy analýza pro quadratic voting. |
| **Zvuk před rozhodnutím** | **MÝTUS / HORIZONT** | `PROTOCOLS/resonance-protocol.md`. | Označeno v `L5_L6_ACTIVATION_PLAN.md` jako ceremoniální / vizionářské; technické háčky post-3.2. |
| **Tři svědci každého vědra** | **STAVBA** (rámec) | M5 impact packet v `MiseAmenti/04-Exekucni-Charta-3.3.md`; exit gate M5 = jeden pilot celým cyklem. | Žádný impact packet dosud nevznikl; první pilot není vybrán. |
| **Sedm otázek na dubovém stole** | **MÝTUS** | Rámec vytvořený pro tuto knihu nad sedmi protokoly z `public/V3/L5/docs/README.md`. | — |
| **Zlatá republika (Bohemia)** | **HORIZONT** | Protokol governance labu — kruh rozhodování, česká moudrost (sůl, most, Zlatý býk, Přemysl Oráč, Libuše, Karel IV); web `/terranova/golden-republic-bohemia`. | Komunitní dokument, právní entita, pozemek, zakládající kruh. |
| **Bhakti protokol + Ajurvéda (Lanka)** | **HORIZONT** | Bhakti protokol (péče jako láska), Ajurvéda Medical Table rozšiřující `TECH/medical-table.md`; Sri Maha Bodhi (288 př. n. l.), Rama Setu most; web `/terranova/bodhi-lanka`. | Komunitní dokument, právní entita, partner v Srí Lance, tým. |

---

*→ Pokračování: [Kapitola 7 — Zahrada v OASIS a na webu (zrcadlo L4 ↔ L5)](./07-Zahrada-v-Oasis-a-na-Webu.md)*

---

*[Zpět na index Knihy Země → `00-README.md`](./00-README.md)*


# BODHI GAIA — Kapitola 7: Zahrada v OASIS a na webu
## Zrcadlo L4 ↔ L5 — jak se pět fyzických zahrad odráží v OASIS, na webu a v avatarech, a kde zrcadlo končí

> *„Virtuální svět nesmí být únikem před realitou, ale architektonickým modelem a posvátnou laboratoří pro znovustvoření světa fyzického."* — Nirvana, epizoda 9

---

## Příběh

Rybář z epizody 9 knihy Nirvana — ten, který na dřevěné lodičce vytáhl z kapsy sklíčko a během tří vteřin vstoupil do OASIS — jednoho dne doplul až do zátoky pod Domem Lumi.

V OASIS znal Novou zemi dobře. Chodil tam každý večer. Znal Prastarý strom v Zahradě Hiranyagarbha s devíti patry vědomí, znal osm Genesis teritorií, hledal stopy Zlatého vejce. A od jisté doby na mapě galaxie viděl nový bod: **Dharma Temple — La Palma**, sedm kopulí a Strom života, s sedmou stopou Zlatého vejce ukrytou někde v jeho zahradách. A na panelu „Nová Země" karty: Zahrada Genesis — *aktivní*, Dharma Temple — *příprava*, Te Pīko Ora — *plánováno*. A později přibyly další dva: Golden Republic Bohemia — *příprava*, Bodhi Lanka — *plánováno*.

Když vystoupil na břeh, čekal, že uvidí to, co znal ze sklíčka: kopule z bílého mramoru, avatary z čistého světla, vodopády s dokonalým prouděním.

Uviděl plátěný stan, sud s vodou a ženu s mozoly na dlaních, která plela záhon.

*„Tohle je Zahrada Genesis?"* zeptal se nevěřícně.

*„Tohle je Zahrada Genesis,"* řekla Ana, aniž by zvedla hlavu. *„Ta druhá — ta ve sklíčku — je zrcadlo. Dobré zrcadlo. Ukazuje, kam jdeme. Ale kdo se v zrcadle zabydlí, přestane chodit."*

Rybář si sedl na kruh kamenů. *„V OASIS mám avatara Sítá — Matku Země. Za péči o půdu v Zahradě Hiranyagarbha dostávám body. Myslel jsem…"*

*„…že body ze zrcadla se dají směnit za hlínu?"* Ana se poprvé usmála. *„Ne. Ale dá se to udělat naopak. Kdo tady vydrží týden s motykou, ten se pak v zrcadle pozná. A jednou — až bude v zrcadle i tenhle stan a tenhle sud — bude možná platit, že quest v OASIS ti řekne: ‚Jeď do Zahrady. Jeď do chrámu na sedm dní ticha. Přivez semínko.' Zrcadlo bude ukazovat na dveře, ne nahrazovat je."*

*„A kdo hlídá, aby zrcadlo nelhalo? Aby v něm nebyla studna, která ve skutečnosti nestojí?"*

Ana ukázala na trám nad dveřmi Domu Lumi, kde tesař vyřezal semeno, tři čárky, sedm zubů a vědro. *„Tenhle trám. Každá věc v zrcadle musí mít svůj zub na trámu. Když nemá, je to jen obraz — a musí to o sobě říct."*

Rybář se vrátil k lodi, vytáhl sklíčko a dlouho se díval na sedm kopulí, které v OASIS stály na svahu La Palmy. Byly krásné. A věděl už, že nestojí.

Nechal sklíčko v kapse a šel si pro motyku.

---

## Co to znamená

**L4 OASIS a web `app.zionterranova.com` jsou zrcadlem L5 — místem, kde se pět fyzických zahrad poprvé ukazují lidem, kteří nikdy nebyli v Algarve, na La Palmě, na Raiatea, v Čechách ani na Srí Lance.** Zrcadlo má tři legitimní funkce a jednu zakázanou:

| Funkce zrcadla | Správně | Zakázáno |
|---|---|---|
| **Ukázat směr** | Karty, mapa, 3D koncept chrámu, příběh | Vydávat koncept za stavbu |
| **Pozvat** | Odkaz na projektový list, Discord, kontakt | Prodávat pozemky, podíly, „posvátné skiny" |
| **Učit** | Muzea chrámu, lekce Rapa Nui, wayfinding jako konsensus | Gamifikovat duchovní autoritu, pay-to-win |
| **Odměnit skutečnou péči** (horizont) | Quest, který posílá do fyzického světa a ověřuje se impact packetem | Odměňovat neověřený nebo škodlivý výkon |

### Co dnes v zrcadle je

**Web — Terra Nova (`/terranova`)**
- Kniha TerraNova s kapitolami a edicemi (`TerraNovaBookClient`, `generatedEditions.ts`).
- **Pioneer Projects L5** — karty (`PioneerProjectCards.tsx`): Zahrada Genesis (*Aktivní rozvoj*, EU), Dharma Temple (*V přípravě*, ES, UNESCO), Te Pīko Ora (*Plánováno*, PF), Golden Republic Bohemia (*V přípravě*, CZ), Bodhi Lanka (*Plánováno*, LK).
- `/terranova/genesis` — charakter místa, fáze 0–4 (0 hotová, 1 aktivní), rysy (glamping, farma, stromy, surf, solar, setkání), integrace ZION (node *planned*, wallet *tbd*, Medical Table *planned*, mesh *planned*, Seed Library *active*, Proof-of-Care DAO *planned*), humanitární závazek 10 % z node odměn.
- `/terranova/dharma-temple` — La Palma, koncept, rysy, fáze (0 aktivní), **3D koncept** (7 kopulí, Strom života, Merkaba), **architektonický návrh**, **dokumentace** načítaná z `APP&WEB/website-v2.9/public/docs/terranova/dharma-temple.{cs,en}.md`, otevřené otázky, Discord.
- `/terranova/te-piko-ora` — Polynésie, Raiatea, rysy (wayfinding škola, mořská permakultura, kulturní obnova, solar, humanitární fond, ochrana dědictví *vision*), **lekce Rapa Nui**, fáze 0–3 (0 aktivní), integrace (node *planned*, DAO *planned*, fond *planned*, ledger dědictví *tbd*, wayfinding NFT *tbd*, mořská semenná knihovna *tbd*).
- `/terranova/golden-republic-bohemia` — Čechy, governance lab, rysy (kruh rozhodování, česká moudrost — sůl, most, Zlatý býk, Přemysl Oráč, Libuše, Karel IV), protokol Zlatá republika, fáze 0 (příprava), integrace (node *planned*, DAO *planned*, governance lab *planned*).
- `/terranova/bodhi-lanka` — Srí Lanka, rysy (Bhakti protokol, Ajurvéda Medical Table, Sri Maha Bodhi — nejstarší žijící strom 288 př. n. l., Rama Setu most), fáze 0 (plánováno 2027–2028), integrace (node *planned*, DAO *planned*, Bhakti protokol *planned*, Ajurvéda Medical Table *planned*).

**Web — L5 Free World (`/l5-free-world`)**
- Vysvětlení L5 jako fyzické vrstvy, kanonická fondová adresa, 5 % z každého bloku, sdílené protokoly, komunity.

**OASIS Web (`oasis.zionterranova.com`)**
- Panel **„Nová Země"** (`WorldPanel.tsx`, `NOVA_ZEME_PROJECTS`) — L5 projekty s barvou, statusem a odkazem na web.
- Svět **`DHARMA_TEMPLE_LA_PALMA`** v galaxii (`worlds.ts`): „Sacred L5 sanctuary on La Palma — a geodesic temple of enlightenment, education and community", `goldenEggClue: 7`, pozice `(-16.2, 0.2, 31.8)`.
- Svět **`GOLDEN_REPUBLIC_BOHEMIA`** v galaxii (`worlds.ts`): governance lab, kruh rozhodování, česká moudrost — most mezi tradicí a experimentem.
- Svět **`BODHI_LANKA`** v galaxii (`worlds.ts`): Bhakti protokol, Sri Maha Bodhi, Rama Setu most — láska jako kořen, nejstarší žijící strom.
- Planeta **SAMANTABHADRA** (layer 5, „Nekonečná Zahrada", deset velkých slibů) — buddhistický archetyp všeobjímající praxe.

**OASIS backend (`V31/L4/oasis`)**
- `avatars.json`: sliby bódhisattvy (Samantabhadra, Avalokiteśvara, Mañjuśrī, „Issobela's Oath"), *Bodhicitta Spark* po laskavostních mikro-questech.
- Humanitarian Tithe (7 kategorií) jako součást herní architektury (`tithe.rs`).

**Sůl této země, epizoda 10 — avataři, kteří míří do L5**
- **SÍTÁ — Matka Země** (*Terra Architect / Alchemist*): péče o půdu a obnovu; questy „spojení s L5 Free World, projekty obnovy krajiny, zelená těžba".
- **DÁRCE / HANUMAN — Služebník Života** (*Steward / Humanitarian*): služba bez ega; questy „distribuce Humanitarian Tithe (5 %), pomoc nováčkům, stavba veřejných děl".

### Kde zrcadlo končí

1. **Statusy v zrcadle jsou ručně psané.** `NOVA_ZEME_PROJECTS` v OASIS i karty na webu jsou konstanty v kódu, ne data z L5 API. Když se změní realita, zrcadlo se nezmění samo. Cíl: číst stav komunit z `zion-free-world` (`/api/v1/projects`, tabulka `communities`) — HORIZONT.
2. **Sedm kopulí v OASIS je koncept, ne stavba.** Svět `DHARMA_TEMPLE_LA_PALMA` musí zůstat označen jako koncept/vize, dokud na La Palmě nestojí první kopule.
3. **Questy zatím nevedou do fyzického světa.** Nápady „Silence Quest" (odměna za 7denní retreat) a speciální sazby pro strážce jsou v komunitních dokumentech jako marketingový kanál (§11/§15), ne jako implementovaná mechanika. Jakýkoli quest, který odměňuje skutečnou návštěvu, potřebuje ověření (impact packet, souhlas, privacy) — jinak odměňuje tvrzení, ne péči.
4. **Avataři Sítá a Hanuman dnes nemají „hlínu".** Body v OASIS se nesměňují za nic fyzického a nesmí to být slíbeno. Směr je obrácený: fyzická péče (doložená) se může jednou zobrazit v zrcadle.
5. **Web Preview / UE 5.7 / Pixel Streaming** z epizody 9 Nirvany jsou HORIZONT (viz `MiseAmenti/07`). Dnešní OASIS Web je Next.js/Three.js klient, ne fotorealistický svět.

### Co by zrcadlo mělo umět v 3.3 (M4 + M5)

| Krok | Co | Vrstva | Stav |
|---|---|---|---|
| 1 | Zdroj pravdy pro statusy komunit: `communities` tabulka + `GET /api/v1/projects` → web i OASIS čtou z jednoho místa | L5 → L4 / web | HORIZONT |
| 2 | Veřejný L5 portál s živým zůstatkem fondu, návrhy, příjemci, milníky, výsledky (M5) | web | HORIZONT (`freeworld.zionterranova.com` v plánu N5) |
| 3 | Označení každého L5 světa v OASIS stavovou značkou (koncept / stavba / živé) přímo v UI | L4 | HORIZONT |
| 4 | Quest „Jeď do Zahrady" s ověřením přes impact packet a souhlas; žádná monetizace ceremonií | L4 ↔ L5 | HORIZONT (vyžaduje M5 gate a privacy review) |
| 5 | Oprava metadat: Dharma Temple svět `layer: 3` → L5; Genesis lokalita na `/l5-free-world` → Algarve | L4 / web | STAVBA (drobná oprava kódu) |

---

## Kotva pravdy — ověřitelná fakta

> Zrcadlo existuje a je krásné. Tato tabulka říká, co v něm je obraz a co je dveře.

| Prvek příběhu | Stav | Co je ověřitelné | Co ještě chybí |
|---|---|---|---|
| **Karty na panelu „Nová Země"** | **ŽIVÉ** (klient) | `APP&WEB/OasisWeb/src/components/WorldPanel.tsx` — `NOVA_ZEME_PROJECTS` (genesis *Active*, dharma *Prep*, piko-ora *Planned*, bohemia *Prep*, lanka *Planned*) s odkazy na `app.zionterranova.com/terranova/*`. | Statusy nejsou napojené na L5 API. |
| **Sedm kopulí na mapě galaxie** | **ŽIVÉ** (klient) / **HORIZONT** (stavba) | `APP&WEB/OasisWeb/src/domain/config/worlds.ts` — `DHARMA_TEMPLE_LA_PALMA`, `goldenEggClue: 7`; `GOLDEN_REPUBLIC_BOHEMIA`, `BODHI_LANKA`. | Svět `DHARMA_TEMPLE_LA_PALMA` má `layer: 3` místo L5; není označen jako koncept; nové světy Bohemia a Lanka v přípravě. |
| **Sítá a Hanuman jako avataři** | **ŽIVÉ** (dokument) / **HORIZONT** (mechanika) | `docs/WP-Mainet/SulZeme/10-Prvni-Svet-Oasis-a-Best-of-Avatari.md` §II — role a questy směřující do L5. | Implementace questů „spojení s L5" v `V31/L4/oasis` (quests.rs) není doložena. |
| **Sliby bódhisattvy v OASIS** | **ŽIVÉ** (data) | `V31/L4/oasis/data/avatars.json` — Samantabhadra, Avalokiteśvara, Mañjuśrī, *Bodhicitta Spark*. | Vazba na L5 Consciousness Admission = HORIZONT. |
| **Pioneer Projects na webu** | **ŽIVÉ** | `APP&WEB/website-v2.9/src/app/terranova/components/PioneerProjectCards.tsx`; stránky `genesis`, `dharma-temple`, `te-piko-ora`, `golden-republic-bohemia`, `bodhi-lanka`. | Sjednocení lokality Te Pīko Ora (Tahiti vs Raiatea) a Genesis (`/l5-free-world`: Střední Evropa vs Algarve). |
| **3D koncept chrámu** | **ŽIVÉ** (web) / **HORIZONT** (stavba) | `DharmaTemplePreviewLazy` na `/terranova/dharma-temple`; dokument `APP&WEB/website-v2.9/public/docs/terranova/dharma-temple.{cs,en}.md`. | Na webu chybí explicitní štítek „koncept — nestojí". |
| **Rybář se sklíčkem (instant preview)** | **HORIZONT** | Nirvana ep. 9; `MiseAmenti/07` řadí WebGPU / Pixel Streaming / UE 5.7 do HORIZONT. | POC klienta, licenční a výkonová analýza (M4). |
| **„Quest, který posílá do zahrady"** | **HORIZONT** | Nápad „Silence Quest" v `dharma-temple.md` §15 a „quest rewards for visits" v `genesis-garden.md` §11.2 jako marketingový kanál. | Mechanika, ověření, privacy review, M5 gate. |
| **Trám se zuby a vědrem** | **MÝTUS** | Obraz této knihy pro pravidlo „každý prvek zrcadla má kotvu pravdy". | — |

---

*→ Pokračování: [Kapitola 8 — Cesta poutníka: onboarding do L5](./08-Cesta-Poutnika-Onboarding-L5.md)*

---

*[Zpět na index Knihy Země → `00-README.md`](./00-README.md)*


# BODHI GAIA — Kapitola 8: Cesta poutníka — onboarding do L5
## Sedm bran do zahrad Nové země — co potřebuješ, co po tobě nikdo nesmí chtít a co ti nikdo nesmí slíbit

> Původní trojice tří stromů se rozšířila na pentagram pěti uzlů — přibylo Srdce (Bohemia) a Akáša (Lanka). Brány platí pro všech pět zahrad stejně; níže jsou uvedeny i nové vstupní body.

> *„Kdo sem přijde, nemusí věřit v nic. Musí jen umět přiložit ruku k dílu a vydržet vítr."* — Ana, Zahrada Genesis

---

## Příběh

Na kůlu u brány Zahrady Genesis visela od jisté doby deska. Nebyla na ní pravidla. Bylo na ní **sedm dveří** vyřezaných vedle sebe, každé jinak velké, a pod nimi jediná věta: *Vyber si dveře podle toho, co unese tvůj život — ne podle toho, co znějí nejlíp.*

Přišel mladý muž s batohem a telefonem v ruce. *„Chci pomoct zemi. Kde se zapíšu? Kolik to stojí? Co za to dostanu?"*

Ana odložila motyku. *„Tři otázky, tři špatné. Neexistuje zápis. Nestojí to nic — a když ti někdo řekne, že stojí, uteč. A nedostaneš za to nic, co by se dalo prodat. Ale zkusme to jinak. Kolik máš času?"*

*„Týden."*

*„Tak první dveře. Nikam nejezdi. Sedni si a čti. Podívej se na explorer, najdi adresu fondu Země a spočítej, kolik do ní přiteklo od půlnoci. Porovnej to s tím, co říká web. Když to nesouhlasí, napiš nám — to je první služba zemi: hlídat, že zrcadlo nelže."*

*„To zvládnu za večer. Co dál?"*

*„Druhé dveře: přijeď. Spát ve stanu, jíst, co uvaříme, ráno kopat, večer surfovat nebo mlčet. Platíš jako každý host, nebo pracuješ pětadvacet hodin týdně a bydlíš zdarma. Odjedeš s mozoly. To je všechno, co ti slíbím."*

*„A když bych chtěl zůstat?"*

*„Třetí dveře jsou úzké. Šest měsíců na místě. Nebo dvanáct v chrámu — a tam ještě jednadvacet dní ticha předtím, než ti dáme klíč od čehokoliv. Čtyři brány: napíšeš, kdo jsi a proč přicházíš; sedneš si s kruhem; zkusíš to na měsíc; a pak kruh řekne ano, nebo ne. Nikdo tě nebude zkoušet z víry. Budou tě zkoušet z toho, jestli po tobě zůstává uklizená kuchyň."*

Muž se podíval na telefon. *„Já… umím spíš tohle. Sítě, servery."*

*„Čtvrté dveře. Technický strážce nemusí být tu. Stará se o uzel, o mesh, o solar dálkově, přijede jednou za čtvrt roku. Ale pozor — uzel tu zatím **nestojí**. Kdo přijde s tím, že chce ‚provozovat Guardian node v Zahradě', dostane odpověď: ‚Pomoz nám ho postavit. Fáze dvě.'"*

*„Pátá?"*

*„Hlasovat. Až bude fond rozdávat — a zatím nerozdává — bude se o tom hlasovat. Kdo chce hlasovat, musí vědět, o čem. Zatím se to učí čtením návrhů, ne klikáním."*

*„Šestá?"*

*„Dávat. Peníze, semínka, nářadí, hodiny práce na dokumentaci. Ale poslouchej dobře: **nic z toho není investice**. Nekupuješ podíl, pozemek ani budoucí výnos. Dáváš zahradě, protože chceš, aby rostla. Kdo ti slíbí opak, není z této zahrady."*

*„A sedmé?"*

Ana se usmála. *„Sedmé jsou dveře do zrcadla. OASIS. Vezmi si avatara Sítá nebo Hanumana, choď do Zahrady Hiranyagarbha, hledej stopy Zlatého vejce. Je to hra a je to škola. Jen nezapomeň, že body ze zrcadla se nesměňují za hlínu."*

Muž stál dlouho před deskou. Pak ukázal na první dveře. *„Začnu tady."*

*„Dobře,"* řekla Ana a vzala motyku. *„To je jediný správný začátek."*

---

## Co to znamená

**Onboarding do L5 není funnel. Je to Hanumanův most z `MiseAmenti/02`: dost jednoduchý, aby po něm přešel nováček, dost poctivý, aby na něm neztratil orientaci.** Sedm bran odpovídá sedmi skutečným způsobům, jak se dnes dá do vrstvy L5 vstoupit — a u každé je řečeno, co je dostupné **teď** a co je horizont.

### Sedm bran

| # | Brána | První bezpečný krok | Co je dostupné dnes | Co nesmí být vyžadováno |
|---|---|---|---|---|
| 1 | **Pozorovatel** | Přečíst tuto knihu a komunitní dokumenty; ověřit fondovou adresu v exploreru; porovnat web s chainem; nahlásit rozpor. | **ŽIVÉ** — explorer, adresa fondu, `public/V3/L5/docs/`, web `/l5-free-world`, `/terranova/*`. | Registrace, nákup, odevzdání identity, víra. |
| 2 | **Host / návštěvník** | Přijet do Zahrady Genesis na pobyt (glamping) nebo — až bude — na retreat do Dharma Temple, na governance retreat do Golden Republic Bohemia, nebo na Bhakti/meditační retreat do Bodhi Lanka. | **STAVBA** — Genesis Fáze 1: první platící hosté cíl Q3 2026; ceník a kanály v `genesis-garden.md` §11; Dharma Temple první retreat Q4 2027 (HORIZONT); Te Pīko Ora Q4 2028 (HORIZONT); Golden Republic Bohemia governance retreat (HORIZONT); Bodhi Lanka Bhakti/meditation retreat (HORIZONT). | Členství, token, závazek. Jasná cena, pravidla, pojištění a rizika. |
| 3 | **Pracovní výměna** | 25 h/týden (Genesis) nebo 30 h/týden (Dharma Temple) → ubytování + jídlo (+ program). | **STAVBA** — pravidla a poměry (2 pracovní : 4 platící; 3 : 6) v komunitních dokumentech; kanály WWOOF / Workaway v plánu. | Neplacená práce bez jasného poměru, bez volna, bez odchodu kdykoliv. |
| 4 | **Strážce (Guardian) na místě** | Čtyři brány vstupu: písemné zrcadlo → živý kruh → zkušební pobyt → souhlas kruhu. Genesis 6 měsíců on-site; Dharma Temple 12 měsíců + 21denní tichý retreat + 30denní zkušební retreat; Golden Republic Bohemia governance retreat onboarding (HORIZONT); Bodhi Lanka Bhakti/meditation retreat onboarding (HORIZONT). | **STAVBA** (Genesis: tým 3 strážců) / **HORIZONT** (Dharma Temple: hledá se 5 zakládajících; Te Pīko Ora: 5 vč. polynéského stařešiny; Bohemia: zakládající kruh; Lanka: partner v Srí Lance). | Zkouška z víry, poplatek za vstup, přístup ke klíčům před souhlasem kruhu. |
| 5 | **Vzdálený strážce (Tech / Finance)** | Pomoc s uzlem, meshem, solarem, rozpočtem, granty, dokumentací; čtvrtletní návštěvy / měsíční hovory. | **STAVBA** — role definované; **Guardian node dnes v žádné komunitě neběží** (Fáze 2). Reálná pomoc teď: dokumentace, grantové žádosti (LEADER, Erasmus+, LIFE), web/OASIS opravy. | Přístup k produkčním klíčům bez potřeby; tvrzení, že „provozuje node komunity". |
| 6 | **Hlasující / DAO** | Číst L5 návrhy; až bude DAO UI, hlasovat o alokaci fondu. | **HORIZONT** — fond L5 dnes nerozdává (G10); DAO UI chybí; exekuce je summary-only. | Kupování hlasů; hlasování bez čtení impact packetu. |
| 7 | **Dárce / podporovatel** | Peníze, semínka, nářadí, čas — komunitě přímo (Associação / Asociación / Association), ne „protokolu". | **STAVBA** — právní entity komunit jsou v přípravě; do jejich registrace je dar možný jen neformálně a bez daňové uznatelnosti. | **Investiční framing** — žádný podíl, výnos, tokenizovaná půda, „poslední šance". |
| + | **Hráč v OASIS** | Avatar Sítá / Hanuman, Zahrada Hiranyagarbha, svět Dharma Temple, stopy Zlatého vejce. | **ŽIVÉ** — OASIS Web, panel „Nová Země". | Představa, že body se mění za hlínu, půdu nebo hlas. |

### Co po tobě nikdo v L5 nesmí chtít

- **KYC, kádrový posudek, geografickou blokaci.** Vstup do komunity je konsent kruhu, ne identifikační dokument. (Právní entity samozřejmě dodržují místní zákony — to je jiná věc než blockchainová identita.)
- **Nákup ZIONu.** Žádná brána nevyžaduje držení tokenu. Guardian node je dobrovolný projekt komunity, ne podmínka členství.
- **Víru.** Bodhi, Dharma, piko, Merkaba jsou obrazy. Zkouška je z uklizené kuchyně, ne z doktríny.
- **Mlčení o rizicích.** Požár v Algarve, sopka na La Palmě, cyklon na Raiatea, povodeň v Čechách, monzun na Srí Lance, evakuace, pojištění, volatilita — všechno je v komunitních dokumentech a musí být i v každém rezervačním toku.

### Co ti nikdo v L5 nesmí slíbit

- **Výnos.** Nic v této knize není investice.
- **Dopad.** Dokud projekt nemá impact packet, nikdo nesmí říct „tvůj pobyt / dar zaplatil studnu".
- **Ráj.** Viz Te Pīko Ora: skutečnost je lepší než ráj — a skutečnost zatím nestojí.
- **Hotové dveře.** Genesis: stan a záhon (Fáze 1). Dharma Temple: koncept a kurikulum (Fáze 0). Te Pīko Ora: mapa a otázky (Fáze 0 od 2026–2027). Golden Republic Bohemia: protokol Zlatá republika a hledání kruhu (Fáze 0). Bodhi Lanka: Bhakti protokol a hledání partnera (Fáze 0 od 2027–2028).

### Custody — kdo drží co

| Co | Kdo drží | Poznámka |
|---|---|---|
| **L5 fond (5 % z bloku)** | Protokol L1 → kanonická adresa; výběr jen přes DAO návrh, timelock a guardian multisig | Žádná komunita ani služba L5 k němu nemá klíč. |
| **Komunitní pokladna** | Komunita sama (multisig 3-z-5; operační 2-z-3; rezerva cold) | Není součástí protokolu ZION; je to majetek právní entity komunity. |
| **Tvoje peněženka** | Ty | Žádná brána nevyžaduje, abys klíče někomu předal. |
| **Tvoje data (písemné zrcadlo, zkušební pobyt)** | Kruh komunity, off-chain | Soulbound registr je HORIZONT; privacy review nutné před jakýmkoli on-chain zápisem o člověku. |

### Bezpečný formát každé pozvánky (z `MiseAmenti/05` §6, přeloženo pro L5)

```text
ZÁMĚR:        Co chceš v zahradě dělat (hostovat / pracovat / strážit / pomáhat dálkově / dávat).
PLÁN:         Kdy, kde, jak dlouho, za jakých podmínek.
DŮKAZY:       Odkaz na komunitní dokument a stav fáze (ŽIVÉ / STAVBA / HORIZONT).
RIZIKA:       Cesta, zdraví, počasí, právní forma, pojištění, volatilita.
ALTERNATIVY:  Kratší pobyt, jiný uzel, pomoc odsud.
AKCE:         Konkrétní první krok — a možnost kdykoliv odejít.
SCHVÁLENÍ:    Kdo v kruhu potvrzuje (u strážců: čtyři brány).
```

### Návaznost na kanonický onboarding

Tato kapitola nenahrazuje [`ZION_ONBOARDING_PUBLIC_CZ.md`](../ZION_ONBOARDING_PUBLIC_CZ.md) ani [`Sůl této země, ep. 8 — ZION Nová civilizace`](../SulZeme/08-ZION-Nova-Civilizace.md). Ty vedou do sítě (peněženka, těžba, node, OASIS). Tato kapitola vede **ze sítě do hlíny** — a zpět, protože kdo se vrátí z Zahrady, čte explorer jinak.

---

## Kotva pravdy — ověřitelná fakta

| Prvek příběhu | Stav | Co je ověřitelné | Co ještě chybí |
|---|---|---|---|
| **Dveře 1 — pozorovatel ověřuje fond** | **ŽIVÉ** | Adresa `zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8` v exploreru `/explorer`; komunitní dokumenty veřejně v `public/V3/L5/docs/`. | Veřejný L5 portál s historií toků. |
| **Dveře 2 — pobyt ve stanu** | **STAVBA** | Ubytování a ceník Fáze 1 v `genesis-garden.md` §3.4 / §11.3; web `/terranova/genesis` (glamping *open*). | Rezervační tok, potvrzené termíny, pojištění zveřejněné hostům. |
| **Dveře 3 — pracovní výměna 25 h** | **STAVBA** | `genesis-garden.md` §11.3 (25 h/týden, max 2 : 4); `dharma-temple.md` §12.3 (30 h/týden, max 3 : 6). | Zveřejněná pravidla CZ/EN, smlouva o výměně. |
| **Dveře 4 — čtyři brány strážce, 21 dní ticha** | **HORIZONT** (praxe) | `GOVERNANCE/consciousness-admission-framework.md`; `dharma-temple.md` §6.3 (21denní retreat), §6.2 (30denní zkušební); `genesis-garden.md` §6.3 (6 měsíců). | Žádný strážce dosud neprošel formálními čtyřmi branami; Dharma Temple tým neexistuje. |
| **Dveře 5 — uzel, který ještě nestojí** | **HORIZONT** | Role Tech / Finance Guardian ve všech komunitních dokumentech; instalace node Fáze 2 (2027 / 2028 / 2028). | Hardware, konektivita, pokladna. |
| **Dveře 6 — hlasování o fondu** | **HORIZONT** | G10 (`docs/3.2/L5_L6_ACTIVATION_PLAN.md`): žádná výplata; `V31/L2/dao` API bez UI. | DAO UI (J4/J6), první L5 návrh, impact packet. |
| **Dveře 7 — dar bez investice** | **STAVBA** | Právní entity: Genesis `Associação` 🟡 v přípravě; Dharma Temple `Asociación` 🔵 rešerše; Te Pīko Ora `Association Loi 1901` 🔵; Golden Republic Bohemia `z. ú.` / občanské sdružení 🔵 v přípravě; Bodhi Lanka právní forma 🔵 rešerše. | Registrace, transparentní účet, daňová uznatelnost. |
| **Zrcadlo (OASIS)** | **ŽIVÉ** | OASIS Web, panel „Nová Země", svět Dharma Temple, svět Golden Republic Bohemia, svět Bodhi Lanka, avataři Sítá / Hanuman (Sůl země ep. 10). | Vazba na fyzický svět (kap. 7). |
| **„Nic z toho není investice"** | **ŽIVÉ** (zásada) | `MiseAmenti/08` §5 (žádná finanční manipulace), `public/docs/TOKEN_DISCLOSURE.md`, web `/roadmap` („mined, not sold"). | — |
| **Deska se sedmi dveřmi, mladý muž s telefonem** | **MÝTUS** | Obraz této knihy nad cestami z `MiseAmenti/02` §3 (Pozorovatel / Hráč / Stavitel / Strážce). | — |

---

*→ Pokračování: [Kapitola 9 — Kotva pravdy a hranice (registr L5)](./09-Kotva-Pravdy-a-Hranice.md)*

---

*[Zpět na index Knihy Země → `00-README.md`](./00-README.md)*


# BODHI GAIA — Kapitola 9: Kotva pravdy a hranice
## Úplný registr L5 — co je živé, co se staví, co je horizont a co je jen obraz; známé rozpory, otevřené otázky a další kroky

> *„Nežádej víru tam, kde lze nabídnout důkaz. Neprodávej horizont jako současnost. Když se vize střetne s faktem, oprav vizi — nikdy fakt."* — První slib Mise Amenti

---

## 1. Proč má Kniha Země nejdelší kotvu

Půda nezná marketing. Strom buď roste, nebo ne. Studna buď dává vodu, nebo ne. A protože L5 je vrstva, kde se ZION poprvé dotýká skutečných lidí, skutečné půdy a skutečných peněz jiných lidí, platí tu **nejpřísnější důkazní laťka celé řady** — přísnější než u mostů L2, které aspoň mají on-chain receipt.

Tato kapitola je registr. Nepřepisuje [`MiseAmenti/07-Registr-Dukazu.md`](../MiseAmenti/07-Registr-Dukazu.md); **rozšiřuje** jeho sekci 5 (L4, L5, L6) o detail, který kanonický registr z důvodu stručnosti nemá. Při rozporu platí kanonický registr, `StatusV3.md` a kód.

---

## 2. Úplná evidence tabulka L5

### 2.1 Protokol a fond

| Nárok | Stav | Důkaz či zdroj | Co je stále nutné |
|---|---|---|---|
| 5 % block subsidy jde do L5 fondu v každém bloku. | **ŽIVÉ** | `V31/L1/core/src/emission.rs`, `v3_template.rs` (`coinbase_humanitarian`, výstup 1); `getBlockByHeight` → `transactions[].outputs`. | — |
| Adresa L5 fondu je kanonická: `zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8`. | **ŽIVÉ** | `V31/L1/core/src/v3_compat.rs`; `docs/PREMINE_ADDRESSES_PUBLIC.txt`; `HARD_RESET_PLAYBOOK.md`; CLI `zion node start --human`; dashboard; web `/l5-free-world`. | Změna = třída D (konsensus). |
| Coinbase má 4 výstupy (miner / L5 / L6 / node reward). | **ŽIVÉ (3) / STAVBA (4.)** | Výstupy 0–2 vždy; výstup 3 jen po `node_reward_activation_height` (default `u64::MAX`), jinak 1 % burn. | Activation height a on-chain evidence. |
| Zůstatek fondu je veřejně čitelný. | **ŽIVÉ** | Explorer `/explorer` (adresa fondu); `GET /api/v1/fund/balance` na `127.0.0.1:8095` (operator-only přes nginx `/api/free-world/`). | Veřejný portál s historií a grafem (M5 / N5). |
| Fond dnes vyplácí granty. | **NEPLATNÝ NÁROK** (dnes) | G10: žádná automatická výplata; DAO exekuce summary-only (`V31/L2/dao/src/runtime.rs`). | DAO UI, výplatní tx flow, guardian multisig, první impact packet. |

### 2.2 Služba L5

| Nárok | Stav | Důkaz či zdroj | Co je stále nutné |
|---|---|---|---|
| `zion-free-world` běží na Edge a skenuje coinbase. | **ŽIVÉ** | `zion-v31-free-world.service` active; `V31/deploy/systemd/`; `StatusV3.md` update 2026-08-23; L5 na `127.0.0.1:8095`. | Průběžný health; nezávislé srovnání skeneru s explorerem. |
| Služba eviduje granty, projekty, komunity a fond. | **ŽIVÉ** (schema) | `V31/L5/free-world/src/db.rs` — tabulky `grants`, `projects`, `communities`, `fund_balance`; testy `tests/db.rs`. | Naplněná data (dnes nejsou doloženy reálné záznamy komunit v produkční DB). |
| API `submit-to-dao` předává granty do DAO. | **STAVBA** | `dao_client.rs` → `ZION_DAO_API_ADDR` (`127.0.0.1:8456`), `X-DAO-Key`. | E2E na Edge: grant → návrh → hlasování. |
| API je chráněno klíčem. | **STAVBA** | `api_key` načten do `AppState`, **nevynucen** na routeru. | Middleware (`X-API-Key` / Bearer) před jakýmkoli veřejným exponováním. |
| Hiran AI hodnotí granty. | **HORIZONT** | `hiran_bridge.rs` (defaultně `hiran_enabled = false`); na Edge není Hiran inference. | Nasazení Hiran podle `MiseAmenti/05` (A0–A2 nejdřív). |
| CLI `zion free-world`. | **STAVBA** | `V31/cli/src/commands/free_world.rs` — `start/status/stop` (systemd passthrough). | Přehled fondu / grantů z CLI. |

### 2.3 Komunity

| Nárok | Stav | Důkaz či zdroj | Co je stále nutné |
|---|---|---|---|
| Zahrada Genesis existuje jako fyzické místo v aktivním rozvoji. | **STAVBA** | `public/V3/L5/docs/COMMUNITIES/genesis-garden.md` (🟡 Active development; Fáze 0 ✅, Fáze 1 🟡); web `/terranova/genesis`; OASIS panel *Active*. | Pozemek (koupě/nájem), registrovaná entita, GPS, evidence realizace (solar, vrt, stany), nezávislé ověření. |
| Zahrada Genesis má tým strážců. | **STAVBA** | Fáze 0: „core team formation (3 Guardians)" ✅. | Veřejná (privacy-respektující) identifikace koordinátora; role podle §6.3. |
| Zahrada Genesis přijímá hosty. | **STAVBA** | Plán: první platící hosté Q3 2026; kanály a ceník §11. | Potvrzené rezervace, pojištění, pravidla výměny. |
| Dharma Temple je připravovaná svatyně na La Palmě. | **STAVBA (dokumentace) / HORIZONT (fyzicky)** | `dharma-temple.md` (🔵 Preparation; Fáze 0 2026 Q2–Q4 🔵); web `/terranova/dharma-temple` (3D koncept, půdorys, dokumentace). | Pozemek, entita, 5 zakládajících strážců, financování 60 000 EUR Fáze 1. |
| Architektura Dharma Temple: Merkaba, 7 kopulí, Strom života. | **HORIZONT** (koncept) | `APP&WEB/website-v2.9/public/docs/terranova/dharma-temple.{cs,en}.md`; `DharmaTemplePreviewLazy`; `/images/dharma-temple/concept-og.png`. | Statika, povolení, rozpočet stavby. |
| Te Pīko Ora je plánovaný pacifický uzel. | **HORIZONT** | `te-piko-ora.md` (🔵 Vision / Preparation; Fáze 0 2026–2027); web `/terranova/te-piko-ora` (*Plánováno 2027+*). | Polynéský partner, ostrov, entita, tým, rozpočet 80 000 EUR. |
| Golden Republic Bohemia je plánovaný governance uzel v Čechách. | **HORIZONT** | `APP&WEB/website-v2.9/public/docs/terranova/golden-republic-bohemia.cs.md` (koncept, půdorys, fáze); [Kapitola 10](./10-Golden-Republic-Bohemia.md); `docs/TerraNova/06-L5-SVOBODA.md` §6.6 (Zlatá republika, 8 principů). | Pozemek (Říp region / Vysočina), entita (z.s. / z.ú.), tým 3–5 strážců, rozpočet 60 000 EUR, kulturní review. |
| Bodhi Lanka je plánovaný akáša uzel na Srí Lance. | **HORIZONT** | [Kapitola 11](./11-Bodhi-Lanka.md); Sri Maha Bodhi (Anurádhapura, UNESCO, 288 př. n. l.) — veřejně ověřitelné; Rámájana a Ráma Setu (Adamův most) — veřejně doložené. | Pozemek (Anurádhapura vs hill country vs south coast), entita (srí lanská NGO), tým 3–5 strážců, rozpočet 80 000 EUR, kulturní review Rámájany a buddhistických motivů, partnerství s buddhistickou sáňghou. |
| Komunity provozují Guardian node. | **NEPLATNÝ NÁROK** (dnes) | Všech pět dokumentů: instalace Fáze 2 (2027 / 2028 / 2028 / 2028 / 2029). | Hardware, konektivita, pokladna. |
| Komunity mají multisig pokladnu 3-z-5. | **HORIZONT** | Struktura v §5.2 každého dokumentu. | Skutečné peněženky, podepisovatelé, transparentní účet. |
| Semenná knihovna funguje. | **STAVBA (Genesis) / HORIZONT (síť)** | Genesis: „informal exchange → catalogued"; web *Seed Library — active*. | Katalog, partneři, první výměna mezi uzly (2028). |
| Medical Table, LoRa mesh, Resonance Protocol jsou nasazeny. | **HORIZONT / MÝTUS** | Specifikace `TECH/`, `PROTOCOLS/`; `L5_L6_ACTIVATION_PLAN.md` §5 bod 13: vizionářské, neimplementované. | — |
| Ekonomické modely komunit (break-even, příjmy) platí. | **HYPOTÉZA** | §4 každého dokumentu. | Skutečné účetnictví po první sezóně. |
| L5 provozuje globální síť vodních / permakulturních projektů. | **HORIZONT** | `MiseAmenti/07` §5. | Impact packety a externí ověření. |

### 2.4 Web a OASIS

| Nárok | Stav | Důkaz či zdroj | Co je stále nutné |
|---|---|---|---|
| Web `/terranova`, `/terranova/genesis`, `/terranova/dharma-temple`, `/terranova/te-piko-ora`, `/l5-free-world` existují a běží. | **ŽIVÉ** | `APP&WEB/website-v2.9/src/app/terranova/**`, `l5-free-world/page.tsx`; `zion-website.service` active. | Štítky stavu (koncept / stavba) přímo v UI. |
| OASIS ukazuje tři L5 projekty a svět Dharma Temple. | **ŽIVÉ** (klient) | `WorldPanel.tsx` (`NOVA_ZEME_PROJECTS`), `worlds.ts` (`DHARMA_TEMPLE_LA_PALMA`). | Napojení statusů na L5 API; oprava `layer`. |
| Avataři Sítá a Hanuman mají questy do L5. | **ŽIVÉ (dokument) / HORIZONT (mechanika)** | `SulZeme/10` §II. | Implementace v `V31/L4/oasis`. |
| OASIS quest odměňuje fyzickou návštěvu zahrady. | **HORIZONT** | Nápad v `genesis-garden.md` §11.2, `dharma-temple.md` §15. | Ověření, privacy, M5 gate. |
| OASIS je fotorealistický UE 5.7 svět s instant preview. | **HORIZONT** | `MiseAmenti/07` §5. | POC (M4). |

### 2.5 Příběh a symbolika

| Nárok | Stav | Poznámka |
|---|---|---|
| Sítá, Hanuman, Sádhu, Ana, Hina, tesař, rybář, oráč, žena s lipovou větví, Ráma. | **MÝTUS** | Archetypy (Sůl země, Rámájana) a postavy vytvořené pro tuto knihu. Nikdo netvrdí historickou ani duchovní autoritu. |
| Bodhi Gaia = „probuzená Země". | **MÝTUS** | Obraz z návrhu Dharma Temple, rozšířený na L5. Není nábožensky závazný. |
| Merkaba, 7 čaker, piko, tatau, wayfinding, Přemysl/Libuše, Zlatá bula, sůl smlouvy, Ráma/Sítá, Sri Maha Bodhi, Ráma Setu, akáša, prema/bhakti. | **MÝTUS / kulturní fakt** | Kulturní tradice jsou citovány s úctou; použití pro L5 vyžaduje kulturní review (třída E), zejména polynéské, české, hinduistické a buddhistické prvky — souhlas místních komunit a citlivé zacházení s posvátnými texty a náboženskými objekty. |
| Yesod ↔ L5, slib péče. | **MÝTUS** | `docs/Zohar/01-SEFIROT-VRSTVY.md`. |

---

## 3. Co Bodhi Gaia není

1. **Není prodej pozemků, podílů ani „tokenizované půdy".** Komunity jsou právně samostatné entity; ZION protokol nevlastní žádnou půdu a fond L5 nekupuje nemovitosti bez DAO procesu, který dnes neexistuje.
2. **Není investice.** Žádná brána, dar ani pobyt nenese výnos. Framing „investuj do ráje" je porušení `MiseAmenti/08` §5.
3. **Není náboženství ani lineage.** Bodhi, Dharma, Merkaba, piko, Strom života jsou obrazy. Kniha netvrdí, že ZION je posvátný text, že Dharma Temple je buddhistický chrám v tradičním smyslu, ani že kdokoliv v projektu má duchovní autoritu.
4. **Není tvrzení o dopadu.** Bez impact packetu (příjemce, scope, rozpočet, on-chain ref., důkaz s původem, limitace, nezávislé ověření) není žádný projekt „ověřený dopad".
5. **Není náhrada `StatusV3.md`, `MiseAmenti/07` ani komunitních dokumentů.** Kde se liší, platí ony.
6. **Není nástroj vyloučení.** Consciousness Admission, sliby a ceremonie nesmí nikdy sloužit k označení člověka za „nižšího", „nečistého" nebo „nepřítele" (`MiseAmenti/05` §4).

---

## 4. Známé rozpory v dokumentaci, webu a OASIS

Registr M0 („claim registry") vyžaduje, aby se rozpory hlásily bez obrany identity projektu. Toto jsou rozpory nalezené při psaní této knihy (2026-09-02):

| # | Rozpor | Kde | Doporučená oprava | Třída |
|---|---|---|---|---|
| 1 | Humanitární podíl uveden jako **10 %** místo kanonických **5 % L5 + 5 % L6**. | `docs/TerraNova/06-L5-SVOBODA.md` §6.2 (a odhad „777 600 ZION/den") | Označit kapitolu jako historickou / opravit na 5 % a odstranit cenový odhad (porušuje zákaz predikcí ceny). | B + E |
| 2 | Lokalita Genesis Garden jako **Střední Evropa** místo **Algarve, Portugalsko**. | `APP&WEB/website-v2.9/src/app/l5-free-world/page.tsx` (`L5FreeWorldCopy.centralEurope`) | Sjednotit s `/terranova/genesis`, kartami a OASIS panelem. | A |
| 3 | Svět Dharma Temple označen `layer: 3`, ale jde o L5 projekt. | `APP&WEB/OasisWeb/src/domain/config/worlds.ts` (`DHARMA_TEMPLE_LA_PALMA`) | `layer: 5`, tag `layer 5`; přidat štítek „koncept". | A |
| 4 | Lokalita Te Pīko Ora: web/OASIS **Tahiti**, komunitní dokument preferuje **Raiatea** (Tahiti jako záloha). | `PioneerProjectCards.tsx`, `WorldPanel.tsx` vs `te-piko-ora.md` §3.3 | Uvést „Raiatea / Tahiti (výběr probíhá)" všude stejně. | A |
| 5 | Komunitní dokumenty datovány **2026-05-21**; timeline Genesis Fáze 1 „první hosté Q3 2026" — Q3 2026 již probíhá bez evidence. | `public/V3/L5/docs/COMMUNITIES/*.md` | Refresh stavů a dat; přidat sekci „Evidence" s odkazy. | B |
| 6 | Nirvana ep. 10 uvádí konkrétní čísla („přes 23 600 plateb") a „živý graf" na `/l5-free-world`. | `docs/WP-Mainet/nirvana/10-Prameny-Zivota.md` | Čísla označit jako snímek s datem; „živý graf" ověřit nebo změnit na „stránka s adresou fondu". | B |
| 7 | Nirvana ep. 4 popisuje ZIS s Passkeys / WebAuthn / biometrikou. | `docs/WP-Mainet/nirvana/04-Domov.md` | Podle `MiseAmenti/07` je Passkeys HORIZONT — doplnit štítek. (Mimo L5, ale nalezeno při čtení.) | B |
| 8 | Inventář v `L5_L6_ACTIVATION_PLAN.md` §4.2 a §5 stále uvádí placeholder `fund_address`, špatný RPC port a chybějící env overrides — **kód je už opraven** (`DEFAULT_HUMANITARIAN_FUND_ADDRESS = zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8`, `l1_rpc_url = 127.0.0.1:9445`, env `FREE_WORLD_*`). | `docs/3.2/L5_L6_ACTIVATION_PLAN.md` vs `V31/L5/free-world/src/config.rs` | Aktualizovat inventář plánu (sekce 4.2 / 5) na skutečný stav kódu; ponechat historické body jako „vyřešeno". | B |
| 9 | OASIS statusy komunit jsou ručně psané konstanty bez zdroje v L5 API. | `WorldPanel.tsx`, `PioneerProjectCards.tsx` | Zdroj pravdy: `communities` tabulka / `GET /api/v1/projects`. | STAVBA (M5) |
| 10 | Web `/terranova/genesis` uvádí *Seed Library — active*, komunitní dokument „informal exchange". | web vs `genesis-garden.md` §3.3 | Sjednotit stav (STAVBA), doplnit katalog nebo změnit štítek. | A |

---

## 5. Konsolidované otevřené otázky L5

**Zahrada Genesis:** přesné GPS a výměra; kapacita solaru (kWp / kWh); právní forma (Associação / Cooperativa / hybrid); surf škola a partnerství; koordinátor Tech Guardian; sdílené protokoly s Dharma Temple; semenná knihovna (odrůdy, partneři); pojištění; EU granty (LEADER, CAP, Erasmus+).

**Dharma Temple:** lokalita (sever / jih / výška); půda (koupě / nájem / spoluvlastnictví); zakládající strážci; právní forma (Asociación / Fundación / SCE); mikro-hydro (barranco, povolení); vazba na existující eko-komunity La Palmy; financování Fáze 0–1; vulkanické pojištění; koordinace semenné knihovny (2028); spolupráce s observatoří.

**Te Pīko Ora:** Raiatea vs Tahiti; místní *mā'ohi* partner a způsob oslovení; customary vs státní půda; cyklonové pojištění; zdravotní evakuace; povolení na perly; partnerství s *Fa'afaite*; *tatau* mistr pro symbolické návrhy; havajská linie (KNIHA-LEHUA); expertiza mořské permakultury.

**Golden Republic Bohemia:** Říp region vs Vysočina vs střední Čechy (přesná lokalita a výměra); právní forma (z.s. / z.ú. / komunitní nadace / hybrid); partnerství s českými eko-komunitami (permaculture sítě, Transition Towns, ekovesnice); MOU s Charles University a ČZU pro governance výzkum; semenná knihovna (Genobanka Praha, SEMO, lokální šlechtitelé); kulturní review Přemysl/Libuše mytologie (mýtus vs nacionalismus); kulturní review Karel IV / Zlatá bula motivů (inspirace, ne nárok na historickou autoritu); koordinátor Tech Guardian s vazbou na českou developer komunitu; EU funding (LEADER, CAP, Erasmus+, LIFE, Horizon Europe — governance research).

**Bodhi Lanka:** Anurádhapura vs hill country (Kandy / Nuwara Eliya) vs south coast (přesná lokalita a výměra); právní forma (srí lanská NGO / trust / hybrid); partnerství s buddhistickou sáňghou (Sri Maha Bodhi chrám, Anurádhapura); partnerství s ayurvedickou univerzitou (např. University of Kelaniya, Gampaha Wickramarachchi Ayurveda Institute); kulturní review Rámájany (Ráma/Sítá motivy — posvátné pro hinduisty, buddhisty i Srí Lankance) a buddhistických motivů (Sri Maha Bodhi jako živý náboženský objekt, ne turistická atrakce); visa/residency pro zahraniční strážce (Srí Lanka visa policy, dlouhodobé pobytové povolení); monzunové pojištění (Yala + Maha sezóny); elefanti konflikty (zónování, ploty, respekt ke koridorům); politická stabilita (ekonomická krize 2022, monitoring).

**Síť L5:** DAO UI/UX pro L5 návrhy (J4/J6); výplatní tx flow a guardian multisig; API key middleware; veřejný portál (N5); zdroj pravdy pro statusy komunit; první impact packet; Sybil-resistance pro quadratic voting; kulturní review polynéských, buddhistických, hinduistických a českých prvků.

---

## 6. Další kroky — mapováno na Mise Amenti M5 a plán N5

| Krok | Co | Gate | Stav |
|---|---|---|---|
| 1 | Opravit rozpory #1–#4, #10 (redakční) a #8 (config). | M0 | ❌ |
| 2 | Refresh tří komunitních dokumentů se sekcí *Evidence* (co je doloženo, kdy, kým). | M0 / M5 | ❌ |
| 3 | Přidat řádky L5 do `MiseAmenti/07-Registr-Dukazu.md` (tato kapitola jako zdroj). | M0 | 🔄 (návrh v [`CHANGELOG`](../MiseAmenti/CHANGELOG.md)) |
| 4 | Vynutit API klíč na `zion-free-world` před jakýmkoli veřejným exponováním. | M1 (bezpečnost) | ❌ |
| 5 | Zdroj pravdy statusů komunit: `communities` tabulka → web + OASIS. | M5 | ❌ |
| 6 | Veřejný L5 portál: zůstatek, historie toků, návrhy, příjemci, milníky, výsledky. | M5 / N5 | ❌ |
| 7 | DAO UI pro L5 návrhy + výplatní tx flow + guardian multisig (bez toho fond nerozdává). | M5 (+ J4/J6) | ❌ |
| 8 | Definovat šablonu **impact packetu** a vybrat **jeden pilot** (nejblíž: Zahrada Genesis Fáze 1). | M5 exit gate | ❌ |
| 9 | Kulturní review polynéských (Te Pīko Ora) a buddhistických (Dharma Temple) prvků před veřejným vydáním. | třída E | ❌ |
| 10 | Kulturní review českých (Golden Republic Bohemia) prvků — Přemysl/Libuše mytologie a Karel IV / Zlatá bula motivy — před veřejným vydáním. | třída E | ❌ |
| 11 | Kulturní review srí lanských (Bodhi Lanka) prvků — Rámájana (Ráma/Sítá), Sri Maha Bodhi (živý náboženský objekt), buddhistické a hinduistické motivy — před veřejným vydáním. | třída E | ❌ |
| 12 | Kanonizace této řady po review (technika + bezpečnost + fakta + kultura). | `MiseAmenti/08` | 🔄 DRAFT |

---

## 7. Návrh změny podle `MiseAmenti/08` §3

```markdown
## Záměr
Sjednotit vizi a dokumentaci vrstvy L5 (Zahrada Genesis, Dharma Temple / Nová Bodhi Gaia,
Te Pīko Ora, Golden Republic Bohemia, Bodhi Lanka) do jedné narativně-technické řady navazující na Onboarding, Sůl země a Nirvanu,
s úplnou kotvou pravdy pro každý nárok.

## Stav tvrzení
Protokol/fond/služba: ŽIVÉ. Komunity: STAVBA (Genesis) / HORIZONT (Dharma Temple, Te Pīko Ora, Golden Republic Bohemia, Bodhi Lanka).
Sdílené protokoly: HORIZONT. Příběh a symbolika: MÝTUS.

## Důkaz
V31/L1/core (emission, v3_template, v3_compat); V31/L5/free-world; V31/deploy;
public/V3/L5/docs/**; APP&WEB/website-v2.9/src/app/terranova/**, l5-free-world;
APP&WEB/OasisWeb (WorldPanel, worlds.ts); docs/3.2/L5_L6_ACTIVATION_PLAN.md;
MiseAmenti/03, 04 (M5), 05, 07; StatusV3.md.

## Rizika
Kulturní (polynéské, buddhistické, hinduistické, srí lanské a české prvky), finanční framing (dar vs investice),
privacy (údaje o strážcích a hostech), nadsazení stavu (koncept vs stavba),
bezpečnost (API bez klíče, DAO exekuce).

## Hranice
Netvrdí, že komunity fungují, že fond vyplácí, že uzly běží, že OASIS odměňuje fyzické akce,
že existuje ověřený dopad, ani že kdokoliv má duchovní autoritu.

## Review
Technický reviewer (L1/L5 fakta), bezpečnostní reviewer (fond/DAO/API), factual editor,
kulturní konzultant pro Polynésii, buddhismus, hinduismus (Rámájana), Srí Lanku a české tradice, public-copy review před jakýmkoli výňatkem do public/.

## Rollback / oprava
Řada zůstává DRAFT do dokončení review; každý nárok lze snížit změnou štítku bez mazání textu;
changelog zachová historii; veřejné výňatky až po schválení.
```

---

## 8. Slib Knihy Země

> **Strom, který nestojí, nebudeme kreslit jako stojící.**
> **Studnu, která nedává vodu, nebudeme počítat jako dopad.**
> **Člověka, který přijde, nebudeme zkoušet z víry, ale z uklizené kuchyně.**
> **A když se příběh střetne s hlínou, opravíme příběh.**

---

*[Zpět na index Knihy Země → `00-README.md`](./00-README.md)* · *[Mise Amenti — Registr důkazů](../MiseAmenti/07-Registr-Dukazu.md)* · *[Nirvana, ep. 10 — Prameny Života](../nirvana/10-Prameny-Zivota.md)*


# BODHI GAIA — Kapitola 10: Golden Republic Bohemia
## Srdce · Čechy, Česká republika — kruh bez trůnu, sůl na stole a most mezi mýtem a protokolem

> *„Sůl, co jsme spolu ochutnali, platí i bez papíru. Most, co spojuje, nerozděluje. A kruh, kde není trůn, je nejstarší parlament na světě."*

---

## Příběh

Sítá a tesař se vrátili do země, kde se sůl poprvé ochutnala. Ne na mořském břehu, ne na vulkanickém svahu, ne v laguně — ale uprostřed kontinentu, kde pole táhnou se až k obzoru a řeka teče pomalu, jako by nic nevěděla o moři, do kterého jednou dojde.

Šli po polní cestě, dokud nevyšli k samotné hoře. Ne vysoké — sotva čtyři sta padesát metrů — ale stojící sama uprostřed roviny, jako by ji někdo položil na zem jako kámen na šachovnici. Říp.

Na vrcholu, kde vítr hladi trávu a dole se leskne Labe, seděl muž s motykou opřenou o kámen. Ne starý, ne mladý. Ruce měl hlínu pod nehty a tvář opálenou sluncem, které u nás svítí jinak než na jihu — pomaleji, ale důsledněji.

*„Hledáte něco?"* zeptal se.

*„Zemi, kde se dá rozhodovat bez trůnu,"* řekla Sítá.

*„Tak jste na správném místě,"* odpověděl muž. *„Tady nahoře poslala prorokyně pro oráče. Ne proto, že by byl vznebený. Proto, že uměl pracovat rukama. Král, který si pamatuje, že držel motyku, se chová jinak než král, který ji nikdy nedržel."*

*„A kde je ta prorokyně?"*

*„Pod lipou, dole v údolí. Ale nespěchejte. Nejdřív musíte pochopit, proč tady není žádný hrad."*

Muž — oráč, jak mu později říkali — je zavedl po svahu dolů k místu, kde stála lípa. Pod ní seděla žena s větví v ruce a kolem ní kruh lidí. Ne soud, ne parlament, ne rada. Kruh. Každý viděl každého. Nikdo nebyl vzadu.

*„Pod lipou se rozhodovalo dávno před parlamenty,"* řekla žena. *„Ne proto, že by to bylo staré a proto dobré. Protože v kruhu nemůže nikdo mluvit za zády někoho jiného. Kdo chce říct ne, musí se podívat tomu, kdo navrhuje, do očí. To je víc, než co většina ústav dokáže."*

Tesař se rozhlédl. *„A co když se neshodnou?"*

*„Čekají,"* řekla žena. *„Neshoda není porážka. Je chybějící znak. Jako když mořský navigátor čeká, až se hvězdy shodnou. Vy tomu říkáte konsensus. My tomu říkáme sednout si a poslouchat."*

Toho večera postavili kruh z kamenů. Uprostřed položili dubový stůl a na něj misku se solí. Ne sochu, ne oltář, ne vlajku. Sůl. Oheň hořel uprostřed a kouř stoupal rovně vzhůru, protože večer byl bezvětří.

Kolem kruhu, v průběhu týdnů, vyrostly tři pavilony. Ne z mramoru — z pískovce, dřeva a skla. První měl tvar mostu: oblouk, který spojoval dva břehy ničeho, a přesto nesl střechu. Druhý měl průčelí s otevřenými dveřmi — žádná brána, žádný hlídač, jen vstupte. Třetí byl nejnápadnější: na jeho průčelí visela zlatá pečeť — bula — a uvnitř svítil monitor s řetězem bloků.

*„Most je pro governance,"* řekl oráč. *„Univerzita je pro vědění. Zlatá bula je pro protokol. Každý jinou funkcí, všechny jedním záměrem."*

*„A co je uprostřed?"* zeptal se tesař.

*„Kruh. Vždycky kruh. Všechno ostatní je jen ochrana kruhu."*

Tesař vzal nůž a vyřezal do dubového stolu uprostřed kruhu čtyři znaky: vlnu, most, korunu a kruh. Pod ně napsal malým písmem: **Král si pamatuje, že držel motyku.**

Oráč se zasmál. *„To je jediná věta, kterou potřebuje každá ústava."*

Žena s lipovou větví přikývla. *„A každá ústava potřebuje sůl. Co jsme spolu ochutnali, platí i bez papíru. Ale papír — nebo řetěz — je tam, aby si to nikdo nemohl rozmyslet, až mu přestane vyhovovat."*

---

## Co to znamená

**Golden Republic Bohemia je čtvrtý uzel L5 Free World — Srdce, governance laboratoř. Kde Zahrada Genesis je Kořen (země, začátek), Dharma Temple je Kmen (oheň, cesta) a Te Pīko Ora je Koruna (voda, dovršení), Bohemia je Srdce — místo, kde se rozhoduje.** Ne farma, ne svatyně, ne laguna — kruh. Místo, kde se protéká česká moudrost (sůl, most, univerzita, Zlatá bula) a ZION protokol (DAO, Guardian Node, Proof-of-Care), a kde se z dobrovolného protokolu soužití stane živá praxe.

### Jméno a kosmologie

| Slovo | Jazyk / původ | Význam |
|---|---|---|
| **Golden** | angličtina | zlatý — odkaz na Zlatou bulu (1356) a „zlatý věk" jako horizont, ne nárok |
| **Republic** | lat. *res publica* | věc veřejná — ne stát, ne národ, ale dobrovolný protokol soužití |
| **Bohemia** | lat. *Boiohaemum* | Čechy — země Čechů, kde se narodila sůl země, král byl oráč a císař postavil most |

**Zlatá republika** (z `TerraNova/06-L5-SVOBODA.md` §6.6) není stát. Není národ. Není revoluce. Je to **dobrovolný protokol soužití** — jako Bitcoin pro peníze, ale pro společenský řád. Osm principů:

1. Členství je dobrovolné a kdykoli odvolatelné.
2. Pravidla soužití se tvoří lokálně, inspirují globálně.
3. Žádné monopoly (ekonomické ani informační).
4. Vzdělání je právo — ne komodita.
5. Zdraví je právo — ne komodita.
6. Energie je právo — ne komodita.
7. Blockchain jako transparentní zákon.
8. DAO jako žijící ústava.

*Zlatá republika nezrušila staré státy. Nabídla lepší alternativu — a lidé si vybrali.*

### Říp — posvátná osa

Říp (456 m n. m.) je osamělá hora uprostřed České roviny, národní kulturní památka, veřejně přístupná. Podle Kosmase (*Chronica Boemorum*, 12. stol.) sem prorokyně Libuše poslala pro oráče Přemysla — muže, který oral na poli v Stadicích. Přemysl se stal zakladatelem přemyslovské dynastie. Říp je v českém povědomí **bod původu** — místo, kde mýtus a půda dotýkají se navzájem.

Cíl Fáze 1: region Řípu / střední Čechy / Vysočina — krajina, kde se potkává česká mytologie, řeky a pole. Říp jako symbiotická hranice mezi mýtem a půdou; Labské údolí v pozadí.

### Tři pavilony: Most, Univerzita, Zlatá bula

| Pavilon | Funkce | Symbolika | Protějšek v ZION |
|---|---|---|---|
| **Most** | Governance sál, DAO workspace, sociokratické kruhy, on-chain návrhy | Karlův most (1357) — spojuje, nerozděluje; most mezi komunitami, ne zeď | DAO, multichain bridge |
| **Univerzita** | Knihovna, studovna, přednáškový sál, semenná knihovna, Akášický archiv | Charles University (1348) — první v Evropě otevřená všem národům; vzdělání jako právo | Knowledge commons, education as right |
| **Zlatá bula** | ZION node, protokolová komora, multisig treasury, technické centrum | Zlatá bula (1356) — psaná ústava, distribuovaná moc, stabilita strukturou; proto-DAO | Guardian Node, DAO constitution, multisig |

Pavilony nejsou gotickými replikami. Jsou to **originální současné struktury** z pískovce, dřeva a skla, které vizuálně evokují most/triadu a souvisejí se svatou geometrií karlštejnského půdorysu a Zlaté buly — bez kopírování jakéhokoli existujícího symbolu.

**Konstrukce a materiály:** pískovec a dřevo (české lokální materiály, tepelná setrvačnost), skleněné fasády pavilonů (průhlednost governance, pasivní osvětlení), hliněné stavitelství (rammed earth) a konopné izolace, dřevěné terasy a lávky (propojení pavilonů a kruhu, evokace mostu), solární panely integrované do střech, dešťová voda a šedá voda (uzavřený vodní okruh), kompostovací toalety a kořenová čistírna (uzavřený nutrientní cyklus).

### Kruh jako governance

Srdcem areálu není žádný pavilon. Je jím **centrální kruh rozhodování** — kamenný amfiteátr pod širým nebem, oheň uprostřed, sůl na dubovém stole. Žádný trůn, žádná kazatelna. Jen kruh, kde se každý vidí s každým.

| Princip | Popis | Protějšek |
|---|---|---|
| **Kruh bez trůnu** | Všichni sedí ve stejném kruhu; nikdo není vzadu, nikdo nevelí | Sociokratické kruhy, DAO |
| **Sůl na stole** | Smlouva, která platí beze slov; *berit melach* — co jsme spolu ochutnali, platí i bez papíru | ZION konsensus, neměnný řetěz |
| **Souhlas, ne hlasování** | „Žádná odůvodněná námitka" — kdo chce říct ne, musí se podívat do očí | Consent decision-making |
| **Rotační role** | Facilitátor se střídá; autorita se získává službou, nekupuje se | Reputační skóre, Proof-of-Care |
| **Lipová alej** | Strom zasazený při každém novém strážci — živý ledger komunity | On-chain záznam role, vstupu a přínosu |

**Srovnání se Zlatou bulou (1356):** Karel IV napsal ústavu, která zabránila občanským válkám o volbu císaře — kodifikoval 7 volitelů, psaná pravidla, distribuovaná moc, stabilita strukturou. Zlatá bula platila 450 let (do 1806). Je to **proto-DAO**: moc distribuovaná, ne centralizovaná; psaná pravidla, ne libovůle; stabilita strukturou, ne osobou. Golden Republic Bohemia bere ten princip a překládá ho: volitelé → strážci, bula → DAO constitution, pečeť → multisig.

### Česká moudrost a ZION

| Český koncept | Význam | Protějšek v ZION |
|---|---|---|
| **Sůl** (*berit melach*) | Smlouva beze slov; sůl nevládne jídlu, zaručuje, že pravidla platí | ZION konsensus — neměnný řetěz, pravidla platí i bez víry |
| **Most** (Karlův most, 1357) | Spojení, ne rozdělení; most mezi břehy, kulturami, komunitami | Multichain bridge — ZION jako most mezi komunitami, ne zeď |
| **Univerzita** (Charles University, 1348) | Otevřená všem národům; vzdělání jako právo, ne komodita | Education as right — knowledge commons, ZION Academy |
| **Zlatá bula** (1356) | Psaná ústava, distribuovaná moc, stabilita strukturou | DAO constitution — žijící ústava, on-chain governance |
| **Přemysl oráč** | Král, který si pamatuje, že držel motyku; sůl země | Proof-of-Care — odměny za skutečnou péči, ne za staking |
| **Lipa** | Strom slovanské svrchovanosti; pod lipou se rozhodovalo dávno před parlamenty | Živý ledger — lipová alej jako on-chain záznam komunity |

### Infrastruktura, právo, ekonomika

| Oblast | Fáze 1 | Fáze 2 |
|---|---|---|
| **Energie** | 8 kWp PV + 16 kWh LiFePO4 (~30 kWh/den v létě), DC mikrosíť, solární ohřev vody | 20 kWp + 40 kWh + grid fallback (~60 kWh/den) |
| **Voda** | Pramen + 30 m³ dešťová cisterna, pískový filtr + UV, kořenová čistírna šedé vody, kompostovací toalety | Pramen + 80 m³ cisterna, uzavřený okruh, biodigestor |
| **Jídlo** | 1 ha organicky + agrolesnictví; české odrůdy, jabloně, hrušně, třešně, bylinky, včely; 25 % kalorické soběstačnosti | 3 ha syntropické agrolesnictví + keyline; 60 %; kozy, kachny, akvaponie |
| **Ubytování** | 4–6 hostů: eko-chaty, jádro týmu v opravené budově | 20–30 hostů: dřevěné eko-chaty, komunitní jurta, amfiteátr |
| **Právo** | z.s. (spolek) — registrace podle českého práva | z.s. + nadace / z.ú. (ústav) pro dlouhodobé držení půdy |
| **Příjmy** | Governance retreaty 40 %, eko-turistika 25 %, workshopy 15 %, farma 10 %, node 10 % | Cíl 80 000 EUR/rok; + semenná knihovna, vzdělávací centrum |

**Pracovní výměna:** 25 h/týden = ubytování + jídlo, omezeno na 2 pracovní hosty na 4 platící — jako v Zahradě Genesis, aby kruh měl ruce i příjem.

**Desátek:** Golden Republic Bohemia dává **10 % z veškerého přebytku** (ne jen z node rewardů) místním českým komunitám, ochraně české krajiny a podpoře českého bylinného dědictví.

### Vazba na ZION

- **Guardian Node** (Fáze 2, cíl 2028): mini-PC (Intel N100 / Ryzen embedded), 15–25 W, vejde se do solárního rozpočtu; Starlink + 4G failover + LoRa relay. Dělení odměn **90 % operátor / 10 % komunitní pokladna**.
- **Pokladna:** multisig 3-z-5 (operační 2-z-3, rezerva 3-z-5 cold, desátek auto-forward měsíčně, fond semenné knihovny).
- **Medical Table:** bylinkářský pavilon, první pomoc, integrativní medicína — česká bylinná tradice (heřmánek, meduňka, dobromysl, řepík, třezalka); spolupráce s českými bylinkáři a univerzitami.
- **LoRa / Mesh network:** off-grid komunikace, telemetry, nouzové vysílání; napojení na regionální sítě.
- **Proof-of-Care:** odměny za skutečnou péči o půdu, komunitu a governance dokumentaci — ne za staking, ne za holding.
- **Golden Republic protokol lab:** první fyzický uzel, kde se prototypuje dobrovolný protokol soužití z `TerraNova/06-L5-SVOBODA` §6.6. Governance experimenty: consent vs hlasování, rotační role, on-chain návrhy, živá ústava.

### Propojení s dalšími uzly

| Uzel | Co posílá | Co přijímá |
|---|---|---|
| **Zahrada Genesis** (Kořen) | Hosty na governance retreaty; olivový olej, sušené bylinky | České odrůdy, semenná výměna; hosty z kruhu na farmářské pobyty |
| **Dharma Temple** (Kmen) | Strážce po 21denním tichu → do kruhu Bohemia; subtropické ovoce, léčivé byliny | Governance protokoly zpět do chrámu; české byliny, lipový med |
| **Te Pīko Ora** (Koruna) | Wayfinding jako konsensus → kruh Bohemia jako konsensus; polynéské governance mapy | České governance protokoly; semenná výměna (české × tropické odrůdy) |

Všech čtyři uzly tvoří L5 Free World + Srdce: Kořen (země) → Kmen (oheň) → Koruna (voda) → Srdce (rozhodování). Kruh bez trůnu je to, co drží ostatní tři pohromadě.

### Fáze

| Fáze | Období | Stav | Klíčové body |
|---|---|---|---|
| 0 — Zárodek | 2026 Q3–Q4 | 🔵 | Core team 3–5 strážců, scouting Čechy (Říp region / Vysočina), právní rešerše (z.s. vs z.ú. vs nadace), rozpočet 60 000 EUR, zkušební záhony 0,2 ha |
| 1 — Kořeny | 2027 | 🔵 | Pozemek (koupě / dlouhodobý nájem), registrace z.s., solar 8 kWp, cisterna 30 m³, eko-chaty 4–6 jednotek, 1 ha, první hosté Q3 2027, ZION wallet + DAO rámec, lipová alej |
| 2 — Komunita | 2028 | 🔵 | Guardian node, stálé bydlení 3–5 chat, měsíční governance program, LoRa mesh, Medical Table pavilon, propojení s Genesis Garden a Dharma Temple, první governance retreat |
| 3 — Síť | 2029 | 🔵 | 3 ha, semenná síť 3+ uzlů, vzdělávací centrum (Wayfinding Governance škola), druhý uzel v Čechách nebo na Slovensku, 80 000 EUR/rok |
| 4 — Výzařování | 2030+ | 🔵 | Governance retreat centrum 40+ hostů, ZION platby jako výchozí, knowledge commons, 1 % přebytku → L6, první prototyp Zlaté republiky v praxi |

### Rizika

Kontinentální klima (mrazíky, sucho, bouře; protipožární pásy, zásoby vody, evakuační plán), **kulturní citlivost** (Přemysl/Libuše mytologie vs nacionalismus — kulturní review, citlivé zacházení s českými tradicemi; Karel IV / Zlatá bula jako inspirace, ne nárok na historickou autoritu), stavební povolení (krajinný režim, památková ochrana v Říp regionu), odchod klíčového strážce (cross-training, dokumentace), volatilita ZIONu (pokladna v stablecoinech + CZK + ZION), neúroda (polykultura, semenná diverzita), úraz hosta (pojištění, první pomoc).

---

## Kotva pravdy — ověřitelná fakta

> Golden Republic Bohemia je **koncept a příprava**. Žádná půda nebyla zakoupena, žádný kruh nebyl postaven, žádný strážce nebyl zapsán. To, co existuje, je narativní rámec, historická inspirace a protokolová vize.

| Prvek příběhu | Stav | Co je ověřitelné | Co ještě chybí |
|---|---|---|---|
| **Říp, Labské údolí, česká krajina** | **ŽIVÉ** (fakta o místě) | Říp (456 m), národní kulturní památka, veřejně přístupný; Labské údolí — veřejně ověřitelné. | Konkrétní lokalita areálu není vybrána (Říp region / Vysočina / střední Čechy). |
| **Přemysl Oráč, Libuše, oráč na trůnu** | **MÝTUS / kulturní fakt** | České pověsti (Kosmas, *Chronica Boemorum* 12. stol.), Přemyslovská dynastie — veřejně doložené. | — |
| **Karel IV, Zlatá bula (1356), Karlův most (1357), Charles University (1348)** | **ŽIVÉ** (historická fakta) | Veřejně ověřitelné historické záznamy; Zlatá bula v archivech; Karlův most stojí; univerzita funguje; `docs/docs2.9/ZION_OASIS/SACRED_TRINITY/35_KAREL_IV.md`. | — |
| **Zlatá republika jako koncept** | **HORIZONT** (dokumentace) | `docs/TerraNova/06-L5-SVOBODA.md` §6.6 — 8 principů, horizont 2030–2035; `docs/TerraNova/BASE_FINAL/08-SVOBODA.md`. | Fyzický uzel, tým, protokol v praxi. |
| **Kruh rozhodování, pavilony, permakultura** | **HORIZONT** (koncept) | `APP&WEB/website-v2.9/public/docs/terranova/golden-republic-bohemia.cs.md` — půdorys, legenda, konstrukce, fáze. | Pozemek, stavební povolení, statika, rozpočet stavby. |
| **Guardian Node, DAO, multisig** | **HORIZONT** | Specifikace `public/V3/L5/docs/TECH/zion-node-spec.md`; split 90/10 v komunitních dokumentech; multisig struktura v §5.2. | Žádný L5 node v Čechách neběží; instalace Fáze 2 (2028). |
| **Partnerství s českými univerzitami** | **HORIZONT** | Charles University (1348), ČZU — veřejně existující instituce. | Žádný kontakt není doložen; MOU není podepsáno. |
| **Semenná knihovna, Genobanka Praha** | **HORIZONT** | Genobanka Praha, SEMO — veřejně existující instituce. | Partneři výměny nejsou dohodnuti; katalog neexistuje. |
| **Ekonomický model (break-even, příjmy)** | **HYPOTÉZA** | Podle vzoru Genesis Garden §4 komunitního dokumentu; koncept doc §Fáze rozvoje. | Skutečné účetnictví po první sezóně; žádná grantová žádost není podána. |
| **Sítá, tesař, oráč, žena s lipovou větví** | **MÝTUS** | Postavy vytvořené pro tuto knihu; oráč a prorokyně jako archetypy Přemysla a Libuše — nikdo netvrdí historickou ani duchovní autoritu. | — |

> **Věta z Exekuční charty, která tu platí nejvíc:** *„Žádné monetizované ‚posvátné skiny', žádná gamifikace duchovní autority."* Golden Republic Bohemia nesmí být prodávána jako „návrat českého zlatého věku". Je to laboratoř governance, ne národní mýtus k prodeji.

---

*→ Pokračování: [Kapitola 11 — Bodhi Lanka](./11-Bodhi-Lanka.md)*

---

*[Zpět na index Knihy Země → `00-README.md`](./00-README.md)*


# BODHI GAIA — Kapitola 11: Bodhi Lanka
## Akáša · Srí Lanka — nekonečná láska Ramy a Sity, nejstarší žijící strom na Zemi a most mezi ostrovy

> *„Most nespojil ostrovy — spojil srdce. A srdce nepotřebuje most. Láska je element, který oheň nemůže spálit. Je to akáša — prostor, ve kterém hoří všechny ostatní elementy, a sám nehoří."*

---

## Příběh

Poutníci z kruhu bez trůnu se nevrátili domů. Vrátili se k moři — ale tentokrát ne na břeh, na který byli zvyklí. Pluli na východ, přes oceán, který neznal jejich kompas, ale znal jejich sůl.

Když loď po týdnech dorazila k ostrovu, vzduch se změnil. Ne najednou — postupně, jako by se někdo pomalu otevíral. Teplý, nasáklý vůní jasmínu a frangipani, nasáklý něčím, co nebylo ani vlhkost, ani teplo, ale přítomnost. Jako by prostor sám byl živý.

Šli po cestě, kterou lemovaly kamenné sloupy zarostlé mechem, dokud nedošli k místu, kde stál strom. Ne strom, který zasadili. Ne strom, který zasadil kdokoliv živý. Strom, který tu stál už dva tisíce tři sta let — a předtím, v jiné zemi, pod ním seděl muž, který se probudil.

Sri Maha Bodhi. Řízek z původního stromu probuzení, přivezený z Buddha Gaya na Srí Lanku v roce 288 př. n. l. Sáňghamittá, dcera císaře Ašóky, ho nesla přes oceán v zlaté nádobě. A strom — zakořenil. A roste. Dodnes. Je to nejstarší žijící strom, který byl kdy záměrně vysazen lidskou rukou a jehož datum výsadby je písemně doloženo.

Pod stromem seděli muž a žena. Drželi se za ruce. Mlčeli.

Žena nebyla cizí. Tesař ji poznal — byla to Sítá, Matka Země, ta, která v Sůl země ochutnala sůl s poutníky u prvního ohně. Ale tady, pod tímto stromem, na tomto ostrově, byla také Sítá — ta, kterou unesli, ta, která prošla ohněm a vyšla nespálená. Ne jedna nebo druhá. Obě. Protože země, která unesla strom probuzení, unese i dvojí tvář jedné ženy.

Muž nebyl tesař. Byl to Ráma — ten, který postavil most z kamenů přes oceán, aby dostal Sítá zpět. Rámájana vypráví, že opice a medvědi nesli kameny do moře a psali na ně jméno Ráma, a kameny pluly. Most se jmenuje Ráma Setu — Adamův most — a jeho pozůstatky leží dodnes jako řetěz vápencových mělčin mezi Indií a Srí Lankou.

Ráma promluvil první. Hlas měl tichý, ale ne slabý — tichý jako prostor, ve kterém se všechno odehrává.

*„Postavil jsem most z kamenů. Ale most nespojil ostrovy — spojil srdce. A srdce nepotřebuje most."*

Sítá promluvila druhá. Hlas měla stejně tichý, ale v něm bylo něco, co hořelo — ne jako oheň, ale jako světlo, které oheň nezničí.

*„Šla jsem ohněm a oheň mě nespálil. Ne proto, že jsem čistá. Proto, že láska je element, který oheň nemůže spálit. Je to akáša — prostor, ve kterém hoří všechny ostatní elementy, a sám nehoří."*

Poutníci mlčeli. A v tom tichu pochopili.

Zahrada Genesis je Země — půda, začátek, kořen. Dharma Temple je Oheň — cesta, transformace, kmen. Te Pīko Ora je Voda — dovršení, tok, koruna. Golden Republic Bohemia je Vzduch — diskurs, rozhodování, srdce.

Ale Lanka je Akáša — prostor, ve kterém všechny čtyři existují. Éter, který nevytváří, netransformuje, neteče, nerozhoduje. Prostor, který **druží**. Ve kterém může půda růst, oheň hořet, voda téct a vzduch vanout. Bez akáše by nebylo místo pro žádný z nich.

Láska není element mezi elementy. Je to prostor, který je drží.

Tesař — který teď nebyl tesař, ale poutník, který si pamatoval, co znamená držet nůž — vzal nůž a vyřezal do kamenné stěny chrámu, který střežil Sri Maha Bodhi, čtyři znaky: lotos, most, dvě ruce a otevřený kruh. Pod ně napsal malým písmem: **Láska je prostor, ve kterém hoří oheň a sám nehoří.**

Ráma se usmál. *„To je jediná věta, kterou potřebuje každá ústava — a každé srdce."*

Sítá přikývla. *„A každý strom. Protože strom neroste v zemi. Roste v prostoru, který zemi dovoluje nést."*

---

## Co to znamená

**Bodhi Lanka je pátý uzel L5 — Akáša, prostor, který drží všechny ostatní. Kde Zahrada Genesis je Kořen (země, začátek), Dharma Temple je Kmen (oheň, cesta), Te Pīko Ora je Koruna (voda, dovršení) a Golden Republic Bohemia je Srdce (vzduch, rozhodování), Bodhi Lanka je Akáša — éter, prostor, ve kterém se všechny čtyři konají.** Ne farma, ne svatyně, ne laguna, ne kruh. Místo, kde se láska — prema — stává principem, ne emocí. Kde se protékají Rámájana (nekonečná láska Ramy a Sity), Sri Maha Bodhi (nejstarší žijící strom na Zemi) a ZION protokol (DAO jako žijící ústava, Bhakti jako governance).

### Jméno a kosmologie

| Slovo | Jazyk / původ | Význam |
|---|---|---|
| **Bodhi** | sanskrt बोधि | probuzení, osvícení — stav, ve kterém Buddha seděl pod stromem |
| **Lanka** | sanskrt / pálí | ostrov — Srí Lanka, ostrov v Indickém oceánu; v Rámájaně sídlo Rávany, místo kam byla unesena Sítá |
| **Akáša** | sanskrt आकाश | éter, prostor, nebe — pátý element v hinduistické a buddhistické kosmologii |

**Pět elementů a pět uzlů L5:**

| Element | Sanskrt | Uzel L5 | Role | Funkce |
|---|---|---|---|---|
| **Země** | *Pṛthvī* | Zahrada Genesis | Kořen | Půda, začátek, zakořenění |
| **Oheň** | *Agni* | Dharma Temple | Kmen | Transformace, cesta, ticho sopky |
| **Voda** | *Āpas* | Te Pīko Ora | Koruna | Tok, dovršení, wayfinding |
| **Vzduch** | *Vāyu* | Golden Republic Bohemia | Srdce | Diskurs, rozhodování, kruh |
| **Éter / prostor** | **Ākāśa** | **Bodhi Lanka** | **Akáša** | **Prostor, který drží všechny; láska jako princip** |

Akáša v hinduistické kosmologii (samkhja, tantra) a buddhistické kosmologii (abhidharma) není „nic". Je to substrát, prostor, ve kterém se ostatní čtyři elementy manifestují. Bez akáši by nebylo místo, kde země leží, oheň hoří, voda teče a vzduch vanou. **Láska — prema — je v tomto rámci ne element, ale kvalita akáši**: prostor, který dovoluje všemu existovat, aniž by sám hořel, tekl, vanul nebo ležel.

### Sri Maha Bodhi — nejstarší žijící strom

Sri Maha Bodhi v Anurádhapure je **nejstarší žijící strom na Zemi, který byl záměrně vysazen lidskou rukou a jehož datum výsadby je písemně doloženo**. Řízek z původního Bodhi stromu z Buddha Gaya (Bódhgaja) — stromu, pod kterým Siddhártha Gautama dosáhl probuzení — byl přivezen na Srí Lanku v roce **288 př. n. l.** Sáňghamittá, buddhistická mniška a dcera indického císaře Ašóky, ho přinesla přes oceán. Strom byl zasazen v Anurádhapure, tehdejším hlavním městě království Anurádhapura, na terase zvané Mahámégha. Od té doby — **2300+ let** — roste a je nepřetržitě uctíván.

Anurádhapura je **světové dědictví UNESCO** (od 1982). Sri Maha Bodhi je jedním z nejposvátnějších míst buddhismu — poutní místo, ke kterému proudí věřící z celého světa. Strom je chráněn zlatou a stříbrnou ohradou a střežen kněžími a dobrovolníky.

**Bodhi Lanka je JEDINÝ uzel L5, který má skutečný, žijící Strom života — ne koncept, ne architekturu, ne symbol.** Zahrada Genesis má strom zasazený jako rituál. Dharma Temple má Strom života jako osu architektury. Te Pīko Ora má kokosovou palmu jako archetyp. Golden Republic Bohemia má lipovou alej jako živý ledger. Ale Sri Maha Bodhi je **strom, který roste 2300 let** — strom, pod kterým se probudil Buddha, a který žije dál.

### Ráma Setu — most přes oceán

Ráma Setu (Adamův most) je **řetěz vápencových mělčin a pískových ostrůvků** mezi ostrovem Mannar (Srí Lanka) a Ráméšvaram (Indie), dlouhý přibližně 48 km. Geologicky je to přírodní útvar — pozůstatek spojení mezi Indií a Srí Lankou, který existoval až do doby před několika tisíci let, kdy ho rozrušily mořské proudy. V Rámájaně je most popisován jako dílo Rámy — postavený z kamenů, na které opice a medvědi napsali jméno Ráma, aby pluly po vodě.

Ráma Setu je **geologický fakt + kulturní mýtus**. Most existuje — satelitní snímky NASA ho ukazují jako podmořský hřeben. Ale jeho původ (přírodní vs umělý) je předmětem debat mezi geology, archeology a věřícími. Pravda je: **most spojuje dvě země, ať už ho postavila příroda nebo Ráma.**

**ZION jako most:** Ráma Setu je obrazem multichain bridge — ZION jako most mezi komunitami, ne zeď. Kde Golden Republic Bohemia má Karlův most (spojení, ne rozdělení), Bodhi Lanka má Ráma Setu (spojení přes oceán, mezi ostrovy, mezi mytologiemi).

### Tři pavilony: Prema, Bodhi, Setu

| Pavilon | Funkce | Symbolika | Protějšek v ZION |
|---|---|---|---|
| **Prema** | Bhakti sál, meditační kruh, tichá governance, obřad souhlasu | Prema (láska/bhakti) — láska jako princip, ne emocie; souhlas narozený z přítomnosti, ne z pravidel | DAO jako žijící ústava, consent z přítomnosti |
| **Bodhi** | Meditační hala, Ayurveda pavilon, knihovna, studovna, Bodhi retreat centrum | Bodhi (probuzení) — osvícení jako stav, ne dogma; Sri Maha Bodhi jako osa; vzdělání jako probuzení | Knowledge commons, Consciousness Admission |
| **Setu** | Multichain node, protokolová komora, multisig treasury, spojení s dalšími uzly | Setu (most) — Ráma Setu jako most přes oceán; ZION jako most mezi komunitami | Guardian Node, multichain bridge, multisig |

Pavilony nejsou replikami chrámů. Jsou **originální současné struktury** z tropického dřeva, kamene a skla, které vizuálně evokují lotos, most a otevřený kruh — geometrii akáši — bez kopírování jakéhokoli existujícího symbolu.

**Konstrukce a materiály:** tropické dřevo (teak, jackfruit, eukalyptus — lokální, obnovitelné), kámen a laterit (srí lanské lokální materiály, tepelná setrvačnost), skleněné fasády pavilonů (průhlednost, pasivní osvětlení, průvan), bambusové a konopné izolace, dřevěné terasy a lávky (propojení pavilonů a stromu, evokace mostu), solární panely integrované do střech, dešťová voda a šedá voda (uzavřený vodní okruh), kompostovací toalety a kořenová čistírna (uzavřený nutrientní cyklus).

### Bhakti jako governance

| Princip | Popis | Protějšek |
|---|---|---|
| **Kruh ticha** | Rozhodování v tichu, ne v diskursu; souhlas narozený z přítomnosti, ne z argumentů | Consent decision-making — ale z přítomnosti, ne z debaty |
| **Prema, ne pravidla** | Láska jako princip governance — ne láska jako emocie, ale jako kvalita prostoru, který dovoluje | DAO jako žijící ústava — ústava narozená z péče, ne ze strachu |
| **Bhakti yoga** | Cesta oddanosti — služba jako forma lásky, ne jako povinnost | Proof-of-Care — odměny za skutečnou péči, ne za staking |
| **Souhlas z přítomnosti** | Kdo chce říct ne, musí se podívat do očí — a držet ticho, dokud se prostor neusadí | Sociokratické kruhy, ale s tichem místo slov |
| **Strom jako svědek** | Rozhodnutí se dějí pod stromem — strom je živý ledger, ne papír | On-chain záznam — strom jako archetyp neměnného záznamu |

**Srovnání s Bohemií:** Golden Republic Bohemia má **kruh diskursu** — slova, argumenty, sůl na stole, oheň uprostřed. Bodhi Lanka má **kruh ticha** — přítomnost, ne slova. Kde Bohemia se ptá „proč?", Lanka se ptá „cítíš to?". Obě jsou governance. Obě jsou konsensus. Ale Bohemia je vzduch (diskurs) a Lanka je akáša (prostor, ve kterém se diskurs odehrává). **Lanka není náhrada Bohemie — je jejím prostorem.**

### Rámájana a ZION

| Rámájana / buddhistický koncept | Význam | Protějšek v ZION |
|---|---|---|
| **Ráma** (dharma/justice) | Král, který staví most pro spravedlnost; dharma jako povinnost | ZION konsensus — pravidla, která platí i bez víry |
| **Sítá** (Země/čistota) | Žena, která prošla ohněm a nespálila se; země, která vydrží | Proof-of-Care — péče, která se ověřuje ohněm reality |
| **Ráma Setu** (most) | Most přes oceán, spojení ostrovů | Multichain bridge — ZION jako most mezi komunitami |
| **Sri Maha Bodhi** (probuzení) | Strom, pod kterým se Buddha probudil; živý 2300+ let | Consciousness Admission — vstup do L5 jako stav, ne test |
| **Akáša** (prostor) | Éter, ve kterém existují všechny elementy | DAO jako žijící ústava — prostor, ve kterém se rozhoduje |
| **Prema** (láska) | Láska jako princip, ne emocie; kvalita prostoru | Humanitární desátek — 5 % z každého bloku, které nikdo nemusí schválit |

### Infrastruktura, právo, ekonomika

| Oblast | Fáze 1 | Fáze 2 |
|---|---|---|
| **Energie** | 10 kWp PV + 20 kWh LiFePO4 (~35 kWh/den v tropech), DC mikrosíť, solární ohřev vody, bioplyn z kompostu | 25 kWp + 50 kWh + grid fallback (~70 kWh/den) |
| **Voda** | 50 m³ dešťová cisterna + pramen, pískový filtr + UV, kořenová čistírna šedé vody, kompostovací toalety | 150 m³ cisterna, uzavřený okruh, biodigestor, solární odsolování |
| **Jídlo** | 1,5 ha ayurvedické byliny + food forest (kurkuma, kari list, jackfruit, mango, banán, kokos, hřebíček, kardamom); 30 % kalorické soběstačnosti | 4 ha syntropické agrolesnictví + ayurveda; 60 %; kozy, kachny, akvaponie |
| **Ubytování** | 6–10 hostů: eko-chaty, jádro týmu v opravené budově | 25–40 hostů: dřevěné eko-chaty, komunitní meditační hala, amfiteátr |
| **Právo** | Srí lanská NGO (non-governmental organization) — registrace podle srí lanského práva | NGO + nadace / trust pro dlouhodobé držení půdy |
| **Příjmy** | Bodhi retreaty 35 %, Ayurveda programy 30 %, eko-turistika 20 %, farma 10 %, node 5 % | Cíl 120 000 EUR/rok; + ayurvedická produkce, vzdělávací centrum |

**Pracovní výměna:** 25 h/týden = ubytování + jídlo, omezeno na 2 pracovní hosty na 4 platící — jako v Zahradě Genesis a Bohemii, aby kruh měl ruce i příjem.

**Desátek:** Bodhi Lanka dává **10 % z veškerého přebytku** (ne jen z node rewardů) místním srí lanským komunitám, ochraně Sri Maha Bodhi a podpoře ayurvedického dědictví Srí Lanky.

### Vazba na ZION

- **Guardian Node** (Fáze 2, cíl 2029): mini-PC (Intel N100 / Ryzen embedded), 15–25 W, vejde se do solárního rozpočtu; Starlink + 4G failover + LoRa relay. Dělení odměn **90 % operátor / 10 % komunitní pokladna**.
- **Pokladna:** multisig 3-z-5 (operační 2-z-3, rezerva 3-z-5 cold, desátek auto-forward měsíčně, fond ayurvedického dědictví).
- **Medical Table:** Ayurveda pavilon, první pomoc, integrativní medicína — srí lanská ayurvedická tradice (kurkuma, neem, gotu kola, ashwagandha, triphala); spolupráce s ayurvedickými univerzitami a léčiteli Srí Lanky.
- **LoRa / Mesh network:** off-grid komunikace, telemetry, nouzové vysílání; napojení na regionální sítě.
- **Bhakti Protocol:** governance protokol založený na souhlasu z přítomnosti — tichý konsensus, kde rozhodnutí vzniká z přítomnosti, ne z argumentů. Prototyp v Bodhi Lanka, sdílený s Bohemií (kruh diskursu) jako komplementární vrstva.
- **Proof-of-Care:** odměny za skutečnou péči o strom, komunitu a ayurvedické dědictví — ne za staking, ne za holding.

### Propojení s dalšími uzly

| Uzel | Co posílá | Co přijímá |
|---|---|---|
| **Zahrada Genesis** (Kořen / Země) | Hosty na Bodhi retreaty; olivový olej, sušené bylinky | Srí lanské koření, ayurvedické byliny; hosty z Lanky na farmářské pobyty |
| **Dharma Temple** (Kmen / Oheň) | Bodhi tree spojení — Dharma's Strom života je koncept, Lanka's Sri Maha Bodhi je realita; strážce po tichu → do kruhu ticha | Governance protokoly zpět do chrámu; české byliny, lipový med |
| **Te Pīko Ora** (Koruna / Voda) | Wayfinding → Rámova cesta přes oceán jako wayfinding; polynéské governance mapy | Bodhi retreat protokoly; semenná výměna (tropické odrůdy) |
| **Golden Republic Bohemia** (Srdce / Vzduch) | Governance kruh (diskurs) → Lanka's kruh ticha jako komplement; české governance protokoly | Bhakti Protocol — souhlas z přítomnosti; tichá governance vrstva |

Všech pět uzlů tvoří L5: Kořen (země) → Kmen (oheň) → Koruna (voda) → Srdce (vzduch) → **Akáša (prostor)**. Akáša je to, co drží ostatní čtyři pohromadě — ne vládnoucím, ale **družícím** principem. Láska, která nevládne, ale dovoluje.

### Fáze

| Fáze | Období | Stav | Klíčové body |
|---|---|---|---|
| 0 — Zárodek | 2027 Q1–Q2 | 🔵 | Core team 3–5 strážců, scouting Srí Lanka (Anurádhapura vs hill country vs south coast), právní rešerše (srí lanská NGO), kulturní review Rámájany a buddhistických motivů, rozpočet 80 000 EUR, partnerství s buddhistickou sáňghou |
| 1 — Kořeny | 2027 Q3–2028 | 🔵 | Pozemek (dlouhodobý nájem), registrace NGO, solar 10 kWp, cisterna 50 m³, eko-chaty 6–10 jednotek, 1,5 ha ayurveda + food forest, první hosté Q4 2028 („Bodhi + Ayurveda Immersion"), ZION wallet + DAO rámec |
| 2 — Komunita | 2029 | 🔵 | Guardian node, stálé bydlení 3–5 chat, měsíční Bhakti governance program, LoRa mesh, Ayurveda pavilon, propojení s Genesis Garden, Dharma Temple, Te Pīko Ora a Bohemií, první Bodhi retreat |
| 3 — Síť | 2030 | 🔵 | 4 ha, ayurvedická produkce, vzdělávací centrum (Bodhi + Ayurveda škola), druhý uzel v jižní Asii, 120 000 EUR/rok |
| 4 — Výzařování | 2031+ | 🔵 | Bodhi retreat centrum 40+ hostů, ZION platby jako výchozí, knowledge commons, 1 % přebytku → L6, první prototyp Bhakti governance v praxi |

### Rizika

Monzun (dvě sezóny — Yala květen–září, Maha říjen–leden; stavby odolné větru, zásoby vody, evakuační plán), tropické nemoci (dengue, malaria, japonská encefalitida — očkování, moskytiéry, lékařský plán), konflikt s elefantly (Srí Lanka má nejvyšší hustotu asijských slonů; ploty, zónování, respekt ke koridorům), **kulturní citlivost** (Rámájana je posvátná pro hinduisty, buddhisty i Srí Lankance — kulturní review, citlivé zacházení s Ráma/Sítá/Sri Maha Bodhi motivy; Sri Maha Bodhi je živý náboženský objekt, ne turistická atrakce), politická nestabilita (Srí Lanka prošla ekonomickou krizí 2022; právní a politická monitoring), odchod klíčového strážce (cross-training, dokumentace), volatilita ZIONu (pokladna v stablecoinech + LKR + ZION), neúroda (polykultura, semenná diverzita, monzunové zajištění).

---

## Kotla pravdy — ověřitelná fakta

> Bodhi Lanka je **koncept a příprava**. Žádná půda nebyla zakoupena, žádný pavilon nebyl postaven, žádný strážce nebyl zapsán. Sri Maha Bodhi existuje a roste — ale není naším stromem. Je stromem Srí Lanky, buddhismu a celého lidstva. To, co existuje, je narativní rámec, historická inspirace a protokolová vize.

| Prvek příběhu | Stav | Co je ověřitelné | Co ještě chybí |
|---|---|---|---|
| **Sri Maha Bodhi, Anurádhapura** | **ŽIVÉ** (skutečný strom, skutečné místo, UNESCO) | Sri Maha Bodhi v Anurádhapure, vysazena 288 př. n. l., řízek z Buddha Gaya, přivezena Sáňghamittou; Anurádhapura UNESCO (1982); 2300+ let nepřetržitého uctívání — veřejně ověřitelné. | Není náš strom — je strom Srí Lanky. Žádné partnerství s chrámem není dohodnuto. |
| **Rámájana — Ráma, Sítá, Ráma Setu** | **MÝTUS / kulturní fakt** | Rámájana (atribuována Válmíkim, ~5.–4. stol. př. n. l.) — veřejně doložený epos; Ráma a Sítá jako postavy eposu; Rámájana je posvátná pro hinduisty, buddhisty a Srí Lankance. | — |
| **Ráma Setu (Adamův most)** | **MÝTUS + geologický fakt** | Řetěz vápencových mělčin mezi Indií a Srí Lankou, ~48 km; satelitní snímky NASA; geologický původ debatován (přírodní vs umělý). | — |
| **Bodhi Gaia jako koncept** | **MÝTUS** | Obraz z návrhu Dharma Temple, rozšířený na L5. Není nábožensky závazný. | — |
| **Bodhi Lanka projekt** | **HORIZONT** (dokumentace) | Tato kapitola; narativní a protokolový rámec. | Pozemek, entita, tým, financování, kulturní review. |
| **Guardian Node, DAO, multisig** | **HORIZONT** | Specifikace `public/V3/L5/docs/TECH/zion-node-spec.md`; split 90/10; multisig struktura. | Žádný L5 node na Srí Lance neběží; instalace Fáze 2 (2029). |
| **Ayurvedická partnerství** | **HORIZONT** | Ayurveda je veřejně doložená tradice Srí Lanky; ayurvedické univerzity a léčitelé existují. | Žádný kontakt není doložen; MOU není podepsáno. |
| **Ekonomický model (break-even, příjmy)** | **HYPOTÉZA** | Podle vzoru Genesis Garden a Bohemia §4; koncept Fáze. | Skutečné účetnictví po první sezóně; žádná grantová žádost není podána. |
| **Ráma, Sítá, tesař jako poutník** | **MÝTUS** | Postavy z Rámájany a z této knihy; Sítá jako archetyp Matky Země (Sůl země) a Sity z Rámájany — nikdo netvrdí historickou ani duchovní autoritu. | — |

> **Věta z Exekuční charty, která tu platí nejvíc:** *„Žádné monetizované ‚posvátné skiny', žádná gamifikace duchovní autority."* Bodhi Lanka nesmí být prodávána jako „návrat k Buddhaovu probuzení" ani jako „Rámájana na blockchainu". Sri Maha Bodhi je živý náboženský objekt, ne marketingový asset. Rámájana je posvátný epos, ne brand. Je to laboratoř lásky jako governance, ne náboženský mýtus k prodeji.

---

*→ Pokračování: [Kapitola 12 …]*

---

*[Zpět na index Knihy Země → `00-README.md`](./00-README.md)*




