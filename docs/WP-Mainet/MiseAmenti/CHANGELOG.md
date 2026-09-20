# Mise Amenti — Changelog

Tento changelog je součástí kanonu. Zachovává důvod změny, ne jen seznam souborů. Pokud změna opravuje veřejné nebo technicky významné tvrzení, musí odkazovat na příslušnou evidence položku v [`07-Registr-Dukazu.md`](./07-Registr-Dukazu.md).

---

## 2026-08-31 — Kanonizace 3.3 „Nirvana“

### Přidáno

- `README.md` a `README_EN.md` jako kanonický vstupní bod pro Mise Amenti.
- `01-Kanon-a-Ustava.md` — hierarchie pravdy, pět stavů tvrzení a závazek svobody/ověřitelnosti.
- `02-Pribeh-a-Architektura.md` — společná mapa čtyř knih, onboardingu, Sůl Země, Nirvany a NirvanaCloud.
- `03-Zivy-Zaklad-3.3.md` — L1–L6 baseline rozdělený na ŽIVÉ / STAVBA / HORIZONT / HYPOTÉZA.
- `04-Exekucni-Charta-3.3.md` — workstreamy M0–M8 a release gates R1–R9.
- `05-Autonomie-a-Bezpecnost.md` — lidský mandát, capability model, hard prohibitions a agentní incident response.
- `06-Generacni-Kompas-2026-2126.md` — mezigenerační kompas, krizová mapa a scénářové epochy.
- `07-Registr-Dukazu.md` — důkazní registry pro L1–L6 a reconciliation předchozích 3.3 nároků.
- `08-Protokol-Zmen.md` — klasifikace změn, review, veřejný filtr a předání dalším maintainerům.

### Kanonické rozhodnutí

- `MiseAmenti/` je **primární integrační canon** pro plánování a komunikaci ZION 3.3 „Nirvana“.
- `V33_NIRVANA_MASTER_PLAN.md` zůstává technickým execution companionem; živý kód, síť, `StatusV3.md` a `V31/STATUS.md` nadále mají vyšší prioritu.
- Příběhové materiály `docs/WP-Mainet/nirvana/` a `docs/WP-Mainet/NirvanaCloud/` zůstávají kanonickým narativním zdrojem, ale jejich faktické nároky se interpretují podle evidence registru.

### Opravené vymezení nároků

- Passkeys/WebAuthn, full multichain, production solver federation, Hiran v2.5 autonomy, UE5.7/WebGPU/Pixel Streaming, globální L5 portal a quantum/warp engine jsou vedeny jako **STAVBA, HORIZONT nebo HYPOTÉZA**, nikoli jako live feature.
- 1% coinbase slot je popsán podmíněně: **burn před node-reward activation, node reward po aktivaci**, podle aktuální konfigurace a on-chain evidence.
- „Global Assimilation“ je definována pouze jako **dobrovolná interoperabilita a spolupráce**, nikdy jako donucování nebo kulturní nadřazenost.
- „Consciousness“ u AI je výhradně narativní/etická metafora; canon netvrdí prokazatelné subjektivní vědomí softwaru.

### Kanonická integrace s existujícími dokumenty

- `V33_NIRVANA_MASTER_PLAN.md` — upraveno na technický execution companion; přidána čtecí smlouva, statusové štítky L2–L6 a odkaz na `MiseAmenti/07-Registr-Dukazu.md`.
- `ROADMAP.md` — přidán odkaz na `MiseAmenti/` a upřesněn rozdíl mezi live baseline 3.2 a vývojovým horizontem 3.3.
- `docs/WP-Mainet/nirvana/00-README.md` a `00-README_EN.md` — označeny jako MÝTUS-HORIZONT a propojeny s `MiseAmenti/` a `StatusV3.md`.
- `docs/WP-Mainet/NirvanaCloud/00-README.md` a `00-README_EN.md` — převedeny na narativní společník s hierarchií důkazů vedenou `MiseAmenti/`.
- `docs/WP-Mainet/NirvanaCloud/08-Kotva-Pravdy-Eticke-Hranice.md` — doplněn odkaz na `MiseAmenti/07-Registr-Dukazu.md` jako kotva technické pravdy.
- Vytvořen `docs/3.1/REPORTS/README.md` jako index historických reportů; opraven jeden rozbitý odkaz v `REPORT_2026-08-22_G7_CHAOS_LOAD_TESTS.md`.
- Cílený link check kanonických dokumentů a `git diff --check` proběhly bez nálezů.

