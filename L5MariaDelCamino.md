# L5 · María del Camino — plující uzel Terra Nova

> **NÁVRH K DISKUSI** — interní pracovní dokument, ne veřejný text.
> Po schválení konceptu se z něj stane `public/V3/L5/docs/COMMUNITIES/maria-del-camino.md` + public docs pair `terranova/maria-del-camino.{cs,en}.md` + záznam v `freeworld/content/projects.json`.
>
> *"Pentagram má pět bodů. Šestý je most. Sedmý je paměť. Osmý je cesta, která je všechny spojuje."*
>
> *"Ultreia et suseia — vpřed a výš." — pozdrav poutníků z Codex Calixtinus*
>
> **Název:** **María del Camino** — „Marie Cesty" (rozhodnuto operátorem 2026-09-30; viz §3)
> **Status:** 🟣 Vision — návrh
> **Poslední úprava:** 2026-09-30

---

## 1. Identita a záměr

Každý uzel Terra Nova nese do sítě jeden princip: Genesis nese zahradu, Dharma chrám, Te Pīko Ora oceán, Bohemia governance, Bodhi Lanka akášu, LUMI most mezi světů, Uluru paměť.

**María del Camino nese cestu samotnou** — sedm pevných bodů se stává sítí teprve tehdy, když mezi nimi něco žije. Loď je osmý bod, který není bod, ale **linie**: pohyblivý uzel, který fyzicky spojuje všechny ostatní.

### Kde končí starý svět

Tisíc let chodili poutníci po Caminu do Santiaga — a kdo chtěl jít skutečně do kraje, pokračoval na **Finisterre** (*finis terrae* — konec země), kde cesta končila u moře a nebylo kam jít dál. Tam poutníci pálili šaty a dívali se na horizont.

**María del Camino je přesně ten krok navíc**: cesta, která nekončí u moře, ale na něm pokračuje. Tam, kde skončil starý svět, začíná nový — a loď ho nese.

Tři kotvy:

- **Cirkulace** — seed library, kulturní archiv, lidé a granty proudí mezi uzly přes moře, ne přes kurýrní služby. L5 protokoly (seed exchange, knowledge commons, resonanční kalendář) dostávají doslova námořní dopravu.
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

### 2.2 Trup a posádka

- **Kategorie:** velká cestovní plachetnice — ocelový/alu schooner, brigantina nebo DynaRig koncept; ~55–70 m, **~50 osob** (14–18 permanentní crew/Guardians + ~30 rotujících residentů: výzkum, youth bridge programy, Medical Table praktici, noví Guardiani v tranzitu mezi uzly).
- **Posádka = poutníci.** Struktura lodi kopíruje Camino: stálá crew jsou „hospitaleři" (Guardians), rotující residenti jsou „poutníci" (pilgrims) — nastupují v jednom uzlu, vystupují v jiném; každý leg je etapa (*etapa* = caminský termín pro denní úsek).
- **Na palubě je celý pentagram v malém:** zahrada (hydroponie), chrám (tichá kajuta pro praxi/resonance před rozhodováním), oceán (doslova), governance (kruh posádky), akasha (archiv).
- **Uluru dotek:** loď pluje po **songlines** — trasy mezi uzly pojmenované jako současné zpěvní stezky sítě; u australského pobřeží žádný „claim", jen návštěva custodiánů na jejich podmínky (FPIC platí i na moři).

### 2.3 ZION integrace

- **Guardian node na moři** — full node + satellite backhaul; 90/10 revenue split jako u pozemních uzlů → treasury lodi.
- **Treasury lodi** — multisig, kruh posádky; humanitární tithe umí loď **fyzicky doručit** (zásoby, medicína, vybavení pro uzly).
- **Mesh backbone** — loď jako mobilní relay: na stěžeň LoRa/Meshtastic gateway; při kotvení u uzlu se stává jeho edge nodem.
- **Pilgrim credential** — Soulbound záznam „etapa absolvována" (paralela k caminské *credencial* — poutníčkový průkaz s razítky): každý leg = razítko do on-chain credencialu; absolventi celého okruhu = „compostela".
- **Registry** — loď je v L5 registry jako projekt se `status: "vision"` (stejná cesta jako Uluru; `budget_zion: 0` dokud není funding scope).

---

## 3. Název — María del Camino

**Rozhodnuto: MARÍA DEL CAMINO** — „Marie Cesty". Slug pro registry: `maria-del-camino`.

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
| Tres Marias | Krásná legenda, ale zní jako flotila, ne jedna loď |
| María de las Nieves | Vyhrazené — patronka celé sítě (ZION) a vázaná na La Palma |
| Stella Maris | Generické; hvězdnou navigaci drží Te Pīko Ora |
| Va'a | Třída/program (va'a program), ne jméno první lodi |

---

## 4. Trasa — Camino pokračuje za horizont (vision)

Okruh spojuje všech 7 uzlů v jednom plavbě ~12–18 měsíců; pořadí je orientační (podle sezón a oken).

### Prolog — Finisterre → moře (místa zjevení + konec starého světa)

