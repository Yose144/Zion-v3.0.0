# 04 — Exekuční charta 3.3
## Jak se z Mise Amenti stane ověřitelná práce: workstreamy, závislosti, hranice a release gates

> **Status:** Kanonický prováděcí rámec pro 3.3 „Nirvana“.  
> **Doplňuje:** [`V33_NIRVANA_MASTER_PLAN.md`](../V33_NIRVANA_MASTER_PLAN.md) a nikoliv jej mechanicky neduplikuje.  
> **Zásada:** Úspěch 3.3 se neměří cenou tokenu, velikostí publika ani hlasitostí příběhu. Měří se bezpečností, ověřitelností, dobrovolností, odolností a doloženým přínosem.

---

## 1. Severka 3.3

V3.3 je připravena teprve tehdy, když člověk může:

1. **vstoupit bezpečně** a pochopit, co se děje, bez nátlaku;
2. **vlastnit a ověřovat** svou identitu, data a prostředky, bez skrytého custodiana;
3. **přenášet hodnotu** přes podporované sítě pouze s jasně viditelným rizikem a ověřeným settlementem;
4. **použít AI jako pomocníka**, který nemá skrytá oprávnění, neudává mu směr a nemůže jednat bez kontroly;
5. **tvořit, učit se a setkávat** se v OASIS bez manipulativní ekonomiky pozornosti;
6. **vidět, kam jde společný podíl hodnoty**, a ověřit skutečný dopad L5/L6;
7. **převzít projekt** do další generace, i kdyby dnešní tým a Edge server zítra zmizely.

---

## 2. Pořadí práce a závislosti

```text
M0 Evidence & Stability Baseline
 │
 ├── M1 L2 / ZIS: bezpečná identita a skutečný settlement
 │      │
 │      ├── M2 L3: Hiran 2.4 Maestro v sandboxu
 │      │      └── M3 L3: Amitábha / omezená agentní autonomie
 │      │
 │      └── M4 L4: OASIS klient a web preview
 │
 ├── M5 L5: Free World public evidence a participace
 ├── M6 L6: Issobella DeSci a reprodukovatelný výzkum
 │
 └── M7 Decentralizace, lokalizace, DR a předání generacím
        │
        └── M8 Release / Canon evidence review
```

**Základní pravidlo závislostí:** žádný agent nesmí ovládat finance nebo produkci, dokud nejsou dokončeny M1 (identita/opravy), M2 (sandbox), M0 (auditovatelnost) a odpovídající části M8 (security review). Žádný OASIS quest nesmí odměňovat neověřený nebo škodlivý výkon. Žádný L5/L6 grant nesmí být označen za „impact“ bez důkazu.

---

## 3. Workstreamy Mise Amenti

### M0 — Stabilní základ a registr důkazů

**Cíl:** uzamknout rozdíl mezi live stavem a budoucím plánem dřív, než se dále rozšíří produkt nebo příběh.

| Dodávka | Akceptace |
|---|---|
| Verze a release evidence | Každé veřejné číslo verze lze přiřadit ke konkrétnímu tagu, binárce a kompatibilitě protokolu. |
| Live health matrix | Node, pool, ZIS, WARP, DAO, OASIS, L5 a L6 mají dohledatelný health check a incident policy. |
| Baseline testů | `cargo test --workspace`, relevantní clippy a frontend build mají uložené/verifikovatelné výsledky. |
| Claim registry | Každý důležitý statement je označen ŽIVÉ/STAVBA/HORIZONT/HYPOTÉZA/MÝTUS. |
| Disaster recovery | Zálohy, restore drill a vlastnictví runbooků jsou testovány, nikoli jen sepsány. |

**Exit gate M0:** žádný současný dokument 3.3 neprezentuje Passkeys, plnou multichain síť, UE5 klient, autonomní finance ani quantum/warp research jako hotový produkt.

---

### M1 — L2 Multichain & ZIS: od quote k doloženému vypořádání

**Cíl:** vytvořit bezpečnou a srozumitelnou cestu `identita → vklad → quote → potvrzení → settlement → výběr` pro explicitně podporovaný, omezený rozsah chainů.

