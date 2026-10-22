# Pozemní stanice Kostarika — L6 Issobella Ground Segment

> *„Stanice, která nemá kde přistát v myslích lidí, poletí naprázdno."*

Tento dokument popisuje **pozemní segment vrstvy L6** — výzkumný kampus a budoucí pozemní stanici (ground station) v **Kostarice**, na pozemku sdíleném s L5 uzlem **LUMI (Nová Amerika)** (`docs/TerraNova/Projects/NOVA-AMERIKA-KOSTARIKA.md`).

> **Stav: HORIZONT.** Žádný pozemek, anténa ani laboratoř neexistuje. Dokument je plánovací rámec, ne záznam stavby.

---

## 1. Proč pozemní segment jako první

Orbitální stanice Issobella má tři segmenty: vesmírný (HORIZONT 2040+), uživatelský (STAVBA — DeSci, výzkumný balík) a **pozemní**. Pozemní segment je jediný, který lze stavět **bez rakety**:

- TT&C (Telemetry, Tracking & Command) antény pro LEO družice a CubeSaty
- Datové centrum a obsluha downlinku
- Výzkumná laboratoř (energetika, materiály, ECLSS prototypy)
- Observatoř (optika + rádio, SETI pipeline)
- DeSci centrum — rezidence, open-science publikace, vzdělávání

---

## 2. Proč Kostarika

| Faktor | Hodnota | Dopad na L6 |
|--------|---------|-------------|
| **Zeměpisná šířka** | ~9–10° s. š. | Blízkost rovníku → více přeletů pro nízkoinklinované/ekvatoriální dráhy; výhodné pro tracking a případné starty |
| **Geografie** | Pevninský most Sever↔Jih Amerika; Pacifik + Karibik | Zeměpisný středobod Amerik; dvě oceánské fronty pro pozorování |
| **Energie** | ~98 % obnovitelná síť | Čistý provoz laboratoří i antén |
| **Stabilita** | Bez armády od 1948, stabilní demokracie | Dlouhodobě bezpečný provoz fondu |
| **Pozemky** | Levná rurální půda mimo indiánská teritoria | Proveditelná akvizice |
| **Vesmírný ekosystém** | Agencia Espacial Costarricense (2021); CubeSat Irazú (2018); Ad Astra Rocket Company (Liberia, Guanacaste) — VASIMR plazmový motor | Reálný kosmický průmysl v zemi — partnerství a know-how |

### 2.1 Kandidátní regiony

| Region | Pro | Proti |
|--------|-----|-------|
| **Guanacaste** (Liberia a okolí) | Ad Astra Rocket Company v dosahu; sušší klima (menší korozní tlak); letiště Liberia | Dál od indiánských teritorií; turistický tlak |
| **Talamanca** (Karibik) | Sousedství Bribri/Cabécar teritorií → FPIC partnerství pro sdílený L5 pozemek | Vlhké, vzdálené, složitější logistika |
| **Boruca / jih Pacifiku** | Boruca teritorium, oceán, klid | Infrastruktura slabší |

> Rozhodnutí o lokalitě patří Fázi 0 — site survey + FPIC dialog se sousedními teritorii.

---

## 3. Technický rozsah

### 3.1 TT&C / pozemní stanice

- **Pásma:** VHF/UHF (CubeSat start), S-band (TT&C), později X-band (downlink dat)
- **Startovní bod:** SatNOGS-kompatibilní ground station — amatérská síť, okamžitě užitečná pro cizí CubeSaty i budoucí ZION Space Node
- **Kontaktní okna:** při ~9,7° s. š. kvalitní pokrytí pro rovníkové a nízkoinklinované LEO; pro 51,6° inklinaci (ISS-typ) omezené, ale použitelné
- **Redundance:** Starlink/fiber backhaul + LoRa mesh k L5 uzlu

### 3.2 Laboratoř

