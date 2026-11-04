# REPORT — Zion Archive: „Moje knihovna" + oprava deep-linku

**Datum:** 2026-11-04 · **Kód:** `apps/website-v2.9`

## 1. Moje knihovna (`#moje`)

Nová sekce hubu — osobní přehled bez serveru:

- **Přístup:** štítek aktivního passu (`kód / OASIS bonus / aktivní / do <datum>`) + odkaz na marketplace.
- **Rozečtené knihy:** všechny knihy s uloženým progresem, procenta, „Pokračovat" (deep-link na kapitolu),
  „Vymazat historii čtení".
- **Záložky:** všechny kapitolové záložky napříč knihami, mazání, skok.
- **Stažení / knihovna:** odkazy na `#stazeni` a `#knihovna`.

Data zůstávají v prohlížeči (`zion.archive.progress.v1`, `zion.archive.bookmarks.v1`); pass se čte
z `/api/archive/access`.

## 2. Oprava deep-linku (skutečná chyba)

Při **přímém načtení** `/zion-archive/nirvana/cist#01-Prvni-Paprsek` skončil reader na indexu
(`#00-README`): efekt, který synchronizuje URL s vybranou kapitolou, běžel dřív, než se aplikoval
příchozí hash, a přepsal ho indexem. Následek: sdílené odkazy, záložky i „Pokračovat" z jiné
stránky vedly na index.

**Fix:** URL se zapisuje jen po **uživatelské** změně kapitoly (`userNavigated` ref v `handleChapterSelect`,
klávesách a prev/next); příchozí hash se nikdy nepřepisuje při prvním renderu.

**Ověřeno:** fresh load `#01-Prvni-Paprsek` → URL zůstane, heading „První paprsek", TOC aktivní,
`localStorage` = `chapterSlug: 01-Prvni-Paprsek`, `totalChapters: 14`. E2E na to má nový test.

## 3. Poznámky

- Nákupní historie (co jsem koupil) z marketplace v `#moje` není — vyžaduje propojení s objednávkami
  marketplace (W6/W3 backlog).
- Screenshot: `/tmp/archive-moje-2.png`.
