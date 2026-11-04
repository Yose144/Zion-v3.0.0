# ZION ARCHIVE — plán kompletizace (Nirvana Hub)

> **Verze:** 1.0 · **Datum:** 2026-11-04 · **Vlastník:** 👤 · **Stav:** M0 hotové (hub 2.0), M1 startuje
> **Kanonický stav archivu:** [`docs/3.2/REPORTS/REPORT_2026-11-04_ZION_ARCHIVE_HUB.md`](../3.2/REPORTS/REPORT_2026-11-04_ZION_ARCHIVE_HUB.md)
> **Kód:** `apps/website-v2.9/src/app/zion-archive/**`, `src/lib/books/**`, `src/components/books/**`

## 0. Cíl a principy

**Cíl:** ZION Archive je kompletní, dvojjazyčná, placená knihovna ZION Terra Nova —
všechny knihy, všechny edice ke stažení, jeden reader, poctivé jazykové štítky a přístup
přes ZION Pass. Ne „web s pár texty", ale **archiv, který obstojí jako produkt**.

Principy, které platí pro každou práci:

1. **Jeden zdroj pravdy** — `BOOK_NAV` + `BOOKS` + `library.ts` → `library-index.ts`. UI nikdy
   neopisuje seznam knih ručně.
2. **Poctivost místo marketingu** — co není přeložené, je označené `CZ` / `CZ (+EN části)`;
   co není hotové, je `draft`; žádné „live" bez evidence.
3. **Gate na serveru** — obsah knih i soubory jdou jen přes `hasArchiveAccess()`; UI gate
   nikdy není jediná ochrana.
4. **Bez trackingu** — čtenářský postup zůstává v prohlížeči, dokud se 👤 nerozhodne pro
   opt-in synchronizaci přes ZIS.
5. **Každá změna má důkaz** — `tsc`, build, headless test, živá URL; měření místo dojmů.

---

## 1. Co existuje (audit k 2026-11-04)

| Vrstva | Stav | Poznámka |
|---|---|---|
| Přístup | ✅ | 3 cesty: `ARCHIVE_PASS_CODES`/marketplace kód, ZIS+OASIS, entitlement; cookie 90 dní, revalidace proti env |
| Lock page | ✅ 2.0 | výkladní skříň: staty, mřížka 18 knih, tři cesty, jak to funguje, co pass odemyká |
| Hub | ✅ 2.0 | hero se staty, pokračovací strip, sekce `cesta` / `knihovna` / `kniha` / `nirvana` / `plan-v33` / `souvislosti` |
| Knihovna | ✅ 2.0 | hledání bez diakritiky, filtry skupina + jazyk, karty s akcenty a progress barem |
| Readery | ✅ | 18 knih, společný `BookReader`, EN→CZ fallback s upozorněním, progress, `~N min`, ←/→ |
| Obsah | ⚠️ | 18 knih, ale EN parita jen u hlavní osy (viz §2) |
| Soubory ke stažení | ⚠️ | existuje jediný ZIP (Království srdce, 62 MB) — nyní nově v archivu |
| Entitlements | ✅ | `archive-entitlements.json`, admin API, vazba kódu na ZIS |
| E2E | ⚠️ | lock suite běží; hub suite je `describe.skip` (archiv za passem) |

---

## 2. Gap audit (co chybí do „kompletní archiv")

### 2.1 Obsah a jazyky

| Kniha | EN (kapitoly) | Priorita dopřekladu |
|---|---|---|
| Maitreya | **19/19** | hotovo |
| Nirvana | **14/14** | hotovo (QA) |
| NirvanaCloud | 2/8 | **P1** |
| Sůl této země | 0/12 | **P1** |
| Ekam Deeksha | 0/10 (EN jsou 401B stuby) | P1/P2 |
| Quantum Revolution | 0 (EN je 396B stub) | P2 |
| BodhiGaia | 0/13 | P2 |
| Issobella | 0/11 | P2 |
| Mise Amenti | 0/8 | P2 (rámec, ne román) |
| Lumi, Miriam, Růže, MariaCaminho, Na Cestě, Surta Srdce, Království srdce, Kruh Bohyní, Nabukano | 0 | P2/P3 dle 👤 |

