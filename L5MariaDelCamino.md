# L5 · María del Camino — plující uzel Terra Nova

> **NÁVRH K DISKUSI** — interní pracovní dokument, ne veřejný text.
> Po schválení konceptu se z něj stane `public/V3/L5/docs/COMMUNITIES/maria-del-camino.md` + public docs pair `terranova/maria-del-camino.{cs,en}.md` + záznam v `freeworld/content/projects.json`.
>
> *"Pentagram má pět bodů. Šestý je most. Sedmý je paměť. Osmý je cesta, která je všechny spojuje."*
>
> *"Ultreia et suseia — vpřed a výš." — pozdrav poutníků z Codex Calixtinus*
>
> **Název:** **María del Camino** — „Marie Cesty" (rozhodnuto operátorem 2026-09-30; viz §3)
> **Flotila:** **dvě lodě** — atlantická plachetnice *María del Camino* + pacifický solární katamarán *María del Pacífico* (rozhodnuto 2026-09-30)
> **Domácí přístav:** **Pontevedra, Galicie** — bazilika Santa María la Mayor, pobřežní Camino Portugués (rozhodnuto operátorem 2026-09-30)
> **Formát trasy:** **obeplutí světa** — iniciační posloupnost pro Guardiany; 2 trupy obsluhují cestu, chybějící uzly v pipeline (§4)
> **Status:** 🟣 Vision — návrh
> **Poslední úprava:** 2026-09-30

---

## 1. Identita a záměr

Každý uzel Terra Nova nese do sítě jeden princip: Genesis nese zahradu, Dharma chrám, Te Pīko Ora oceán, Bohemia governance, Bodhi Lanka akášu, LUMI most mezi světů, Uluru paměť.

**María del Camino nese cestu samotnou** — sedm pevných bodů se stává sítí teprve tehdy, když mezi nimi něco žije. Loď je osmý bod, který není bod, ale **linie**: pohyblivý uzel, který fyzicky spojuje všechny ostatní.

Osmý bod přitom není jedna loď, ale **dvojče lodí — dvě Marie pro dva oceány**:

- **María del Camino** (Atlantik) — klasická plachetnice v tradici Camina de Santiago; galicijská domácí voda, Finisterre, tři mariánská místa na trase.
- **María del Pacífico** (Pacifik) — solární katamarán navazující na *wa'a kaulua* / voyaging-canoe tradici Polynésie; otevřený prostor, wayfinding, Te Pīko Ora jako její duchovní domov.

Dvojice se fyzicky schází v **LUMI Nová Amerika** (Kostarika) — most mezi Amerikami se stává mostem mezi dvěma moři: poutníci, semena a náklad překládají přes Panamu/isthmus a přestupují mezi loděmi. LUMI je kloub flotily.

### Kde končí starý svět

Tisíc let chodili poutníci po Caminu do Santiaga — a kdo chtěl jít skutečně do kraje, pokračoval na **Finisterre** (*finis terrae* — konec země), kde cesta končila u moře a nebylo kam jít dál. Tam poutníci pálili šaty a dívali se na horizont.

**María del Camino je přesně ten krok navíc**: cesta, která nekončí u moře, ale na něm pokračuje. Tam, kde skončil starý svět, začíná nový — a loď ho nese.

Tři kotvy:

- **Cirkulace** — seed library, kulturní archiv, lidé a granty proudí mezi uzly přes moře, ne přes kurýrní služby. L5 protokoly (seed exchange, knowledge commons, resonanční kalendář) dostávají doslova námořní dopravu — **a lodě se stávají obchodní tepnou sítě** (viz §4 Terra Nova Cargo).
- **Plovoucí ambasáda** — loď připlouvá do přístavů jako ambasáda celé sítě: otevřené dny, Medical Table na palubě, výstava všech sedmi uzlů na jedné návštěvní trase.
- **Důkaz soběstačnosti** — ~50 lidí, vlastní energie z plachet, vlastní voda, vlastní jídlo, vlastní uzel validující chain zprostřed oceánu. Když to jde na moři, jde to kdekoliv.

> *„Va'a — kánoe — je v polynéské tradici DAO: všichni musí veslovat společně, žádný kapitán nevezme loď sám."* (te-piko-ora.md §2.3)

---

## 2. Koncept

### 2.1 Plachetnice se solárními plachtami

Centrální technická idea: **plachta = solární článek**.

