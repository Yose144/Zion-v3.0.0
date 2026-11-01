# Next.js 14 → 16 unifikace (W4 K3) — migrační plán (design, read-only)

> **Stav:** 🚧 **probíhá** — rozhodnutí „RC first" bylo pro tento povrch revidováno; migrace K1.1 jede po appkách (viz §2b).
> **Rozpor:** #10 v [`NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md`](../../NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md) §2.
> **Ověřeno 1. 11.:** Next 14 — MarketPlace `^14.2.5` (poslední). Next 16.4.3 + React 19 — pool-ui, IntroPage, website-v2.9. Next 16.2.9 — nirvana, OasisWeb.

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
| `MarketPlace` | 16.4.3 | 19.2.0 | ✅ | ⏳ **build OK, deploy čeká** (gate 1b — money-path, chce TEST-K11-* objednávku) |
| `nirvana` | 16.4.3 | 19.2.0 | ✅ | ✅ (manifest srovnán; build/deploy patří herní session) |
| `OasisWeb` | 16.4.3 | 19.2.0 | ✅ | ✅ 2026-11-01 (`oasis.zionterranova.com`) — **jediná appka, která potřebovala config fix** (`reactBrowserBailout: false`, React #438) |
| `website-v2.9` | 16.4.3 | 19.2.0 | ✅ (jen `--webpack`) | ✅ |

**Zkušenost z 1–2:** obě appky prošly **bez zásahu do kódu**. Jediná reálná změna u pool-ui byly `force-static` metadata routy; u IntroPage byly už dopředu. Synchronní `params` u `[slug]` rout Next 16 se `generateStaticParams` přijme — migrace na Promise není blokující.

**⚠️ `OasisWeb` je výjimka — potřeboval jednu řádku configu (React #438).** Next 16.4 zapíná `experimental.reactBrowserBailout` (`next/dynamic` se `ssr: false`). Bailout objekt, který se předává do `use()`, umí zpracovat **jen React canary, který si Next veze interně** — s veřejným Reactem 19.2.0 `use()` spadne na React #438 a ErrorBoundary zobrazí „Something went wrong". Naměřeno live: **8 z 11 rout prázdných, `canvas=0`**. React 19.3.1 to **nespraví** (ověřeno). Fix = `experimental: { reactBrowserBailout: false }` v `apps/OasisWeb/next.config.ts`. Ostatní appky to nepostihne: `website-v2.9` je `output: 'standalone'` (85× `ssr:false` OK), `IntroPage` (4×) a `pool-ui` (0×) jsou statické exporty a v prohlížeči prošly. **Test:** `curl` 200 nestačí — u statického exportu měř `pageerror` + `canvas` v prohlížeči (postup v reportu `REPORT_2026-11-01_KINGDOM_F0-F2_OASIS.md` §K1.1 OasisWeb).

**⚠️ Past s `ENOENT` v `.next` (jiná věc než #438):** build padal na `ENOENT` uvnitř `.next` (`_buildManifest.js.tmp`, `page.js.nft.json`, `pages-manifest.json`) u **Turbopacku i webpacku**, s podvrženou stopou „workspace root není správný" (`apps/package-lock.json` nutí Next inferovat root `apps/`). Nebyla to konfigurace — v `apps/OasisWeb` běžela **souběžná session s `rm -rf .next dist && next build` v cyklu**, která mazala výstup uprostřed buildu. **Recept:** build v izolovaném `git worktree` (`git worktree add /tmp/x HEAD --detach` + `npm install` + build). Pravidlo: **dva buildy v jednom `apps/<app>` nejdou**; při podezření zkontroluj `ps aux | grep next-build`.

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
