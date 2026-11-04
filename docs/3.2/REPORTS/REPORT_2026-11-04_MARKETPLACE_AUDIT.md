# REPORT 2026-11-04 — MarketPlace: kompletní kontrola a opravy

**Zadání (👤):** „pojďme teď kouknout na marketplace a všechno zkontrolujeme" → „fixni vše".
**Prostředí:** `market.zionterranova.com` (EDGE2, `zion-marketplace` :3100), DB `zion_marketplace` (PostgreSQL), L1 RPC `127.0.0.1:9445`.
**Commity:** `9d6d9b2af` (kód + assety), `ab496b48b` (deploy skript).

---

## 1. Jak se to kontrolovalo

Nic nebylo „proklikané od oka" — každý bod má měření:

- **Kód:** `npx tsc --noEmit`, `npx eslint .`, `npm run build` (Next 16.4.3, standalone).
- **Produkce:** HTTP status všech 18 stránek + API, `journalctl` za 48 h, `systemctl show`.
- **Data:** přímé read-only dotazy do Postgresu (produkty, objednávky, faktury, `ShopSetting`).
- **Peníze:** `getTransaction` / `getUtxos` proti L1 RPC — hash z DB vs. reálný chain.
- **Bezpečnost:** neautentizované pokusy na 20 endpointech (admin, write, webhook).

---

## 2. Co bylo v pořádku

| Oblast | Důkaz |
|---|---|
| Typecheck | `tsc --noEmit` 0 chyb |
| Produkce | `/` 200, `/api/health` `healthy` (DB 5 ms) |
| Stránky | 18/18 200 vč. vánočních detailů |
| Auth | 6/6 admin API → 401, `seed`/`bonus-sweep`/`zion-confirm` → 401, IPFS/HIRAN/INDEXER → 401 |
| Data | 463 artefaktů, 25 produktů, 3 objednávky, 2 faktury |
| Stažení | 65 MB ZIP knihy → 200 |
| Watcher | `zion-l1-watcher` aktivní, skenuje aktuální blok |

### Výplaty ověřené na chainu (ne jen v DB)

| Objednávka | Částka | Blok | Stav |
|---|---|---|---|
| `GIFT-MW0V63NQ` | 1 000 000 ZION | 108195 | ✓ 1 UTXO = 1e12 flowers |
| `GIFT-MW18HIQK` | 10 000 000 ZION | 108492 | ✓ 1 UTXO = 1e13 flowers |
| `TEST-ZPASS-…` | 108 000 ZION | 107305 | ✓ |

Zákazníci peníze dostali; žádná duplicitní platba (zůstatky sedí na korunu).

---

## 3. Nálezy a co se s nimi udělalo

### P0-1 — `/api/email-debug` byl otevřený mail relay ❌→✅

`POST /api/email-debug` bez autentizace poslal **skutečný e-mail** přes Resend na adresu z requestu a v odpovědi vrátil `SMTP_HOST`, `SHOP_EMAIL`, `RESEND_FROM`, `hasResendKey`.

**Fix:** `requireAdminAuth()` (API klíč nebo admin session) — live 401.
`/api/email-preview` zůstává veřejný: negeneruje data z DB ani nic neposílá, jen vykreslí šablonu.

### P0-2 — 8 produktů nešlo koupit, přestože byly skladem ❌→✅

