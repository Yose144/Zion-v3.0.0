# ISSOBELLA — Kapitola 10: Kotva pravdy a hranice
## Registr · Mise Amenti M5 — co je ověřitelné, co je horizont, co je mýtus, a čím Issobella není

> *„Kniha, která se bojí vlastních hranic, se nehodí ke hvězdám."*

---

## Příběh

Na konci cesty nebe přišel poutník k poslednímu stanu tábora — největšímu a nejtiššímu. Na jeho stěně nevisely obrázky ani mapy. Visela **jedna tabulka** — a nad ní napsáno: *„Sem chodíme, když se příběh srazí s faktem."*

Vedle tabulky seděl Jen-že a vedl záznamy. *„Tohle je registr,"* řekl. *„Každý obraz v knize má svůj řádek. Když někdo přijde a řekne: tohle není pravda — nehádáme se. Půjdeme k řádku, přečteme kotvu a opravíme, co je třeba. Ne příběh kvůli pocitu — příběh kvůli pravdě."*

Ukázal na tři sloupce. *„Živé — to, co můžeš zkontrolovat v kódu a na řetězu. Stavba a horizont — to, co se dělá a co je teprve před námi. Mýtus — to, co je krásné a pravdivé jako obraz, ale ne jako událost."*

Poutník se zeptal: *„A co když se mýtus a fakt srazí?"*

*„Pak opravíme mýtus,"* řekl Jen-že prostě. *„Ne fakt. Nikdy fakt."*

Pod tabulkou byly ještě tři seznamy: **co Issobella není** (prodej vesmíru, slib letu, fyzikální teorie, militarizace, náhrada kanonu), **známé nesrovnalosti** (místa, kde se příběhy a dokumenty ještě nesešly) a **otevřené otázky** (kde pravda ještě nedorostla).

Poutník dlouho mlčel. Pak se zeptal: *„A proč se to všechno dělá? Proč držet knihu tak přísně?"*

Jen-že se podíval k obloze, kde se nad táborem začínaly objevovat první hvězdy. *„Protože jednoho dne — možná za patnáct let, možná za třicet — se někdo podívá nahoru a zeptá se: *letí to tam, nebo ne?* A my mu chceme moci odpovědět pravdu — ne příběh, který jsme si líbili."*

---

## Co to znamená

**Tato kapitola je registrová pravda Knihy Nebe.** Je to nejdůležitější stránka série — ta, která se otevře, když se narativ srazí s faktem, a ta, která drží celou knihu při zemi, i když vypráví o nebi.

### Plná tabulka důkazů L6

| Obraz / tvrzení | Stav | Kotva | Stále chybí |
|---|---|---|---|
| `ISSOBELLA_PCT = 5` — 5 % každého subsidy → `zion1z4s3a5...` | **ŽIVÉ** | `V31/L1/core/src/{emission,v3_template,v3_compat}.rs`; `StatusV3.md` | — |
| Premine slot 6 = 2,5 mld ZION, `zion1f5h5k6t8...`, lock 144 000 | **ŽIVÉ** | `v3_compat.rs`, `CHANGES_L6_ISSOBELLA.md`, `StatusV3.md` 2026-09-12 | Nezávislý explorer pohled |
| `zion-issobella` tracker na Edge, `:8097`, `/api/issobella/` | **ŽIVÉ** (read-only) | `V31/L6/issobella/`, `zion-v31-issobella.service`, `StatusV3.md` 2026-08-23 | Veřejný portál; API-key enforcement |
| Fond vyplácí granty | **NEPLATNÉ** (dnes) | G10 read-only; DAO cesta čeká na UI | DAO UI, payout flow, multisig, první projekt |
| Výzkumný balík `L6data/` veřejný v `/docs` | **ŽIVÉ** (dokumentace) | `L6data/README.md`, `APP&WEB/website-v2.9/public/docs/l6/`, `APP&WEB/website-v2.9/src/app/docs/page.tsx` | Peer review, externí experti |
| Orbitální stanice 400–550 km, AG 0,38 g, posádka | **HORIZONT** | `L6data/Architektura.md`, `Umela_Gravitace.md`, `Lidske_Faktory.md`, `/l6-issobella` | Feasibility, partneři, roky práce |
| Kvantový motor: demonstrátor 2033, CubeSat 2035 | **HORIZONT / HYPOTÉZA** | `L6data/Kvantovy_Motor.md`, `/l6-issobella` roadmapa | Výzkum, lab, ověření; hardware |
| Alcubierre–Ekam warp, Φ rezonance, toroidní vlny | **HYPOTÉZA / MÝTUS** | `nirvana/11` jako narativní rámec | Fyzikální důkaz — číst jako poezii |
| L6 svět v OASIS | **HORIZONT** | Žádný provozní L6 svět v `worlds.ts` | Design, integrace |
| Historie stanic (Saljut, Skylab, ISS, Dual Keel, Freedom) | **ŽIVÉ** (historie) | `L6data/Histori.md`; veřejně zdokumentováno | — |
| Jméno Issobella, izotropie, Hiranyagarbha, postavy | **MÝTUS** | Kanonická mytologie této knihy | — |

