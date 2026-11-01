# Next.js 14 → 16 unifikace (W4 K3) — migrační plán (design, read-only)

> **Stav:** 🚧 **probíhá** — rozhodnutí „RC first" bylo pro tento povrch revidováno; migrace K1.1 jede po appkách (viz §2b).
> **Rozpor:** #10 v [`NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md`](../../NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md) §2.
> **Ověřeno 1. 11.:** **všech 6 webů na Next 16.4.3 + React 19** (pool-ui, IntroPage, OasisWeb, website-v2.9, nirvana, MarketPlace). Next 14 už v `apps/` není.

## 1. Cíl

Sjednotit všechny 6 webů na jednu generaci Next (16.x) + React 19, aby:
- byla jedna sada závislostí, jeden build pipeline, jeden security patch level (MarketPlace `next` critical — gate 1b),
- sdílené komponenty (`apps/shared/scenes`, design tokens, i18n) fungovaly napříč všemi povrchy bez polyfillů,
- deploy skripty nebyly vázané na verzi-specific quirks (např. `--webpack` flag pro 16.x).

## 2. Pořadí migrace (od nejméně rizikového)

| Pořadí | App | Důvod | Riziko |
|---|---|---|---|
| 1 | `pool-ui` | nejmenší povrch, statický export, žádné server-side logika | nízké |
| 2 | `IntroPage` | statický export, žádné API routes | nízké |
| 3 | `MarketPlace` | největší povrch, API routes, Prisma, Stripe/Coinbase, L1 watcher integrace | vysoké — security gate 1b (next critical CVE) |
| 4 | `nirvana` → `OasisWeb` | už na 16.2.9, jen srovnání na 16.4.3 (jeden patch level) | nízké |

## 2b. Stav provedení

