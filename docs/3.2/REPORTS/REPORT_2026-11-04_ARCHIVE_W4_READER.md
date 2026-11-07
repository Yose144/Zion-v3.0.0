# REPORT — Zion Archive W4: čtenářský zážitek (hledání, záložky, nastavení) + W3 checksum

**Datum:** 2026-11-04
**Workstream:** W4 (čtení), doplněk W3 (metadata stažení)
**Kód:** `apps/website-v2.9` · **Plán:** [`docs/plans/ZION-ARCHIVE-COMPLETION.md`](../../plans/ZION-ARCHIVE-COMPLETION.md)

---

## 1. Co je nové

### 1.1 Hledání v knize (fulltext)

- Vstup v sidebaru readeru (desktop i mobilní menu), aktivní od 3 znaků, debounce 450 ms.
- Prohledává **všechny kapitoly knihy** (front matter vynechán), načítá je on-demand
  s concurrency 6 a cachuje v paměti session — opakované hledání je okamžité.
- Respektuje EN režim: když je EN soubor stub, hledá v českém textu (stejná logika jako reader).
- Výsledek = kapitola + kontextový snippet (markdown očištěný, ~90 znaků okolí), klik otevře kapitolu.
- Prázdný stav „Nic nenalezeno", stav „Hledám…".

### 1.2 Záložky kapitol

- `src/lib/books/bookmarks.ts` — localStorage `zion.archive.bookmarks.v1`, max 300 položek,
  event + `storage` listener (jiná záložka prohlížeče).
- Tlačítko **Záložka** v hlavičce kapitoly (toggle, `aria-pressed`), seznam záložek knihy
  v sidebaru (klik = skok, X = odebrat).
- Záložka je kapitola (ne pozice scrollu) — kapitola má stabilní hash, takže je vždy dohledatelná.

### 1.3 Nastavení čtečky

- `src/lib/books/reader-settings.ts` — localStorage `zion.archive.reader.v1`:
  - **velikost písma** S / M / L / XL (`reader-size-*`),
  - **šířka sloupce** úzká / normální / široká (`max-w-2xl` / `3xl–4xl` / `5xl`),
  - **téma** tmavý / sépia / světlý (`reader-theme-*`), včetně override barev nadpisů,
    odkazů, citací a kódu v `globals.css`.
- Popover „Čtečka" v hlavičce, zavírá se kliknutím mimo a Escape, `aria-haspopup="dialog"`.
- Vše lokálně, bez účtu.

### 1.4 Kontrolní součet stažení (W3)

- Karta stahování nově nese **SHA-256** (`6bce6c14…`), datum verze a tlačítko kopírování
  ( clipboard, potvrzení ✓ ).
- Hodnota je z reálného souboru v marketplace (62 250 857 B), ne odhad.

---

## 2. Ověření (headless Chromium)

- záložka: klik → `localStorage` obsahuje `nirvana:01-Prvni-Paprsek`, seznam „Záložky · 1" viditelný;
- nastavení: klik XL + Široká + Sépia → `{"font":"xl","width":"wide","theme":"sepia"}`,
  v DOM `reader-theme-sepia` ×1, `.zion-docs-prose.reader-size-xl` ×1, `.max-w-5xl` ×1;
- hledání „Ararat" v Nirvaně → **6 výsledků** se snippety, klik otevře kapitolu;
- checksum v panelu `#stazeni` viditelný;
- 0 chyb v konzoli (mimo přechodného 500 při regeneraci `doc-manifest.json` v dev režimu;
  produkční build je prerenderovaný a neprojevil se).

Screenshoty: `/tmp/archive-reader-settings.png`, `/tmp/archive-reader-search.png`,
`/tmp/archive-downloads-checksum.png`.

---

## 3. Meze a další kroky

- Hledání **nezvýrazňuje** nalezený text v kapitole (skok na kapitolu, ne na přesný odstavec).
- Záložky jsou jen kapitoly; poznámky k textu nejsou.
- Téma mění obsah knihy, ne chrome readeru (hlavička/sidebar zůstávají tmavé).
- Další dávka W4: „další kniha v pořadí" na konci knihy, tisk/PDF kapitoly.
- W3: „Moje knihovna" (co jsem koupil / do kdy), SHA-256 i pro další edice.
- W6: stav passu, auto entitlement z nákupu.
- W7: e2e pro hub s testovacím passem, downloads a reader funkce.
