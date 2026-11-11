# AGENTS.md — Lumi

Kontext pro agenty, kteří na tomhle webu pracují. Přečti před zásahem do kódu.

## Co je Lumi

Samostatný e-shop **Omnity.One s.r.o.** pro dřevěné lampiony. **Není to ZION**: žádné tokeny, peněženky, NFT ani odkazy na ZION v UI. Pokud někdo chce ZION bonus, patří to do MarketPlace, ne sem.

- Next.js 16 (App Router, Turbopack, standalone), Tailwind 3, Prisma + SQLite.
- Texty v `src/data/**` (cs/en/de), ne v komponentách.
- Vlastní vizuální jazyk: teplý papír, inkoust, amber, serif (Cormorant Garamond). Nepoužívej rasta paletu ani `apps/shared/ui` tokeny.

## Pravidla, která se nesmí porušit

1. **Prisma má custom output** `src/generated/prisma` (`prisma/schema.prisma`). Nikdy neměň na výchozí `.prisma/client` — v monorepu je jeden `node_modules` a přepsalo by to klienta MarketPlace. Deploy kopíruje klienta i do `.next/standalone/src/generated/prisma`.
2. **Fire safety text je jeden soubor** `src/lib/fire-safety.ts`. Změna textu, který zákazník podepisuje, **musí** bumpnout `FIRE_CONSENT_VERSION`. Server (`/api/orders`) i klient používají stejnou funkci `checkFireConsent`.
3. **Ceny a sklad jsou v DB**, obsah v katalogu. Server nikdy nevěří ceně z klienta — počítá z `Product` řádku. Sklad se decrementuje v transakci s podmínkou `stock >= qty`; jinak vznikne dvojí prodej posledního kusu.
4. **Žádné PII v URL.** Číslo objednávky ano, e-mail ne. Sledování je `GET /api/orders/[id]?email=` a faktura jen se shodným e-mailem nebo admin session.
5. **Admin je fail-closed.** Bez `LUMI_ADMIN_PASSWORD` + `LUMI_SESSION_SECRET` vrací 503. Mutace kontrolují `Origin` (CSRF).
6. **3D model:** `public/models/lumi-2.glb` je meshopt. Bez `MeshoptDecoder` se nenačte. **Nepřepisuj materiály** (`Překližka`/`Řez`/`Gravír`) — přemalování z něj udělá papírovou krabici. Model se načítá až po kliknutí (three je ~700 kB).
7. **Firemní identita:** v patičce, fakturách a e-mailech vždy `Omnity.One s.r.o.`, IČO 09120050, neplátce DPH. Lumi je značka, ne firma.
8. **Žádné falešné recenze, hodnocení ani „slevy"** bez reálného základu.

## Časté úkoly

| Úkol | Kde |
|---|---|
| Přidat produkt | `src/data/catalog.ts` + `POST /api/seed` (vytvoří nový řádek) |
| Změnit cenu/sklad | `/admin` → Produkty, nebo `PATCH /api/admin/products` |
| Změnit text | `src/data/site.ts`, `pages.ts`, `legal.ts` |
| Přidat jazyk | `Lang` v `src/lib/i18n.ts` + `Localized` pole ve všech datech |
| Přidat platební metodu | `PaymentMethod` v `src/types/shop.ts`, validace v `/api/orders`, UI v `/kosik` |
| Upravit e-mail | `src/lib/email.ts` (šablony drží `shell()` a `itemsTable()`) |

## Build a kontrola

```bash
cd apps/lumi
npm run db:generate
npm run typecheck
npm run lint
npm run build
```

`npm run build` pouští `prisma generate` a `postbuild` (flatten standalone + static + public). Deploy očekává `.next/standalone/server.js`.

## Pasti

- **Next 16:** `params` a `searchParams` jsou `Promise` — vždy `await`. `useSearchParams` musí být v `<Suspense>`.
- **Standalone v monorepu:** Next zanoří výstup do `.next/standalone/apps/lumi/`; `scripts/flatten-standalone.mjs` ho zploští. Nemazat sdílený `node_modules` v rootu standalone stromu.
- **`turbopack.root`** musí být kořen repa, jinak Next nenajde lockfile.
- **Port 3200** — nekoliduje s MarketPlace (3100) ani website (3000).
- **SQLite zámky:** jedna Prisma instance (globalThis) v devu; dlouhé transakce drží zámek.
- **Obrázky:** `next/image` se nepoužívá, `images.unoptimized = true`. Nové fotky dávej do `public/images/` a preferuj webp.
- **Jazyk:** klientský (`localStorage` + cookie), serverové metadata jsou česky. Route-based i18n je roadmapa, ne hotová věc — nedělej částečný přechod.

