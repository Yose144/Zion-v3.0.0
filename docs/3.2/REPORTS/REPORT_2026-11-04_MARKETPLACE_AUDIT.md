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

### P1-3 — `/tmp` na EDGE2 měl práva z macOS rsyncu → PDF faktura nešla vygenerovat ❌→✅

Při závěrečné kontrole journalu: `Invoice PDF attachment skipped … EACCES: permission denied, mkdtemp '/tmp/puppeteer_dev_chrome_profile-…'`.

Příčina nebyla v Puppeteeru ani v Chrome (oba nainstalované správně), ale v **`/tmp` samotném**: `drwxr-xr-x 501:root` — do adresáře mohl zapisovat jen UID 501 a root. Vznikl zjevně rsyncováním z macOS (`-a` přenesl ownera 501 i mode 755; v `/tmp` po něm zůstaly i `._*` AppleDouble soubory). Následek: **žádná služba běžící jako `zion` nemohla do `/tmp` zapsat** — kromě PDF faktur by to postupně rozbilo cokoli, co potřebuje dočasný soubor.

**Fix:** `chown root:root /tmp && chmod 1777 /tmp`. Ověřeno: `sudo -u zion mktemp -d /tmp/...` projde, `/api/invoice/<id>/download?format=pdf` → **200, 361 kB, platný PDF** (`/tmp` je teď `drwxrwxrwt root:root`).
EDGE1 byl v pořádku (`drwxrwxrwt`), jiné unity na EDGE2 EACCES na `/tmp` neměly.

---

## 4. Ověření po nasazení (`deploy-marketplace.sh`, restart 08:06)

- `/api/health` → `healthy`, nový DB smoke prošel.
- `/vanoce` → 200, tři odkazy `/vanoce/{zion-pass,kniha-kralovstvi-srdce,lampion}`.
- `POST /api/email-debug` → **401**.
- 7/7 dříve chybějících obrázků → 200.
- Koupitelných produktů 10/23.
- **Objednávka end-to-end:** vytvořena `ORD-AUDIT-…` (`totalCzk 108`, `tokens 108 000`, peněženka vygenerována, faktura `FV2026-000002`), poté zrušena přes admin API → sklad vrácen `997 → 998`.
- **PDF faktury:** `/api/invoice/<id>/download?format=pdf` → 200, 361 kB, validní PDF (před opravou `/tmp` padalo na EACCES).
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
- **`rsync -a` z macOS umí přepsat metadata cílového adresáře.** `/tmp` s ownerem 501 a právy 755 vypadá jako funkční adresář, ale rozbije každou non-root službu, která potřebuje dočasný soubor — a chyba se objeví až v konkrétní funkci (tady PDF faktura), ne při deployi.
- **Soubory přidané do `public/` za běhu služby se neobjeví.** Next si seznam statických souborů načte při startu; 23 nových produktových fotek leželo na disku a vracelo 404, dokud se služba nerestartovala. Deploy to řeší restartem — ruční nahraní souborů ne.

---

## 7. Dodatek (stejný den, druhá dávka)

**Produktové fotky:** 👤 dodal `heros/shop/ZION_RASTA_23_obrazku_WEBP` (23× WEBP 1024×1024) + `prirazeni.csv`. Nacopírováno do `public/shop/img/products/`, přemapováno v `shopProducts.ts` **i v DB** (`image` u všech 23 produktů). Provizorní dlaždice z §3 P2 smazány — nahradily je skutečné fotky.

**Vánoční produkty rozšířeny o kontext a ukázky:**

- Každý ze tří produktů má `home.lead` + `bullets` + `facts` (čísla), takže karta na homepage není tři věty, ale konkrétní nabídka.
- Kniha dostala **tři reálné ukázky z rukopisu** (Prolog, 7. kapitola, Epilog) v češtině i angličtině — vytažené z `canon/…/CZ` a `EN`, ne přepsané. Vykreslují se jako papírové karty s iniciálou.
- **Mřížka 8 edic** s vygenerovanými obálkami a počty slov (z `EDITION/00-STAV.md`).
- Čísla jsou změřená: **3 252 stran** = součet všech 40 PDF, **619 498 slov** = součet edic × jazyků. Nahradila dosavadní „přes 3 200 stran" i chybné „10 kapitol" (vlajková edice má 24 kapitol + epilog).
- Zdvojený nadpis „Ukázky z knihy" (citáty vs. nové vzorky) → citáty jsou „Hlasy z knihy".

