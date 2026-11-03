# OMNITY ÚČETNICTVÍ — plán vlastního účetního systému

> **Datum:** 2026-11-02
> **Subjekt:** Omnity.One s.r.o. (IČO 09120050, FÚ Ústí nad Orlicí, DS `ebz4tpd`, KS HK `C 45723/KSHK`)
> **Profil:** **neplátce DPH, bez zaměstnanců** → filing surface = DPPO + závěrka **1× ročně**
> **Rozhodnutí:** implementace přímo v `apps/MarketPlace` (admin + API + Prisma) — ne samostatná app.
> **Motivace:** vlastní data v naší DB, crypto ledger (wZION/ZION/fio) nativně, náhrada Trivi sync, přímé e-podání úřadům.

---

## 1. Co ze zákona musíme (a co ne)

| Povinnost | Frekvence | Stav |
|---|---|---|
| Podvojné účetnictví (zákon 563/1991 Sb.) — deník, hlavní kniha, účtový rozvrh, inventury | průběžně | **F1–F2 tohoto plánu** |
| DPPO přiznání `DPPDP*` (21 %, povinně elektronicky — držitel DS) | 1× ročně, do 4. 5. | F4 |
| Účetní závěrka → sbírka listin (mikro jednotka = zkrácená rozvaha + příloha) | 1× ročně, do 12 měs. | F4 — přes § 21b předání správcem daně (zdarma) |
| Zálohy na daň | jen pokud předchozí daň > 30 tis. | platba, ne podání |
| Přiznání k DPH jako identifikovaná osoba (IO) — jen měsíce s nákupem služeb ze zahraničí | podle potřeby | F5 |
| ~~DPHDP3/DPHKH1/DPHSHV~~, ~~mzdy/ČSSZ/VZP~~, ~~EET~~ | — | neplátce + bez zaměstnanců |

**Žádná certifikace účetního SW v ČR neexistuje.** Zákon požaduje jen průkazné účetní záznamy (§ 4–11 ZoÚ): označení dokladu, obsah případu + účastníci, částka, okamžik vyhotovení + uskutečnění, podpisové záznamy.

**Archivace:** závěrka 10 let, doklady/knihy/rozvrh 5 let, daňové doklady 10 let. Elektronická forma povolená — podmínky čitelnost + neporušenost + věrohodnost.

## 2. Komunikační kanály s úřady (vše zdokumentované, zdarma)

| Úřad | Kanál | Formát | Pozn. |
|---|---|---|---|
| Vše přes **ISDS** | SOAP 1.1/1.2 WS (`dm_operations.wsdl` WSDL 3.x, `ws*.mojedatovaschranka.cz`) | datová zpráva + přílohy | veřejné test prostředí existuje |
| Finanční správa | DS `ebz4tpd` → adresa podatelny FÚ ÚnO; nebo EPO app s ověřenou identitou | **XML dle zveřejněných XSD** (`adisspr.mfcr.cz`, verze z 11. 8. 2026) | `DPPDP*` = DPPO |
| Sbírka listin | § 21b — předá správce daně **automaticky s DPPO** (zadarmo) | PDF do 10 MB | alternativně DS soudu / ePodatelna WS (justice.cz SOAP) |

## 3. Skryté pasti (hlídat bez ohledu na systém)

1. **Identifikovaná osoba (IO):** nákup služeb ze zahraničí (VAST.ai US, Stripe IE, hosting, SaaS) → povinnost registrace IO + podání přiznání k DPH za dané měsíce (reverse charge, § 108). KH se nepodává. **Ověřit aktuální registraci!**
2. **Odměna jednatele:** smlouva o výkonu funkce s odměnou = zdanitelný příjem → najednou mzdová agenda. Bez odměny nic. Podíl na zisku = srážková daň 15 % (vyúčtování jen při výplatě).
3. **B2C digitální prodeje do EU:** e-služby spotřebitelům → místo plnění země zákazníka → teoreticky OSS-NEU registrace i jako neplátce. Pokud prodej jen CZ/B2B, irelevantní — **k ověření**.
4. **Crypto účetnictví:** CZ GAAP = historická cena, žádné přecenění na tržní (jen opravné položky dolů). MF ČR stanovisko: krypto jako zásoby (sk. 1). Politika inventarizace (FIFO vs vážený průměr) = rozhodnutí, zafixovat v příloze závěrky.
5. **První rok provozu vlastního systému → externí daňař review DPPO + závěrky před odesláním.**