`ShopProduct.inStock=false` v produkci u osmi položek, které katalog (`src/data/shopProducts.ts`) vede jako dostupné, a `active=true` (tj. visí v e-shopu jako „Vyprodáno"). Každá objednávka skončila `409 out of stock`.

Postiženo: `wood-003` (5 ks), `digi-001…004`, `soft-001…003` (999 ks).
**Fix:** UPDATE na 8 řádků (`stock > 0`), záloha před/po. Koupitelných produktů **2 → 10 / 23**.
Zbylé (`star-*`, `engr-*`, `wood-004`) mají `inStock=false` **už v katalogu** — záměr, neměněno. `vr-001` v katalogu není (vznikl ručně), ponecháno.

### P1-1 — payout peněženka je rozdrobená, velké bonusy selhávaly ❌→✅

`Error: broadcast failed: transaction too large: size 103664 exceeds max 100000` (16:49–18:03) a
`fee estimation failed: largest 177 UTXOs cover only 2.78e12 of 1e13 — consolidate the wallet UTXO set first` (22:02).

Příčina: peněženka `zion1d2k5…` měla **96 709 UTXO** s průměrem 1 788 ZION (jedna coinbase odměna = jeden UTXO). Do 100 KB tx se vejde ~177 vstupů → víc než ~850 tis. ZION v jedné transakci nebylo technicky možné odeslat.

**Fix:** 40 kol `zion wallet consolidate` (177 vstupů → 1 výstup 850 672 ZION, poplatek 0,0235 ZION/kolo).
Výsledek: 40 nových velkých UTXO (34,0 M ZION), stav 96 709 → 89 692 UTXO, celkový zůstatek beze změny (rozdíl = poplatky 0,94 ZION + běžné pool payouty).

**Ověřeno:** `zion wallet send --amount 10000000 --fee auto --dry-run` už projde (`Auto fee: 1756 flowers`, tj. 0,0018 ZION). Před konsolidací padal.

### P1-2 — deploy nepoznal rozbitý Prisma bundle ❌→✅

`4. 11. 07:03` osmkrát `Cannot find module '@prisma/client-2c3a…/default.js'` — každá DB routa mrtvá, ale deploy ohlásil úspěch: smoke testoval jen `/` a `/_next/static`, a ty Next servíruje i s rozbitým bundlem. Zachránil to až další deploy v 07:26.

**Fix:** deploy nově ověřuje `/api/health` (`"status":"healthy"`) a `/api/shop/products` (`"data"`), při chybě vypíše poslední Prisma chyby z journalu a skončí `exit 1`.

### P2 — kosmetika ❌→✅

| Co | Detail | Fix |
|---|---|---|
| 7 obrázků produktů | 404 → ikonový fallback (`pool-license`, `dom.jpeg`, `dev.jpg`, `qrcode.jpg`, `miner-pro`, `lotos2`, `farm-bundle`) | brandované dlaždice (`scripts/gen-placeholder-images.py`, 1200×1200) — **nejsou to fotky**, jen drží vizuál, dokud se nedodá skutečný snímek |
| `/vanoce` | 404 (existovaly jen `/vanoce/<slug>`) | nový rozcestník se 3 produkty, cenou i ZION bonusem |
| lint | 24 errors | `Link` místo `<a href="/">`, debounce timer v `useRef`, ikona přes `createElement`, `set-state-in-effect` → warn s odůvodněním (hydratace z localStorage) → **0 errors / 36 warnings** |
| `.next/dev` + darwin engine na serveru | 197 MB balastu z macOS buildu | `--exclude='.next/dev'` + úklid `libquery_engine-darwin-*` po regeneraci klienta |

---

## 4. Ověření po nasazení (`deploy-marketplace.sh`, restart 08:06)

- `/api/health` → `healthy`, nový DB smoke prošel.
- `/vanoce` → 200, tři odkazy `/vanoce/{zion-pass,kniha-kralovstvi-srdce,lampion}`.
- `POST /api/email-debug` → **401**.
- 7/7 dříve chybějících obrázků → 200.
- Koupitelných produktů 10/23.
- **Objednávka end-to-end:** vytvořena `ORD-AUDIT-…` (`totalCzk 108`, `tokens 108 000`, peněženka vygenerována, faktura `FV2026-000002`), poté zrušena přes admin API → sklad vrácen `997 → 998`.
- 18/18 stránek 200, v journalu po restartu 0 chyb.

---

## 5. Otevřené věci (vědomě neopravené)

1. **Konsolidace je jednorázová, fragmentace se vrací** (~1 UTXO na blok, ~2 880/den). Doporučení: denní `zion wallet consolidate --rounds 20 --target-utxos 3000` (poplatek ~0,5 ZION/den). Nezapnuto — je to automatizovaná pohyblivá operace s penězi, chce výslovné rozhodnutí.
2. **Audit objednávka `ORD-AUDIT-…` + faktura `FV2026-000002`** zůstávají v DB jako `cancelled`. Nemazal jsem je: smazání by udělalo mezeru v číselné řadě faktur (daňový problém), což je horší než zrušený záznam.
3. **`/api/oasis/reverse-sync`** nemá auth (jen notifikuje OASIS). Riziko nízké, ale je to jediná write routa bez klíče.
4. **`vr-001`** (VR Experience, 100 000 Kč) je v DB mimo katalog a nedostupný — pokud se má prodávat, chybí mu místo v `shopProducts.ts`.

---

## 6. Poučení

- **Neposílat peníze z peněženky s desítkami tisíc UTXO.** Limit 100 KB na serializovanou tx (JSON pole čísel ≈ 540 B na vstup) znamená strop ~177 vstupů bez ohledu na `MAX_TX_INPUTS`. CLI to už pozná (`build 4b6914c9f`) a řekne „consolidate first" — dobrá zpráva, ale musí se to udělat dřív, než přijde platba.
- **Smoke test musí sáhnout na databázi.** HTML + statický asset nejsou důkaz, že aplikace žije.
- **`inStock` není totéž co `stock`.** Dvě nezávislá pole; nesoulad se neprojeví nikde než u pokladny (409).