**Deploy past:** `npm ci` se dvakrát srazil s paralelní session (ENOTEMPTY, chybějící `valtio/esm/vanilla.mjs`, zkrácený `next-swc` → „Turbopack requires native bindings"). Řešení = plný `rm -rf node_modules && npm ci` a hned deploy. Skript má nově `ZION_SKIP_NPM_CI=1` pro případ, kdy je strom čerstvý a nechceme ho znovu přepisovat.

---

## 8. Dodatek 2 — vánoční novinka s novými obrázky, cesta nákupem a FAQ

👤 dodal druhý balíček `ZION_MARKET_KOMPLET_WEBP` (39 WebP): 3 homepage obrázky 1672×941, 7 do galerií, 6 ilustrací z knihy a 23 katalogových fotek.

**Použito:**
- `public/vanoce/home/` — hero karty na homepage (pass / kniha / lampion v4 s tesařem a dětmi). Karty si obrázek berou z dat produktu (`hero`), ne z konstanty v komponentě.
- `public/vanoce/galerie/` — 2–3 snímky na detailu produktu (pass 2, kniha 2, lampion 3).
- `public/vanoce/pribeh/` — 6 ilustrací; tři z nich jsou **přiřazené konkrétním ukázkám**: Prolog → Světla u brány, 7. kapitola → Jméno lodi, Epilog → Místo navíc. Ukázka tak není jen text, ale dvoustránka.

**Nový obsah:**
- `ChristmasJourneySection` pod třemi kartami: **5 kroků „jak to funguje"** (od výběru po uplatnění kódu a import peněženky) + **6 otázek**, které se ptají u všech darů (doručení e-mailem, hodnota bonusu, co je ZAP, seed phrase, darování, vrácení).
- Detaily produktů rozšířeny o dva odstavce každý — Pass „co je uvnitř / kód nemá expiraci", kniha „jak číst / kde začít", lampion „co přijde hned / světlo je součást příběhu". Nic o rozměrech či materiálech lampionu jsem nedopisoval: výrobní geometrii určuje SVG/DXF v4 a náhledy nejsou výrobní dokumentace.

**Past (screenshot):** `loading="lazy"` + `fullPage` screenshot bez scrollu = prázdné boxy a falešný nález „obrázek chybí". `scripts/shot-xmas.mjs` teď před snímkem projede stránku.

**Pozor:** commit s touto dávkou byl stržen do commitu paralelní session (`df8bb7a02`) — obsah je v HEAD, jen pod cizí zprávou. Ověřeno `git cat-file -e HEAD:<soubor>` u všech dotčených souborů.

---

## 9. Dodatek 3 — karty podle formátu fotek (responsivita)

👤: „na úvodní page jsou obrázky roztažlé zbytečně … uprav karty podle nich a ať je to hezky responsivní".

**Co bylo špatně:** karta měla pevný levý sloupec **340 px** s `aspect-auto` + `min-h-[320px]`, do kterého se široký hero obrázek (1672×941) cpál přes `object-cover`. Výsledek: agresivní ořez a dojem roztaženého obrázku; na 768 px se navíc dvousloupec lámal do úzkého pruhu.

**Nové chování:**

| Šířka | Layout | Obrázek |
|---|---|---|
| < 1280 px | obrázek na plnou šířku, text pod ním | 16:9 |
| ≥ 1280 px | dva sloupce (obrázek / text) | 4:3, mírný ořez stran |

- Dvousloupec startuje až na `xl` (1280) — na 768 a 1024 je stack, kde má text plnou šířku.
- Čísla v kartě: 2 sloupce na mobilu (`mobile-keep-cols`, jinak je globální pravidlo srovnalo do jednoho), 4 na `xl`.
- Ověřeno `scripts/shot-responsive.mjs` na **390 / 768 / 1024 / 1440** — ve všech čtyřech **žádné vodorovné přetečení**; screenshoty v `.artifacts/render/xmas-20261104/resp-*.png`.

**Past:** `git commit -m "…"` se zpětnými apostrofy v textu spustí v zsh command substitution — zpráva se tiše rozpadla (`aspect-auto` → `command not found`). Commity s technickými názvy psát do `'…'`.

---

## 10. Dodatek 4 — ultraširoké bannery jako hero + novinky srovnané s realitou

**Odpověď na otázku 👤:** ne — práce v **novinkách** (`app.zionterranova.com/news/christmas-2026`) nebyla moje. Dělal jsem jen marketplace; novinky jsou samostatná appka (`apps/website-v2.9`) a měl je na starosti někdo jiný. Teď jsou srovnané.

### Bannery z `heros/shop/heros/`

Dva PNG 1983×793 (přesně formát `aspect-[21/9]` hero boxu na detailu). Překonvertováno na webp a použito na dvou místech:

| Soubor | Marketplace | Novinky |
|---|---|---|
| `Zion Pass_ Zlatá brána mezi světy-1.png` | `/vanoce/hero/zion-pass-wide.webp` | `pass-wide.webp` |
| `b05095de-…png` (tesař + kniha na tabletu) | `/vanoce/hero/kralovstvi-srdce-wide.webp` | `book-wide.webp` |

Marketplace: nové pole `heroWide` v datech produktu; `XmasProductPage` bere `heroWide ?? image`. Karta na homepage dál používá 16:9 `hero` — banner je na ni moc široký.

### Novinky — co bylo špatně

Článek tvrdil **„deset kapitol a epilog"** a mluvil jen o knize. Realita: **8 edic × 5 jazyků, 40 knih, 3 252 stran, 619 498 slov, 24 kapitol + epilog**; a vedle knihy jsou v prodeji ještě **ZION Pass** a **lampion**.

Nově článek obsahuje: 5 sekcí (Pass / kniha / lampion / Kingdom / Nirvana) s obrázky, **„Jak to funguje"** (5 kroků) a **„Časté otázky"** (5 otázek) — stejná čísla i stejné formulace jako na marketplace, aby si web a e-shop neodporovaly. Odkazy vedou na tři produkty na marketplace.

Dodržena pravidla `apps/website-v2.9/AGENTS.md` §2 (public copy): žádné interní názvy, cesty, služby ani verze; CS + EN kompletní.

### Ověřeno živě

`/news/christmas-2026` 200 (text obsahuje 3 252, 619 498, „Jak to funguje", „Časté otázky"), oba bannery 200, `app.zionterranova.com` 200, `market/vanoce/*` 200.

**Deploy poznámka:** `deploy-web2.9.sh --artifact-dir` selhal na `incomplete standalone artifact` — artifact potřebuje `node_modules/next` **uvnitř** app dir (workspace hoisting), což skript doplňuje jen v cestě bez `--artifact-dir`. Řešení: složit `node_modules`, `.next/static`, `public/`, `archive-content/` do `.next/standalone/apps/website-v2.9/` a volat `scripts/ops/deploy-next-artifact.sh` přímo.

---

## 11. Dodatek 5 — hero bez ořezu a původní obrázky na webu

### Hero na detailu produktu byl uříznutý

Hero box měl `aspect-[21/9]` **a** `max-h-[420px]`. Ultraširoký banner je 1983×793 = **2,5:1**, takže:
- `21/9` (2,33) už sám ořezával,
- a `max-h-[420px]` při 1280px kontejneru capoval výšku z 548 na 420 → poměr spadl na ~3:1 a `object-cover` ukrojil dalších ~20 % shora i zdola.

**Fix:** `aspect-[5/2]` (přesně 2,5:1) pro produkty s `heroWide`, `aspect-[16/9]` pro ostatní (lampion), `max-h` zrušen.
Ověřeno screenshotem: u Passu jsou vidět celé oblouky brány i knihovna, u knihy celá scéna s tesařem, obálkou, tabletem i dětmi.

### Tři karty na webu měly cizí obrázky

`apps/website-v2.9/src/components/ChristmasShopCards.tsx` — sekce „Vánoční edice v eShopu" na `app.zionterranova.com`:

| Karta | Bylo | Je |
|---|---|---|
| ZION Pass | `kingdom-1200.webp` (obecná brána Kingdom) | `card-pass.webp` — brána s Passem |
| Království srdce | `kralovstvi-srdce-1200.webp` (tesař) | `card-book.webp` — obálky + tablet |
| Lampion | `images/home/christmas-kingdom.webp` (vánoční trh) | `card-lampion.webp` — tesař s dětmi a lampionem |

Všechny tři jsou původní snímky 1672×941 z dodané sady. Zároveň:
- štítek **„Připravujeme"** přesunut z pravého horního rohu dolů vpravo — nahoře se překrýval s dlouhým kickerem („VÁNOČNÍ EDICE · RUČNÍ VÝR…"),
- text karty knihy srovnán s realitou: osm edic, 40 knih, 3 252 stran.