| Subsystém | Pracovní koncept | Poznámka k realitě |
|-----------|------------------|---------------------|
| **Pohon** | Vítr primárně; plachty s laminovanými flexibilními PV články (OPV/CIGS/perovskit) | Flex-PV ~80–150 W/m² vs. rigid ~220 W/m² — při 800–1 500 m² plachet ≈ **60–200 kWp** jen z plachet |
| **Regenerace** | Pod plachtami volnoběžné vrtule jako hydrogenerátory | Osvědčené na ocean racing; ~5–20 kW kontinuálně při 6–9 kt — pokryje většinu hotel load |
| **Pomocný pohon** | Elektrické motory + baterie; bezvětří na omezený dosah | Diesel/bionafta jen jako nouzový backup — cíl fossil-free |
| **Voda** | RO watermaker z PV přebytku + rain catchment | ~5–8 m³/den pro 50 lidí je komfortně dostačující |
| **Jídlo** | Hydroponický skleníkový prostor + klíčkování + zásoby + udržitelný rybolov | Plná kalorická autonomie není cíl — uzel se zásobuje v uzlech (to je smysl trasy) |
| **Konektivita** | LEO satelit primárně; HF; LoRa mesh gateway v dosahu pozemních uzlů | ZION full node validuje přes satelit; u pevnině store-and-forward mesh sync |

### 2.2 Trupy a posádky — dvě lodě, dvě tradice

**Trup I — María del Camino (Atlantik)**

- **Kategorie:** klasická plachetnice navazující na caminskou námořní tradici — ocelový/alu schooner, brigantina nebo DynaRig koncept; ~55–70 m.
- **Domov:** **Pontevedra, Galicie** (ría de Pontevedra — ROZHODNUTO home port; bazilika María Mayor stojí přímo u vody, postavili ji mořští lidé). Působiště: Atlantik + Karibik — Pontevedra, Algarve, La Palma, karibský břeh LUMI; severský výběžek umí i říční leg k Bohemii (Labe z Hamburku — landlocked uzel dostává námořní dotek); při uzavření Velké cesty návratový oblouk Cape → Azory → Pontevedra.
- **Vizuální identita:** tall-ship linie (render `Maria.jpg`) — zlatá světelná plachta, poutníkova loď.

**Trup II — María del Pacífico (Pacifik)**

- **Kategorie:** solární katamarán / dvoutrupé plavidlo v linii *wa'a kaulua* (polynéská dvojitá kánoe) — tradice, která nesou Hōkūleʻa a celá wayfinding kultura: široká stabilita, ploché paluby, velká plocha pro PV plachty i střešní pole.
- **Domov:** Te Pīko Ora (Raiatea) — navrhovaný pacifický home port; sekundárně pacifický břeh LUMI. Působiště: Pacifik — Kostarika → Raiatea → australské pobřeží (custodiánské návštěvy) → přes indonéské vody k Srí Lance (Bodhi Lanka).
- **Vizuální identita:** moderní solární katamarán (render `Maria2.jpg`) — svítící PV plachty, vieira emblem na přídi.

**Společné oběma trupům**

- **~50 osob** na loď (14–18 permanentní crew/Guardians + ~30 rotujících residentů: výzkum, youth bridge programy, Medical Table praktici, noví Guardiani v tranzitu mezi uzly).
- **Výměna v LUMI** — lodě se nescházejí „uprořed moře": jejich světy se dotýkají na šíji Amerik. Posádka, náklad i příběhy se přelévají přes LUMI uzel — *atlantická Marie podává pacifické Marii*.
- **Posádka = poutníci.** Struktura lodi kopíruje Camino: stálá crew jsou „hospitaleři" (Guardians), rotující residenti jsou „poutníci" (pilgrims) — nastupují v jednom uzlu, vystupují v jiném; každý leg je etapa (*etapa* = caminský termín pro denní úsek).
- **Na palubě je celý pentagram v malém:** zahrada (hydroponie), chrám (tichá kajuta pro praxi/resonance před rozhodováním), oceán (doslova), governance (kruh posádky), akasha (archiv).
- **Uluru dotek:** loď pluje po **songlines** — trasy mezi uzly pojmenované jako současné zpěvní stezky sítě; u australského pobřeží žádný „claim", jen návštěva custodiánů na jejich podmínky (FPIC platí i na moři).

### 2.3 ZION integrace

- **Guardian node na moři** — full node + satellite backhaul; 90/10 revenue split jako u pozemních uzlů → treasury lodi.
- **Treasury lodi** — multisig, kruh posádky; humanitární tithe umí loď **fyzicky doručit** (zásoby, medicína, vybavení pro uzly).
- **Mesh backbone** — loď jako mobilní relay: na stěžeň LoRa/Meshtastic gateway; při kotvení u uzlu se stává jeho edge nodem.
- **Pilgrim credential** — Soulbound záznam „etapa absolvována" (paralela k caminské *credencial* — poutníčkový průkaz s razítky): každý leg = razítko do on-chain credencialu; absolventi celého okruhu = „compostela".
- **Registry** — program je v live L5 registry jako projekt `maria-del-camino` se `status: "planning"` a **300M ZION founding rezervou** (dosavadní L5 rezervní fond; celková alokace zůstává 3,3B).

