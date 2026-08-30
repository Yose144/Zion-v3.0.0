# 01 — Kanon a ústava Mise Amenti
## Pravidla, která drží příběh, kód, lidskou svobodu a dlouhý horizont pohromadě

> **Normativní status:** Tento dokument je závaznou redakční a plánovací ústavou corpus `MiseAmenti/`.  
> **Technický limit:** Nezavádí změnu konsensu, nenahrazuje bezpečnostní politiku a nedává žádné osobě, agentovi nebo dokumentu pravomoc nad živým kódem.

---

## 1. Základní princip

Mise Amenti stojí na jednoduché větě:

> **Technologie je dobrá jen tehdy, když rozšiřuje schopnost lidí ověřovat, rozhodovat se svobodně, pečovat o sebe navzájem a opravovat chyby bez skrývání.**

Z této věty vyplývá pět neoddělitelných závazků. Jsou odvozeny z pěti hodnot formulovaných v `Road to Zion` — **pravda, svoboda, jednota, láska a služba** — ale jsou psány jako testovatelné zásady pro skutečný software a skutečnou komunitu.

| Závazek | Jak se projeví v kódu, provozu a komunikaci |
|---|---|
| **Pravda** | Každý technický nárok má zdroj, commit, test, on-chain důkaz nebo je označen jako plán. Chyba se přiznává a opravuje. |
| **Svoboda** | Žádný nátlak na nákup, držbu, víru, identitu, politickou loajalitu ani setrvání v síti. Uživatel může kdykoliv odejít se svými klíči a daty. |
| **Jednota** | Interoperabilita před lock-inem, spolupráce před kultem osobnosti, více nezávislých uzlů před jediným centrem moci. |
| **Péče** | Bezpečnost, přístupnost, srozumitelný onboarding, incident response a transparentní fondy nejsou vedlejší funkce; jsou součástí definice hotové práce. |
| **Služba** | Výpočet, AI a finance slouží uživatelům a komunitám. Nikdy nejsou navrženy tak, aby maximalizovaly závislost, manipulaci nebo skrytou extrakci. |

---

## 2. Pět povinných stavů každého tvrzení

Každé důležité tvrzení o ZION 3.3, a zejména každé tvrzení zveřejněné mimo interní plánování, musí nést jednu z těchto značek:

| Značka | Význam | Minimální důkaz |
|---|---|---|
| **ŽIVÉ** | Funkce či služba je nasazená a současně ověřitelná. | Odkaz na živý endpoint/on-chain data + relevantní kód nebo deployment evidence. |
| **STAVBA** | Práce existuje v repozitáři nebo je aktivně realizována, ale není ještě produkčně dokončená. | Odkaz na větev/commit, issue, test nebo konkrétní akceptační kritérium. |
| **HORIZONT** | Dlouhodobý směr; není závazným datem ani slíbeným produktem. | Jasně označený cíl, závislosti a hranice tvrzení. |
| **HYPOTÉZA** | Výzkumná otázka, která vyžaduje nezávislé testování a může být vyvrácena. | Metodika, falsifikační kritérium, otevřená data nebo jasně pojmenovaná absence důkazu. |
| **MÝTUS** | Literární, kulturní nebo filosofický archetyp. | Kontextový disclaimer, aby se nemíchal s historií, vědou či technickým faktem. |

### Příklady správného použití

- „`zion-v31-node` je **ŽIVÉ** na Edge“ — pokud to potvrzuje aktuální `StatusV3.md` a live probe.
- „ZIS Passkeys jsou **STAVBA**“ — pokud existuje implementační issue/plan; **nesmí** být vydávány za funkční, dokud není kód a E2E test.
- „Unreal Engine 5.7 klient je **HORIZONT**“ — dokud ve zdrojovém stromu neexistuje skutečný klient a deploy.
- „Kvantový pohon je **HYPOTÉZA**“ — dokud nejsou reprodukovatelné experimenty; nikdy „vynález“ nebo „řešení energetiky“.
- „Síně Amenti jsou **MÝTUS**“ — literární obraz, ne egyptologický dokument ani důkaz historické technologie.

---

## 3. Výklad „Mise Amenti“

Mise Amenti není mise na ovládnutí lidstva, boj proti lidem ani projekt, který se může vykonávat „pro dobro lidí“ bez jejich souhlasu.