## 4. Architektura

```
ShopOrder/Invoice (DB má už teď) ──┐
Crypto payments (zionpay, wZION) ──┤──► posting engine ──► LedgerEntry(+lines)
Fio banka API (IBAN CZ63 2010…) ───┘         │
ManualEntryForm (náklady, banka, kasa) ──────┘
                                             ▼
                              LEDGER (podvojné, vyhl. 500/2002)
                                             │
        ┌──────────────┬─────────────────────┼─────────────────┐
        ▼              ▼                     ▼                 ▼
   Deník + HL    Obratová předvaha    Závěrka (rozvaha     EPO XML gen
   (účetní knihy) (kontrola MD=D)     zkr. + VZZ + příloha) (DPPDP*, DPHDP3-IO)
                                            │                   │
                                            ▼                   ▼
                                       PDF export          ISDS SOAP klient
                                       → sbírka listin     → DS ebz4tpd
                                       (§21b přes FÚ)      → FÚ / soud
```

**Kde:** `apps/MarketPlace` — `src/lib/accounting/`, `src/app/admin/accounting/`, `src/app/api/admin/accounting/`. Auth: existující `requireAdminAuth`. DB: Prisma/Postgres.

## 5. Datový model (Prisma)

```
LedgerAccount   code, name, class(0-6), synthetic?, active, system
LedgerEntry     entryNumber "U-2026-0001", date, description,
                documentRef?, sourceType(order|invoice|manual|bank), sourceId?,
                period(rok), postedBy?
LedgerEntryLine entryId→LedgerEntry, accountCode, side(MD|DAL), amountHal(Int haléře)
```

Pravidla: suma MD = suma DAL per entry (server vynutí); číslování dokladů sekvenční per rok; `sourceType+sourceId` idempotence při auto-postingu.

## 6. Seed účtového rozvrhu (vyhl. 500/2002, podmnožina)

`112 Materiál, 131 Zboží v prodejně, 132 Zboží na skladě, 139 Zboží-méněcenné? , 118 Crypto-inventory (interní účet — viz §3.4)`
`211 Pokladna, 221 BÚ (Fio), 261 Peníze na cestě, 311 Odběratelé, 314 Poskytnuté zálohy, 315 Ostatní pohledávky, 321 Dodavatelé, 325 Ostatní závazky`
`341 Daň z příjmů, 342 Ostatní daně, 343 DPH (IO režim), 349 Rozvázané? , 381 Náklady příštích období, 383 Výnosy příštích období`
`411 Základní kapitál, 421 Zákonný rezervní fond, 428 Nerozd. zisk min. let, 431 VH běžného roku`
`501 Spotřeba mat., 504 Prodané zboží, 511 Opravy, 512 Cestovné, 518 Ostatní služby, 527 Zák. soc. náklady, 538 Ostatní daně/poplatky, 543 Ostatní provozní náklady, 544 Sankce, 551 Odpisy, 591 Daň z příjmů`
`601 Tržby za zboží, 602 Tržby ze služeb, 604 Tržby za materiál, 648 Ostatní provozní výnosy, 668 Ostatní finanční výnosy`

Přesný seznam = seed v `src/lib/accounting/coa.ts`, rozšiřitelný.

## 7. Auto-posting pravidla (fáze 1)

| Událost | MD | DAL |
|---|---|---|
| Faktura vystavena (objednávka s fakturou) | 311 Odběratelé | 602/601 podle položek |
| Platba přijata (bank/card/crypto → BÚ/kasa) | 221 (banka/card), 211/261 (crypto do doby převodu) | 311 |
| Zrušení objednávky s fakturou | storno entry (záporné částky, cross-ref) | |
| Manuální doklad | libovolně (form validuje MD=DAL) | |

## 8. Fáze