## Deploy

`deploy/deploy-lumi.sh` (EDGE2). Env je v `/etc/zion/lumi.env`, data v `/opt/zion/data/lumi/`. Nginx vhost a systemd unit v `deploy/`. Podrobnosti v `README.md`.

## Design engine a obrázky (2026-11-11)

- **Paleta:** ZION Design Engine v1.0 B — inkoust `#101C2B`, les `#344A36`, pergamen `#F0E1BE`, jantar `#E7AA4B`, rez `#9D493D`. Nedávej zpět starou hnědou paletu ani rasta barvy.
- **Obrázky:** `public/images/lumi-b/`; varianty `-200/-640/-700/-1280` přes `src/lib/images.ts`. Karty používají `imageSmall`, detail plnou variantu, náhledy `-200`.
- **Žádné technické řezy v UI:** `sest-sten.png` a `rozlozeni-a3.png` se na webu nesmí objevit (rozhodnutí 👤 11. 11.). Jen fotky a produktové rendery; reálné fotky přijdou v dalším kole.
- **Lokace:** marketing nesmí tvrdit „vyrobeno v Horní Čermné“ ani jinou výrobní lokaci. Adresa v kontaktu, faktuře, OP, GPSR a vratné adrese zůstává (zákon).
- **Poznámky k obrázkům:** Mini = „Ilustrační zobrazení Lumi Mini“, personalizace = „Ukázka motivu na dřevěném vzorku“, dárkové balení = doplněk, ne sada. Drž je v `ProductDef.disclaimer`.
- **3D:** `#nahled-3d` (ID nesmí začínat číslicí — CSS selektor by selhal), na homepage je sekce „Naše eso“ hned pod hero/trust stripem; fallback `3d-poster-700.webp`.
- **Právní minimum:** `/nakupni-rad`, `/cookies`, `/odstoupeni-od-smlouvy`, `/bezpecnost-produktu`, `/pristupnost`, `/reklamace`; odkazy v patičce, checkoutu a sitemapě. Cookie lišta jen technické cookies.

## Motivy a varianty (připraveno 2026-11-11)

Šest nových motivů = **šest nových produktových variant** (vlastní `externalId`,
cena, sklad). Kód je připravený; chybí jen podklady. Postup:
1. **Assety:** `node scripts/import-motifs.mjs <balíček> --slug <slug> [--group <skupina>]`
   - Bere `Jednotlive_steny/*` (PNG/SVG/WebP); když je stěna v PNG i SVG, vyhraje **SVG** (vektor → ostrá `-700` varianta).
   - SVG se vyplní inkoustem (`#101C2B`) podle `fill-rule="evenodd"` = silueta řezu; `--style line` nechá jen tah. PNG se bere tak, jak je.
   - Píše `public/images/motifs/<slug>/<nn>-<nazev>-{200,400,700}.webp`, `strip-{640,1280}.webp` a `motivy.json`.
   - Názvy motivů bere z `Motivy.json` v balíčku, jinak z názvů souborů.
   - Vypíše hotový TS snippet pro katalog a připomene, co doplnit.
2. **Katalog** `src/data/catalog.ts`: záznam do `VARIANT_GROUPS` (popisek sekce) + šest produktů s `variantGroup`, `variantOrder`, `motifName` a `walls`.
3. **Překlady:** `label.en` / `label.de` u stěn (skript je nechává v češtině).
4. **Seed:** `POST /api/seed` s `Authorization: Bearer $LUMI_SEED_TOKEN` — doplní **jen chybějící** řádky, existující ceny a sklad nemění.
5. **Cena a sklad:** `/admin` → Produkty (ne v katalogu).

Co se v UI zapne samo (bez dalšího kódu):

