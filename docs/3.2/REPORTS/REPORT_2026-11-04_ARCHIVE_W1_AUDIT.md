# REPORT — Zion Archive W1: audit obsahu + front matter + poctivé jazykové štítky

**Datum:** 2026-11-04
**Workstream:** W1 (obsahová kompletnost), začátek W2 (CZ/EN poctivost)
**Kód:** `apps/website-v2.9` · **Plán:** [`docs/plans/ZION-ARCHIVE-COMPLETION.md`](../plans/ZION-ARCHIVE-COMPLETION.md)

---

## 1. Co bylo cílem

Ověřit, že každá kapitola deklarovaná v registru má reálný soubor, najít mrtvá místa a
**říct pravdu o jazykové pokrytí** (dosud se „CZ + EN" tvrdilo i u knih, které měly jen
krátkou anglickou poznámku místo překladu).

---

## 2. Nástroje (nové, opakovaně použitelné)

### 2.1 `GET /api/archive/audit` (admin-only)

- ověřuje **registr vs. soubory**: pro každou knihu projde `book.docPath(slug, {cs,en})`,
  zmapuje cestu na `archive-content/` nebo `public/docs/` a zkontroluje existenci,
- detekuje **stuby překladu** (soubor < 1 500 B s „language note" není překlad),
- hlásí chybějící CS/EN, duplicitní slugy, chybějící `parts`, front matter,
- chrání `ARCHIVE_ADMIN_TOKEN` (Bearer; bez tokenu 401, fail-closed),
- read-only, vrací jen počty a slugy (žádný obsah).

### 2.2 `apps/website-v2.9/scripts/ops/check-archive-content.mjs`

- offline audit stromů (`archive-content/**`, `public/docs/**`): prázdné soubory,
  duplicitní číselné prefixy (ignoruje vícenásobné `00-*` front matter), aux dokumenty,
  EN soubory,
- `--json` výstup, exit 1 při prázdném souboru nebo duplicitě,
- spustitelné v CI bez serveru.

---

## 3. Výsledek registr vs. soubory (2026-11-04)

`ok: true` — **0 chybějících CS kapitol, 0 duplicit, 0 chybějících částí.**

| Kniha | Kapitol | Z toho překladatelných | EN |
|---|---:|---:|---:|
| Maitreya | 19 | 19 | **100 %** |
| Nirvana | 15 | 14 | **100 %** |
| NirvanaCloud | 9 | 8 | 25 % |
| Ostatních 15 knih | 161 | 148 | **0 %** |
| **Celkem** | **204** | **189** | **35 / 189 (18,5 %)** |

- **15 front matter** souborů (`00-README` v 15 knihách) — nejsou kapitoly, nepočítají se
  do progresu ani do EN coverage.
- `quantum-revolution` je single-doc: CS má 10 kapitol, EN soubor je jen stub.
- Plný JSON: [`archive-content-audit-2026-11-04.json`](./archive-content-audit-2026-11-04.json).

---

## 4. Nálezy a opravy

### 4.1 Falešné „CZ + EN" claimy (W2, opraveno)

| Kde | Bylo | Je |
|---|---|---|
| Ekam Deeksha (kicker + fakt) | CZ + EN | **CZ** — 35 EN souborů jsou 401B stuby („language note") |
| Quantum Revolution (kicker + fakt) | CZ + EN | **CZ** — EN dokument je 396B stub |
| Nirvana (kicker + fakt) | CZ (+EN index) | **CZ + EN** — 14/14 kapitol reálně přeloženo |
| Sůl této země | CZ + EN | **CZ (+EN index)** — EN existuje jen jako index README |
| BodhiGaia, Issobella, Mise Amenti | CZ + EN | **CZ (+EN index)** |
| NirvanaCloud | CZ + EN | **CZ (+EN části)** — 2 z 8 kapitol |

### 4.2 Stub překladu uživatele nepodrazí

- `BookReader` rozpozná stub (< 1 500 B + „language note") a **automaticky načte český text**
  s viditelným upozorněním „English translation is in progress" — týká se Ekam i Quantum
  Revolution v EN režimu místo dřívějšího zobrazení 400B poznámky.
- `korpusLangs` už nepočítá `_EN` soubory front matter a aux dokumentů (Onboarding, CHANGELOG),
  takže štítky v knihovně nejsou nafouknuté.

### 4.3 Front matter mimo progres (W1)

- `00-README` (Index) zůstává v TOC, ale **nezapisuje se do progresu** a nezobrazuje
  „1 / N" — progress začíná prvním skutečným textem.
- Ověřeno headless: otevření indexu → `localStorage` prázdné; první epizoda Nirvany →
  `totalChapters: 14`, counter **1 / 14**.
- `readingPct`, sidebar counter i „Pokračovat" používají stejný přepočet.

---

## 5. Ověření

- `npx tsc --noEmit` — 0 chyb.
- Audit endpoint (lokálně, `ARCHIVE_ADMIN_TOKEN`): `ok: true`, 18 knih, 204 kapitol.
- Headless Chromium: front matter nezasahuje do progresu, EN fallback u Ekam/QR bez stub
  poznámky, 0 chyb v konzoli.
- `check-archive-content.mjs`: 26 adresářů, 368 md, **0 prázdných**, 0 duplicit.

---

## 6. Co zůstává (další dávky)

1. **W2 P1 překlady:** Sůl této země (12 kapitol) a NirvanaCloud (6 zbývajících) — postupně
   po kapitolách, s QA (markdown parita, odkazy, diakritika).
2. W1: dodatky/glosáře a odkazy „O knize" u knih bez landing page.
3. W3: checksum/verze stažených edic, „Moje knihovna", PDF/EPUB per kniha.
4. W4: hledání v knize, záložky, nastavení čtečky.
5. W6: stav passu + auto entitlement z nákupu.

**Re-run auditu:**

```bash
# offline (bez serveru)
node apps/website-v2.9/scripts/ops/check-archive-content.mjs --json /tmp/audit.json

# registr vs. soubory (dev server s tokenem)
ARCHIVE_ADMIN_TOKEN=... npx next dev -p 3123
curl -H "Authorization: Bearer ..." http://127.0.0.1:3123/api/archive/audit | jq
```
