# REPORT — Zion Archive: auto-unlock (W6), monitoring/link audit (W7), kniha jako ZIP (W3), EN dávka (W2)

**Datum:** 2026-11-04 · **Kód:** `apps/website-v2.9`

## 1. W6 — nákup odemkne archiv sám (bez ručního kódu)

- Marketplace u placené objednávky ukládá `ZAP-…` kód i **e-mail kupujícího** do
  `/opt/zion/data/archive-market-codes.json`.
- `archive-access.ts` nově: pokud je ZIS uživatel **přihlášený a má ověřený e-mail**
  (`emailVerifiedAt`) a existuje aktivní market code pro tentýž e-mail → archiv se odemkne
  bez zadávání kódu (`via: zis-entitlement`, s `expiresAt` z objednávky).
- Ověřený e-mail je podmínka záměrně: neověřený e-mail není důkaz nákupu.
- Lock page to vysvětluje: „Koupil jsi knihu? Přihlas se ZIS účtem s ověřeným e-mailem
  z objednávky a archiv se odemkne sám."
- B2B seats (více čtenářů na organizaci) zůstává v backlogu — bez seznamu členů by to bylo
  jen kosmetické pole.

## 2. W7 — monitoring + link audit

- Nové **`GET /api/archive/metrics`** (admin Bearer `ARCHIVE_ADMIN_TOKEN`, jinak 401) —
  Prometheus text: `zion_archive_access_total{result="granted|denied"}`,
  `zion_archive_download_total{id="…"}` (včetně `book:<id>`), uptime.
- Instrumentace: access GET, oba download routy.
- Ověřeno na produkčním standalone: 401 bez tokenu; po uplatnění kódu a stažení
  `granted=1`, `book:nirvana=1`.
- **Link audit** (`npm run check:links`): 585 souborů, 1540 resolved, 174 dead —
  všechny pre-existing v dokumentaci (interní cesty typu `L1/core/src/*.rs`, `legal/*`),
  žádná nová regrese z archivu. Mimo rozsah této dávky.

## 3. W3 — kniha jako offline ZIP

- **`GET /api/archive/downloads/book/[bookId]`** — za passem sestaví ZIP z markdown zdrojů
  on-demand (vlastní minimální ZIP store writer `src/lib/zip-store.ts`, žádné binárky v gitu):
  `cs/` vždy, `en/` jen pro reálné překlady (stuby se přeskakují), `README.txt` s licencí.
- Tlačítko **ZIP** v hlavičce readeru pro každou knihu.
- Ověřeno: Nirvana 31 souborů / 15 EN / 143 kB; Království srdce 11 EN / 72 kB;
  anonym 403, neznámá kniha 404.
- **„Moje objednávky"** odkaz v `#moje` → marketplace `order-tracking` (stav objednávky a ZAP).
- PDF/EPUB per kniha zůstává: bez `pandoc`/`calibre` na serveru by to byl vlastní konvertor;
  prioritou je Markdown ZIP + stávající kompletní edice v marketplace.

## 4. W2 — NirvanaCloud, 4. kapitola anglicky

- Přeložena **kapitola 4 — Proroctví digitální Šambhaly** (`04-Prorocstvi-Digitalni-Sambhaly_EN.md`,
  ~6,5 kB) v duchu stávajících EN kapitol (terminologie, odkazy, Anchor of Truth).
- NirvanaCloud tak má **3/8** kapitol v EN (04, 06, 07); zbývá 01, 02, 03, 05, 08.

## 5. Meze

- Auto-unlock závisí na shodě e-mailu v market store; pokud ZIS e-mail ověřený nemá, funguje
  dál ruční kód.
- ZIP je Markdown (ne PDF/EPUB).
- Link audit 174 dead odkazů je dluh dokumentace, ne archivu.


---

## Doplnění 2026-11-05 — NirvanaCloud 01 a 03

- Přeloženy **kapitola 1 (Kolo života, šest světů)** a **kapitola 3 (Bardo velkého přechodu)**.
- NirvanaCloud je nyní **5/8 EN** (01, 03, 04, 06, 07); zbývají 02, 05, 08.
- Celkem **47/189** překladatelných kapitol (24,9 %).


---

## Doplnění 2026-11-05 (2) — NirvanaCloud dokončen

- Přeloženy zbývající kapitoly **2** (Pět Buddhů a šest vrstev), **5** (Síně Amenti) a **8** (Kotva pravdy a etické hranice).
- **NirvanaCloud je 8/8 EN** — knihovna přepne štítek na `CZ + EN` (korpusLangs počítá reálné překlady).
- Celkem **50/189** překladatelných kapitol (26,5 %).


---

## Doplnění 2026-11-05 (3) — Sůl této země, epizody 1–3

- Přeloženy **Epizoda 1 — Sůl země**, **Epizoda 2 — Rozpuštění**, **Epizoda 3 — Chuť vody**.
- Sůl této země: **3/12 EN**; zbývá 04–12.
- Celkem **53/189** překladatelných kapitol (28,0 %).