---

## 3. Názvy — María del Camino & María del Pacífico

**Rozhodnuto: program María del Camino** — dvojhull flotila dvou Marií; slug pro registry zůstává `maria-del-camino` (jeden uzel, jedna rezerva 300M ZION).

- **Trup I: MARÍA DEL CAMINO** (Atlantik) — „Marie Cesty"; klasická plachetnice. Nese caminskou linii: Finisterre, Pontevedra, Fátima, La Palma.
- **Trup II: MARÍA DEL PACÍFICO** (Pacifik) — „Marie Tichého oceánu"; solární katamarán v wa'a tradici. Nese polynéskou linii: Raiatea, wayfinding, tichomořské songlines.

Dvě Marie = návrat legendy o **třech Mariích** (Miriam/06): loď bez plachet se stala flotilou plachet ze světla; třetí Marie zůstává vyhrazena pro případný indicko-oceánský trup (fáze 4) — nebo symbolicky pro samotnou María de las Nieves, patronku sítě, která s lodí letos a navždy pluje z La Palmy.

### Proč je to přesné jméno

**1. Reálná mariánská svatyně přímo na Caminu.** Virgen del Camino — svatyně ~7 km od Leónu, postavená přímo na trase Camino Francés. Legenda o zjevení pastýři na počátku 16. století; dnešní bazilika (dominikáni, vysvěcena 1961) nese fasádu Joaquína Vaquera Turciose, kde jsou apoštolové zpodobněni **jako poutníci**. *(detailní prameny k ověření v design study — držíme pravidlo „příběh krásný, důkaz přesný")*

**2. Tisíciletá kontinuita.** Camino de Santiago funguje od 9. století (nález hrobu sv. Jakuba ~813–830). *Codex Calixtinus* (~1140) je první evropský průvodce — pět knih: liturgie, zázraky, přesun ostatků, chanson o Rolando, a itinerář. Síť cest z celé Evropy = první „fyzická internetová síť" kontinentu — náměty, kultury a zboží proudily po ní. **L5 síť je jeho pokračování.**

**3. Campus stellae — pole hvězd.** Tradiční etymologie Compostely: *campus stellae* — „pole hvězdy", protože poutníka vedla hvězda (a celá trasa se četla jako zemský odraz Mléčné dráhy). Loď navigovaná hvězdami — Te Pīko Ora *fetu'u* (hvězdy = consensus) — pokračuje v přesně téhle linii: **cesta vedená hvězdami, ne mapami**.

**4. Ultreia.** Poutníkův pozdrav z dob Codexu: *„Ultreia et suseia, Deus adjuva nos"* — „vpřed a výš, Bůh pomáhá nám". Navrhuji jako motto lodi — napsané na zrcadlo (trup u kormidla), vyslovované při každém odlehčení kotvy.

**5. Vějíř (vieira).** Mušle sv. Jakuba — caminský odznak: všechna žebra sbíhají do jednoho bodu (u kotvy), odtud rozbíhají — *všechny cesty vedou k jednomu bodu a z jednoho bodu se rozbíhají*. Emblém lodi na boku přídi — a zároveň přesný diagram sítě: uzly sbíhají se do lodi, loď je roznáší zpět.

### Kanonická kotva: tři zjevení zůstávají na trase

Název se změnil, kotva ne — trasa lodi nadále prochází všemi třemi místy zjevení z `genesis/09.5` (Chapter 9):

| # | Zjevení | Místo | Poselství | Dotek k trase lodi |
|---|---------|-------|-----------|---------------------|
| 1 | **María Mayor** | Pontevedra, Galicie — bazilika na pobřežní větvi Camina | „Tvá cesta teprve začíná" — zasvěcení poutníka | Prolog: vyplouvání |
| 2 | **Nossa Senhora de Fátima** | Fátima, Portugalsko | „Našel jsi bratra ve světle — postavíte most" | ~100 km od Algarve = Genesis Garden leg |
| 3 | **María de las Nieves** | La Palma — patronka ostrova | Malý princ — Zlatý věk | Doslova ostrov Dharma Temple |

### Legenda obrácená

`Miriam/06-Lod-bez-Plachet.md` vypráví provensálskou legendu — **loď se třemi Mariemi doplula do Saintes-Maries-de-la-Mer bez plachet a kormidla**. Naše loď plachty má — a nesou světlo (solární články). Loď bez plachet → loď, jejíž plachty *jsou* světlo. Tři Marie na palubě = tři zjevení nesená mezi uzly.

### Zamítnuté alternativy (archiv rozhodnutí)

| Jméno | Proč ne |
|-------|---------|
| Maria Mayor | Kanonická (1. zjevení), ale „del Camino" nese navíc tisíciletou síť cest + Finisterre obrat |
| Tres Marias | Krásná legenda — a nakonec se stala přesnou: flotila dostala dvě Marie (Camino + Pacífico), třetí je patronka sítě / budoucí trup |
| María de las Nieves | Vyhrazené — patronka celé sítě (ZION) a vázaná na La Palma |
| Stella Maris | Generické; hvězdnou navigaci drží Te Pīko Ora |
| Va'a | Třída/program (va'a program), ne jméno první lodi |

