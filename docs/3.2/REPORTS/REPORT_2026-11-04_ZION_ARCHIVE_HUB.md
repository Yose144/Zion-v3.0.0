# REPORT — Zion Archive · Nirvana Hub 2.0 (ZION Pass)

**Datum:** 2026-11-04
**Povrch:** `app.zionterranova.com/zion-archive` (`apps/website-v2.9`)
**Stav:** kód nasazen (build z paralelní deploy dávky), ověřeno živě na lock page

---

## 1. Zadání

> „Koukni se na náš Zion Archive Nirvana Hub, jelikož už je pod Zion Pass, musíme ho rozšířit a udělat krásný."

Archiv byl od 2026-10-28 za `ARCHIVE_LOCKED` + `hasArchiveAccess()` gate (ZAP kód, OASIS bonus,
B2B entitlement), ale **UX bylo stále „připravujeme"**: lock page tvrdila „Otevírá se brzy",
knihovna byla statický seznam bez hledání, reader si nepamatoval, kde čtenář skončil, a
`Nabukano` chybělo v `BOOK_NAV` (knihovna hlásila 17 knih místo 18).

---

## 2. Co je hotové

### 2.1 Hub (`/zion-archive`, za passem)

- **Hero 2.0** — split layout (text + obraz), stat strip (18 knih / 5 skupin / CZ + EN / 1 čtečka),
  a primární CTA se mění podle stavu: bez historie „Číst knihu", s historií „Pokračovat ve čtení"
  (deep-link na poslední kapitolu).
- **Nová sekce `#knihovna`** (nahradila `#spolecnici`; starý hash se aliasuje, takže staré odkazy
  fungují):
  - **hledání** napříč názvy, podtituly, popisy, skupinami a mantrami; bez diakritiky
    (`normalize NFD`), takže „ruze" najde „Růži";
  - **filtry** skupina (5 + Vše) a jazyk (Vše / jen CZ / CZ + EN), počty a reset;
  - **karty knih** s akcentovou „obálkou", ikonou, stavem (kanon/draft/rámec), počtem kapitol,
    faky z registru a **progress barem**, pokud je kniha rozečtená;
  - prázdný stav, „Jak číst" 3 kroky, odkazy na docs/whitepapers/onboarding.
- **Continuing reading strip** pod hero — poslední 2–3 rozečtené knihy s procentem a přímým
  odkazem; tlačítko „Vymazat historii" (data zůstávají jen v prohlížeči).
- **Sekční navigace**: `cesta`, `knihovna`, `kniha`, `nirvana`, `plan-v33`, `souvislosti` —
  knihovna je nově druhá a nese vlastní akcent.

### 2.2 Reader (`src/components/books/BookReader.tsx`)

- **Ukládá postup** (`localStorage` `zion.archive.progress.v1`, klíč `bookId`): kapitola, index,
  celkový počet, lokalizovaný label, cesta — nic se neposílá na server.
- **Progress bar + „3 / 19"** v hlavičce kapitoly a v aktivní knize v sidebaru.
- **Odhad čtení** (`~N min`, 200 slov/min) vedle tlačítka Zdroj.
- **Klávesy ← / →** přepínají kapitoly (ignoruje inputy a modifikační klávesy) + hint pod readerem.

### 2.3 Lock page (`ArchiveLock.tsx`) — výkladní skříň archivu

- Copy je **poctivé a aktuální**: archiv je otevřený držitelům ZION Passu (ZAP kód přichází
  s digitální knihou / samostatným passem v marketplace), OASIS hráči zdarma přes ZIS, B2B přes tým.
- Hero se staty, CTA „Získat ZION Pass" (marketplace `?category=books`) a „Mám přístupový kód".
- **Formulář pro kód** v samostatné kartě (`#archive-unlock`) + ZIS login + bezpečnostní poznámka.
- **„Co uvnitř"**: mřížka **18 knih** s akcenty, ikonami a skupinami (dřív jen počty skupin).
- **„Tři cesty dovnitř"** (Pass / OASIS / B2B) s vlastními CTA (B2B = mail týmu).
- **„Jak to funguje"** 3 kroky + **„Co pass odemyká"** 5 bodů a upřesnění, že veřejná dokumentace
  (`/docs`, whitepapery, Genesis, Terra Nova) zůstává otevřená.