### Ověřeno živě

`market/vanoce/zion-pass` a `/kniha-kralovstvi-srdce` — bannery bez ořezu · `app.zionterranova.com` 200, tři `card-*.webp` 200 a v HTML · `news/christmas-2026` 200.

---

## 12. Dodatek 6 — hero banner pro lampion

👤 dodal `heros/shop/heros/Lampion_HERO_rasta.webp` (1983×793, stejný 2,5:1 formát jako Pass a kniha).

- `apps/MarketPlace/public/vanoce/hero/lampion-wide.webp` + `heroWide` v datech produktu → detail lampionu má teď hero ve stejném formátu jako ostatní dva (dřív 16:9 `vanoce-lampion.webp`).
- `apps/website-v2.9/public/images/news/christmas-2026/lampion-wide.webp` → sekce Lampion v novinkách používá tentýž banner místo obecného snímku dílny.

Ověřeno: `/vanoce/lampion` 200, oba soubory 200, `news/christmas-2026` 200, screenshot hero bez ořezu (vidět celý lampion, kniha na tabletu i děti).

---

## 13. Dodatek 7 — IntroPage: pozvánka „Market is open" pod menu

👤: „na intropage vyměníme kartu pozvánku do marketu, ale posunul bych ji až pod menu".

**IntroPage** (`apps/IntroPage`) je statický export (`output: 'export'`, zdroj `src/app/maintenance.html`), na apexu ho servíruje systémový nginx z `/var/www/zion-maintenance`.