---

## 2026-09-02 — Bodhi Gaia: Kniha Země (L5) — DRAFT navržený ke kanonizaci

### Změněno

- Přidána nová narativně-technická řada [`docs/WP-Mainet/BodhiGaia/`](../BodhiGaia/00-README.md) (CZ, 9 kapitol + EN index): Zahrada Genesis, Dharma Temple / Nová Bodhi Gaia, Te Pīko Ora, Protokoly Země, zrcadlo L4 ↔ L5, onboarding do L5 a úplný L5 registr pravdy. Řada sjednocuje existující materiál z `public/V3/L5/docs/`, webu `/terranova/*` a `/l5-free-world`, OASIS (`WorldPanel`, `worlds.ts`), Sůl země (Sítá, Hanuman), TerraNova (kap. 3, 6, Hawaii) a Zohar (Yesod ↔ L5).
- `docs/WP-Mainet/README.md` — řada přidána do sekce „Koncepty a horizont (nekanonické)".
- `docs/WP-Mainet/nirvana/00-README.md`, `00-README_EN.md`, `10-Prameny-Zivota.md` — odkaz „sestup k hlíně" na Knihu Země.
- `07-Registr-Dukazu.md` — sekce 5 rozšířena o L5 řádky (komunity, Guardian Node, OASIS zrcadlo, dopad) s odkazem na detailní registr v `BodhiGaia/09`.
- `02-Pribeh-a-Architektura.md` — přidána devátá brána „Bodhi Gaia / Kniha Země" do mapy bran.

### Důkaz

- L1: `V31/L1/core/src/{emission,v3_template,v3_compat}.rs` (5 % → `zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8`).
- L5 služba: `V31/L5/free-world/` (`config.rs` má kanonický default, `db.rs` tabulky `grants/projects/communities/fund_balance`), `zion-v31-free-world.service`, `StatusV3.md` 2026-08-23, `docs/3.2/L5_L6_ACTIVATION_PLAN.md` (G10).
- Komunity: `public/V3/L5/docs/COMMUNITIES/{genesis-garden,dharma-temple,te-piko-ora}.md`; web `APP&WEB/website-v2.9/src/app/terranova/**`, `public/docs/terranova/dharma-temple.{cs,en}.md`; OASIS `APP&WEB/OasisWeb/src/components/WorldPanel.tsx`, `src/domain/config/worlds.ts`.

### Dopad na stav tvrzení

- Nové L5 nároky zavedeny se stavem: protokol/fond/tracker **ŽIVÉ**; Zahrada Genesis **STAVBA**; Dharma Temple **STAVBA (dokumentace) / HORIZONT (fyzicky)**; Te Pīko Ora **HORIZONT**; sdílené protokoly (Guardian Node, mesh, Medical Table, Seed Library síť) **HORIZONT**; Resonance Protocol **MÝTUS / HORIZONT**; „fond vyplácí granty" a „komunity provozují Guardian node" **NEPLATNÝ NÁROK (dnes)**; ekonomické modely komunit **HYPOTÉZA**; příběh a symbolika **MÝTUS**.
- Nalezené rozpory k opravě (registr v `BodhiGaia/09` §4): TerraNova kap. 6 uvádí 10 % místo 5 % + 5 %; `/l5-free-world` lokalita Genesis „Střední Evropa" vs Algarve; OASIS svět Dharma Temple `layer: 3` místo L5; Te Pīko Ora Tahiti vs Raiatea; komunitní dokumenty datované 2026-05-21 bez evidence sekce; Nirvana ep. 10 statická čísla; inventář `L5_L6_ACTIVATION_PLAN.md` §4.2/§5 neodpovídá již opravenému kódu.

### Review

- Autor: Devin (AI) na základě čtení kódu, dokumentace, webu a OASIS klienta. **Řada je DRAFT** — vyžaduje technické review (L1/L5 fakta), bezpečnostní review (fond/DAO/API), factual editor a kulturní konzultaci (polynéské a buddhistické prvky) podle `08-Protokol-Zmen.md` §2 (třída E + C) před kanonizací nebo jakýmkoli veřejným výňatkem.

---

## 2026-09-14 — Lumi: Cesta domů (sjednocující kniha L1–L6) — DRAFT navržený ke kanonizaci

### Změněno

