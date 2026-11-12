# IntroPage — agent notes

This Next.js 16 project produces the `zionterranova.com` landing / maintenance page.

## Build & verify

```bash
npm install    # if needed
npm run build  # static export into dist/
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

- `src/app/amenti/page.tsx` — Amenti page
- `src/app/blog/page.tsx` — Blog archive
- `src/app/blog/[slug]/page.tsx` + `BlogPostClient.tsx` — Blog detail
- `src/app/components/PageLayout.tsx` — shared top nav + footer
- `src/app/data/amenti-data.json` — Amenti copy
- `src/app/data/blog-posts.json` — Blog archive data (converted from `public_html/V2/blog-posts.js`)
- `public/legacy/` — full V2 static archive
- `src/app/Vzestup/page.tsx` + `VzestupNav.tsx` — Vzestup portal page and navigation

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
