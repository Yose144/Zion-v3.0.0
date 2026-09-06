# ZION Tokenomics A/B — 144B vs 144M Total Supply

> **Datum:** 26. února 2026  
> **Kontext:** rozhodnutí před/po freeze 2.9.7  
> **Cíl:** porovnat ekonomické důsledky variant total supply `144,000,000,000` vs `144,000,000`.

---

## 1) Vstupní předpoklady

Tento dokument používá aktuálně zveřejněné parametry z premine disclosure:

- Total supply (aktuální model): `144,000,000,000 ZION`
- Genesis premine: `16,780,000,000 ZION`
- Premine podíl: `11.65 %`
- Mining supply: `127,220,000,000 ZION` (`88.35%`)
- Drobné jednotky: `1 ZION = 10^12 Flowers`

Pro variantu `144M` porovnáváme dvě podvarianty:

- **B1 (proporcionální):** zachovat stejné procenta (11.65 % / 88.35 %)
- **B2 (fixní absolutní):** ponechat původní absolutní premine čísla (prakticky nedává smysl, protože by přesahovala supply)

> Poznámka: B2 je uvedeno pouze pro úplnost; realistická je pouze B1 nebo kompletně nový návrh distribuce.

---

## 2) Číselné srovnání

### Varianta A — 144B (aktuální)

- Total supply: `144,000,000,000`
- Premine (11.65 %): `16,780,000,000`
- Mining supply (88.35%): `127,220,000,000`

### Varianta B1 — 144M (proporcionální)

- Total supply: `144,000,000`
- Premine (11.65 %): `16,286,400`
- Mining supply (88.35%): `127,713,600`

### Přepočet faktorů

- Přechod z 144B na 144M znamená faktor **1000× nižší nominální supply**.
- Pokud by se nezměnila relativní emise/odměny, nominální block rewardy by se také musely škálovat ~`/1000`, aby ekonomika zůstala konzistentní.

---

## 3) Dopady na ekonomiku a provoz

## 3.1 Bezpečnost sítě (mining incentives)

- Nižší nominální supply sama o sobě nezlepšuje bezpečnost.
- Kritické je, zda čisté odměny minerů (po nákladech) zůstanou konkurenceschopné.
- U 144M modelu je nutné přesně přenastavit reward curve, jinak hrozí slabší hashpower/participace.

## 3.2 UX a tržní psychologie

- 144M bývá uživatelsky „čitelnější“ (méně nul).
- 144B je kompatibilní s původními materiály a snižuje riziko zmatku těsně před freeze.
- Díky `Flowers` (12 decimál) je mikro-platby možné řešit v obou modelech bez technického omezení.

## 3.3 Governance a důvěra

- Změna supply před freeze zvyšuje governance riziko (komunikace, interpretace fairness, audit trail).
- Každá změna vyžaduje transparentní důvod, simulace a jasný migration proces.

## 3.4 Integrace a dokumentace

- Změna na 144M zasahuje právní texty, premine disclosure, mainnet dokumentaci, reward kalkulace, dashboardy a případné CEX podklady.
- Vysoké riziko nekonzistence, pokud se změna dělá narychlo.

---

## 4) Rozhodovací matice

| Kritérium | 144B (A) | 144M (B1) |
|---|---|---|
| Stabilita před freeze | ✅ vysoká | ⚠️ nižší (větší změna) |
| Komunikační jednoduchost | ✅ kontinuita | ⚠️ potřeba re-edukace trhu |
| Psychologická „scarcity“ | ⚠️ nižší | ✅ vyšší |
| Riziko implementace chyby | ✅ nižší | ⚠️ vyšší |
| Potřeba re-baseline simulací | ⚠️ střední | 🔴 vysoká |

---

## 5) Doporučení (pragmatická varianta)

### Fáze 1 — Freeze-safe (teď)

- Pro `2.9.7` ponechat model `144B`.
- Dokončit CUDA + multialgo + revenue aktivaci bez dalších tokenomics zásahů.
- Uzavřít mainnet readiness s minimem moving parts.

### Fáze 2 — Governance návrh (po freeze)

- Připravit ZIP (ZION Improvement Proposal): „Supply Rebase 144B → 144M (pokud schváleno)“.
- Dodat A/B simulace minimálně pro:
  - roční inflaci,
  - odměny minerů/validatorů,
  - buyback/burn dopad,
  - treasury runway.
- Stanovit jasné acceptance podmínky a datum aktivace.

### Fáze 3 — Implementace (jen pokud schváleno)

- Jednorázový migration plán, replay-safe testy a referenční kalkulačka převodů.
- Full docs/legal refresh + externí komunikace před aktivací.

---

## 6) Minimální checklist před případnou změnou na 144M

- [ ] Tokenomics simulace a peer review.
- [ ] Governance hlasování s quorum pravidly.
- [ ] Audit ekonomických a distribučních dopadů.
- [ ] Aktualizace `legal/PREMINE_DISCLOSURE.md` a navazujících dokumentů.
- [ ] Testnet rehearsal s reprodukovatelným migration skriptem.
- [ ] Komunikační plán pro komunitu / partnery / integrátory.

---

## 7) Executive závěr

Pokud je prioritou **bezpečný mainnet launch**, dává nejvyšší smysl držet v `2.9.7` model `144B` a supply změnu řešit až po freeze jako separátní governance upgrade. Varianta `144M` může být validní, ale jen s plným ekonomickým přepočtem, auditním rámcem a řízenou migrací.
