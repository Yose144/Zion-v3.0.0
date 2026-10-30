# L5 Free World — Proof-of-Impact workflow + Impact Packet šablona (6.B4)

**Datum:** 2026-10-30 · **Autor:** Devin · **Gate:** prerekvizita pro V33-6 (≥1 pilot s veřejným rozpočtem a výsledkem, nezávisle ověřený)

## 1. Pilot lifecycle (end-to-end)

```
1. PROPOSAL      projekt/registr → grant záznam v L5 daemonu (requested_zion, scope, milníky)
2. QV ADVISORY   otevřené kolo → tally → water-filling alokace (advisory, ne disbursement)
3. DAO APPROVAL  advisory proposal → DAO submit path → guardian multisig (human-approved, VŽDY)
4. DISBURSEMENT  1. tx (celá částka nebo milestone tranše) — on-chain odkaz povinný
5. EXECUTION     projekt dodává; milestone evidence se sbírá průběžně
6. IMPACT PACKET dokument níže — vyplněný příjemcem + ověřovatelem
7. VERIFICATION  nezávislý ověřovatel (≠ příjemce, ≠ operátor fondu) potvrdí evidence
8. PUBLIC RECORD impact packet + tx odkazy publikovány na freeworld portálu → V33-6 ✅
```

**Pravidla:**
- Žádná disbursement tx bez předchozího DAO advisory záznamu.
- Každá tx musí mít on-chain odkaz (explorer URL + txid).
- Ověřovatel musí být jmenovitý a nezávislý; jeho podpis/konfirmace je součást packetu.
- Partial delivery = packet stále povinný (result vs plan + procento naplnění).

## 2. Impact Packet šablona

```markdown
# Impact Packet — <Název projektu>

**Grant ID:** <l5 grant id>  **Round:** <qv round id>
**Příjemce:** <org/osoba + kontakt>  **Ověřovatel:** <jméno, vztah k projektu: nezávislý>
**Období:** <od–do>  **Stav:** completed | partial | failed

## Rozpočet
| Položka | Plán (ZION) | Skutečnost (ZION) |
|---|---|---|
| celkem | | |

## Finance — on-chain důkazy
| Tx | Částka | Datum | Účel | Explorer |
|---|---|---|---|---|
| <txid> | | | disbursement/milestone N | <url> |

## Dodávky vs. plán
| Milník | Plánovaný výstup | Dodáno | Důkaz (foto/doc/link) |
|---|---|---|---|
| 1. | | ✅/⚠️/❌ | |

## Naměřený dopad
- Primární metrika (z proposal): <např. "120 stromů vysázeno"> → **výsledek:** …
- Sekundární metriky: …

## Ověřovací záznam
- Metoda ověření: site visit | dokumentace | třetí-strana report
- Ověřovatel statement: <citace + datum + podpis/kontakt>
- Nezávislost check: ❌ žádný finanční/rodinný vztah k příjemci

## Závěr
- Výsledek vs. plán: <%>
- Doporučení pro další kolo: refund | další tranše | uzavřít
```

## 3. Co existuje vs. co chybí (code-verified)

| Kousek | Stav |
|---|---|
| Grant/round/ballot registry v daemonu | ✅ `db.rs` + QV endpoints |
| Advisory→DAO bridge | ✅ `dao_client.rs` existuje |
| Disbursement tx flow | ❌ summary-only (6.B5) — první E2E grant potřeba |
| Impact packet storage | ❌ — MVP: packet jako markdown v repo `docs/3.2/impact/` + link z grant záznamu; DB pole `impact_packet_url` jako follow-up |
| Public zobrazení packetu | ❌ — portál stránka grantu může renderovat packet md (stejný pattern jako docs viewer) |

## 4. Doporučený pilot postup (pro 👤 výběr)

1. Vybrat 1 reálný projekt z registru s **malým, ověřitelným** deliverablem (< ~equivalent pár set USD; fyzicky kontrolovatelný výstup).
2. Projít lifecycle i bez QV kola (round může být formální s 1 grantem) — cílem je prověřit *workflow*, ne konkurenci.
3. První packet vyplnit do 30 dní od disbursement; publikovat na portálu.

## 5. Ne-cíle

- Automatická orákula / on-chain escrow milníků — HORIZONT.
- Komplexní M&E framework — packet je záměrně jednostránkový.
