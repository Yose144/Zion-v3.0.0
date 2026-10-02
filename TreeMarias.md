# TRES MARIAS — Realizační studie flotily

> **Status:** 🟣 **NÁVRH K DISKUSI** — interní pracovní dokument, ne veřejný text.
> **Datum:** 2026-10-01 · **Příprava:** ZION / Terra Nova L5
> **Souvisí:** [`L5MariaDelCamino.md`](./L5MariaDelCamino.md) (koncept a Velká cesta), [`L5Ekam.md`](./L5Ekam.md), [`L5BoaEsperanca.md`](./L5BoaEsperanca.md), korpus [`docs/WP-Mainet/MariaCaminho/`](./docs/WP-Mainet/MariaCaminho/00-README.md)
> **Registry:** program `maria-del-camino`, status `planning`, founding rezerva **300M ZION**

---

## 0. TL;DR

Flotila **Tres Marias** = tři plavidla á ~50 poutníků, každé pro jeden oceán. Realizace se dělí na tři rozdílné inženýrské projekty:

| Trup | Loď | Oceán | Technologie | Odhad CAPEX | Obtížnost |
|---|---|---|---|---|---|
| **I — Santa María la Mayor** | Klasická plachetnice (tall ship) 55–70 m | Atlantik | Ocelový trup + výztužný diesel-elektro agregát; solární plachta jako symbol | €8–25M (refit → novostavba) | **Střední** — osvědčená kategorie |
| **II — Nossa Senhora de Fátima** | Solární katamarán ~35–45 m | Pacifik | PV skin + baterie + e-motory + plachta; wa'a linie | €15–35M (custom = jediný certifikovatelný design pro ~50 osob na oceán) | **Nejvyšší** — není sériový produkt |
| **III — María de las Nieves** | Otevřené — plachetnice / sail-cargo / moderní dhow | Indický | TBD v design study | €8–25M | Střední (po zkušenostech I+II) |

**Strategie zničení rizika:** nejdřív **charter** (fáze 1), pak **refit nebo partnerství** (fáze 2–4), novostavba až tam, kde nic nekoupíš (pacifický solární katamarán). Celá flotila sekvenčně přes ~7–10 let — ne jako stavba, ale jako program.

---

## 1. Co přesně lodě musejí umět (specifikace z konceptu)

Z `L5MariaDelCamino.md`:

- **Kapacita:** ~50 osob na trup = 14–18 permanentní posádka/hospitaleři + ~30 rotujících poutníků
- **Soběstačnost na moři:** RO watermaker, PV přebytek, hydroponie/zásoby, kuchyň pro 50
- **ZION uzel na palubě:** full node + multisig trezor + LEO satelit + LoRa mesh gateway
- **Práce mezi uzly:** nákladní prostor (seeds, humanitární cargo, produkty uzlů — „Terra Nova Cargo")
- **Legitimita:** SOLAS/SPS-použitelná kategorie pro přepravu „voyage crew" (special personnel, ne passenger)
- **Panama-compliance:** do 38,1 m LOA = handline transit (levný); nad = tonnage toll, ale průjezdné — viz §9

**Klíčové rozhodnutí o kategorii pasažérů (ovlivňuje celý design):**

| Režim | Limit | Nástroj |
|---|---|---|
| „Passenger" | >12 osob = SOLAS Passenger Ship (velmi tvrdé) | vyhnout se — přepaluje CAPEX |
| **„Voyage crew / trainees"** | SPS Code (IMO) — stážisté jako „special personnel" | **cesta sail-training flotily** — Bark Europa, Statsraad Lehmkuhl, Santa Maria Manuela tak jezdí světové okruhy s ~40 hosty |
| „Charter yacht" | ≤12 hostů komerčně | příliš malé |

→ **Doporučení:** klasifikace jako **Special Purpose Ship / sail training vessel** (SPS Code + flag state sail-training endorsement). Poutníci = trainees — opravňuje je to legálně pracovat na palubě (což je zároveň smysl iniciace).

---

## 2. Trup I — SANTA MARÍA LA MAYOR (Atlantik)

*Klasická plachetnice v caminské tradici. Červená královská roucha → červené akcenty oplachtění/bonite. Domov: Pontevedra.*

### 2.1 Tři cesty k trupu

| Cesta | Popis | CAPEX | Čas | Riziko |
|---|---|---|---|---|
| **A — Refit ojetého tall shipu** | Koupit historický/charterový schooner/barquentine/lugger (50–70 m), refit pro expedice | **€3–10M** | 18–36 měs. | Údržba starého trupu; survey překvapení |
| **B — Novostavba schooner/brigantine** | Ocel/alu novostavba 55–65 m v Galicii | **€15–25M** | 3–4 roky | CAPEX, ale plná kontrola |
| **C — Partnerství/management** | Dlouhodobý charter nebo JV se stávajícím provozovatelem | €0.5–1.5M/rok | ihned | Žádné vlastnictví — pilot fáze |

### 2.2 Referenční flotila — co už existuje a pluje

| Loď | Typ | Kapacita | Model | Ponaučení |
|---|---|---|---|---|
| **Santa Maria Manuela** (PT) | 4-stěžňový lugger 68 m (1937, refit 2010) | ~50 hostů + ~17 crew | Eco-voyages + sail training, Algarve/Madeira/Kanáry/Azory; legy €600–1000/os | **Přímý vzor** — portugalská, mariánská, dělá přesně naši atlantickou osu |
| **Bark Europa** (NL) | Bark 56 m (1911) | ~40 voyage crew | Celoroční světové expedice vč. Antarktidy; platící poutníci | Business model „voyage crew" na celosvětové trase — prokázáno |
| **Statsraad Lehmkuhl** (NO) | Bark 84 m (1914) | ~130 trainee | **One Ocean Expedition** — obeplula svět 2021–23 jako UN decade flagship | Scaled verze našeho konceptu; prokázaná legovaná cirkumnavigace |
| **Atyla** (ES) | Schooner 31 m | ~24 trainee | Bilbao, mládežnické expedice | Španělský malý formát, levnější provoz |
| **NRP Sagres / Creoula** (PT Navy) | Bark/lugger | cvičné lodě námořnictva | Státní sail training | Zdroj **kapitánů a důstojníků** — portugalské námořnictvo školí tall-ship důstojníky |
| **Sea Cloud Spirit** (MT/DE) | 138 m luxusní plachetnice (2021) | 136 pax + 90 crew | Luxusní plavby ~$100M | Postavena ve **Vigu (Metalships & Docks)** — Galicie umí tall ships |
| **Pelican of London** (UK) | Barquentine | ~30 trainee | Arctic expedice + mládež | Další prokázaný provozovatel |
| **Eye of the Wind** | Brigantine (1911) | ~24 hostů | Global charter | Menší referenční bod |

### 2.3 Loděnice (priority podle home portu Galicie)

**Galícijský klastr (ría de Vigo + Marín) — 40 km od Pontevedry:**

- **Metalships & Docks** (Vigo, Rodman Group) — dostavěli **Sea Cloud Spirit** (největší moderní plachetnice světa v kategorii). Mohou novostavbu i komplexní refit.
- **Freire Shipyard** (Vigo) — zakázkové ocelové lodě, expedice, výzkumné plavidla; zkušenost se solárními/hybridními projekty.
- **Nodosa Shipyard** (Marín, ría de Pontevedra doslova!) — historická loděnice přímo v domácí vodě; z níž Sea Cloud Spirit unesené plavidlo opravili.
- **Astilleros Armón** (Vigo/Burela) — pracovní lodě, vlastní design offices.

**Portugalsko:**
- **West Sea** (Viana do Castelo) — velká komerční loděnice (Scandlines ferries); reálná kapacita pro zakázkovou novostavbu.
- **Navalria** (Aveiro) — ocelové pracovní lodě; levnější.

**Nizozemsko/Německo (pokud Galicie nestačí):**
- **Balk Shipyard** (Urk, NL) — světová špička pro refit superjacht vč. klasických plachetnic.
- **Fassmer** (Berne, DE) — postavili Rainbow Warrior III (2011, A-frame škuner, motor-plachetník).
- **Damatai / Damen Shipyards** — komerční řada + podpora.
- **Baltic Workboats / Baltic Yachts** (FI/EE) — pokud kompozit.

### 2.4 Námořní architekti pro plachetnici

- **Dykstra Naval Architects** (Amsterdam) — *de facto* lídr pro tall ships a klasické jachty (Athena, Maltese Falcon DynaRig, Adix, mnoho schoonerů); mají i „Classic Yacht" modely připravené pro refit konzultace.
- **Olivier F. van Meer Design** (NL) — výzkumné/expediční plachetnice (postavil design pro několik světových expedičních lodí).
- **De Villiers – van Schaik Marine Design** — Pepijn van Schaik = designer **Ceiba** (Sailcargo) i poradce u Tres Hombres/Europa; ideální pro „cargo-pilgrim" hybrid.
- **MAURIC** (FR) — námořní architekti za NEOLINE; solid-sail + hybrid.
- **LomOcean / Craig Loomes** (NZ) — viz trup II.

### 2.5 Oplachtění — doporučená konfigurace

**Schooner nebo brigantina, ~55–65 m LOA:**
- Schooner (příď i záď příčné plachty) = menší výkon na posádku, jednodušší výuka, ideální pro 30 trainee
- Brigantina/barquentine = příď příčná, zadní podélné → rychlejší, tradičnější, složitější
- **DynaRig varianta** (jako Maltese Falcon/Black Pearl): automatizované plachty na volně stojících stožárech — drahé, ale vizuálně „plachty ze světla" = naše poetika; licence přes Southern Spars/Dykstra
- **Solární vrstva:** PV integrované do povrchů nástavby + případně flexibilní PV na plachtách (Solbian/Giosolar); e-pohon hybrid diesel-electric pro přístavy/canals

### 2.6 CAPEX/OPEX

| Položka | Refit (A) | Novostavba (B) |
|---|---|---|
| Akvizice trupu | €1.5–4M | — |
| Design/studie/class | €0.5–1M | €1.5–3M |
| Stavba/refit | €3–6M | €12–20M |
| Oplachtění/výstroj | €0.8–1.5M | €1.5–3M |
| Certifikace, trials | €0.3–0.5M | €0.5–1M |
| **CAPEX celkem** | **~€6–12M** | **~€15–25M** |
| OPEX roční (crew, pojištění, údržba, přístavy, potraviny) | €0.8–1.5M/rok | €1–1.8M/rok |

*(Rámcové odhady dle provozovatelů tall ships; design study to upřesní.)*

---

## 3. Trup II — NOSSA SENHORA DE FÁTIMA (Pacifik)

*Solární katamarán v linii wa'a kaulua. Bílé svatební šaty → bílý trup, orchidej na přídi. Domov: Te Pīko Ora (Raiatea).*

### 3.1 Precedent — PlanetSolar (důkaz proveditelnosti)

**MS Tûranor PlanetSolar** — *největší solární lodní precedent:*
- 31 × 15 m katamarán, 537 m² PV (825 modulů), 1 130 kWh baterie, 4 e-motory
- **První obeplutí světa čistě na solár** (Monaco 2010 → 2012, 584 dní, 32 410 nm, průměr ~5–8 kn)
- Postavena **Knierim Yachtbau** (Kiel), design **LOMOcean / Craig Loomes** (NZ)
- Náklady ~€15M; relaunched 2025 jako **Porrima P111** (Tchaj-wan)

→ PlanetSolar měl crew 4 a minimum kajut. Náš požadavek ~50 osob na oceán = **nová třída** — „solar passenger catamaran", v sérii neexistuje. To je trup II: **custom design, ne katalog**.

### 3.2 Zdroje pro trup II

| Typ | Příklad | Poznámka |
|---|---|---|
| **Luxury solar cat** (vzor technologie) | **Sunreef 80 Eco** (Gdańsk, PL) — PV integrované do trupu/stožáru/bimini (až 36 kWp), hydrogenerace, twin 180 kW e-motory; ~€7–9.5M za 24 m / ~10 hostů | Technologie + sériový dodavatel PV-skin; malá kapacita → pouze tech partner |
| **Silent Yachts** (Fano, IT / Thailand) | Silent 55/60/80/100/120 — sériové solar-electric caty | Stejná poznámka — komerční partner pro subsystémy |
| **Expe katamarány** | Energy Observer (H₂), Race for Water (= ex-PlanetSolar), Brim Explorer (NORSKÁ e-passenger cat ~140 pax fjordové plavby) | Prokázané koncepty; Brim je nejbližší „50-pax eco" komerční zkušenosti |
| **Commercial cat design** | **Incat Crowther** (AU/Sydney) — projektují e-ferry a expediční katamarány v pax třídách; **Austal** (AU), **Damen Fast Ferry** | Pokud chceme „SOLAS-lite" skutečný pax katamarán |

### 3.3 Stavba — dvě varianty

**Varianta B1 — „Wa'a modern":** polynéská dvojitá kánoe, ale industrializovaná:
- Design office: **LOMOcean** (PlanetSolar autor) nebo **VPLP** (FR — lídr pro velké multihulls, Vela cargo trimaran)
- Yard: **Sunreef** (Gdańsk — sériová PV integrace), **Knierim** (Kiel — composite masters), **Piriou** (FR — Anemos zkušenost), **Two Oceans Marine** (Cape Town — expediční caty; symbolicky Mys!)
- **Costa Rica varianta:** Gulf of Nicoya klastr kolem Sailcargo (trup III/logistika — ne primární, ale partnerství na kapitole se nabízí — wa'a se staví v Polynésii...)

**Varianta B2 — „Pragmatická":** refit velkého komerčního katamaránu (ex-ferry/ex-charter 35–45 m, Incat/Austal loď z druhé ruky) + PV retrofit + kajuty pro 50. Podstatně levnější, méně krásné, možná chytré jako mezikrok.

### 3.4 Regulační realita trupu II

Katamarán pro ~50 osob na oceán:
- ≤12 pax → yacht; 13+ pax → **passenger ship** nebo **SPS** režim
- **Řešení:** SPS Code + stážisté; případně flag v pacifické zóně (Cook Islands register — wa'a-friendly, Fats Polynésie; Marshall Islands accept SPS; Panama flag má otevřený registr). Rozhodnout v design study.
- Polynéský rámec: FPIC konzultace + partnerství s **Polynesian Voyaging Society** (Hōkūleʻa) a FFA — „va'a" koncept přijde z jejich tradice; buď je honorujeme značkou, nebo si říkáme katamarán (respect).

### 3.5 CAPEX/OPEX

| | Custom new (B1) | Refit ferry (B2) |
|---|---|---|
| Design+class | €2–4M | €1–2M |
| Stavba/refit | €12–25M | €6–12M |
| PV+baterie+e-propulze | zahrnuto | €1.5–3M |
| **CAPEX** | **~€15–30M** | **~€8–15M** |
| OPEX | €0.8–1.4M/rok | €0.8–1.3M/rok |

---

## 4. Trup III — MARÍA DE LAS NIEVES (Indický oceán)

*Zlatá roucha, nedokončené zázraky — „loď, která ještě není". Trasa Ekam → Boa Esperança → návrat. Design otevřený; poslední z flotily.*

### 4.1 Tři kandidátní linie

| Linie | Koncept | Poznámka |
|---|---|---|
| **Dhow heritage** | Moderní „solar dhow" — trup v linii indickooceánských baghlah/sambuk, třešně z Kerala nebo Mandvi (Indie) — tradice lateen plachet, které obsluhovaly Indický oceán 2000 let | Nejkrásnější kultura-match (Zlatá Marie + monzunová trasa); nejobtížnější certifikace |
| **Second tall ship** | Sistership trupu I (schooner/brigantine) — sjednocuje velitelský/trénink program | Nejjednodušší provoz; nejnižší inovační příběh |
| **Sail-cargo hybrid** | Moderní plachetní nákladní loď ve stylu TOWT Anemos / Sailcargo Ceiba — cargo-first, ~50 poutníků jako trainees | Navazuje na „Terra Nova Cargo" misi; Boa Esperança/Indie linka by žila nákladem |

### 4.2 Kde stavět

- **Indie:** Kerala (Kochi shipyard klastr, Beypore uru tradice — dřevěné dhows se staví dodnes), Goa/Beypore pro tradiční stavbu; **Cochin Shipyard** pro komerční
- **Jihoafrická republika:** **Two Oceans Marine Manufacturing** (Cape Town) — světová špička v expedičních katamaránech; symbolicky u Boa Esperança
- **Evropa:** stejný klastr jako trup I (Galicie) — levnější management, jediná výuka pro všechny tři

### 4.3 Záměrně HORIZONT

Trup III se **nepodrobuje stejné specifikaci jako I/II v tomto dokumentu** — otevřené otázky (dhow vs schooner vs cargo) se mají řešit až po zkušenostech fází 1–4. Korpusní pravidlo (MariaCaminho/08): *horizont si zaslouží poctivost, ne barvu.*

---

## 5. Regulace, vlajka, pojištění — právní stack

### 5.1 Certifikační cesta

1. **Class society:** DNV, Bureau Veritas (francouzská tradice pro sail), Lloyd's Register, RINA — sail training návrhy vede BV/LR
2. **Flag state:** 
   - **Portugalsko (PT)** — MAR register (Madeira International Shipping Register — EU vlajka, daňově přátelská, zkušenost s tall ships — Santa Maria Manuela je PT)
   - **Malta** — pragmatický registr, angličtina, SPS-friendly
   - **Nizozemsko** — největší tall-ship registr světa (Bark Europa, Thalassa, Eendracht...)
   - **Španělsko** — silná námořní kultura, složitější registrace
   - → Doporučení trup I: **MAR/Madeira (PT)** — evropská vlajka + portugalská mariánská linie
3. **Kategorie plavidla:** SOLAS + **IMO SPS Code** (special purpose ship pro trainees) — „voyage crew" není pasažér
4. **ISM Code** (management), **ISPS** (security), **MLC 2006** (život posádky), **MARPOL** (emise)

### 5.2 Pojištění

- **P&I klub:** NorthStandard, Britannia, UK P&I — sail training flotily standardně; ~€150–300k/rok/loď
- **Hull & Machinery:** Lloyd's market
- **Liability pro trainee program:** specializovaný pojišťovatel STV (sail training vessels)

### 5.3 Kapitány a posádka — kdo lidi naučí plout

**Manning table (per hull, ~50 osob):**

| Role | Počet | Poznámka |
|---|---|---|
| Master (kapitán) | 1 | STCW II/2 Master Mariner + flag endorsement + tall-ship experience |
| Chief Officer + 2nd Officer | 2 | STCW II/1+; aspoň jeden se sail training zkušeností |
| Engineer + Electro-tech | 2 | e-propulze, RO watermaker, PV |
| Bosun + deckhands | 4–6 | sail handling; trainee vedení |
| Cook/steward | 2 | 50 porcí 3× denně |
| Medic/hospitaller | 1 | zdravotník na expedici |
| **Permanent crew** | **12–16** | |
| **Guardians/poutníci (voyage crew)** | **~34** | trainees — placené legy / stipendia |

**Kanály pro personál:**
- **Sail Training International (STI)** — světová síť sail training organizací; nábor kapitánů/důstojníků i certifikační rámec
- **Portugalské námořnictvo** — důstojníci ze Sagres/Creoula po aktivní službě = ready-made Marian tall-ship kapitáni
- **Španělské námořnictvo** — Juan Sebastián de Elcano alumni
- **Nizozemská STV síť** — Bark Europa alumni jsou zkušení circumnavigátoři
- **Sailcargo/Fairtransport síť** — lidi co pluli na Tres Hombres/Nordlys bez motoru

---

## 6. Workflow realizace — od nuly ke třem lodím

### Fáze 0 — Design study (6–9 měsíců, ~€150–300k)

- [ ] Námořní architekt brief pro trup I (refit vs newbuild studie, cost model)
- [ ] SPS/flag konzultace (BV/DNV + MAR/Dutch registry early dialog)
- [ ] Operator model: vlastní operator vs. ship management company (např. **Columbia Shipmanagement**, **Wilhelmsen**, nebo menší tall-ship manažeři)
- [ ] Partnerstvo: STI membership, kontakt na provozovatele (SMM, Bark Europa) pro benchmark

### Fáze 1 — Charter pilot (fáze 1 z konceptu, ~€300–800k/rok)

- [ ] **Dlouhodobý charter existující lodi** na první etapu (Pontevedra → La Palma): kandidáti Santa Maria Manuela (PT), Atyla (ES), Pelican (UK), nebo malý expedice vessel
- [ ] Důkaz: Guardian uzel na moři, credencial razítka, mesh sync, posádka-zkušenost — bez vlastnictví
- [ ] Zároveň market test „voyage crew" modelu

### Fáze 2 — Trup I (24–48 měsíců)

- [ ] Tender: Dykstra/van Meer/De Villiers-van Schaik na koncept → basic design → class approval
- [ ] Tender loděnic: Metalships & Docks / Freire / Nodosa / West Sea / Balk
- [ ] Stavba nebo refit; zkoušky; flag registration; ISM; pojištění
- [ ] Nabírání kapitána → crew (pilot legy Pontevedra–Finisterre–Algarve–La Palma)

### Fáze 3 — Atlantický okruh v provozu (rok 1–2 provozu)

- [ ] Plná atlantická trasa vč. Karibiku a LUMI
- [ ] Manifest/cargo ops, credencial cycle live

### Fáze 4 — Trup II (24–48 měsíců po fázi 3)

- [ ] Solar cat design (LOMOcean/VPLP) + yard tender (Sunreef/Knierim/Piriou/Two Oceans)
- [ ] Polynéské konzultace (PVS), Te Pīko Ora home port formální vztah
- [ ] LUMI exchange protokol — dvou-trupové operace

### Fáze 5 — Trup III (design v závislosti na I+II)

- [ ] Design brief (dhow vs schooner vs cargo), Indie/JAR loděnice
- [ ] Trasa dokončení Ekam → Boa Esperança → návrat

**Realistický horizont celé flotily: ~7–10 let sekvenčně** (soudě dle Ceiba 2018→dodnes a TOWT 2011→2024 u nových typů; refit cesta zkracuje na ~4–6 let).

---

## 7. Náklady vs. founding rezerva

| Scénář | CAPEX celkem | vs. 300M ZION (~$300M nominál)* |
|---|---|---|
| Minimalistický (3× refit) | €18–35M | **velká rezerva zůstává** — na provoz + infrastrukturu uzlů |
| Střední (trup I refit + II custom + III refit) | €30–50M | stále rezerva |
| Maximální (3× novostavba + luxusní trup I) | €50–80M | pokryté, ale konzervativně přepočítat |

*Nominálně; reálná likvidita ZION ≠ nominál — finanční plán v design study zvlášť.*

**OPEX souhrn flotily:** ~€2.5–4M/rok za všechny tři (crew ~55–60%, údržba ~20%, pojištění ~8%, přístavy/potraviny ~15%). **Příjmy:** placené legy (Bark Europa model ~€80–150/den/poutníka → 30×250dní×€100 ≈ €750k/rok/loď), náklad manifest, stipendia/granty, L5 tithe. Flotila může být ~polosoběstačná jako provoz.

---

## 8. Rizika

| Riziko | Míra | Mitigace |
|---|---|---|
| Nový custom solar cat zůstane prototyp | vysoká | Trup II na refitu komerčního catu jako mezikrok; expertní class review před kýlem |
| Náklad na refit starší plachetnice | střední | Out-of-water survey před nákupem; 20% kontingence |
| SPS/flag kategorie neprojde pro plánovaný program | střední | Brzy class+flag v design study; SMM nebo holandský registr je osvědčená cesta |
| CAPEX překročí odhady | střední | Sekvenční stavba; charter-first drží program živý i při CAPEX delay |
| Nábor posádky pro dlouhé legy | střední | Voyage-crew model + STI network + portugalské námořní alumni |
| Sezónní okna (hurikán/monzun) | — | Je to feature trasy, ne chyba — etapy se naplánují na okna |
| Panama průplavní sloty | nízká (ne nutnost) | Trupy drží své oceány; jediný případ = repozicionování |

---

## 9. Meziokéanská logistika (připomenutí z konceptu)

- **LUMI šíje** — lidé+cargo po souši, trupy zůstávají ve svých oceánech (Camino de Cruces precedent)
- **Panama Canal** — realita pro přesun trupu: ≤38.1 m LOA = handline transit (~$3–4k), >38.1 m = tonnage toll, lokomotivy; ~8–10 h přejezd. Použitelné pro dodání trupu II do Pacifiku, pokud se postaví v Atlantiku — místo půlkruhu kolem Cape Hornu
- **Kostarika/Nikaragujský kanál** — neexistuje; pouze pozemní přechod (což je náš případ — a je to krásnější)
- **Sailcargo Ceiba** (Punta Morales, Pacific Costa Rica) — 45 m dřevěný topsail schooner, 250 t cargo, 12 crew + 12 guest crew; stavba od 2018, potřebuje ~$2M na dokončení → **potenciální partner/okno do Pacifiku i LUMI infrastruktury**

---

## 10. Partnerská mapa (kdo oslovit, v jakém pořadí)

| Priorita | Organizace | Proč |
|---|---|---|
| 1 | **Sail Training International** | rámec, certifikace trainee programu, nábor |
| 1 | **Santa Maria Manuela provozovatel** | přesný vzor operací, možný charter na pilotní etapu, PT flag know-how |
| 1 | **Dykstra NA / De Villiers-van Schaik** | design trupu I |
| 2 | **Metalships & Docks / Freire / Nodosa** | galícijský klastr pro trup I |
| 2 | **Bark Europa provozovatel** | světový voyage-crew model — možný management/charter partner |
| 2 | **BV nebo DNV class** | early class konzultace |
| 3 | **LOMOcean / VPLP / Sunreef** | trup II |
| 3 | **Polynesian Voyaging Society** | wa'a legitimita, Te Pīko Ora vztah |
| 3 | **Sailcargo Inc. (Ceiba)** | LUMI infrastruktura + duchovní spřízněnost |
| 4 | **TOWT / NEOLINE / Fairtransport** | cargo model pro trup III a manifest síť |
| 4 | **Two Oceans Marine** (Cape Town) | trup III varianta na Mysu |

---

## 11. Otevřené otázky

- [ ] Vlastník flotily — L5 foundation entity vs. operační SPV vs. partner-operator JV?
- [ ] Trup I: refit vs novostavba — závisí na výsledku design study + na trhu ojetých tall ships v době tenderu
- [ ] Trup II: potvrdit, že 50-osobný oceánský solární cat projde SPS (nebo zvolit pragmatickou B2 refit ferry variantu)
- [ ] Trup III: dhow vs schooner vs cargo — nechat otevřené do fáze 4
- [ ] Flag: MAR/PT vs. NL vs. Malta — začít konzultace pro trup I
- [ ] Management: in-house operator team vs. external ship manager (doporučuji external pro první 2 roky)
- [ ] Placené legy vs. stipendia vs. mix — doplnit cenový model do design study
- [ ] Vzdělávací rámec: STI trainee curriculum + ZION Guardian certifikát

---

## 12. Reference — přímé odkazy k ověření

- Santa Maria Manuela: `santamariamanuela.pt` (provoz, ceny legů, PT flag)
- Bark Europa: `barkeuropa.com` (world voyage program)
- Statsraad Lehmkuhl One Ocean Expedition (2021–23 circumnavigation)
- Sea Cloud Spirit: Metalships & Docks Vigo (2021, ~€90M luxury class — důkaz galícijské kapacity)
- PlanetSolar/Tûranor: Knierim Yachtbau Kiel, design LOMOcean — `planetsolar.org`; relaunch 2025 jako Porrima P111
- Sunreef Yachts (Gdańsk): Sunreef 80 Eco — PV-skin integrace
- Sailcargo Ceiba: `sailcargo.org` (Punta Morales, Costa Rica; designer De Villiers-van Schaik)
- TOWT Anemos: Piriou Shipyard, Le Havre–NYC linka (2024–)
- NEOLINE Neoliner Origin: RMK Marine Tuzla, Solid Sail (Chantiers de l'Atlantique), Saint-Nazaire–Halifax linka (2025)
- IMO SPS Code (MSC.266(84)) — special purpose ships / trainees
- STI: `sailtraininginternational.org`

---

*„Loď bez plachet se stala flotilou, jejíž plachty jsou světlo. Teď je čas položit kýly."*