- Přidána nová narativně-technická řada [`docs/WP-Mainet/Lumi/`](../Lumi/00-README.md) (CZ, README + 13 kapitol): sjednocuje `nirvana/` (L1–L6 horizont), `BodhiGaia/` (L5) a `Issobella/` (L6) do jednoho příběhu navazujícího na kanonický onboarding (`ZION_ONBOARDING_PUBLIC_CZ.md`, `ZION_ONBOARDING_3.2_ONE_LOVE_CZ.md` §6). Osou je postava Lumi / Elizabeth — dítě na přídi (`nirvana/01`), rybářova dcera (`Issobella/01`) a kněžka s lucernou u brány OASIS — čtená jako jedna postava napříč časem. Kapitoly: archa (L1), Dům jmen (ZIS), mosty (L2), hlas bez klíče (L3), brána (L4), dvě kapitoly L5, tři kapitoly L6, 3.3 + šest epoch 2026–2126, návrat k bráně (onboarding), registr.
- Zavedeno zařízení „lucerna ukazuje dnešek": kapitoly 05–10 se odehrávají ve „zjevené budoucnosti" (HORIZONT / MÝTUS, nikdy termín ani slib) a každá kapitola 02–12 obsahuje odstavec se skutečným stavem sítě ke snímku 2026-09-14 plus kotvu pravdy se štítky.
- `docs/WP-Mainet/README.md` — řada přidána do sekce „Koncepty a horizont (nekanonické)".
- `docs/WP-Mainet/nirvana/00-README.md`, `00-README_EN.md` — odkaz „celá cesta jako jeden příběh" a řádek ve zdrojích pravdy.
- `02-Pribeh-a-Architektura.md` — přidána desátá brána „Lumi / Cesta domů" do mapy bran („devět bran" → „deset bran").

### Důkaz

