# Report — Účetnictví: oprava sync pravidel (2026-11-03)

> **Zadání:** „koukneme na market a admin a účetnictví" → review odhalilo 4 reálné
> chyby v auto-postingu + 1 race; 👤: „pokracuj ve fixech".
> **Kde:** `apps/MarketPlace` — `src/lib/accounting.ts`, `documentsWithLinks`
> **Stav:** opraveno, ověřeno 58 kontrolami v mock-DB testu, typecheck + eslint čisté.

---

## 1. Co bylo špatně (a proč na tom záleželo)

| # | Chyba | Důsledek |
|---|---|---|
| 1 | **Mrtvá storno větev.** Sync tahal faktury jen `status ∈ issued/sent/paid`, ale cancel-flow nastaví fakturám `cancelled` → zrušená nezaplacená objednávka nikdy nedostala storno | výnos 60x + pohledávka 311 zůstaly v knihách navždy; tab Doklady ukázal falešnou zelenou |
| 2 | **Paid+cancelled → phantom 311.** U zaplacené zrušené objednávky storno připisovalo DAL na 311 → fiktivní pohledávka místo závazku k vrácení | 311 = +total k ničemu; peníze na 221 správně, ale knihy lhaly |
| 3 | **`hasInvoiceEntry = invoices.length > 0`** počítal i draft/cancelled faktury | platba se zaúčtovala proti 311, která nebyla nikdy debitovaná → záporný zůstatek odběratelů |
| 4 | **`totalCzk` vs součet položek.** Faktura účtovala `Σ(items)+shipping`, platba `order.totalCzk` | jakýkoli rozchod (sleva, zaokrouhlení, jiný klíč v items JSON) → na 311 visel zbytek navěky |
| 5 | **Race v číslování.** `nextEntryNumber` = findFirst + create mimo transakci | souběžný sync + manuální doklad → P2002 crash místo retry |

## 2. Oprava

**Storno zrušených** (`syncOrdersToLedger`): faktury se nově tahají i ve stavu
`cancelled` na zrušené objednávce. Storno se účtuje jen když faktura už v
ledgeru je (jinak není co stornovat — nezaúčtovaná zrušená se přeskočí):

- **nezaplacená** → `DAL 311` + revenue na MD (zruší otevřenou pohledávku)
- **zaplacená** (`paymentStatus=paid` nebo existuje `order_paid` doklad) →
  `DAL 325` Ostatní závazky + revenue na MD — **závazek k vrácení**, ne
  fiktivní pohledávka. 311 zůstává vyrovnaná (faktura MD + úhrada DAL).

**Platby**: `paymentStatus='paid'` bez filtru na zrušenost. Kreditní strana
podle skutečnosti, ne podle počtu Invoice řádků:

- zaúčtovaná faktura (ledger entry `sourceType='invoice'` pro ID faktury
  objednávky) → `DAL 311`
- zrušená bez zaúčtované faktury → `DAL 325` (peníze dorazily, závazek
  k vrácení — jediný doklad, žádný falešný výnos ani pohledávka)
- jinak → přímé výnosy 60x

**Dorovnání částek** (`reconcileRevenueLines` + `diffLine`): výnosové řádky se
sečtou přesně na fakturovanou částku. Rozdíl > 0 → `DAL 648` (zaokrouhlení),
< 0 → `MD 604` (sleva na MD výnosového účtu — záporné částky `postEntry`
správně odmítá). Storna strany převrací `flipSides`, takže se zrcadlí i
slevový řádek.

**Race**: `postEntry` při P2002 přečte číslo znovu (max 3 pokusy).

**`documentsWithLinks`**: unposted počítá se stejnou sadou faktur jako sync
(zrušená se hlásí jen když byla zaúčtovaná a chybí storno), zaplacené
objednávky bez filtru zrušení.

## 3. Účetní správnost výsledků (ověřené zůstatky)

| Scénář | 221 | 311 | 325 | 60x |
|---|---|---|---|---|
| Neplacená zrušená (po syncu) | 0 | **0** | 0 | 0 |
| Zaplacená zrušená (po syncu) | +T | **0** | **−T** závazek | 0 |
| Zaplacená zrušená (nikdy synced) | +T | 0 | −T | 0 (žádný výnos v knihách) |
| Invoice synced → paid+cancelled | +T | 0 | −T | 0 |
| Happy path faktura→úhrada | +T | 0 | 0 | −T |
| Paid bez faktury | +T | 0 | 0 | −T |
| Paid + draft faktura | +T | 0 | 0 | −T (ne 311!) |

Refund pak bude manuální doklad `MD 325 / DAL 221` — až se peníze vrátí.

## 4. Ověření

- **`scripts/test-accounting-sync.ts`** — in-memory prisma mock (findMany/
  findFirst/create/groupBy + where matcher vč. OR/in/not/relací), 13 scénářů,
  **58/58 kontrol PASS**: storno-strany, zůstatky per účet, sleva/přebytek,
  idempotence, unposted report, P2002 retry, celkové MD=DAL
- `npm run typecheck` — čistý
- `eslint` na změněných souborech — čistý
- Test je trvalý regresní harness — spustitelný `npx tsx scripts/test-accounting-sync.ts`

## 5. Co s tím souvisí

- **Sync existujících 51 faktur + 4 plateb** (otevřený bod plánu §9b) je teď
  bezpečné spustit — všechny edge-case jsou ošetřené a idempotentní. Pořád
  je to reálný zápis → rozhodnutí 👤.
- Refund zaplacených zrušených objednávek: teď vznikne 325 závazek — při
  reálném vrácení peněz ruční doklad `325/221`.
- F3+ (Fio import, crypto FIFO, DPPO XML, ISDS) beze změn.

---

*Soubory: `src/lib/accounting.ts`, `scripts/test-accounting-sync.ts` (nový), `UCETNICTVI-PLAN.md`*
