# GENESIS-ROSE-001 — Návrh pilotu fyzického zasazení
## Rozhodovací rámec pro případ, že by literární semínko z *Příběhu Růže* mělo jednou narazit na skutečnou hlínu

> **Stav: HORIZONT / NEZAHÁJENO.**
> Tento dokument je rámec, ne záznam události. **Nedokládá** pozemek, povolení, nákup rostliny, zasazení, přežití ani dopad. **Neexistuje žádný schválený výdaj L5/DAO** a tento dokument jej nenavrhuje.

---

## 1. Účel a hranice

Mikro-pilot **disciplíny důkazu**: ověřit, že projekt umí provést a zdokladovat jeden malý fyzický čin poctivě — se souhlasem, s původem, s limitacemi a s nezávislým ověřením, kde je dostupné.

**Co pilot není:**

- není automaticky M5 exit gate (splnění gate M5 je samostatné rozhodnutí podle `MiseAmenti/04`);
- není marketing, ceremonie ani fundraising aktivita;
- není náboženský, genealogický ani „posvátný" akt;
- není nárok na L5 fond, token, NFT ani reward.

---

## 2. Gaty — všechny musí projít před výsadbou

### Gate A — místo a souhlas

- Písemné oprávnění vlastníka nebo oprávněného správce místa.
- Potvrzené konkrétní místo výsadby v rámci lokality.
- Přesné GPS může zůstat neveřejné; veřejně se uvádí jen hrubá lokalita.
- Souhlas s pořizováním fotografií a jejich publikací (včetně souhlasu osob na snímcích).

### Gate B — botanika a bezpečnost

- Místní zahradník / hortikulturista potvrdí **lokálně dostupný, neinvazivní kultivar** vhodný pro konkrétní mikroklima Algarve.
- Ověřit: vodní omezení lokality, vhodnou dobu výsadby, stav půdy, požární režim.
- Umístění **mimo pěší, dětskou a pracovní trasu** — rostlina bude mít trny.
- Žádné sázení do chráněného biotopu ani na místo, kde by rostlina konkurovala původní květeně.

### Gate C — péče

- Jmenovaný pečující člověk + náhradník (jména interní, veřejně jen role).
- Zdroj vody a jeho limit; mulč a zálivka podle lokálního doporučení.
- Plán pro sucho a požár (kdy přerušit, kdy obnovit, kdy ukončit).
- **Žádná voda na úkor pitné vody nebo potravinových záhonů.** Před výsadbou musí být doloženo, že zdroj pokryje doporučenou následnou péči; jinak Gate C neprojde a rostlina se nesází.

### Gate D — finance a tvrzení

- Žádné L5 fondy bez skutečného DAO procesu (dnes žádný návrh neexistuje).
- Žádný token, NFT, reward ani prodej „ceremonie zasazení".
- Žádná tvrzení o Miriam, Marii, relikvii, krevní linii, reinkarnaci ani „posvátné" rostlině.
- Veškerá komunikace nese štítek stavu podle `MiseAmenti/07`.

---

## 3. Záznamová pole

| Pole | Hodnota |
|---|---|
| Pilot ID | `GENESIS-ROSE-001` |
| Stav | HORIZONT / NEZAHÁJENO |
| Datum rozhodnutí | TBD |
| Authorization ref (vlastník/správce) | TBD |
| Správce místa | TBD |
| Lokální botanický reviewer | TBD |
| Datum/čas výsadby | TBD |
| Taxon / kultivar | TBD |
| Zdroj rostliny/semena a doklad | TBD |
| Veřejná hrubá lokalita | TBD (např. „Algarve, Portugalsko") |
| Soukromé GPS ref | TBD (interní) |
| Vodní / aftercare plán | TBD |
| Rozpočet a zdroj | TBD |
| Privacy / consent | TBD |
| On-chain ref | N/A (dokud neexistuje schválený spend) |
| Nezávislý ověřovatel | TBD |
| Omezení / odchylky | TBD |

---

## 4. Evidence Day 0

Packet Day 0 obsahuje:

- fotografie místa **před** výsadbou, rostliny/zdroje, procesu výsadby a místa **po**;
- hash původních souborů nebo manifest jejich metadat (doklad integrity);
- jmenovaného svědka a datum;
- vyplněnou tabulku záznamových polí.

**Day 0 dokládá pouze událost „zasazeno".** Nedokládá přežití, zdraví rostliny ani dopad — ty se dokládají následnými kontrolami.

---

## 5. Follow-up prahy

| Kontrola | Co dokládá | Obsah |
|---|---|---|
| **Day 30** | Ujmutí / počáteční stav | Stejný bod a úhel fotografie, stejná provenience; stav rostliny, spotřeba vody, zásahy, limitace; nezávislé potvrzení, pokud je dostupné. |
| **Day 90** | První kontrola přežití | Stejný formát jako Day 30; výslovný verdikt žije/odumírá/uhynulo. |
| **Day 365** | Biologická persistence | Stejný formát; **nejméně Day 365 + nezávislé ověření** je podmínkou pro štítek „doložená biologická persistence". |

Každá kontrola se připojuje do tohoto dokumentu (nebo jeho verzovaného logu) — ne přepisuje se historie, přidává se výsledek.

---

## 6. Stavové přechody

| Ze stavu | Do stavu | Podmínka |
|---|---|---|
| — | **HORIZONT** (teď) | Tento dokument existuje; žádná akce. |
| HORIZONT | **STAVBA** | Splněny Gate A–C + naplánovaný termín výsadby. |
| STAVBA | **ŽIVÉ** („doložená událost zasazení") | Splněna Gate D + kompletní Day 0 packet. |
| — | Přežití: **NEDOLOŽENO → doložené** | Příslušná kontrola (D30/D90/D365) s evidencí. |
| — | „Doložená biologická persistence" | Nejdřív **Day 365** s nezávislým ověřením. |

> **Ani doložená persistence sama nesplňuje M5 exit gate** — M5 vyžaduje celý auditovatelný cyklus podle `MiseAmenti/04` a samostatné rozhodnutí.

---

## 7. Selhání a re-plant

- Uhynutí nebo selhání se **nemaže ani nepřejmenovává** — zapíše se jako výsledek s datem a příčinou, pokud je známa.
- Re-plant = **nový pilot ID / nová verze** (`GENESIS-ROSE-002`), nikdy „tichá oprava" tohoto záznamu.
- Záznam o selhání je legitimní výstup: dokazuje, že proces umí říct pravdu i o neúspěchu.

---

## 8. Checklist (nezaškrtnutý — pilot nezahájen)

```text
[ ] Gate A — souhlas vlastníka/správce, potvrzené místo, souhlas s publikací
[ ] Gate B — lokální neinvazivní kultivar potvrzen hortikulturistou; voda, půda, požár, trasa ověřeny
[ ] Gate C — pečující + náhradník, zdroj vody a limit, plán pro sucho/požár, doložená dostatečnost vody pro následnou péči bez konkurence s pitnou vodou a potravinovými záhony
[ ] Gate D — žádný L5/DAO spend bez procesu; žádný token/NFT/reward; žádné posvátné/genealogické nároky
[ ] Day 0 packet — foto před/proces/po, provenience, svědek, záznamová pole
[ ] Day 30 — ujmutí
[ ] Day 90 — přežití
[ ] Day 365 — biologická persistence s nezávislým ověřením
```

---

*[Zpět na Kapitolu 12 → `../12-Ruze-v-Zahrade-Genesis.md`](../12-Ruze-v-Zahrade-Genesis.md)* · *[Index Knihy Země → `../00-README.md`](../00-README.md)*