- Technické nároky převzaty beze změny stavu z `07-Registr-Dukazu.md`, `BodhiGaia/09`, `Issobella/10`; zdroje: `V31/L1/core/src/{emission,v3_template,v3_compat,difficulty}.rs`, `V31/L1/cosmic-harmony`, `APP&WEB/identity`, `APP&WEB/zion-wallet-sdk`, `L2contracts.md`, `warp.example.toml`, `V31/L3/ai-native` + `docs/3.0.6/HIRAN_OVERVIEW.md`, `V31/L4/oasis/data/avatars.json` (avatar id 40 „Elizabet"), `APP&WEB/OasisWeb` (`BabylonIntro.tsx`, `worlds.ts` `ELIZABET`), `V31/L5/free-world`, `V31/L6/issobella`, `L6data/`, `docs/3.2/L5_L6_ACTIVATION_PLAN.md` (G10), `docs/3.2/ROADMAP.md` (G8/G9), `docs/genesis.md`, `StatusV3.md`, `AGENTS.md` (2026-08-22, 2026-09-07, 2026-09-14); přímý probe `getStatus` na Edge 2026-09-14 (výška 43 500+, 7 aktivních peerů).
- Jazykový fakt Isabel = Elizabeth: veřejná etymologie; v repozitáři `docs/docs2.9/genesis/09.5-CHAPTER-9-Three-Marian-Apparitions.md`.

### Dopad na stav tvrzení

- Žádný technický nárok se nepovyšuje. Nové nároky knihy: ztotožnění Lumi = rybářova dcera = kněžka s lucernou = avatar 40 / svět ELIZABET → **MÝTUS** (kanonické rozhodnutí příběhu, ne tvrzení o datech ani o skutečných osobách); Isabel = Elizabeth → **ŽIVÉ (jazykový fakt)**; obrazy zjevené budoucnosti → **HORIZONT / MÝTUS**; historický původ názvu „Issobella" zůstává **NEDOLOŽENO** (kniha ho netvrdí).
- Nalezené rozpory k opravě (registr v `Lumi/13` §3, #1–#10): `nirvana/01` statické číslo bloků; `nirvana/04` Passkeys/WebAuthn jako současnost a statická čísla poolu; `nirvana/11` „fond a služba plně aktivní", NCL „připravený pro DeSci", nadsazená formulace o `cosmic-harmony`; `nirvana/12` „všech 6 vrstev synchronizováno", „bez privilegovaného klíče"; `Issobella/06` „devadesát procent"; `Issobella/10` otevřená etymologie (vyřešeno na úrovni mýtu); `worlds.ts` `ELIZABET` `layer: 3`; `nirvana/00-README` popis ep. 9 bez štítku HORIZONT; `NirvanaCloud/00-README` „stovky uzlů". Původní soubory nebyly měněny.

### Review

- Autor: Devin (AI) na základě čtení kódu, dokumentace, OASIS dat a live probe. **Řada je DRAFT** — vyžaduje factual review (L1–L6 proti registrům), bezpečnostní review pasáží o custody, fondech a DAO (kap. 02, 03, 06, 10 — třída C), kulturní konzultaci (třída E: původ a význam jména; převzaté hinduistické, buddhistické, polynéské a české motivy) a public-copy review před jakýmkoli výňatkem do `public/` nebo na web, podle `08-Protokol-Zmen.md` §2. Anglický index vznikne až po českém review (`08` §5.7).

---

## 2026-09-19 — Miriam: Kniha Růže (Kniha Linie — osa času) — DRAFT navržený ke kanonizaci

### Změněno

- Přidána nová narativní řada [`docs/WP-Mainet/Miriam/`](../Miriam/00-README.md) (CZ, README + 13 kapitol): kniha vodoravné osy korpusu — paměť, linie a svědectví skrze dvacet století — jako protějšek svislé osy `Lumi/` (světlo skrze vrstvy). Rámcový příběh: stará Miriam v jeskyni nad mořem vypráví dívce Sáře (Sara e Kali) tři oblouky — **U jezera** (01–04: Magdala, alabastrová nádobka, zahradník u hrobu, Evangelium podle Marie), **Podzemní řeka** (05–09: Řehořovo slití 591 / opravy 1969 a 2016, provensálská legenda o lodi a Sáře, desposyni s mozoly před Domitianem, grálové romance a podvrh Prieuré de Sion, žena oděná sluncem Zj 12) a **Město, které sestupuje** (10–13: svatba Beránkova, město jako nevěsta, řeka a strom života, setkání s Lumi na břehu, registr pravdy).
- Zaveden mechanismus „kámen / hlína / sen" — každá kapitola rozděluje příběh na doložený text (listina), živou tradici (legenda) a literární sen — s tabulkou Kotva pravdy a štítky ŽIVÉ / NEDOLOŽENO / NEPLATNÝ NÁROK / MÝTUS ve stejném významu jako `07-Registr-Dukazu.md`.
- `docs/WP-Mainet/README.md` — řada přidána do sekce „Koncepty a horizont (nekanonické)".
- `07-Registr-Dukazu.md` §6 — přidáno pravidlo 6: příběh Miriam se čte podle vlastních štítků; narativní „fakta" z ní nesmí vstupovat do provozních dokumentů.

### Důkaz

- Historické kořeny knihy: evangelia (Mk 15–16; Lk 7–8, 24; Jan 12, 19–20; Mt 1, 26–28) · Evangelium podle Marie (Berlínský kodex 8502 + P.Oxy. 3525 + P.Ryl. 463) · Evangelium Filipovo (NHC II) · Pistis Sofia · Hippolytos (~235, „apostola apostolorum") · Eusebios III.19–20 (Hegesippos o desposyni) · Řehoř Veliký Homilie 33 (591) · liturgická reforma 1969 / dekret 10. 6. 2016 · *Legenda aurea* (~1260) a provensálská/romská tradice · grálové romance (Chrétien ~1180, Wolfram, Robert de Boron) · Dossiers secrets / Prieuré de Sion (prokázaný podvod, přiznání 1993) · Zjevení 12, 19, 21–22.
- Repo kotvy: `docs/genesis.md` (jméno Meriam v genesis zprávě), `V31/L4/oasis/data/avatars.json` (avatar 18 Meriam Rose), `docs/docs2.9/ZION_OASIS/SACRED_TRINITY/18_MERIAM_ROSE.md`, `docs/TerraNova/public/Full.md` (příloha C — Zjevení jako blueprints), `V31/L1/core/src/emission.rs` (TOTAL_SUPPLY 144 mld, split 89/5/5/1), `WarpBeta/ARCHITECTURE.md` (HTLC preimage), kontinuita `SulZeme/`, `nirvana/`, `BodhiGaia/`, `Issobella/`, `Lumi/`.

### Dopad na stav tvrzení

- Žádný technický nárok se nepovyšuje; kniha nepřidává provozní nároky.
- Nové nároky knihy se štítky: doložené listiny → **ŽIVÉ (doložený text)**; pomazání = Miriam, manželství, krevní linie, „koinónos" = manželka → **NEDOLOŽENO**; Miriam jako „hříšnice", Prieuré de Sion / merovejská linie, Zjevení jako předpověď ZIONU → **NEPLATNÝ NÁROK**; provensálská legenda, relikvie, černé madony, čtení ženy Zj 12 → **Hlína/MÝTUS**; rámcový příběh a setkání s Lumi → **MÝTUS (autorské)**; 144 miliard jako ozvěna Zj čísla → **ŽIVÉ (designová volba, ne nárok)**.

### Review

- Autor: Devin (AI) na základě čtení korpusu, pramenů a webové rešerše. **Řada je DRAFT** — vyžaduje factual review historických pasáží (třída E — kulturní/veřejná komunikace; křesťanské, gnostické, židovské a romské prvky vyžadují kulturního konzultanta), českou jazykovou korekturu, link check (proveden — všechny relativní odkazy resolvují) a public-copy review před jakýmkoli výňatkem, podle `08-Protokol-Zmen.md` §2. Pasáže o fondu/emisi jsou pouze kotvící odkazy, žádný nárok na prostředky — třída C se neuplatňuje, pokud se neobjeví nároky na custody/governance.

---

## 2026-09-19 — Příběh Růže: Co nelze vlastnit — DRAFT navržený ke kanonizaci

### Změněno

- Přidána nová samostatná literární bajka [`docs/WP-Mainet/Ruze/`](../Ruze/00-README.md) (CZ, README + 9 souvislých kapitol + kotvící kapitola 10): malá kniha o Lumi a růži u řeky za otevřenou bránou. V kompasu korpusu zaujímá **průsečík — vztah**: roste mezi vodorovnou osou Miriam (paměť/čas) a svislou osou Lumi (světlo/vrstvy); **není dvanáctou branou** ani technologickou vrstvou. Oblouk: prázdná nádoba od Sáry, jméno bez titulu, trn jako hranice, zahradník zrcadel, kupec s vůní, zahrada mnoha růží, vzájemná péče za sucha, svoboda odejít, návrat na oba břehy.
- Literární klíč: *Malý princ* je přiznanou vzdálenou inspirací pouze formou (filosofická bajka, dítě a růže); žádná postava, scéna ani věta není převzata. Etika knihy: péče bez vlastnění, souhlas, svoboda, vzájemnost — vztah bez svobody je klec (`SulZeme/11`).
- `docs/WP-Mainet/README.md` — řada přidána do sekce „Koncepty a horizont (nekanonické)" za Miriam.
- `Miriam/13-Kotva-Pravdy-a-Hranice.md` — do poslední navigace přidán odkaz na Příběh Růže; jinak beze změny.
- `02-Pribeh-a-Architektura.md` — za tabulku bran přidán odstavec „Příběh Růže není dvanáctá brána" (počet bran beze změny).
- `07-Registr-Dukazu.md` §6 — přidáno pravidlo 7: `Ruze/` je celý literární MÝTUS a nepovyšuje starší Meriam Rose / esoterické nároky.

### Důkaz

- Repo kotvy: `docs/WP-Mainet/Miriam/13` (předání prázdné nádoby Sáře), `Miriam/12` (setkání u řeky, semínko růže), `Lumi/12` (otevřená brána, lucerna), `SulZeme/11` (růžová zahrada, „vztah bez svobody je klec"), `V31/L4/oasis/data/avatars.json` (avatar id 18 „Meriam Rose", Jerusalem Garden, „True devotion sees beyond form").
- Existence těchto řádků je repozitářový fakt, ne historická/duchovní pravda — roztříděno v `Ruze/10-Kotva-Pribehu.md`.

### Dopad na stav tvrzení

- Žádný nový technický nárok; kniha nepřidává provozní ani finanční claimy.
- Celý děj, postavy i dialogy → **MÝTUS**. Doložená kontinuita → pouze existence řádků/textů (**ŽIVÉ** jako repozitářový fakt).
- Starší `docs/docs2.9/ZION_OASIS/SACRED_TRINITY/18_MERIAM_ROSE.md` **není validován**: jeho nároky (twin flame, tajný svazek, grál-lůno, tajné kódy, škola, council, fondy) zůstávají MÝTUS/NEDOLOŽENO/HORIZONT/NEPLATNÝ NÁROK; konkrétní štítek závisí na konkrétním tvrzení a nový příběh žádné z nich nevaliduje.

### Review

- Autor: Devin (AI) na základě čtení korpusu a pramenů. **Řada je DRAFT** — vyžaduje českou literární a jazykovou korekturu a public-copy review podle `08-Protokol-Zmen.md` §2 (třída E; žádné custody/finance/governance nároky — třída C se neuplatňuje). Link check a `git diff --check` provedeny při vytvoření.

---

## 2026-09-20 — Růže v Zahradě Genesis — MÝTUS / HORIZONT

### Změněno

- `docs/WP-Mainet/Ruze/` — přidán epilog [`Epilog-Zahrada-Genesis.md`](../Ruze/Epilog-Zahrada-Genesis.md) mezi kapitolu 9 a kotvu 10: Lumi s alabastrovou nádobou dorazí do skromné Zahrady Genesis u Atlantiku a s Anou zasadí druhé semínko na okraj záhonu; `00-README` (tabulka + řád E), navigace v `09`, registry a review v `10-Kotva-Pribehu.md`.
- `docs/WP-Mainet/BodhiGaia/` — nová [kapitola 12](../BodhiGaia/12-Ruze-v-Zahrade-Genesis.md) (Ana, následující ráno, odmítnutí „posvátné růže", zápis do pracovního sešitu) + návrh fyzického pilotu [`pilots/GENESIS-ROSE-001.md`](../BodhiGaia/pilots/GENESIS-ROSE-001.md): gaty A–D (souhlas a místo, botanika a bezpečnost, péče, finance a tvrzení), záznamová pole, evidence Day 0, prahy D30/D90/D365, stavové přechody; integrace v `00-README` (dvanáct kapitol + mapa zdrojů), `03` (most + kotva), `07` (OASIS zrcadlo + kotva), `09` (registry + krok 13), `11` a `full.md`.
- `APP&WEB/OasisWeb/src/domain/config/worlds.ts` — metadata světa `GENESIS_GARDEN` nesou výslovně označenou Rose lore (MYTH): změněny pouze `vibe`, `summary`, `tags`; žádný deploy.
- `docs/WP-Mainet/README.md` (položka Příběh Růže + epilog), `MiseAmenti/02` (věta: OASIS zrcadlí MÝTUS, pilot HORIZONT, žádná nová brána), `MiseAmenti/07` (nový řádek L5 evidence + rozšířené pravidlo 7).

### Důkaz

- `Ruze/Epilog-Zahrada-Genesis.md` + `Ruze/10-Kotva-Pribehu.md` §2/§6; `BodhiGaia/12`, `BodhiGaia/03` (most + kotva), `BodhiGaia/07` (OASIS metadata), `BodhiGaia/09` (registry + krok 13); `BodhiGaia/pilots/GENESIS-ROSE-001.md`; `APP&WEB/OasisWeb/src/domain/config/worlds.ts` (`GENESIS_GARDEN`).

### Dopad na stav tvrzení

- Narativní lore (epilog, scéna Lumi + Ana, OASIS copy) = **MÝTUS** — žádná událost, žádný fyzický čin.
- Existence zdrojového řádku `GENESIS_GARDEN` = **ŽIVÉ** (repozitářový fakt); nová klientská metadata = **STAVBA** do deploy (build prošel, deploy neproběhl); jejich obsah = **MÝTUS**.
- Fyzická růže zasazená v Algarve = **NEDOLOŽENO** — žádné zasazení se nestalo.
- Pilot `GENESIS-ROSE-001` = **HORIZONT / NEZAHÁJENO** — nesmí začít bez Gate A–D, nenahrazuje M5 exit gate.
- Žádný deploy, žádný L5/DAO spend, žádný token/NFT/reward, žádné finance, žádné „posvátné" ani genealogické nároky; Zahrada Genesis zůstává **STAVBA**.

### Review

- Autor: Devin (AI). **DRAFT** — vyžaduje českou literární/jazykovou korekturu, public-copy review (třída E), review OASIS kopie (lore musí zůstat MÝTUS) a před jakýmkoli fyzickým krokem botanickou/lokální kontrolu a souhlas místa podle Gate A–D pilotního rámce.

---

## Formát budoucích položek

```markdown
## YYYY-MM-DD — stručný název

### Změněno
- Co se změnilo.

### Důkaz
- Odkazy na code/test/live evidence.

### Dopad na stav tvrzení
- ŽIVÉ → STAVBA, STAVBA → ŽIVÉ atd.

### Review
- Kdo a jaký typ review provedl.
```

---

*[Zpět na index Mise Amenti → `README.md`](./README.md)*
