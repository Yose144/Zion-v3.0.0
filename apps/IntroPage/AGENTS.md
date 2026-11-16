# IntroPage — agent notes

This Next.js 16 project produces the `zionterranova.com` landing / maintenance page.

## Build & verify

```bash
npm install    # if needed
npm run build  # static export into dist/
node scripts/e2e-check.js   # internal link/asset check against dist/
```

Local preview:

```bash
cd dist && npx serve -l 3001
# or
npx serve dist -l 3001
```

## Routes (trailing slash, static export)

- `/` — Intro / maintenance page (`src/app/page.tsx` renders `src/app/maintenance.html`)
- `/amenti/` — Amenti section, Next.js app router
- `/blog/` — Blog archive
- `/blog/<slug>/` — Blog detail
- `/legacy/` — Migrated V2 static files (HTML, CSS, JS, images, PDFs)
- `/Vzestup/` — Vzestup portal (legacy V2 content rendered in Next.js with Folio/Marketplace-style nav)

## Important files

- `src/app/page.tsx` — injects the landing body from `src/app/maintenance.html` and mounts `NirvanaUniverseEmbed`
- `src/app/maintenance.html` — landing markup (Dimension tab panels + header/footer)
- `public/assets/js/main.js` — **vanilla** tab controller (hash routing, close, Escape, preload removal). There is no jQuery / util.js / breakpoints.js stack any more.
- `public/assets/js/intro-tabs.js` — i18n (CS/EN/ES/PT/FR), floating menu, background modes, top-nav dropdown
- `public/assets/js/starfield-bg.js` — background starfield canvas
- `public/assets/css/main.css` + `public/assets/css/intro-rasta.css` — template + rasta theme (tab visibility is scoped to `#wrapper #main`)
- `src/app/components/NirvanaUniverseEmbed.tsx` — lazy 3D Nirvana preview; textures live in `public/textures/*.webp`
- `src/app/amenti/page.tsx` + `layout.tsx` — Amenti page + metadata
- `src/app/blog/page.tsx`, `src/app/blog/[slug]/page.tsx` + `layout.tsx` — Blog archive/detail (+ dynamic metadata)
- `src/app/camp/page.tsx`, `src/app/evoluzion/page.tsx`, `src/app/seeds/**` — other sections (+ per-route metadata layouts)
- `src/app/components/PageLayout.tsx` — shared top nav + footer for non-landing routes
- `src/app/data/*.json` — page copy (amenti, blog, camp, evoluzion, seeds)
- `public/legacy/` — full V2 static archive
- `src/app/Vzestup/page.tsx` + `VzestupNav.tsx` — Vzestup portal page and navigation

## Landing behaviour

- **Top nav order** is fixed: `Lumi · Market · Explorer · About · Stránky ▾ ·
  Ekosystém ▾ · 3.3 New Web`. Both dropdowns stay in the DOM and fade in on
  hover/click (invisible bridge over the gap keeps `:hover` alive); the last
  item links to `https://3.3.zionterranova.com` (gold highlight).
- **Stránky** = Amenti, EvoluZion, Camp, Vzestup, Blog, Seeds.
  **Ekosystém** = Těžba, Free World, Nirvana, Pool, Onboard, Docs.
  `SiteDirectory.tsx` mirrors the same split on the subpage rasta nav.
- **Vast Rigs is intentionally absent from every public menu** (internal ops page).
  The unlisted `/vast-rigs/` route is kept only for ops/deploy health checks.
- `#wrapper #main` is hidden by CSS until `body.is-article-visible` is set; only the
  article matching `location.hash` (`#about`, `#mine`, `#amenti`, `#freeworld`,
  `#elements`, `#v3zion`, `#support`, `#contact`, `#in`) is displayed.
- `main.js` handles nav clicks, `hashchange` / back / forward, the close button,
  `Escape` and click-outside. It also removes the legacy `is-preload` state.
- `intro-tabs.js` applies the saved language on load and defaults to **CS**; it also
  translates the Support/Contact panels through `data-i18n` keys.
- All 3D textures are local WebP files (`public/textures/*.webp`, ~260 KB total);
  do not reintroduce `/textures/2k_*.jpg` references.

## Styling

Global CSS loaded in `src/app/layout.tsx`:
- `public/assets/css/main.css`
- `public/stargate/stargate-theme.css`
- `public/assets/css/intro-rasta.css`

Use `className="button primary small rasta-gold|rasta-red|rasta-green"` for CTA buttons.
Use `id="main"` + `<article className="active">` to get the glass rasta card look.

## Deploy

`deploy/deploy-intro.sh` rsyncs `dist/` to EDGE2 `/var/www/zion-maintenance/` and reloads nginx.

## freeworld/ (L5 Free World portal)

Dedikovaný statický L5 portál pro `freeworld.zionterranova.com` — vlastní templaty + build (`marked` + PIL → webp), deploy do `/var/www/freeworld`. Z kořene IntroPage: `npm run build:freeworld`, `npm run deploy:freeworld`. Detaily: `freeworld/AGENTS.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
