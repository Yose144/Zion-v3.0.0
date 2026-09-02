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
| Architektura Dharma Temple: Merkaba, 7 kopulí, Strom života. | **HORIZONT** (koncept) | `public/docs/terranova/dharma-temple.{cs,en}.md`; `DharmaTemplePreviewLazy`; `/images/dharma-temple/concept-og.png`. | Statika, povolení, rozpočet stavby. |
| Te Pīko Ora je plánovaný pacifický uzel. | **HORIZONT** | `te-piko-ora.md` (🔵 Vision / Preparation; Fáze 0 2026–2027); web `/terranova/te-piko-ora` (*Plánováno 2027+*). | Polynéský partner, ostrov, entita, tým, rozpočet 80 000 EUR. |
| Komunity provozují Guardian node. | **NEPLATNÝ NÁROK** (dnes) | Všechny tři dokumenty: instalace Fáze 2 (2027 / 2028 / 2028). | Hardware, konektivita, pokladna. |
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
| Sítá, Hanuman, Sádhu, Ana, Hina, tesař, rybář. | **MÝTUS** | Archetypy (Sůl země) a postavy vytvořené pro tuto knihu. Nikdo netvrdí historickou ani duchovní autoritu. |
| Bodhi Gaia = „probuzená Země". | **MÝTUS** | Obraz z návrhu Dharma Temple, rozšířený na L5. Není nábožensky závazný. |
| Merkaba, 7 čaker, piko, tatau, wayfinding. | **MÝTUS / kulturní fakt** | Kulturní tradice jsou citovány s úctou; použití pro L5 vyžaduje kulturní review (třída E), zejména polynéské prvky — souhlas místních komunit. |
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

**Síť L5:** DAO UI/UX pro L5 návrhy (J4/J6); výplatní tx flow a guardian multisig; API key middleware; veřejný portál (N5); zdroj pravdy pro statusy komunit; první impact packet; Sybil-resistance pro quadratic voting; kulturní review polynéských a buddhistických prvků.

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
| 10 | Kanonizace této řady po review (technika + bezpečnost + fakta + kultura). | `MiseAmenti/08` | 🔄 DRAFT |

---

## 7. Návrh změny podle `MiseAmenti/08` §3

```markdown
## Záměr
Sjednotit vizi a dokumentaci vrstvy L5 (Zahrada Genesis, Dharma Temple / Nová Bodhi Gaia,
Te Pīko Ora) do jedné narativně-technické řady navazující na Onboarding, Sůl země a Nirvanu,
s úplnou kotvou pravdy pro každý nárok.

## Stav tvrzení
Protokol/fond/služba: ŽIVÉ. Komunity: STAVBA (Genesis) / HORIZONT (Dharma Temple, Te Pīko Ora).
Sdílené protokoly: HORIZONT. Příběh a symbolika: MÝTUS.

## Důkaz
V31/L1/core (emission, v3_template, v3_compat); V31/L5/free-world; V31/deploy;
public/V3/L5/docs/**; APP&WEB/website-v2.9/src/app/terranova/**, l5-free-world;
APP&WEB/OasisWeb (WorldPanel, worlds.ts); docs/3.2/L5_L6_ACTIVATION_PLAN.md;
MiseAmenti/03, 04 (M5), 05, 07; StatusV3.md.

## Rizika
Kulturní (polynéské a buddhistické prvky), finanční framing (dar vs investice),
privacy (údaje o strážcích a hostech), nadsazení stavu (koncept vs stavba),
bezpečnost (API bez klíče, DAO exekuce).

## Hranice
Netvrdí, že komunity fungují, že fond vyplácí, že uzly běží, že OASIS odměňuje fyzické akce,
že existuje ověřený dopad, ani že kdokoliv má duchovní autoritu.

## Review
Technický reviewer (L1/L5 fakta), bezpečnostní reviewer (fond/DAO/API), factual editor,
kulturní konzultant pro Polynésii a buddhismus, public-copy review před jakýmkoli výňatkem do public/.

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
