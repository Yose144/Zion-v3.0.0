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

## Světlý / tmavý motiv (2026-11-11)

- `data-theme` na `<html>`, `lumi_theme` v localStorage, systémová preference jako fallback. Přepínač je v hlavičce (`ThemeToggle`), inline skript v `layout.tsx` nastaví motiv před paintem.
- **Barvy nehardcoduj.** `paper`, `paper-deep`, `card`, `line`, `ink`, `ink-soft`, `muted`, `forest`, `rust`, `success` a amber 600–900 jsou CSS proměnné v `globals.css`; Tailwind je mapuje přes `rgb(var(--color-*) / <alpha-value>)`.
- Tmavý motiv: `--btn-primary-bg` = jantar, text inkoust; `forest` je tmavší, `rust`/`success` světlejší. `text-parchment` zůstává staticky světlý pro tmavé plochy (`bg-forest`), `text-ink` se přepíná.
- Nepoužívej `bg-white/*` (kromě QR plochy) — používej `bg-card/*`. `bg-ink` je textová barva, ne plocha; plochy jsou `bg-forest`.
- Responzivita: testuj 390 a 1440 v **obou** motivech, cookies tabulku jako karty na mobilu, administraci s `overflow-x-auto`.