| App | next | react | build | deploy |
|---|---|---|---|---|
| `pool-ui` | 16.4.3 | 19.2.0 | ✅ | ✅ 2026-11-01 (`pool.zionterranova.com`) |
| `IntroPage` | 16.4.3 | 19.2.0 | ✅ | ✅ 2026-11-01 (apex `zionterranova.com`) |
| `MarketPlace` | 16.4.3 | 19.2.0 | ✅ | ✅ 2026-11-01 (gate 1b, `market.zionterranova.com`) |
| `nirvana` | 16.4.3 | 19.2.0 | ✅ | ✅ (manifest srovnán; build/deploy patří herní session) |
| `OasisWeb` | 16.4.3 | 19.2.0 | ✅ | ✅ 2026-11-01 (`oasis.zionterranova.com`) — **jediná appka, která potřebovala config fix** (`reactBrowserBailout: false`, React #438) |
| `website-v2.9` | 16.4.3 | 19.2.0 | ✅ (jen `--webpack`) | ✅ |

**Zkušenost z 1–2:** obě appky prošly **bez zásahu do kódu**. Jediná reálná změna u pool-ui byly `force-static` metadata routy; u IntroPage byly už dopředu. Synchronní `params` u `[slug]` rout Next 16 se `generateStaticParams` přijme — migrace na Promise není blokující.

**⚠️ `OasisWeb` je výjimka — potřeboval jednu řádku configu (React #438).** Next 16.4 zapíná `experimental.reactBrowserBailout` (`next/dynamic` se `ssr: false`). Bailout objekt, který se předává do `use()`, umí zpracovat **jen React canary, který si Next veze interně** — s veřejným Reactem 19.2.0 `use()` spadne na React #438 a ErrorBoundary zobrazí „Something went wrong". Naměřeno live: **8 z 11 rout prázdných, `canvas=0`**. React 19.3.1 to **nespraví** (ověřeno). Fix = `experimental: { reactBrowserBailout: false }` v `apps/OasisWeb/next.config.ts`. Ostatní appky to nepostihne: `website-v2.9` je `output: 'standalone'` (85× `ssr:false` OK), `IntroPage` (4×) a `pool-ui` (0×) jsou statické exporty a v prohlížeči prošly. **Test:** `curl` 200 nestačí — u statického exportu měř `pageerror` + `canvas` v prohlížeči (postup v reportu `REPORT_2026-11-01_KINGDOM_F0-F2_OASIS.md` §K1.1 OasisWeb).

**⚠️ Past s `ENOENT` v `.next` (jiná věc než #438):** build padal na `ENOENT` uvnitř `.next` (`_buildManifest.js.tmp`, `page.js.nft.json`, `pages-manifest.json`) u **Turbopacku i webpacku**, s podvrženou stopou „workspace root není správný" (`apps/package-lock.json` nutí Next inferovat root `apps/`). Nebyla to konfigurace — v `apps/OasisWeb` běžela **souběžná session s `rm -rf .next dist && next build` v cyklu**, která mazala výstup uprostřed buildu. **Recept:** build v izolovaném `git worktree` (`git worktree add /tmp/x HEAD --detach` + `npm install` + build). Pravidlo: **dva buildy v jednom `apps/<app>` nejdou**; při podezření zkontroluj `ps aux | grep next-build`.

### 2c. MarketPlace (gate 1b) — co bylo potřeba

| Věc | Změna |
|---|---|
| `params` v 16 route handlerech | `Promise` + `await context.params` / `await params` |
| `middleware.ts` | → `proxy.ts` s exportem `proxy` (Next 16 konvenci `middleware` deprecuje) |
| `next.config.js` | `turbopack.root = apps/` (appka importuje `apps/shared/**`) |
| eslint | 9 + `eslint-config-next` 16 + **flat config** (Next 16 odebral `next lint`) |
| standalone layout | `scripts/flatten-standalone.mjs` v postbuildu |

**Dvě reálné chyby, které s upgradem nesouvisely:**

1. **Repo na tomhle stroji MarketPlace vůbec nebuildil.** `deletedAt` na `ShopOrder` je ve schématu, ale `node_modules/.prisma/client` byl starý → `next build` padal na 19 type errorech. Po `npx prisma generate` je baseline zelený **ještě na Next 14**. Kdo tu appku buildí, musí generovat klienta.
2. **Trivi routy byly nedosažitelné.** `api/admin/trivi/{status,sync}/route.ts` deklarovaly `params.id`, ale cesta nemá dynamický segment, zatímco `shop-api.ts` volá `/status/<id>` a `/sync/<id>`. Přesunuto do `[id]/`.

**⚠️ Dvě pasti při nasazení (obě shodily produkci, obě vyřešené):**

- **Rsync `--exclude='node_modules'` není kotvený** → matchuje i `.next/standalone/node_modules` a `.next/standalone/.next/node_modules`. Server tak dostal **nové manifesty se starým Next 14 runtime** (`TypeError: Cannot read properties of undefined (reading 'canonicalBase')`), podruhé `Cannot find module '@prisma/client-<hash>'` (Turbopack alias je symlink v `.next/standalone/.next/node_modules`). Fix: `--exclude='/node_modules'` + pre-restart guard, který porovná verzi Next lokálně vs. remote a **nerestartuje** při neshodě. Zálohy `.next` + `.env` na EDGE2 v `/root/market-backups/`.
- **`outputFileTracingRoot = appka` nejde použít** — Turbopack ho bere jako hranici resoluce a `../../../shared/**` přestane existovat. Proto flatten skript, ne tracing root.

**Verifikace na živém povrchu:** 8/8 rout 200, `/api/health` = `healthy` (DB 2 ms), `/api/items` reálná data, `/api/admin/*` = 401 bez klíče, trivi routy 401 (dřív 404), admin API s `x-api-key` vrací agregace, PDF faktura `FV2026-000051` = 200 / `application/pdf` / 358 kB (puppeteer OK), testovací objednávka `TEST-K11-20261101T104032Z` vznikla i se zrušila (history `pending→cancelled`).

**Zbývající známá mezera (pre-existing, ne regrese):** zrušení objednávky **nevrací sklad** (`soft-002` zůstal na 998, dorovnáno ručně) a faktura zůstala `issued`. Audit to vedl už 2026-10-30.

## 3. Klíčové kroky per app

1. Bump `next` + `react` + `react-dom` v `package.json` (+ `@types/react`).
2. `npm install` + `npm run build` lokálně; opravit breaking changes (Next 15/16: async params, `cookies()`/`headers()` async, `fetch` cache default, middleware, Turbopack).
3. Migrace `next/image`, `next/link`, `next/font` API změny.
4. Ověřit `--webpack` vs Turbopack (website-v2.9 používá `--webpack` kvůli `zion-wallet-sdk`/`zion-rpc` aliasům).
5. Deploy na staging (ne produkci) → smoke test → produkční flip s rollback skriptem.
6. Aktualizovat `deploy-*.sh` skripty.

## 4. Security gate 1b (MarketPlace)

MarketPlace `next` 14.2.5 má critical CVE (Image Optimization RCE, Server Actions SSRF). Mitigace nasazeny 28. 10.: `unoptimized:true` (vypíná `/_next/image`), Server Actions 0×, middleware = jen coarse pre-filter s autoritativním `requireAdminAuth` v route handlers. **Major bump 14→16 je RC položka** — musí proběhnout před veřejným launch.

## 5. Závislosti

- W4 K3 je vázán na K1 (shell GA) a K2 (3 vstupy místo 8+ hostname).
- Bez RC sign-off se neimplementuje (rozhodnutí „RC first").
- Po migraci: aktualizovat `docs/3.2/MARKET_V2_PARITY.md` a `docs/marketing/MARKETPLACE.md`.

## 6. Co tento plán nedělá

- Neimplementuje K4 (`zion-compute`) — HORIZONT.
- Nemění L1 consensus.
- Nepřepíná money-paths (Stripe/Coinbase zůstávají env-gated).