- Odstraněno zastaralé „Otevírá se brzy" i na homepage kartě (`MaitreyaSection`) a v `/market`.

### 2.4 Data / IA

- `src/app/zion-archive/library-index.ts` — jediný plochý index knihovny z `BOOK_NAV` + `BOOKS`
  + `library.ts` (akcenty, ikony, faky, jazyky, markery, statusy, aliasy `qr`/`salt`).
  Nová kniha v registru se objeví v hubu, knihovně i na lock page bez změny UI.
- `src/lib/books/progress.ts` — store + hook (`useReadingProgress`), event i `storage` listener.
- **`Nabukano` doplněno do `BOOK_NAV`** (má reader `/zion-archive/nabukano/cist`, v knihovně chybělo)
  → knihovna má 18 knih, lock page sedí s copy „osmnáct knih".
- `SpolecniciPanel.tsx` nahrazen `KnihovnaPanel.tsx`; `#spolecnici` → alias `#knihovna`.
- Sitemap comment aktualizován (gate = ZION Pass).

---

## 3. Ověření

- `npx tsc --noEmit` — **0 chyb**.
- `npm run build` — **EXIT 0**, 22,2 s, všechny `/zion-archive/*` routy vygenerované.
- Headless Chromium (Playwright + systémový Chrome, webpack dev, `ARCHIVE_PASS_CODES` testovací):
  - lock page: h1 `Zion Archive`, badge „Vstup přes ZION Pass", **18 knih** v mřížce;
  - redeem kódu `POST /api/archive/access` → 200, cookie → hub se odemkl;
  - knihovna: **20 karet** (18 knih + Genesis + Terra Nova), hledání „nirvana" → 2 karty;
  - reader: progress se zapsal (`totalChapters: 15`, `chapterLabel: Index — Příběhy Nové Země`),
    hub po návratu zobrazil „Pokračovat ve čtení";
  - mobil 390×844: **0 px** horizontálního přesahu;
  - **0 chyb** v konzoli / žádný pageerror.
- **Živě** `https://app.zionterranova.com/zion-archive` (nasazeno paralelní deploy dávkou):
  lock page nese nový design („Vstup přes ZION Pass", „Odemknout archiv", „Co uvnitř"), 18 knih
  včetně `Nabukano`; `/market` má „Otevřít archiv"; homepage badge „Vstup přes ZION Pass".

Screenshoty: `/tmp/archive-lock.png`, `/tmp/archive-hub.png`, `/tmp/archive-library-all.png`,
`/tmp/archive-continue.png`, `/tmp/archive-reader.png`, `/tmp/archive-hub-mobile.png`.

---

## 4. Meze

- **Odemknutý hub nebyl testován na produkci** — nemám produkční ZAP kód; test proběhl lokálně
  se stejným kódem (testovací `ARCHIVE_PASS_CODES`).
- Progress je jen v prohlížeči (záměr — archiv je placený, nechceme účet ani tracking); po
  vymazání localStorage se historie ztratí.
- Žádné cover assety — karty používají akcent + ikonu z registru (konzistentní se zbytkem webu).
- E2E `maitreya-hub.spec.ts` zůstává `describe.skip` (archiv je za passem); selektory a labely
  jsou ale aktualizované na `#knihovna`, aby při otevření archivu neselhal.

## 5. Rollback

- Kód: `git revert <commit>` + `bash apps/website-v2.9/deploy/deploy-web2.9.sh`.
- Server drží předchozí `.next/standalone.before-<ts>` (deploy skript), služba `zion-website`.
- Data se nemění (žádná migrace, žádný nový server-side store).