| Priorita | Dodávka | Měřitelná akceptace |
|---|---|---|
| M1.1 | Scope a custody disclosure | Každý screen jasně říká, zda jde o user-controlled, delegated, nebo custodial prostředky; recovery a rizika jsou srozumitelná. |
| M1.2 | Funded end-to-end test | Izolovaná testovací peněženka dokončí vklad → swap → výběr s reálným on-chain důkazem; test neobsahuje seed ani secrets. |
| M1.3 | Reconciliation & idempotence | Restart, duplicitní event, reorg a partial failure nezmění uživatelské saldo špatně; testy pokryjí refund a recovery. |
| M1.4 | ZIS hardening | Session security, rate limits, logout/revocation, recovery a privacy threat model jsou testované. |
| M1.5 | Passkeys / WebAuthn | Až po M1.4: standardní WebAuthn implementace, phishing-resistant login, zařízení/recovery flow, E2E test na podporovaných platformách. |
| M1.6 | Další chain | Každý nový chain projde stejným threat modelem, deploy evidence a E2E maticí; `disabled_reason` zůstává výchozí stav. |

**Explicitně mimo M1 bez samostatného gate:** „12 chainů live“, Zero-Knowledge Dharma proof, automatická custody a marketingové tvrzení o univerzální kompatibilitě.

---

### M2 — Hiran v2.4 Maestro: orchestrace nejdřív v bezpečném prostoru

**Cíl:** přeměnit existující orchestration code v provozně bezpečný nástroj pro pozorování, analýzu, simulaci a návrh — ne pro tiché jednání nad produkcí.

| Fáze | Povolené schopnosti | Zakázané schopnosti |
|---|---|---|
| M2.1 Pozorovatel | Čtení metrik, analýza incidentů, shrnutí dokumentace, návrh checklistu. | Editace, restart, deploy, finance, síťová pravidla. |
| M2.2 Simulátor | Dry-run task graph, testnet/fixture workflow, reprodukce chyb v sandboxu. | Produkční vedlejší efekty. |
| M2.3 Asistent s potvrzením | Připraví přesný návrh příkazu či transakce; člověk jej samostatně kontroluje a potvrzuje. | Automatické schválení vlastního návrhu. |
| M2.4 Omezený executor | Jediný předem schválený, idempotentní a vratný krok pod krátkodobým tokenem, audit logem a kill switchem. | Klíče, treasury, nevratné akce, firewall, release nebo consensus. |

**Exit gate M2:** Hiran inference je nasazená v určeném prostředí, nástroje jsou sandboxované, každá akce je auditovatelná a `DharmaValidator` je vysvětlen jako pomocná heuristic kontrola, ne „důkaz etiky“.

---

### M3 — Hiran v2.5: Amitábha / Amṛtabhoja jako rozhraní záměru

**Cíl:** přirozený jazyk zjednoduší práci člověka, aniž by skryl následky nebo převzal jeho rozhodovací právo.

- Hlas/text musí vracet **strukturovaný plán**, ne jen sebevědomě vykonaný výsledek.
- Každý plán ukazuje: zdroj prostředků, příjemce, fee, chain, nevratnost, rizika, alternativy a způsob zrušení.
- Agentní identity mají oddělené, časově omezené capability tokens; nikdy sdílené master seedy.
- „Autonomie“ znamená delegované, limitované jednání pod lidským mandátem — ne nezávislé cíle, osobnostní kult nebo finanční spekulace.

**Exit gate M3:** red-team testy pro prompt injection, confused deputy, privilege escalation, nepravdivé tvrzení, transakční substituci a recovery; nezávislý review bezpečnostního modelu.

---

### M4 — L4 OASIS: otevřený svět bez pozornostního vykořisťování

**Cíl:** proměnit OASIS z backendu a předlohy v přístupný, bezpečný a kulturně citlivý prostor učení, hry a tvorby.

1. **Web preview MVP:** lehký, přístupný prohlížečový vstup; měří se kompatibilita, výkon, přístupnost a bezpečnost, ne marketingové FPS sliby.
2. **OASIS API contract:** verze API, autorizace přes ZIS, vlastnictví assetů, privacy model a rate limits jsou před klientem stabilizovány.
3. **UE feasibility track:** Unreal Engine 5.7 je zvláštní R&D proof-of-concept s licenční, GPU, streamingovou a škálovací analýzou. Dokud tento POC neexistuje, Nanite/Lumen/MetaHuman/Pixel Streaming zůstávají HORIZONT.
4. **Kultura a bezpečnost:** žádné monetizované „posvátné skiny“, žádná gamifikace duchovní autority, žádné pay-to-win a žádné questy, které zneužívají osobní data.

