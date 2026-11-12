# IntroPage — agent notes

Next.js 16 project that produces the `zionterranova.com` landing page plus the
`/amenti`, `/blog`, `/camp`, `/seeds`, `/evoluzion`, `/Vzestup`, `/vast-rigs`
routes. Static export into `dist/`.

## Build & verify

```bash
npm install
npx tsc --noEmit     # must stay clean
npm run build        # static export into dist/
npx serve dist -l 3001   # or: python3 -m http.server 3001 (in dist/)
```

## Landing page (`/`)

`src/app/page.tsx` reads `src/app/maintenance.html`, extracts only its `<body>`
and injects it with `dangerouslySetInnerHTML`. The `<head>` of that file is dead
— metadata lives in `src/app/layout.tsx`, page-local scripts in `page.tsx`
(`next/script`, `afterInteractive`; raw `<script>` inside the injected markup
never re-runs on a client-side navigation back to `/`).

### Structure

The page is a **normal scrolling document** (it used to be an HTML5UP
"Dimension" tab panel where JS revealed one `<article>` at a time — 90 % of the
copy was unreachable without JS and invisible to crawlers).

```
header#header        hero: stargate, title, logo, CTAs, Nirvana preview, nav, market banner
main#main.landing    9 <article> sections: intro, about, paths, mine, amenti,
                     freeworld, status, support, contact
footer               logo, quick links, L1–L6 strip, copyright
nav.floating-menu    bottom-right panel: sections, projects, ecosystem, language, background
```

Rules:

- **One `<h1>`** (the hero wordmark). Section titles are `<h2 class="major">`
  with a `.section-eyebrow` kicker above them.
- Section ids are the deep links; every `#header nav a[href="#…"]` must resolve
  to an element id (checked by the functional probe).
- The top nav is a pill on desktop and a **3-column grid** on phones (the
  template's `min-width: 7.5rem` per link made it a tall column otherwise).
- Long copy is left-aligned inside `72ch`; headers stay centred. The HTML5UP
  reset (`main.css`) puts `margin: 0 auto` on **every** element — grid/flex
  children need `margin-left/right: 0` overrides or they shrink and drift apart
  (`.stat-grid > *`, `.button-row > *`, …).

### Styling

Three hand-authored stylesheets in `public/`, loaded in this order from
`src/app/layout.tsx` with a `?v=` cache-buster:

1. `assets/css/main.css` — HTML5UP Dimension base (reset, hero, articles)
2. `stargate/stargate-theme.css` — the rotating gate and ring layers
3. `assets/css/intro-rasta.css` — **the design system**: rasta tokens, glass
   cards, nav, floating menu, footer, the responsive scroll-flow layout and
   every in-page component (`.stat-grid`, `.path-card`, `.status-card`,
   `.nirvana-embed-*`, …). New styling belongs here, not in `main.css`.

`src/app/globals.css` (Tailwind + `.article` typography) is imported by the
layout. Tailwind is available but the landing markup uses plain classes so the
injected HTML and the React components share one vocabulary.

Use `className="button primary small rasta-gold|rasta-red|rasta-green"` for
CTAs. Decorative images carry `alt=""` + `aria-hidden`; Font Awesome is **not**
loaded any more (inline SVG covers the four social icons).

### Behaviour (public/assets/js)

| File | Job |
|---|---|
| `main.js` | nav "current section" marker, reveal-on-scroll, footer year. Vanilla, ~3 KB. |
| `intro-tabs.js` | floating menu, nav dropdown, background modes, language switch. |
| `starfield-bg.js` | full-viewport canvas starfield (`window.setStarfieldMode`). |

- **No jQuery.** The old `main.js` + `jquery.min.js` + `util.js` +
  `breakpoints.min.js` + `browser.min.js` (~110 KB) were replaced.
- **i18n:** `maintenance.html` is authored in Czech, so Czech costs nothing —
  the original markup is captured the first time a visitor switches away and
  restored when they switch back. Every other language is a ~4 KB JSON file in
  `public/i18n/<lang>.json`, fetched on demand (`scripts/i18n-apply-additions.mjs`
  merges `scripts/i18n-additions.json` into them). Attributes: `data-i18n`
  (text/HTML) and `data-i18n-html` (markup) — both are written as `innerHTML`
  from our own dictionaries so authored `<strong>` survives.
- Honour `prefers-reduced-motion`: gate rotation, card animations, reveal and
  the starfield loop are all disabled.
- The starfield caps DPR, drops density on small/low-power devices and pauses
  while the tab is hidden.

### Nirvana preview

`components/NirvanaUniverseEmbed.tsx` is the lightweight shell (poster + play
button + captions). The three.js scene is `components/NirvanaUniverseCanvas.tsx`
and is pulled in with `next/dynamic` — **never import three.js from the shell**,
it would put ~950 KB back into the initial bundle. Auto-load only on
≥900 px viewports without data-saver/reduced-motion, ~1.2 s after the window
scrolls into view; phones and everyone else get it on tap.

### Assets

`bash scripts/optimize-assets.sh` regenerates the WebP derivatives (stargate
mark, glyph strip, market banner, 3D textures). Run it after replacing a source
image and keep the filenames it writes. Bump `ASSET_V` in `layout.tsx` /
`page.tsx` (and `?v=` on images inside `maintenance.html`) when a file changes
but keeps its name — `public/` assets are served with `no-cache` and no hashes.

### Probes

- `/vast-rigs/` ops dashboard uses `.vast-dashboard-shell`; `intro-rasta.css`
  resets the template's `margin: auto` inside it — keep that block at the end.

## Routes (static export, trailing slash)

- `/` — landing page (see above)
- `/amenti/` — Amenti section
- `/blog/` + `/blog/<slug>/`
- `/camp/`, `/seeds/` + `/seeds/<slug>/`, `/evoluzion/` + `/evoluzion/archa/`
- `/Vzestup/` — Vzestup portal
- `/vast-rigs/` — rig ops dashboard
- `/legacy/` — V2 static archive (untouched)

Shared navigation/footer for those routes: `src/app/components/PageLayout.tsx`.

## Deploy

`deploy/deploy-intro.sh` rsyncs `dist/` to EDGE2 `/var/www/zion-maintenance/`
and reloads nginx. Repo convention: deploy is an explicit operator step.

## freeworld/ (L5 Free World portal)

Dedicated static L5 portal for `freeworld.zionterranova.com` — own templates and
build (`marked` + PIL → webp), deployed to `/var/www/freeworld`. From the
IntroPage root: `npm run build:freeworld`, `npm run deploy:freeworld`.
Details: `freeworld/AGENTS.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