- Plazmová a malá pohonná energetika (inspirace VASIMR / Ad Astra v Guanacaste)
- Materiály a korozní testování v tropickém prostředí (CR je ideální „živá" testbed)
- ECLSS prototypy na menším měřítku; solární a bateriové systémy

### 3.3 Observatoř

- Optický teleskop (tropická obloha, suchá sezóna Guanacaste)
- Rádiová anténní pole → SETI/klidové data pipeline napojená na ZION DeSci
- Meteorologická stanice jako provozní nutnost (blesky, vlhkost)

### 3.4 Sdílená infrastruktura s L5 LUMI (Nová Amerika)

| Systém | L5 podíl | L6 podíl |
|--------|----------|----------|
| Pozemek | Komunita, farma, ranchos | Kampus, antény, laboratoř |
| Energie | 10→25 kWp PV | + dedikovaný string pro anténní pole |
| Voda | Dešťová cisterna 50→150 m³ | Sdílená |
| Komunikace | LoRa mesh | LoRa + S/X-band |
| Lidé | Komunita + hosté z teritorií | Výzkumníci, rezidence, studenti |

---

## 4. Fáze

| Fáze | Období | Stav | Obsah |
|------|--------|------|-------|
| 0 — Site & Consent | 2027–2028 | 🔵 | Site survey, SUTEL/regulační rešerše, FPIC se sousedními teritorii, společná akvizice pozemku s L5 |
| 1 — Field station | 2028–2029 | 🔵 | SatNOGS VHF/UHF anténa, meteostanice, první laboratoř (energie/materiály), vzdělávací program |
| 2 — Research campus | 2029–2031 | 🔵 | S-band TT&C, observatoř, rezidenční program DeSci, partnerství s CR univerzitami a ACE |
| 3 — Ground segment | 2031+ | 🔵 | Plné TT&C pro ZION Space Node / CubeSaty, X-band downlink, provozní centrum pro budoucí stanici |

---

## 5. Governance a vazba na fond

- **Fond:** L6 Issobella — 5 % block subsidy (`zion1z4s3a5...`) + premine slot 6 (2,5 mld ZION, `zion1f5h5k6t8...`, time-lock 144 000)
- **Správkyně fondu:** Aelan Vaast — řídí L6 do 18. narozenin Sarah Hubalkové, poté spolupráce (viz `docs/private/`)
- **Spend:** pouze přes DAO vote + 3-of-3 admin multisig — kampus je projekt fondu, ne držitel klíčů
- **FPIC:** i L6 část pozemku se řídí Most protokolem L5 — žádná stavba bez souhlasu kruhu starších sousedních teritorií

---

## 6. Rizika

- Regulace: SUTEL frekvenční povolení, stavební povolení anténních polí
- Klima: tropická koroza, blesky, hurikánová sezóna (Karibik strana)
- Partnerství: závislost na FPIC a MOU — bez nich projekt nestaví
- Odlehlost: logistika materiálu, zdravotní péče
- Personální kontinuita: fond → DAO → správkyně → lokální tým

---

## 7. Otevřené otázky pro další iteraci

- [ ] Jeden pozemek vs. dvě sousední parcely (L5/L6 právní oddělení)
- [ ] Vztah s Ad Astra / ACE — MoU, stáže, společné experimenty?
- [ ] SatNOGS affiliate status a první anténní konfigurace
- [ ] Optická vs. rádiová observatoř — prioritizace podle lokality
- [ ] Společný "Earth–Sky" vzdělávací program s Novou Amerikou

---

## Zdroje a související

- [`README.md`](README.md) — index L6data
- [`Architektura.md`](Architektura.md) — vesmírný segment stanice
- [`../docs/WP-Mainet/Issobella/11-Pozemni-Uzel-Kostarika.md`](../docs/WP-Mainet/Issobella/11-Pozemni-Uzel-Kostarika.md) — narativní kapitola Knihy Nebe
- [`../docs/TerraNova/Projects/NOVA-AMERIKA-KOSTARIKA.md`](../docs/TerraNova/Projects/NOVA-AMERIKA-KOSTARIKA.md) — sdílený L5 pozemek

> *„Izotropní krása potřebuje konkrétní bod, ze kterého se dívá."*