- **F1 — ledger MVP:** schema, COA seed, posting engine, deník/HL UI, manuální doklad, sync-orders (idempotentní), obratová předvaha. *← hotovo 2026-11-02*
- **F2 — výstupy:** export deníku CSV, hlavní kniha per účet, inventurní soupis stavů, doklady-k-návaznosti (Invoice↔Entry linky). *← hotovo 2026-11-03*
- **F3 — banka + crypto:** Fio API import výpisů (token read-only), auto-párování VS→objednávka; crypto lots (FIFO) ledger.
- **F4 — year-end:** rozvaha zkr. + VZZ + příloha → PDF; `DPPDP*` XML gen per XSD; ISDS SOAP klient (test env nejdřív); §21b příloha.
- **F5 — IO režim:** `DPHDP3` generátor (jen nákupy služeb ze zahraničí), registrace-IO checklist.
- **F6 — archiv + audit stopa:** WORM export ročního balíku (doklady+knihy+závěrka), hash manifest.

## 9. Definition of done (F1) — stav 2026-11-02

- [x] Schéma: `LedgerAccount`/`LedgerEntry`/`LedgerEntryLine` v `prisma/schema.prisma` — `prisma validate` ✓, klient vygenerován
- [x] `npx prisma db push` na EDGE2 — **hotovo 2026-11-03** (`migrate diff` = jen CREATE TABLE/INDEX/FK, žádný DROP)
- [x] Manuální doklad odmítne nevyvážený zápis (MD≠DAL), <2 řádky, záporné částky — ověřeno tsx testem (validace před DB)
- [x] `sync-orders` idempotentní (`sourceType+sourceId` lookup před vytvořením); faktury → 311/602|604, platby → 221/159.9/311, zrušené → storno
- [x] Obratová předvaha v `/api/admin/accounting/balance` (MD=DAL kontrola v response)
- [x] Admin UI `/admin/accounting` (předvaha, deník, form dokladu, seed+sync tlačítka); nav „Účetnictví"; cs/en překlady
- [x] `typecheck` čistý; eslint nových souborů čistý (2 chyby v `layout.tsx` pre-existing)
- [x] Live ověření proti DB — **2026-11-03**: seed 71 účtů, doklad `U-2024-0001` zaúčtován, předvaha `MD=DAL`

## 9b. Definition of done (F2) — stav 2026-11-03

- [x] Hlavní kniha per účet — `generalLedger()` + `/api/admin/accounting/ledger`; počáteční stav z předchozích období, průběžný zůstatek, obraty, konečný stav
- [x] Inventurní soupis stavů — `inventoryReport()` + `/api/admin/accounting/inventory`; aktiva/závazky/kapitál/VH + kontrolní rozdíl (aktiva − pasiva − VH = 0)
- [x] Doklady a návaznosti — `documentsWithLinks()` + `/api/admin/accounting/documents`; Entry ↔ Invoice/Order linky a počet nezaúčtovaných dokladů
- [x] CSV export deníku, hlavní knihy i inventury — `/api/admin/accounting/export` (středník, desetinná čárka, UTF-8 BOM pro Excel)
- [x] UI: pět záložek v `/admin/accounting` + export respektující aktivní záložku; cs/en překlady
- [x] Oprava `flatten-standalone.mjs` (root `node_modules` sám do sebe → `ERR_FS_CP_EINVAL`)
- [x] Ověřeno live na produkční DB (opening carry-forward, kontrolní rozdíl 0, CSV, 401 bez klíče)
- [ ] Sync existujících objednávek (51 faktur + 4 platby) — **rozhodnutí 👤**, je to reálný zápis

## 10. Později / rozhodnutí pro 👤

- FIFO vs vážený průměr pro crypto inventarizaci
- Založit účetní rok 2027 čistými stavy (Trivi doběhne 2026) nebo dovztahovat 2026
- IO registrace — je/není, nákupy ze zahraničí inventura
- Externí daňař review scope (1×/rok, před DPPO)

---
*Souvislosti: `apps/MarketPlace/DEPLOY.md`, `src/lib/company.ts` (Omnity.One identity), master `PLAN.md` §3.*
