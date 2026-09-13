# ISSOBELLA — Kapitola 9: Cesta poutníka
## Sedm bran · L6 onboarding — jak vstoupit do příběhu nebe, aniž ti někdo prodá horizont

> *„Brána k nebi neotvírá se klikou. Otevírá se otázkou, kterou si položíš dobře."*

---

## Příběh

Poutník, který chtěl ke hvězdám, přišel k sedmi branám. Na každé visela cedule — a na každé stála jiná pravda.

**První brána — Pozorovatel.** *„Dívej se,"* stálo na ceduli. *„Zdarma. Beze slibů."* Za ní bylo vidět web, stránku `/l6-issobella`, zrcadlo stanice a fondu. Kdo prošel jen sem, odcházel s jedním pokladem: věděl, že existuje vrstva, která hledí nahoru.

**Druhá brána — Čtenář.** *„Čti, co čteme my."* Za ní byla knihovna: architektura stanice, kvantový motor, umělá gravitace, lidské faktory, historie stanic. Čtenář nemusel věřit — musel jen číst pozorně.

**Třetí brána — Výzkumník.** *„Přines otázku."* Za ní stáli tiskaři pravdy a čekali na lidi, kteří umí počítat, měřit, psát a mýlit se pořádně. Výzkumník nemusel být povoláním — stačilo, že rozuměl pravidlu: hypotéza se zapisuje i se svým pohřebem.

**Čtvrtá brána — Těžař.** *„Hlaď síť."* Za ní teklo pět procent každého bloku — ne do jeho kapsy, ale do studny nebe. Těžař, který dobře těžil, posiloval proud nahoru, aniž o tom rozhodoval.

**Pátá brána — Volič.** *„Hlasuj o tom, co si zaslouží letět."* Za ní čekala cesta DAO: návrhy, hlasování, timelock. Dnes ještě uzavřená — ale cedule slibovala, že až se odemkne, stane se mocí.

**Šestá brána — Dárce.** *„Dej, co můžeš."* Menší brána, tišší — pro ty, kdo chtějí přidat své: čas, dovednost, pozornost, dar. Cedule upozorňovala: dar není investice; návratnost nesmí být slíbena.

**Sedmá brána — Hráč.** *„Vstup do světa."* Za ní čekaly krystalické světy OASIS — jednou snad i svět L6, který si lze projít jako příběh, ne jako let.

A na průčelí nad všemi branami viselo jedno varování, které psal Sádhu:

> *„Kdo ti slíbí let do hvězd, lhář je. Kdo ti nabídne cestu, jak se ptát dobře — projdi."*

---

## Co to znamená

**L6 onboarding je cesta stejné disciplíny jako L5 — jen obrácená nahoru.** BodhiGaia kreslí sedm bran k zemi; Issobella je k nebi. Struktura je záměrně stejná: začíná se pohledem (pozorovatel), pokračuje porozuměním (čtenář), a teprve potom přichází účast (výzkumník, těžař, volič, dárce, hráč).

Zvláštností L6 je, že **nejužitečnější poutník je často ten, kdo umí číst a počítat**. DeSci — decentralizovaná věda — je pro L6 to, čím je práce na farmě pro L5: způsob, jak se zapojit, aniž by člověk čekal návratnost.

| Brána | Co potřebuješ | Co dostaneš | Co ti nikdo nesmí slíbit |
|---|---|---|---|
| Pozorovatel | Oči | Přehled (`/l6-issobella`) | Zisk |
| Čtenář | Trpělivost | Zdroje (`/docs` → `l6-*`) | Pravdu bez důkazu |
| Výzkumník | Otázku + řemeslo | Zapojení do DeSci | Grant „na jistotu" |
| Těžař | Node / pool | 5 % do studny nebe automaticky | Odměnu navíc |
| Volič | DAO přístup | Hlas o výdajích fondu | Garanci výsledku |
| Dárce | Dar / dovednost | Podíl na příběhu | Návratnost |
| Hráč | OASIS klient | Příběh L6 jako svět | „Let do vesmíru" |

A hranice, kterou sedmá brána nese nahlas: **žádná z bran neprodává cestu ke hvězdám**. Prodává se jen způsob, jak se ptát dobře — a pomáhat stavět příběh, který si nehraje na fyziku.

---

## Kotva pravdy — ověřitelná fakta

| Obraz / tvrzení | Stav | Kotva |
|---|---|---|
| Pozorování: `/l6-issobella` je veřejná stránka | **ŽIVÉ** | `APP&WEB/website-v2.9/src/app/l6-issobella/page.tsx` |
| Čtení: výzkumný balík servírován v `/docs` (`l6-*`) | **ŽIVÉ** | `APP&WEB/website-v2.9/src/app/docs/page.tsx` mapování; `APP&WEB/website-v2.9/public/docs/l6/*.md` |
| Výzkumník (DeSci): reálné zapojení do výzkumu L6 | **STAVBA** | Záměr v `L6data/`; zatím žádný formální program / board |
| Těžař: 5 % každého subsidy jde na L6 automaticky | **ŽIVÉ** | `emission.rs` (`ISSOBELLA_PCT = 5`) |
| Volič: hlasování o výdajích L6 fondu | **STAVBA** | G10: DAO cesta je read-only, čeká na DAO UI; volba dnes neexistuje |
| Dárce: dar do L6 fondu | **HORIZONT** | Žádný veřejný darovací mechanismus |
| Hráč: L6 svět v OASIS | **HORIZONT** | Žádný provozní L6 svět v `worlds.ts` |
| „Cesta do vesmíru jako zaručený zážitek" | **NEPLATNÉ TVRZENÍ** | Žádná loď, žádná posádka, žádný let |

---

*„Brána k nebi se neotvírá klikou. Otevírá se otázkou, kterou si položíš dobře."*

**Navigace:** [← Kapitola 8: Zrcadlo](./08-Zrcadlo.md) · [Kapitola 10: Kotva pravdy a hranice →](./10-Kotva-Pravdy-a-Hranice.md)