> Měřeno auditem 2026-11-04: **204 kapitol, 189 překladatelných, 35 přeložených (18,5 %)**.
> Detail: [`REPORT_2026-11-04_ARCHIVE_W1_AUDIT.md`](../3.2/REPORTS/REPORT_2026-11-04_ARCHIVE_W1_AUDIT.md).

**Další mezery:**

- `00-README` se chová jako kapitola → v TOC i v progressu figuruje „Index" jako první
  kapitola (progress pak začíná na 1/15). Má být **front matter**, ne kapitola.
- Několik knih nemá vlastní „O knize" stránku (karty odkazují jen do readeru).
- Chybí jednotný seznam dodatků/glosářů napříč knihami.
- Cross-book odkazy v textech občas míří na interní cesty (renderované jako tlumený text).

### 2.2 Soubory a edice

- Jen jeden ZIP (Království srdce). Ostatní knihy nemají PDF/EPUB/ZIP.
- Soubory nejsou evidované v archivu (žádný katalog, checksum, datum verze).
- Chybí „Moje knihovna" — co jsem koupil, co mohu stáhnout, do kdy.
- Stahování nemá vlastní gate route (nově `/api/archive/downloads/[slug]`).

### 2.3 Čtení

- Chybí fulltextové hledání **uvnitř** knihy a napříč archivem.
- Chybí záložky, poznámky, oblíbené.
- Progress je jen lokální (bez synchronizace mezi zařízeními).
- Chybí nastavení čtečky (velikost písma, šířka sloupce, sepia/světlý režim).
- Chybí tisk/PDF z readeru a sdílení odkazu na kapitolu (deep-link existuje, chybí UI).

### 2.4 Objevování

- Kolekce/čtecí cesty („začni tady", „hlavní osa", „nebe", „země") existují jen jako skupiny.
- Chybí doporučení „co číst po této knize" na konci knihy.
- Chybí novinky archivu (nové kapitoly, nové překlady).

### 2.5 Přístup a obchod