Co se změnilo:
- nový banner `heros/shop/heros/Vánoční příběh ZION pod hvězdami.png` (1672×941) → `public/images/market-open.webp` (242 kB),
- `.hero-christmas` přesunut z hero bloku **`.inner`** (kde visel jako malá karta pod glifem, `min(72vw, 26rem)`) do **pod `<nav>`**; banner nese vlastní typografii („Market is open", „PF 2027"), takže potřebuje plnou šířku — nově `min(94vw, 1150px)`,
- odkaz změněn z novinkového článku na **market.zionterranova.com** (je to pozvánka do Marketu),
- stará `images/christmas-market.webp` už v HTML není.

**Ověřeno:** lokálně 1440 i 390 px bez vodorovného přetečení (`overflow` false), karta je v DOM **za** `<nav>` (index 12 037 > 10 898), live `zionterranova.com` 200, `images/market-open.webp` 200 (242 kB), screenshot potvrzuje banner pod menu.

**Doladění (👤 „to je moc velké, zmenšit na 50 %"):** `.hero-christmas` má `min(94vw, 575px)` — přesně polovinu z 1150 px; na telefonu `88vw`, protože 47vw by byl banner nečitelný. Naměřeno: desktop **575×324 px**, mobil **343×194 px**.

---

## 14. Dodatek 8 — odkazy z webu na detaily produktů

👤: „linky na webapp by měly směřovat na detaily produktu".

Všechny tři karty v sekci „Vánoční edice v eShopu" mířily na `market.../shop` (výpis), takže se člověk musel proklikat znovu — a to i u produktů, které mají vlastní stránku s cenou, obsahem, postupem a FAQ.

| Karta | Bylo | Je |
|---|---|---|
| ZION Pass | `/shop` | `/vanoce/zion-pass` |
| Království srdce | `/shop` | `/vanoce/kniha-kralovstvi-srdce` |
| Lampion | *(žádný odkaz — `<div>`)* | `/vanoce/lampion` |

Připravovaný lampion byl dřív mrtev `<div>`; teď je to odkaz, protože detail produktu právě vysvětluje, co je v ceně a kdy se prodej otevře.

**Navíc `ArchiveLock`** (brána ZION Archivu): CTA **„Získat ZION Pass"** vedlo na `shop?category=books` → nyní `/vanoce/zion-pass`. Dlaždice s popiskem „Otevřít marketplace" zůstala na výpisu — tam je to správně.

**Ověřeno živě:** v HTML homepage jsou všechny tři `href` na `/vanoce/*`, každá z těch URL vrací 200, `app.zionterranova.com` 200.

---

## 15. Dodatek 9 — nový hero na homepage Marketu

👤 dodal `heros/shop/heros/ZION_MARKET_HERO_kolekce_2027.webp` (1672×941).

Marketplace homepage má hero jako **CSS background** (`.kralovstvi-hero-art`) s `aspect-ratio: 1672 / 941` — tedy přesně formát nového artu, žádný zásah do layoutu nebyl potřeba:
- obrázek → `/hero-kolekce-2027.webp`,
- `background-image` v `globals.css` přepnut z `/vanoce-hero.webp`,
- art nese **vlastní text** („Merry Christmas & Happy New Year 2027"), takže se přes něj nic nepřekládá — upraven jen `aria-label` a komentář v `HeroSection.tsx`.

**Ověřeno:** `market.zionterranova.com/` 200, `/hero-kolekce-2027.webp` 200 (421 kB), screenshot desktop 1440 i mobil 390 — art je celý, bez ořezu, CTA zůstala pod ním.

---

## 16. Dodatek 10 — bonusy vánoční trojice o jednu nulu dolů

👤: „musíme nastavit jiné bonusy komplexně v celém ekosystému, je to asi přehnané … snížíme vše o jednu nulu" → po dotazu na úroveň zvolil **jen vánoční produkty, katalog nechat**.

**Měření před změnou:** celý katalog (22 produktů) jede na `SHOP_ZION_PER_CZK=10`, tedy **10 ZION/Kč**. Jen tři vánoční položky měly **1 000 ZION/Kč** — o dva řády výš, což vypadalo spíš jako překlep v řádu než jako prémie.

| Produkt | Před | Po | ZION/Kč |
|---|---|---|---|
| ZION Pass (108 Kč) | 108 000 | **10 800** | 1 000 → 100 |
| Kniha (216 Kč) | 216 000 | **21 600** | 1 000 → 100 |
| Lampion (432 Kč) | 432 000 | **43 200** | 1 000 → 100 |

Po změně jsou vánoční produkty **10× nad katalogem** — prémie zůstává rozpoznatelná, ale už ne o dva řády.

**Kde se to muselo změnit:**
- **DB** `ShopProduct.tokens` (3 řádky) **a** `ShopSetting campaign:book-001` — kampaň přebíjí produkt, takže bez jejího přepsání by se kniha tvářila jako nezměněná,
- seed `shopProducts.ts`, data `christmasProducts.ts` (bonus, fakta, bullets, detaily, FAQ),
- `translations.ts` (popisky karet) a `ChristmasEdition.tsx` (hardcoded bonusy),
- novinky `Christmas2026Client.tsx` + metadata, karty `ChristmasShopCards.tsx`,
- textové vyjádření kurzu: „**tisíc** ZION za každou korunu" → „**sto** ZION za každou korunu" (cs+en).

**Ověřeno živě:** `/api/shop/products` → `10800` a `21600`; homepage marketu obsahuje `10 800 / 21 600 / 43 200 ZION` a „sto ZION za každou korunu"; karty na webu `+10 800 / +21 600 / +43 200 ZION bonus`; v HTML se **nevyskytuje** ani jedno staré číslo.

**Poznámka:** tři už vyplacené objednávky (1 000 000, 10 000 000 a 108 000 ZION) zůstávají v historii beze změny — mění se jen budoucí nákupy.