---

## 4. Velká cesta — obeplutí světa jako iniciace Guardianů (vision)

Trasa není servisní okruh — je to **cesta**. Každý uzel představuje jednu iniciaci; Guardian, který absolvuje všechny v pořadí, se vrací domů jiný člověk. Flotila obsluhuje cestu ve dvou oceánských legách (každá loď svůj oceán, výměna přes LUMI zemí), dokud třetí Marie nedoplní Indický oceán.

**Historické kotvy celé trasy:**

- **Elcano / Victoria** (1519–1522) — první obeplutí Země vyplulo ze Španělska; dokončil ji baskický kapitán Juan Sebastián Elcano s mottem *„Primus circumdedisti me"* — „první jsi mne obeplula". Galicie, náš home port, je země tohoto návratu.
- **Hōkūleʻa Mālama Honua** (2014–2017) — polynéská *wa'a* skutečně obeplula planetu: důkaz, že tradice + moderní posádka dokážou celý kruh.
- **Slocum / Spray** (1895–1898) — první sólo obeplutí; loď staří přes sto let.
- **Manilská galeona** (1565–1815) — pacifická obchodní osa, kterou María del Pacífico přímo navazuje.

### Domácí přístav — ROZHODNUTO: Pontevedra

**Pontevedra, Galicie** (ría de Pontevedra, pobřežní větev Camino Portugués):