- Nákup v marketplace **nevytváří entitlement automaticky** (dnes kód ZAP + ruční/B2B grant).
- Chybí expirace/revokace viditelná uživateli („pass platí do…").
- Chybí B2B seats (jeden účet org, více čtenářů).

---

## 3. Workstreams

### W1 — Obsahová kompletnost (P0)

- [x] Audit: každá kapitola v `BOOKS` má reálný soubor — `GET /api/archive/audit`
      (admin, registr vs. FS) + offline `scripts/ops/check-archive-content.mjs`;
      report [`REPORT_2026-11-04_ARCHIVE_W1_AUDIT.md`](../3.2/REPORTS/REPORT_2026-11-04_ARCHIVE_W1_AUDIT.md).
- [x] `00-README`/front matter vyloučeno z progresu (`BookReader`) — index zůstává v TOC,
      ale nepočítá se do „1 / N" ani do EN coverage.
- [x] Duplicity slugů a chybějící `parts` — audit hlásí 0/0 (204 kapitol, 15 front matter).
- [ ] Sjednotit číslování částí/kapitol a názvy v TOC napříč knihami.
- [ ] Doplnit chybějící dodatky/glosáře a odkazy „O knize".
- [ ] Link audit: interní reference renderovat jako odkaz, pokud cíl existuje.

**Hotovo, když:** 100 % kapitol se načte (200), žádná kniha nemá mrtvý TOC bod, progress
nezačíná na indexu.

### W2 — CZ/EN parita (P0/P1)

- [ ] Slovník pojmů (`docs/3.2/ARCHIVE-TRANSLATION-GLOSSARY.md`): mantra, jména, termíny;
      jednotné přepisy (sanskrt, místní názvy), zásada „neměnit citáty".
- [x] Poctivé štítky: falešná „CZ + EN" u Ekam/QR/korpusu odstraněna; stub překladu se
      v readeru pozná a spadne na češtinu (`isTranslationStub`).
- [ ] Tracking soubor `src/lib/books/en-coverage.json` (automaticky z auditu) — jeden zdroj
      pro štítky v knihovně i pro report (dnes: audit JSON + `korpusLangs`).
- [ ] P1 překlady: **Sůl této země**, **NirvanaCloud** (poslední 3/25 a 3/12 → 100 %).
- [ ] QA checklist pro každou přeloženou kapitolu: markdown parita, nadpisy, anchor slugy,
      odkazy, blokové citáty, tabulky, diakritika, žádné „strojové" vsuvky.
- [ ] U knih bez EN držet `CZ` štítek a fallback hlášku (už funguje).

**Hotovo, když:** každá kniha má v knihovně pravdivý štítek a P1 knihy jsou 100 % EN.

### W3 — Ke stažení a edice (P0, start hned)

- [x] Katalog `src/lib/books/downloads.ts` + panel `#stazeni` v hubu.
- [x] Gate route `/api/archive/downloads/[slug]` (pass → redirect na soubor; bez passu 403).
- [x] První položka: **Království srdce — kompletní edice** (8 edic × 5 jazyků = 40 knih,
      PDF + EPUB, ~62 MB).
- [x] Metadata: checksum SHA-256 + datum verze zobrazené v kartě (kopírování jedním klikem).
- [ ] „Moje knihovna": po zakoupení v marketplace vidět stažení + datum platnosti passu.
- [ ] Generovat PDF/EPUB/ZIP per kniha (`scripts/ops/build-book-bundle.py`), ukládat do
      `apps/MarketPlace/public/shop/downloads/` a registrovat v katalogu.
- [ ] Volitelně: signed URL s TTL (místo veřejné URL v marketplace), aby soubor nešel sdílet.

**Hotovo, když:** každá kniha má alespoň jeden formát ke stažení, katalog je jeden a stažení
jde jen s passem.

### W4 — Čtenářský zážitek (P1)

- [x] Fulltext v knize — hledání napříč kapitolami (fetch on demand, cache, kontextové snippety,
      klik = skok do kapitoly).
- [x] Záložky kapitol (localStorage, seznam v sidebaru, toggle v hlavičce).
- [x] Nastavení čtečky: velikost písma (S/M/L/XL), šířka sloupce, téma (tmavý/sépia/světlý) —
      lokálně, aplikované přes CSS třídy.
- [x] „Pokračovat" respektuje front matter a skutečný konec knihy.
- [ ] Na konci knihy: „Další kniha v pořadí" + „Souvisí" (z `library.ts`).
- [ ] Tisk/PDF aktuální kapitoly.

**Hotovo, když:** čtenář najde text, označí si místo, vrátí se po týdnu a pokračuje tam, kde skončil.

### W5 — Objevování a IA (P1)

- [ ] Kolekce: Hlavní osa / Srdce kompasu / Kořeny / Země / Horizont jako vizuální čtecí cesty.
- [ ] „Začni tady" (3 knihy pro nováčka) + „Co číst po…".
- [ ] Novinky archivu (nové kapitoly, překlady) — malý feed v hubu.
- [ ] Per-kniha cover art (statický webp) místo generované karty.

### W6 — Přístup, obchod, entitlementy (P0/P1)

- [ ] Marketplace purchase → automatický entitlement (webhook/`archive-pass.ts` už kód vydává;
      doplnit server-side grant `zis:` nebo e-mailový claim).
- [ ] UI stavu passu: „platí do", „navázáno na ZIS", „revokováno" + jak obnovit.
- [ ] B2B seats: org → N čtenářů, správa v admin API.
- [ ] Audit přístupů (kdo kdy odemkl) bez sledování čtení — jen auth eventy.

### W7 — Kvalita, ops, důkazy (P0)

- [ ] E2E: lock (běží), hub (přepnout ze `skip` na gated fixture s testovacím kódem),
      downloads (403 bez passu / 200 s passem), reader (progress, klávesy, EN fallback).
- [ ] Link audit v CI (`npm run check:links`) + content audit (W1).
- [ ] Performance: lazy loading knihoven, cache manifestů, bundle budget.
- [ ] A11y: focus management, klávesy, kontrast, `aria-current`, skip links.
- [ ] Monitoring: 5xx na `/api/archive/*`, počet 403 (míra zneužití), latence readerů.

### W8 — Obsahové balíčky (P2)

- [ ] Audio vybraných kapitol (Království srdce, Maitreya).
- [ ] Ilustrace/cover art.
- [ ] Marketingové překlady (perexy, anotace) pro marketplace.

---

## 4. Milníky

| # | Milník | Obsah | Stav |
|---|---|---|---|
| M0 | Hub 2.0 + pass UX | hero, knihovna, progress, lock page | ✅ 2026-11-04 |
| M1 | **Stažení** | katalog, gate route, Království srdce ZIP, karta v knihovně | 🔄 tento týden |
| M2 | Obsah + P1 překlady | W1 audit/fixy, Sůl této země + NirvanaCloud 100 % EN | ⏳ |
| M3 | Čtení | hledání v knize, záložky, nastavení, „co dál" | ⏳ |
| M4 | Obchod | auto entitlement, stav passu, B2B seats | ⏳ |

Každý milník = vlastní report v `docs/3.2/REPORTS/` + záznam v `apps/website-v2.9/AGENTS.md`.

---

## 5. Prioritní backlog (prvních 10 věcí)

1. ~~W3 — katalog stažení + gate route + Království srdce ZIP~~ ✅ 2026-11-04
2. ~~W1 — audit kapitol vs. soubory + report~~ ✅ 2026-11-04
3. ~~W1 — front matter (`00-README`) mimo progres~~ ✅ 2026-11-04
4. ~~W2 — pravdivé jazykové štítky + stub detekce~~ ✅ 2026-11-04
5. **W2** — dokončit EN u Sůl této země (12 kapitol) — první překladová dávka.
6. **W2** — dokončit EN u NirvanaCloud (6 kapitol).
7. **W2** — `en-coverage.json` generovaný z auditu (jeden zdroj pro UI i report).
8. ~~W4 — hledání v knize~~ ✅ 2026-11-04
9. ~~W4 — záložky + nastavení čtečky~~ ✅ 2026-11-04
10. **W6** — stav passu („platí do", vazba na ZIS) v lock page i hubu.
11. **W7** — e2e pro hub s testovacím passem + downloads.
12. **W4** — „další kniha v pořadí" na konci knihy + tisk/PDF kapitoly.

---

## 6. Rizika a meze

- **Kvalita překladu** — strojový překlad bez redakce je horší než poctivé `CZ`; každá dávka
  prochází QA (W2), jinak se nepublikuje.
- **Soubory v repu** — 65 MB ZIP v `public/` znamená deploy čas a místo; držet v marketplace
  a v archivu jen odkaz/gate.
- **Kód vs. marketing** — „kompletní archiv" nelze tvrdit, dokud W1/W2 neprojdou; štítky
  v knihovně musí odpovídat realitě.
- **Paralelní session** — deploy website běží ze stejného working tree; před deployem vždy
  zkontrolovat, že build prošel s cizími změnami, a nestageovat cizí soubory.

---

## 7. Definition of done — „archiv je kompletní"

1. Všech 18 knih má 100 % funkční TOC a žádnou mrtvou kapitolu.
2. Každá kniha má pravdivý jazykový štítek; P1 knihy jsou CZ + EN.
3. Každá kniha má alespoň jeden stažitelný formát; stažení je gateované a evidované.
4. Čtenář najde text (hledání), označí si místo (záložky) a vrátí se (progress).
5. Pass má viditelný stav, expiraci a cestu k obnovení; nákup vytváří entitlement sám.
6. E2E pokrývá lock, hub, downloads, reader; link audit je zelený.
7. Veřejná dokumentace zůstává otevřená; archiv chrání knihovnu, ne projekt.

---

## 8. Startovní dávka (2026-11-04)

- ✅ Panel **`#stazeni`** v hubu (bilingvní karty, formáty, jazyky, velikost, obsah).
- ✅ **Gated route** `/api/archive/downloads/[slug]` (bez passu 403, s passem redirect).
- ✅ **Království srdce — kompletní edice** (ZIP, 40 knih, 5 jazyků, PDF + EPUB).
- ✅ Karta knihy v knihovně dostala tlačítko stažení.
- ✅ Lock page zmiňuje stažení v „co pass odemyká".
- ✅ W1: audit registru (0 chybějících CS, 15 front matter), front matter mimo progres,
  stub detekce EN, opravené jazykové claimy.
- ✅ W2 start: knihovna/readery už nelžou o jazyce; další dávka = P1 překlady.
- ✅ W3: checksum SHA-256 u stažení (kopírování).
- ✅ W4: hledání v knize, záložky, nastavení čtečky (font/šířka/téma).