**Exit gate M4:** veřejný preview má přístupnost review, security review, měřitelný výkon na referenčních zařízeních a srozumitelnou privacy politiku.

---

### M5 — L5 Free World: od fondu k doloženému dopadu

**Cíl:** 5% humanitární mechanismus se stane pro veřejnost vysvětlitelnou cestou `příjem → rozhodnutí → výdej → výsledek → nezávislé ověření`.

- Veřejný portal ukazuje zůstatek, zdroje dat, rozhodnutí DAO, příjemce, rozpočty, milníky a výsledky.
- Každý projekt má minimální „impact packet“: identifikaci příjemce, scope, rozpočet, on-chain reference, důkaz výstupu, limitace a stav nezávislého ověření.
- Quadratic voting není pouze UI prvek: před nasazením potřebuje Sybil-resistance model, pravidla eligibility, privacy analýzu a attack simulation.
- Žádná fotografie studny, stromu nebo komunity není důkazem dopadu bez souhlasu, původu a odpovědnosti za kontext.

**Exit gate M5:** minimálně jeden pilot projde celý veřejně auditovatelný cyklus bez nadsazení výsledků.

---

### M6 — L6 Issobella: DeSci před velkými tvrzeními

**Cíl:** vytvořit infrastrukturu pro otevřený výzkum, která je přísnější než sama spekulace.

- Každý návrh obsahuje hypotézu, výchozí literaturu, metodiku, data, budget, konflikt zájmů a **falsifikační kritérium**.
- Peer review, replikace, negative results a opravy mají stejnou viditelnost jako úspěchy.
- Výzkum kolem kosmologie, kvantových efektů, nových energií či Alcubierre metrik je klasifikován jako **HYPOTÉZA**, dokud není nezávisle reprodukovatelně ověřen.
- Nikdy se nesmí obchodně tvrdit, že ZION vyřešil FTL, antigravitaci, zero-point energii či energetickou bezpečnost světa.

**Exit gate M6:** zveřejněný, licenčně jasný DeSci protocol; první reprodukovatelný výpočetní nebo datový projekt s nezávislým review.

---

### M7 — Decentralizace, komunita a předání dál

**Cíl:** aby „globální“ znamenalo rozložené, místně odpovědné a překladatelné — ne centralizované v jedné infrastruktuře nebo kulturním příběhu.

- Node/operator program s nezávislými provozovateli, dokumentovaným bootstrapem a disaster recovery.
- Lokalizační program: překlady s review rodilých mluvčích, přístupnost, kontextové právní a kulturní disclaimery.
- Komunitní buňky v rozumném rozsahu, otevřené zpětné vazbě a schopné fungovat bez centrálního týmu.
- Nezávislý security, financial-reserve a impact audit tam, kde systém drží cizí prostředky nebo vydává sociální tvrzení.

**Exit gate M7:** minimálně jeden kompletní failover/restore drill bez hlavního Edge serveru a reprodukovatelná onboarding cesta pro nezávislého operátora.

---

## 4. Finální release gates pro označení „3.3 Nirvana“

Žádná marketingová stránka, release nebo whitepaper nesmí označit 3.3 za dokončenou, dokud neexistuje evidence pro každý relevantní gate:

- [ ] **R1 — Pravda:** aktuální release tag, changelog, test results a compatibility matrix.
- [ ] **R2 — L1 bezpečnost:** consensus/security review, monitoring, back-up/restore drill a jasný stav node rewards.
- [ ] **R3 — L2 settlement:** funded E2E test v deklarovaném scope, reorg/retry/reconciliation testing a jasná custody disclosure.
- [ ] **R4 — ZIS:** security/privacy review, session/recovery flow, případné Passkeys pouze pokud skutečně nasazené a otestované.
- [ ] **R5 — L3 autonomie:** human approval model, audit log, sandbox, rollback/kill switch, red-team evidence.
- [ ] **R6 — L4 kultura:** bezpečný a přístupný preview; UE/streaming pouze v rozsahu, který je reálně dodaný.
- [ ] **R7 — L5/L6 odpovědnost:** veřejně auditovatelný fondový/pilotní workflow a vědecká reproducibility policy.
- [ ] **R8 — Decentralizace:** nezávislý operátor/restore test, aktualizované runbooky, incident disclosure process.
- [ ] **R9 — Komunikace:** public copy prošlo factual/legal/cultural review a každé HORIZONT/HYPOTÉZA je viditelně označeno.

---

*[Zpět na index Mise Amenti → `README.md`](./README.md)*