Je to dobrovolný závazek vytvořit **Archu záznamu a péče**:

1. **Záznam** — open source, auditovatelná historie rozhodnutí, technická dokumentace a transparentní incident reporty.
2. **Odolnost** — více uzlů, zálohy, disaster recovery, reprodukovatelné buildy a možnost pokračovat i po selhání jednotlivce nebo serveru.
3. **Svobodný přístup** — srozumitelná cesta pro pozorovatele, hráče, stavitele a operátory, bez potřeby přijmout ideologii.
4. **Péče v architektuře** — měřitelné, auditovatelné humanitární a vědecké toky; žádné „trust us“ fondy.
5. **Předání dál** — dokumentace, otevřené protokoly a právní/technická architektura takové kvality, aby projekt přežil všechny současné autory.

„Dokončení Mise Amenti“ tedy **není vítězství nad protivníkem**. Je to stav, kdy ověřitelnost, bezpečnost, svoboda volby a sdílená péče už nejsou vzácným experimentem jedné komunity, ale běžným způsobem, jak lidé zacházejí s technologií.

---

## 4. Hranice proti zneužití

Následující věci jsou neslučitelné s tímto kanonem, i kdyby krátkodobě přinášely růst, peníze nebo popularitu:

- manipulativní „poslední šance“, garance zisku, cenové predikce nebo investiční sliby;
- dark patterns, závislostní UX, sběr dat bez nutnosti a jasného souhlasu;
- automatické přesuny prostředků, změny produkce, firewallu, deploymentu nebo governance bez příslušného lidského schválení;
- neověřené zdravotní, psychologické, fyzikální nebo duchovní nároky;
- kulturní přivlastnění, předstírání tibetské buddhistické linie nebo vydávání mýtu Amenti za historii;
- komunikace, která označuje kritika za nepřítele nebo zpochybnění za zradu;
- prezentace AI jako bytosti s prokazatelným vědomím, duchovní autoritou nebo právem rozhodovat za člověka.

Podrobná bezpečnostní a autonomní pravidla jsou v [`05-Autonomie-a-Bezpecnost.md`](./05-Autonomie-a-Bezpecnost.md); kulturní a narativní hranice v [`02-Pribeh-a-Architektura.md`](./02-Pribeh-a-Architektura.md).

---

## 5. Verze a právní/komunikační disciplína

- **„3.3 Nirvana“ je v tomto corpus plánovací a integrační označení.** Nesmí být samo o sobě interpretováno jako tvrzení, že běžící binárka již vydává protokolovou verzi 3.3.
- Skutečná verze produktu, releasu, binárky nebo chainu se bere **výhradně** z aktuálního releasu, `StatusV3.md`, `V31/STATUS.md` a kódu.
- Veřejné materiály musí být jasné, férové, neklamavé a konzistentní s technickým whitepaperem a platnými právními požadavky. Žádná mytologická metafora nesmí oslabit bezpečnostní, finanční nebo právní disclaimer.
- Každý překlad je redakční změna s vlastním review; překlad nesmí zesilovat jistotu, která v originálu není.

---

## 6. Jak se řeší spor

1. **Přednost má důkaz.** Zkontroluje se kód, test, live endpoint nebo on-chain data.
2. **Rozpor se zapíše.** Do [`07-Registr-Dukazu.md`](./07-Registr-Dukazu.md) nebo do issue se uvede tvrzení, zdroj, důkaz, rozhodnutí a datum.
3. **Narativ se opraví, ne naopak.** Pokud příběh předběhl skutečnost, opraví se text a zachová se changelog.
4. **Sporný nárok se sníží o stav.** Z `ŽIVÉ` na `STAVBA`, z `STAVBA` na `HORIZONT`, nebo z `HYPOTÉZA` na „nepodpořeno“, dokud nepřijde důkaz.
5. **Bezpečnost vítězí nad tempem.** Při nejistotě se nepublikuje, nenasazuje ani neautomatizuje.

---

## 7. Kanonický závěr

> **Mise Amenti chrání možnost budoucnosti, ne představu o tom, kdo má právo ji vlastnit.**  
> **Příběh smí být krásný. Důkaz musí být přesný. Člověk musí zůstat svobodný.**

---

*[Zpět na index Mise Amenti → `README.md`](./README.md)*