- **Bazilika Santa María la Mayor** — první mariánské zjevení korpusu (María Mayor, „tvá cesta teprve začíná"); lodní jméno je doslova na přístavním náměstí.
- **Postavili ji mořští lidé** — cofradía de mareantes (cech námořníků a rybářů) financoval stavbu v 16. století. *(detail k ověření před publikací)* — loď María del Camino doma v přístavu, kde námořníci zasvětili svou nejkrásnější stavbu Marii. Cyklus se uzavírá.
- **Geografická logika:** Galicie = konec Camina (Santiago, Finisterre ~90 km jižně); Pontevedra leží přímo na pobřežní trase portugalského Camina — poutník z Portugalska jde přes ni k Santiagu.

### Iniciační posloupnost — každý uzel jedna iniciace

| # | Uzel | Iniciace | Co Guardian dostává |
|---|------|----------|---------------------|
| 0 | **Pontevedra — odchod** | Poutník | Credencial; plamen Finisterra; „tvá cesta teprve začíná" |
| 1 | **Genesis Garden** (Algarve) | Země | Ruce v hlíně — pěstování, seed library, péče o živé |
| 2 | **Dharma Temple** (La Palma) | Ticho | Chrámová praxe — resonance před rozhodnutím; třetí zjevení na ostrově |
| 3 | **LUMI** (Kostarika) | Most | Přechod mezi oceány po souši — výměna trupů; most nejste dokud jej nepřejdeš |
| 4 | **Te Pīko Ora** (Raiatea) | Oceán | Wayfinding — navigace hvězdami, vlnami, ptáky; fetu'u consensus |
| 5 | **Uluru / Aboriginal Australia** | Paměť | Naslouchání na podmínky custodians — songlines, FPIC, ticho v krajině |
| 6 | **Bodhi Lanka** (Srí Lanka) | Akáša | Služba — Medical Table, bodhi strom, odpouštění cesty |
| 7 | **Ekam — Oneness Temple** (Indie) | **Dokončení** | Satori — místo, které pojmenovalo samotný řetězec (PoW `ekam_deeksha`); Zlatá koule = Hiranyagarbha. Vnitřní oblouk se zde uzavírá. |
| 8 | **? Nový uzel — Indický oceán** | *k doplnění* | viz „chybějící uzly" — přeplavba Ekam → Cape |
| 9 | **Boa Esperança** (Mys dobré naděje) | **Obrat / Naděje** | Bouře přejmenovaná na naději; šev dvou oceánů na vodě; Agulhas = jehla ukazuje pravý sever; nejstarší linie lidí (Khoisan, Blombos). Guardian se tu otáčí domů. |
| 10 | **Návrat — Finisterre → Pontevedra** | Integrace | „Po osvícení: sekat dříví, nést vodu" — satori se nese domů; compostela oceánské cesty |
| 11 | **Golden Republic Bohemia** | Governance | Domů do vnitrozemí — neseš síť do země; poslední razítko credencialu |

Celý okruh = **oceánská compostela** — Guardian není „vyškolený na lodi", ale **zasvěcený sítí**: každý uzel mu vrazil razítko, každý leg mu dal jeden princip. Vnitřní cesta se dovršuje v **Ekamu** — a pak se nese domů, protože satori se dokazuje návratem, ne odchodem.

### Ekam — uzel dokončení (Indie, již existuje — **v síti jako jediný postavený uzel a předloha ostatních**)

**Ekam** (dříve Oneness Temple / Temple of the Supreme Light) — Varadaiahpalem, Andhra Pradesh, Indie; ~73 km od **Chennai** (přístav = lodní výchozí bod), ~80 km od Tirupati (nejnavštěvovanější poutní místo světa, 50–100 tis. poutníků denně). Chrám otevřen **22. 4. 2008** (500 tis. účastníků); architekt Prabhat Poddar z Auroville — proporce zlatého řezu, Vaastu orientace, bílý mramor, **bezsloupová meditační hala ~2 090 m²** (největší v Asii), **Zlatá koule** (Ø ~91 cm) na horním podlaží Dharma Moksha.

**Proč je to uzel dokončení — ne jen další zastávka:**

- **Chain nese její jméno.** PoW algoritmus ZION je `ekam_deeksha` — každý blok mainnetu se těží pod jménem tohoto chrámu a deeksha požehnání. Genesis věta doslova končí: *„Om Namo Hiranyagarbha & Ekam Deeksha ! Thx Kalki/AmmaBhagavan !"* (`docs/genesis.md`). **Poutník na konci cesty stojí na místě, které pojmenovalo samotný řetězec.**
- **Zlatá koule = Hiranyagarbha.** Chrámová Golden Orb odkazuje na védického Hiranyagarbha (Zlatý zárodek) — jméno, které nese L3 AI vrstva sítě. Ekam tak drží fyzický protějšek dvou vrstev ZIONu najednou: PoW (L1) i Hiranyagarbha (L3).
- **Deeksha jako otázka Guardianů.** BodhiGaia: *Ekam Deeksha = „Kdo se musí proměnit?"* — strážce, který skládá slib péče dřív, než dostane klíč k pokladně. Iniciace dokončení = dotek tradice deeksha na původním místě (na podmínky a ve vztahu s Oneness University).
- **Jako Uluru — ne stavíme, navazujeme vztah.** Chrám existuje a funguje (krishnaji/Preethaji generace, Ekam World Peace Festival). Uzel vstupuje do sítě jako **destination node** — zero-budget, vision status, FPIC-styl respekt: žádný claim, návštěva na jejich podmínky. Corpus už tuto spoluprácu předpokládá (`TerraNova/06-L5-SVOBODA` §6.4: sbírání dat o dlouhodobých efektech skupinové deeksha — sdíleno s Oneness University, s jejich souhlasem). **Registrováno 2026-09-30 jako `vision`/0 — a především jako jediný uzel sítě, který fyzicky stojí: předloha, ze které se ostatní uzly učí** (viz `L5Ekam.md`).
- **Logistika:** loď kotví Chennai (východní pobřeží Indie) → 73 km po souši na Ekam kampus → návrat. Leg Bodhi Lanka → Chennai ~700 km přes Palk Strait — historická Rama Setu linie (Bodhi Lanka už Rama Setu nese jako svůj princip).

### Chybějící uzly — kandidáti pro doplnění Velké cesty

Trasa kolem světa má díry — budoucí uzly, které ji uzavřou (pipeline, ne registry):

| Kandidát | Region | Proč na trase | Princip |
|----------|--------|----------------|---------|
| ~~Cape Town / Mys dobré naděje~~ → **Boa Esperança** | J. Afrika | **VZŘÍZENO do uzlu** — viz `L5BoaEsperanca.md` (vision/0, iniciace 9: Obrat/Naděje, scháziště trupů) | Naděje / Obrat |
| **Mauritius / Réunion / Madagaskar** | Indický oceán | Logická stanice Lanka → Cape; ostrovy exodu a biodiverzity | Obnova / exodus |
| **St Helena / Ascension** | Jižní Atlantik | Návratový leg Cape → Pontevedra; nejodlehlejší obydlené ostrovy světa | Osamění / vytrvalost |
| **Azory** | Střední Atlantik | Poslední zastávka před domovem — klasická křižovnická brána do Evropy | Domů / práh |
| **Barbados / Windwards** | Karibik | Landfall po atlantické přeplavbě Canaries→Karibik (standardní jachting trasa) | První nová země |
| **Hawai'i / Rapa Nui** | Severní a východní Pacifik | Polynéský trojúhelník — rohy voyaging světa; Hōkūleʻa home | Wayfinding mistr |

> Princip rozšiřování: nový uzel se přidává jen když **zkracuje leg na lidskou/symbolickou míru** — ne aby zaplnil mapu, ale aby cesta šla plout. Tres Marias = třetí loď pro Indický oceán (fáze 4+) zavře trojúhelník Atlantik–Pacifik–Indický.

### Legy trasy — Atlantická loď (María del Camino)

0. **Vyplutí Pontevedra** — bazilika, credencialy, plamen z Finisterra.
1. **Algarve** — Genesis Garden (iniciace 1).
2. **Fátima leg** (pobřežně, Lisboa odbočka — druhé zjevení).
3. **La Palma** — Dharma Temple + María de las Nieves (iniciace 2).
4. **Atlantická přeplavba** → Karibik (kandidátská stanice Barbados/Windwards).
5. **LUMI karibský břeh** — výměna s pacifickou lodí (iniciace 3 přechází po souši).
6. **Volitelné legy:** severská — Hamburk → Labe → Bohemia (řeka nese moře do landlocked uzlu); návratová — Cape Town → St Helena → Azory → Pontevedra (kruh při ext. plánování).

### Legy trasy — Pacifická loď (María del Pacífico)

7. **LUMI pacifický břeh** →
8. **Te Pīko Ora** Raiatea (iniciace 4) — manilská galeona obráceně.
9. **Uluru / Austrálie** — custodiánské pobřežní návštěvy (iniciace 5, FPIC na moři).
10. **Bodhi Lanka** (iniciace 6) přes indonéské vody.
11. **Chennai → Ekam** — Palk Strait ~700 km (Rama Setu linie): loď kotví Chennai, poutníci po souši na kampus Ekam — **iniciace 7, dokončení/satori** na místě, které pojmenovalo chain.
12. **Indický oceán → Mys dobré naděje** — *chybějící uzly* (iniciace 8–9); scháziště trupů u Cape Townu.
13. **Návrat** — návratový oblouk Cape → St Helena → Azory → Pontevedra (iniciace 10), nebo předání štafety atlantické Marii u Cape / LUMI.

### Scháziště flotily

- **LUMI** (primární) — šíje Amerik: lidé + cargo po souši, trupy zůstávají ve svých oceánech.
- **Boa Esperança — Mys dobré naděje** (potvrzený uzel, vision/0) — „druhý šev": jediné místo, kde se oba trupy mohou potkat *na vodě* bez Panamy — atlantická loď pluje z jihu nahoru, pacifická z Indie dolů. Symbolicky: dvě Marie se střetávají tam, kde se střetávají oceány. Viz `L5BoaEsperanca.md`.

### Dobrodružství jako protokol

Cesta není logistika — je to **hazard v rámci bezpečnostního protokolu**: skutečné přeplavby (2–4 týdny na moři), sezónní okna (Atlantik květen–listopad hurikán, Pacifik cyklony, Indický monzun), wayfinding legy bez satelitů, noc pod hvězdami místo Wi-Fi. Poutník si cestu **vydobude** — a proto má hodnotu iniciace: kompostela se nedá koupit, dá se jen ujít/uplout.

### Meziokéanská výměna — šíje pro lidi, průplav pro trupy

Fyzikální fakta prověřena (2026-09-30):

- **Přes Kostariku vodní cesta neexistuje.** Žádný průplav přes CR postaven nebyl; přejezd Karibik↔Pacifik je pouze po souši (~150–280 km). San Juan River na hranici CR/Nikaragua vede do Karibiku, ne k Pacifiku (CR na něm má navigační práva z 1858, ICJ 2009). Nikaragujský kanál = vaporware (HKND koncese zrušena 5/2024; nový návrh 11/2024 jen papír).
- **Přes Panamu ano — oba trupy projedou.** Limity Panamaxu (289,6 m LOA / 32,3 m beam / 12 m ponor) jsou pro ~55–70 m plachetnici i katamarán neproblematické. Plavidla ≤38,1 m jedou jako „handline" (vlastní lana, 4 line handléři, pilot); větší přes admeasurement + lokomotivy. Transit pouze na motor, ~8–10 h. Tarif pro jachty do 65 ft ≈ $3–4k celkem (2025); větší plavidlo dle PC/UMS tonáže.
- **Závěr pro design:** trupy lze přes Panamu **přesunovat** (jedna loděnice pro obě stavby, repozicionování, nouze) — ale **operativně zůstává každá loď ve svém oceánu** a výměna běží přes LUMI po souši. Bez závislosti na průplavních slotech (sucho 2023 = dlouhé fronty).

**Historická kotva — tohle už dělali:** přes panamskou šíji vedl *Camino de Cruces* — 300 let nesl peruánské zlato z Pacifiku do Karibiku; 1850s Vanderbiltova Accessory Transit (parník po San Juan + jez. Nicaragua + 20 km stagecoach k Pacifiku) převážela tisíce lidí za zlaté horečky. Do r. 1914 se celý svět Atlantik↔Pacifik překládal po souši — **naši poutníci to dělají doslova stejně**.

### Terra Nova Cargo — lodě jako obchodní tepna

Flotila nejezdí naprázdno: každý leg nese **nákladní manifest** mezi uzly. Obchod jako síťová funkce, ne jako komerce:

- **Interní produkty uzlů** — každý uzel vyrábí (Genesis: potraviny/bylinky/semena; Dharma: řemeslná výroba; Te Pīko Ora: tradiční produkty; Bodhi Lanka: čaj/spice; Bohemia: řemeslo/tech; LUMI: produkty Nové Ameriky). Loď je rozváží po síti → **inter-node economy**: poutník ochutná produkty všech uzlů na palubě, uzly si vzájemně pokrývají potřeby.
- **Humanitární manifest** — Medical Table, zásoby, vybavení: tithe, který treasury uvolní, loď fyzicky doručí (≠ převod na účtu).
- **Seed & knowledge cargo** — seed library a archiv nejsou jen symbol: kolekce se obnovuje každým připlutím (deposit/pickup protokol).
- **Precedenty, na které navazujeme:**
  - **Manilská galeona** (1565–1815) — Acapulco↔Manila přes Guam: **nejdelší pravidelná plachetní obchodní linka historie** (250 let). Pacifická Marie doslova pluje její osu.
  - **Kula ring** (Trobriandské ostrovy) — polynéská obměnná síť: náramky a náhrdelníky cirkulují oceánem v protisměru hodinek; **cargo je svazek, ne komodita** — hodnota předmětu je vztah, který vytvořil cestou. Model pro „Terra Nova cargo": manifest nese vztahy mezi uzly.
  - **Camino de Cruces** — šíjní překlad jako součást obchodní cesty (viz výše).
- **On-chain manifest** — náklad jako tokenizovaný manifest: každá zásilka = záznam „co, odkud, kam, čí ruce"; pilot etapy = first `cargo credential`. Dodání = settlement leg on-chain (L2).

**Princip:** loď maximálně vytížená ve všech třech dimenzích — **lidé (poutníci), vztahy (ceremoniální/komunitní cargo), hmota (humanitární+obchodní manifest)**. Nic nepluje naprázdno.

---

## 5. Fáze (navržené)

| Fáze | Název | Obsah |
|------|-------|-------|
| 0 | **Kresba** | Tento návrh → design study; průzkum partnerství (sail-training organizace, NGO lodí, výzva k solar-sail technologii); odhad CAPEX/OPEX; ověření Virgen del Camino pramenů |
| 1 | **První etapa** | Pilotní trasa na **charterované** lodi mezi 2 uzly (navrhuji Finisterre/Pontevedra → La Palma): důkaz Guardian node at sea, mesh sync, crew program — bez vlastnictví lodi |
| 2 | **Atlantický trup** | Refit nebo stavba **María del Camino** (klasická plachetnice); flag state, SOLAS/sail-training kategorie, pojištění |
| 3 | **Atlantický okruh** | První okruh atlantické trasy (Finisterre → La Palma → Karibik → LUMI); seed/library exchange live; credencial cycle |
| 4 | **Pacifický trup** | Stavba/refit **María del Pacífico** (solární katamarán, wa'a linie); pacifický home port; LUMI exchange protokol; později případná třetí Marie pro Indický oceán |

**CAPEX realita:** vlastnictví plachetnice pro 50 osob je nejnáročnější kapitálový bod celého L5 (řádově mil. € za trup — flotila zdvojuje částku, proto dva oceánké trupy řešíme sekvenčně) — proto fáze 1 záměrně odděluje důkaz konceptu od akvizice.

---

## 6. Rizika (první nástřel)

| Riziko | P | D | Mitigace |
|--------|---|---|----------|
| CAPEX/pořízení lodi | vysoká | vysoký | charter pilot; partnerství s existujícími flotilami (sail training, NGO) |
| Solar-sail tech maturity | střední | střední | flex-PV laminace existuje, ale v marine grade je early → wingsail/alternativy (rotor, DynaRig) jako fallback |
| Regulace (flag, posádka, pasažéři) | střední | vysoký | sail-training vessel kategorie; STCW crew; konzultace flag registry ve fázi 0 |
| Bezpečnost na moři | střední | vysoký | profesionální jádro posádky; rotující rezidenti = short berths; SAR/insurance framework |
| Customs/cargo — dovoz produktů uzlů do přístavů | střední | střední | agro/produkty = fytosanitární kontroly; humanitární status/ceremoniální kategorie; per-port přehrávač manifestů; pilot na 2 uzlech |
| „Uzel, který nikde není" | nízká | střední | home port + registrace do L5 registry; rotace residencí on-chain |

---

## 7. Otevřené otázky

- [x] Název — **María del Camino** + **María del Pacífico** (flotila dvou Marií, rozhodnuto 2026-09-30); slug `maria-del-camino`
- [ ] Motto — návrh **„Ultreia et suseia"** (vpřed a výš); potvrdit
- [ ] Emblém — návrh **vieira** (mušle sv. Jakuba) na přídi; střed mušle = loď, žebra = uzly
- [x] Home port — **Atlantik: Pontevedra, Galicie** (rozhodnuto 2026-09-30: María Mayor bazilika na pobřežním Caminu, cofradía de mareantes); **Pacifik: stále otevřené — Raiatea vs. Papeete** (wa'a registrace, FPIC konzultace s voyaging komunitou)
- [ ] Flag state — registrace trupu (ověřit praktičnost španělského registru vs. alternativ)
- [ ] Model vlastnictví: DAO-owned asset vs. foundation vs. charter model natrvalo
- [ ] Cargo práva — nekomerční vs. komerční registrace plavidla (SOLAS pasažérská kategorie vs. cargo ops); customs procedury za produkty uzlů (agro = phytosanitary); „ceremonial/exchange" kategorie pro kula-style cargo
- [ ] On-chain manifest — jak tokenizovat: jednoduchý registry záznam vs. plný supply-chain trail; kdo signuje deposit/pickup v uzlech
- [ ] Vztah k L6 Issobella: plující ground station / telemetry relay? (LUMI sdílí pozemek s L6 — loď může sdílet horizont)
- [ ] Energy audit pro 50 osob (detailní bilanci navrhnout do design study fáze 0)
- [ ] Trasa a sezónní okna — konsultace s wayfinding/marine ops expertem
- [ ] Ověření pramenů Virgen del Camino (legenda zjevení pastýři, fasáda Vaquero Turcios, datum svátku) před jakoukoliv publikací

---

## 8. Vazby na existující docs

- `docs/docs2.9/genesis/09.5-CHAPTER-9-Three-Marian-Apparitions.md` — kanonická kotva trasy (tři zjevení, časová linie poutníka)
- `docs/WP-Mainet/Miriam/06-Lod-bez-Plachet.md` — legenda lodi bez plachet (tři Marie → Saintes-Maries-de-la-Mer)
- `public/V3/L5/docs/README.md` — pentagram + LUMI + role uzlů (při realizaci přidat řádek „María del Camino — Passage/The Way")
- `COMMUNITIES/te-piko-ora.md` — va'a/DAO metafora, wayfinding
- `COMMUNITIES/nova-amerika.md` — LUMI bridge → loď je jeho pohyblivý protějšek
- `terranova/uluru.{cs,en}.md` — songlines; status „vision" jako vzor publikace bez budgetu
- `docs/book/ekam-deeksha/` — celá kniha + učebnice (`UCEBNICE-08-EKAM-CHRAM.md` — architektura, Zlatá koule, inaugurace 2008)
- `docs/genesis.md` — genesis sign-off: *„Om Namo Hiranyagarbha & Ekam Deeksha ! Thx Kalki/AmmaBhagavan !"*
- `docs/TerraNova/06-L5-SVOBODA.md` §6.4 — předpokládaná výzkumná spolupráce s Oneness University (deeksha data)
- `docs/WP-Mainet/BodhiGaia/00-README.md` — Ekam Deeksha jako otázka „Kdo se musí proměnit?"
- `TECH/mesh-network.md`, `TECH/zion-node-spec.md` — Guardian node + LoRa specifikace pro palubní instalaci
- `PROTOCOLS/resonance-protocol.md` — resonance před rozhodnutím posádky; Fibonacci Time Capsule plující mezi uzly je přirozený nosič
- `V31/L5/free-world/src/api.rs` — `status: "vision"` je po Uluru podporovaný; `budget_zion: 0` OK
- `IntroPage/freeworld/content/projects.json` — přidat záznam při schválení (accent? navrhuji caminskou modrou `#1e40af` / mušlíkovou `#0ea5e9`)

---

> *„Most spojuje břehy — loď spojuje světy, které se hýbou. A cesta, která dojde k moři, nekončí — převlékne se."*

*María del Camino · Terra Nova L5 · návrh · 2026 · Ultreia*