### Co Issobella není

- **Není prodej vesmíru** — žádné podíly, žádná tokenizovaná orbitální nemovitost.
- **Není slib, že poletí** — roadmapa 2030–2050 je horizont, ne garance.
- **Není fyzikální teorie** — kvantový oheň je otázka, ne závěr.
- **Není militarizace** — L6 se nevěnuje zbrojení; bezpečnostní brány jsou součást designu.
- **Není náhrada `StatusV3.md` / `MiseAmenti/07` / `L6data/`** — kde se liší, vítězí kanon.
- **Není nástupce ISS, NASA, ESA ani žádného jiného programu** — čerpá poučení z historie, ne dědictví.

### Známé nesrovnalosti a otevřené otázky

- **`nirvana/11` uvádí „5 % L6 fond" na adrese `zion1z4s3a5...`** — správně jako *subsidy stream*, ale premine slot 6 (`zion1f5h5k6t8...`) je samostatná entita; tato kniha oba rozlišuje (kap. 6).
- **`worlds.ts` zatím nemá L6 svět** — OASIS drží L4; L6 se odráží jen jako příběh/směr.
- **Veřejný portál fondu chybí** — dashboard je operátorský; API-key enforcement není vynucený.
- **DeSci program není formalizován** — žádný board, žádný veřejný call.
- **Jaká je správná etymologie „Issobella"?** — kanonická mytologie říká *iso + bella*; historický původ názvu v git historii není dokumentován (viz `Issabela1stSkelet` render z `5ec065b81`).

### Návrh změny (class E → kanonizace)

Tato kniha je navržena ke kanonizaci jako **narativně-technická série L6** podle `MiseAmenti/08-Protokol-Zmen.md` (třída E — kulturní / veřejná komunikace; pasáže o fondu/governance třída C). Kanonizace vyžaduje: (1) doplnění `07-Registr-Dukazu.md` o L6 řádky z této tabulky, (2) revizi `nirvana/11` pro rozlišení subsidy vs. premine, (3) potvrzení M5 workstream vlastníkem, (4) veřejný peer-review průchod `L6data/` před jakýmkoli „ŽIVÉ" přeřazením.

---

## Kotva pravdy — ověřitelná fakta

| Obraz / tvrzení | Stav | Kotva |
|---|---|---|
| Tato tabulka existuje jako součást dokumentace | **ŽIVÉ** | Tato kapitola; `MiseAmenti/07` |
| Žádná postava, žádný „registrátor" | **MÝTUS** | Jen-že je archetyp této knihy |
| Návrh ke kanonizaci | **STAVBA** | Čeká na review podle `MiseAmenti/08` |

---

*„Když se příběh srazí s faktem, opravíme příběh. Nikdy fakt."*

**Navigace:** [← Kapitola 9: Cesta poutníka](./09-Cesta-Poutnika.md) · [Kniha Nebe — index](./00-README.md)