| Prvek | Podmínka |
|---|---|
| `VariantSwitcher` na detailu | skupina má ≥ 2 členy (`variantSiblings`) |
| `ProductWalls` (šest stěn) | produkt má neprázdné `walls` |
| Sekce skupiny v `/kolekce` | existuje produkt s `variantGroup` |

Když je varianta jen jedna, nekreslí se nic — dávka se dá přidávat po jednom.

**Pozor na seed:** `ensureSeeded()` dřív naplnil jen prázdnou tabulku, takže produkt
přidaný později neměl v DB řádek a checkout ho odmítl („Produkt není v nabídce“).
Teď `seedMissing()` doplňuje chybějící `externalId` a existující řádky nechává být.

## 3D model z výpalových podkladů (2026-11-11)

Šest motivových sad má vlastní GLB postavené **z vektorů, které jdou do laseru** —
ne z ilustrace. Model tedy sedí na skutečný díl: stěny stojí na šestihranu
o poloměru 65 mm (apotéma `65√3/2`), desky mají průměr 140 mm, tloušťka 3 mm.

```bash
cd apps/lumi
node scripts/build-lantern-models.mjs --all          # všech šest sad → public/models/lumi-2-<slug>.glb
node scripts/build-lantern-models.mjs ../../heros/Lumi/<balíček> --slug <slug>
```

- Vstup je `Lumi_2_A3_1ku1.svg` (devět cest: šest stěn, vršek, dno, proužek).
  Cesty jsou uzavřené polylinie `M/L/Z`, takže se čtou bez SVG parseru.
- **Obrysy se třídí podle vnoření** (sudá hloubka = kus, lichá = díra); tím
  vzniknou díry i případné dřevěné ostrůvky. Douglas–Peucker s tolerancí
  0,15 mm (stěny) / 0,3 mm (zdobený vršek) drží tvar a zmenší soubor ~10×.
- **Materiály:** `Překližka` (plochy) a `Řez` (hrany) — dvě skupiny
  z `ExtrudeGeometry`. Nemalovat je na jednu barvu.
- **Sestava:** stěny se otáčejí kolem Y podle úhlů drážek (30° + 60°·k) a stojí
  na apotémě; desky se překlopí o −90° kolem X. Model se staví v souřadnicích
  archu (Y dolů) a nakonec se otočí o 180° kolem X — otočení, ne zrcadlení,
  takže normály zůstanou správně.
- **Výsledek:** 22–40 tis. trojúhelníků, 1,1–2,0 MB, Y-up, metry, objekty
  `stena-01…06`, `vrsek`, `dno`.
- **Produktové náhledy:** `node scripts/ops/lumi-render/render.mjs --model
  public/models/lumi-2-<slug>.glb --out <dir> --mode hero` (čtverec 1200 px,
  teplé tmavé pozadí) → `node scripts/make-model-images.mjs <dir> <slug>` zapíše
  `public/images/motifs/<slug>/produkt-{200,700}.webp`.
- **Stav prodeje:** varianty jsou v katalogu `active: false` („Připravujeme“),
  dokud se v `/admin` nenastaví cena a sklad. Checkout je do té doby odmítne.


## Světlý / tmavý motiv (2026-11-11)

- `data-theme` na `<html>`, `lumi_theme` v localStorage, systémová preference jako fallback. Přepínač je v hlavičce (`ThemeToggle`), inline skript v `layout.tsx` nastaví motiv před paintem.
- **Barvy nehardcoduj.** `paper`, `paper-deep`, `card`, `line`, `ink`, `ink-soft`, `muted`, `forest`, `rust`, `success` a amber 600–900 jsou CSS proměnné v `globals.css`; Tailwind je mapuje přes `rgb(var(--color-*) / <alpha-value>)`.
- Tmavý motiv: `--btn-primary-bg` = jantar, text inkoust; `forest` je tmavší, `rust`/`success` světlejší. `text-parchment` zůstává staticky světlý pro tmavé plochy (`bg-forest`), `text-ink` se přepíná.
- Nepoužívej `bg-white/*` (kromě QR plochy) — používej `bg-card/*`. `bg-ink` je textová barva, ne plocha; plochy jsou `bg-forest`.
- Responzivita: testuj 390 a 1440 v **obou** motivech, cookies tabulku jako karty na mobilu, administraci s `overflow-x-auto`.
