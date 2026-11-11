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