0. **Santiago de Compostela / Finisterre** — ceremoniální počátek: posádka dojede/dojde na konec Camina jako každý poutník tisíc let — a odtud *nepřestane*: loď čeká v rías. „Etapa 0" = cesta, kterou starý svět považoval za konec.
1. **Pontevedra** — María Mayor, první zjevení: lodní „zasvěcení" posádky (výjezd na cestu, ne do cíle).
2. **Fátima leg** — Portugalsko: druhé zjevení — „postavíte most".
3. **La Palma** — María de las Nieves + **Dharma Temple**: třetí zjevení je zároveň první skutečný uzel trasy — patronka lodi i sítě.

### Hlavní okruh

4. **Genesis Garden** — Algarve, Portugalsko (případně prolog fáze 1 sloučit sem).
5. **LUMI — Nová Amerika** — Costa Rica (Karibik → Panama → Pacifik).
6. **Te Pīko Ora** — Raiatea/Tahiti, Francouzská Polynésie — wayfinding legacy: loď se učí navigaci, která předcházela mapám (hvězdy, vlny, ptáci).
7. **Uluru / Aboriginal Australia** — pobřežní návštěva custodiánských komunit, bez claimu; poselství pokračuje do vnitrozemí.
8. **Bodhi Lanka** — Srí Lanka (Indický oceán).
9. **Návrat** — Suez/Good Hope → Středomoří → Algarve → Finisterre: uzavření kruhu tam, kde starý svět končil.

> Landlocked Bohemia se k trase připojuje říčním/land legem nebo jako „home port" — samostatné téma. Symbolika: loď nese z Finisterra kámen/sůl/vodu do každého uzlu — „hlínu z konce světa".

---

## 5. Fáze (navržené)

| Fáze | Název | Obsah |
|------|-------|-------|
| 0 | **Kresba** | Tento návrh → design study; průzkum partnerství (sail-training organizace, NGO lodí, výzva k solar-sail technologii); odhad CAPEX/OPEX; ověření Virgen del Camino pramenů |
| 1 | **První etapa** | Pilotní trasa na **charterované** lodi mezi 2 uzly (navrhuji Finisterre/Pontevedra → La Palma): důkaz Guardian node at sea, mesh sync, crew program — bez vlastnictví lodi |
| 2 | **Trup** | Refit nebo stavba dedikované lodi; flag state, SOLAS/sail-training kategorie, pojištění |
| 3 | **Velký kruh** | První okruh všemi uzly; seed/library exchange live; compostela credential cycle |
| 4 | **Flotila** | Replikace: uvažovaný model „jedna loď na oceán" (Atlantik/Pacifik/Indický) — *tres Marias* se vrací jako jméno flotily |

**CAPEX realita:** vlastnictví plachetnice pro 50 osob je nejnáročnější kapitálový bod celého L5 (řádově mil. €) — proto fáze 1 záměrně odděluje důkaz konceptu od akvizice.

---

## 6. Rizika (první nástřel)

| Riziko | P | D | Mitigace |
|--------|---|---|----------|
| CAPEX/pořízení lodi | vysoká | vysoký | charter pilot; partnerství s existujícími flotilami (sail training, NGO) |
| Solar-sail tech maturity | střední | střední | flex-PV laminace existuje, ale v marine grade je early → wingsail/alternativy (rotor, DynaRig) jako fallback |
| Regulace (flag, posádka, pasažéři) | střední | vysoký | sail-training vessel kategorie; STCW crew; konzultace flag registry ve fázi 0 |
| Bezpečnost na moři | střední | vysoký | profesionální jádro posádky; rotující rezidenti = short berths; SAR/insurance framework |
| „Uzel, který nikde není" | nízká | střední | home port + registrace do L5 registry; rotace residencí on-chain |

---

## 7. Otevřené otázky

- [x] Název — **María del Camino** (rozhodnuto 2026-09-30); slug `maria-del-camino`
- [ ] Motto — návrh **„Ultreia et suseia"** (vpřed a výš); potvrdit
- [ ] Emblém — návrh **vieira** (mušle sv. Jakuba) na přídi; střed mušle = loď, žebra = uzly
- [ ] Home port a flag state (Pontevedra/Galicie by bylo poetické — na trase i na Caminu; ověřit registry praktičnost)
- [ ] Model vlastnictví: DAO-owned asset vs. foundation vs. charter model natrvalo
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
- `TECH/mesh-network.md`, `TECH/zion-node-spec.md` — Guardian node + LoRa specifikace pro palubní instalaci
- `PROTOCOLS/resonance-protocol.md` — resonance před rozhodnutím posádky; Fibonacci Time Capsule plující mezi uzly je přirozený nosič
- `V31/L5/free-world/src/api.rs` — `status: "vision"` je po Uluru podporovaný; `budget_zion: 0` OK
- `IntroPage/freeworld/content/projects.json` — přidat záznam při schválení (accent? navrhuji caminskou modrou `#1e40af` / mušlíkovou `#0ea5e9`)

---

> *„Most spojuje břehy — loď spojuje světy, které se hýbou. A cesta, která dojde k moři, nekončí — převlékne se."*

*María del Camino · Terra Nova L5 · návrh · 2026 · Ultreia*
