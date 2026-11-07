# REPORT — Zion Archive W6 (stav passu) + W7 (e2e hubu)

**Datum:** 2026-11-04
**Kód:** `apps/website-v2.9` · **Plán:** [`docs/plans/ZION-ARCHIVE-COMPLETION.md`](../../plans/ZION-ARCHIVE-COMPLETION.md)

---

## 1. W6 — stav passu

- `ArchiveAccess` nově nese `expiresAt` (z entitlementu); `GET /api/archive/access` ho vrací.
- Hub hero zobrazuje **štítek aktivního passu** (fetch `/api/archive/access` při mountu):
  - `ZION Pass · kód` (B2B/marketplace kód),
  - `ZION Pass · OASIS bonus` (ZIS + propojený OASIS hráč),
  - `ZION Pass · aktivní` / `ZION Pass · do <datum>` (entitlement s expirací).
- Uplatnění kódu při přihlášeném ZIS už pass **váže na účet** (`grantEntitlement`,
  `claimedVia:'code'`) — přežije rotaci kódu. Přímý marketplace webhook (bez ručního kódu)
  zůstává v backlogu W6.

## 2. W7 — e2e hubu

- Nový `e2e/zion-archive-hub.spec.ts`, skip bez `ARCHIVE_TEST_PASS` (prod běhy zelené).
- Pokrytí (5 testů, **5/5 lokálně** proti dev serveru s testovacím kódem):
  1. hub + štítek passu + knihovna (20 karet),
  2. front matter nezapisuje progres, první kapitola → `totalChapters: 14`,
  3. hledání „Ararat", záložka (localStorage), nastavení (XL + sépia → CSS třídy),
  4. panel `#stazeni` (karta + SHA-256 + odkaz),
  5. download gate v čistém kontextu: anonym **403**, neznámý slug **404**.
- Testy běží serial (dev server kompiluje routy on-demand) a gate používá vlastní
  `APIRequestContext`, aby nikdy nezdědil pass cookie.

Spuštění:

```bash
ARCHIVE_TEST_PASS=ZAP-... E2E_BASE_URL=http://localhost:3123 \
  npx playwright test e2e/zion-archive-hub.spec.ts --reporter=line
```

## 3. Poznámky

- `maitreya-hub.spec.ts` zůstává `describe.skip` — po kontrole pokrytí se sloučí/odstraní (W7).
- Expirace kódu: env kódy expiraci nemají (platí do odebrání), cookie 90 dní; entitlement
  expiraci má a UI ji ukáže.
