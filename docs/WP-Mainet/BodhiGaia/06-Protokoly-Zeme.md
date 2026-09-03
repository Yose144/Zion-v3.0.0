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

Původní trinity tří stromů se rozšířila na pentagram pěti uzlů — přibylo Srdce (Bohemia) a Akáša (Lanka). Každý přináší vlastní protokol nad sdílený kód:

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
