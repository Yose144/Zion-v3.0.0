# Report — Účetnictví F2: výstupy (2026-11-03)

> **Zadání:** „F2 doděláme, teď to účetnictví" — dokončit druhou fázi
> vlastního účetního systému Omnity.One s.r.o. podle `UCETNICTVI-PLAN.md` §8.
> **Kde:** `apps/MarketPlace` (admin + API + Prisma) · **Větev:** main
> **Stav:** implementováno, nasazeno live (`market.zionterranova.com`), ověřeno proti produkční DB.

---

## 1. Co F2 přidala

F1 uměla zápisy *vytvářet* (deník, manuální doklad, sync objednávek). F2 je
umí **číst jako knihy** — to, co účetní skutečně potřebuje vytáhnout.

| Výstup | Kde | Co dělá |
|---|---|---|
| **Hlavní kniha per účet** | `generalLedger()` + `/api/admin/accounting/ledger` | počáteční stav z předchozích období, každý zápis s průběžným zůstatkem, obraty MD/DAL, konečný stav |
| **Inventurní soupis stavů** | `inventoryReport()` + `/api/admin/accounting/inventory` | stavy rozvahových účtů (třídy 0/1/2/4) k 31. 12., rozdělené na aktiva/závazky/kapitál + VH a **kontrolní rozdíl** |
| **Doklady a návaznosti** | `documentsWithLinks()` + `/api/admin/accounting/documents` | každý doklad s vazbou na fakturu/objednávku + **kolik dokladů ještě není zaúčtováno** |
| **CSV export** | `/api/admin/accounting/export?type=journal\|ledger\|inventory` | deník, hlavní kniha i inventura; středník, desetinná čárka, UTF-8 BOM (Excel CZ) |
| **UI** | `/admin/accounting` | pět záložek: Předvaha · Deník · Hlavní kniha · Inventura · Doklady, export respektuje aktivní záložku |

### Co je v inventuře matematicky

Zůstatek účtu = MD − DAL (kladný = aktivní, záporný = pasivní).
Výsledek hospodaření = −(Σ třída 5 + Σ třída 6). Kontrola:

```
aktiva − závazky − kapitál − VH = 0
```

Když se to nerovná nule, je v datech nevyvážený doklad — což `postEntry()`
neumí zapsat, takže je to čistě integritní pojistka (a zároveň ruční kontrola
`MD = DAL` přes celou historii, ne jen za jedno období jako předvaha).

## 2. Návaznosti (doklady ↔ účetnictví)

`sourceType` + `sourceId` z F1 je jediné místo pravdy:

| sourceType | odkud | odkaz v UI |
|---|---|---|
| `invoice` | `Invoice` (vystavená) | objednávka + číslo faktury |
| `invoice_storno` | zrušená objednávka s fakturou | objednávka |
| `order_paid` | zaplacená objednávka | objednávka (`/admin/orders?q=…`) |
| `manual` | ruční doklad | — |

Karta **Doklady** proto zároveň hlásí nezaúčtované doklady a má tlačítko sync —
je to kontrolní seznam úplnosti, ne jen výpis.

## 3. Ověření (proti produkční DB, ne mock)

Postup: `prisma db push` → seed → dva testovací doklady → všechny endpointy →
smazání testovacích dokladů.

| Test | Výsledek |
|---|---|
| `prisma migrate diff` před pushem | **jen CREATE TABLE/INDEX/FK**, žádný DROP → aditivní |
| `db push` na EDGE2 | `LedgerAccount`, `LedgerEntry`, `LedgerEntryLine` vytvořeny |
| seed účtového rozvrhu | **71 účtů** |
| manuální doklad 2024 (221 MD / 602 DAL, 100,00) | `U-2024-0001`, předvaha `MD=DAL`, balanced |
| hlavní kniha 221 / 2024 | opening 0 → MD 100,00 → closing 100,00 |
| hlavní kniha 221 / 2025 (nový doklad 50,00) | **opening 100,00** (převod z předchozího roku), closing 150,00 |
| inventura 2025 | aktiva 150,00 · závazky 0 · kapitál 0 · VH 150,00 · **kontrolní rozdíl 0** |
| CSV deník / kniha / inventura | BOM + `;` + `50,00`, hlavičky i součtové řádky OK |
| nezaúčtované doklady (2026) | **51 faktur, 4 platby** — sync zatím nespouštěn (rozhodnutí 👤) |
| API bez klíče | `401` |
| `/admin/accounting` | `200` |

Testovací doklady (`U-2024-*`, `U-2025-*`) byly smazány: 0 entries, 0 lines,
71 účtů zůstává.

## 4. Opravená chyba, která blokovala deploy

`scripts/flatten-standalone.mjs` sléval `node_modules` **sám do sebe**:

```
ERR_FS_CP_EINVAL: src and dest cannot be the same
  .next/standalone/node_modules
```

Smyčka `levels` obsahuje i root `standalone` a jako cíl používá právě jeho
`node_modules` → `cpSync` spadne, když root `node_modules` existuje (což je
u root-workspace layoutu normální). Fix = root úroveň přeskočit (`nm === destNm`).
Postbuild padal už před nasazením — build se tedy musel obejít ručně.

## 5. Meze (poctivě)

- **UI jsem v prohlížeči neproklikal** — ověřené jsou API cesty proti živé DB
  a to, že stránka vrací 200. Admin rozhraní je klientské (vyžaduje session),
  takže screenshot by chtěl admin cookie.
- **Sync objednávek nebyl spuštěn** — 51 faktur a 4 platby čekají. Je to reálný
  účetní zápis, ne test; patří 👤.
- **Bez DPH** (neplátce) — žádný režim reverse charge v dokladech; to je F5.
- **Inventura = stavy účtů**, ne fyzická inventura majetku (ta zůstává ruční).
- **Žádné PDF** — rozvaha/VZZ/příloha a `DPPDP*` jsou F4.
- **Fio import a crypto loty (FIFO)** jsou F3 — peníze na cestě (261) ani
  krypto-inventarizace (159.9) se zatím nenaplňují automaticky.

## 6. Co dál

1. **F3** — Fio API import výpisů (read-only token), párování VS → objednávka,
   crypto lots.
2. **F4** — závěrka (rozvaha zkrácená + VZZ + příloha) → PDF, `DPPDP*` XML,
   ISDS SOAP klient (nejdřív test prostředí).
3. 👤 rozhodnutí: spustit sync existujících objednávek? (51 + 4)

---

**Souvisí:** [`UCETNICTVI-PLAN.md`](../../../UCETNICTVI-PLAN.md) ·
`apps/MarketPlace/src/lib/accounting.ts` · `apps/MarketPlace/deploy/deploy-marketplace.sh`
