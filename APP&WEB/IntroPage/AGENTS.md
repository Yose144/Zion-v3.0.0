# IntroPage — agent notes

This Next.js 14 project produces the `zionterranova.com` landing / maintenance page.

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

## Important files

- `src/app/amenti/page.tsx` — Amenti page
- `src/app/blog/page.tsx` — Blog archive
- `src/app/blog/[slug]/page.tsx` + `BlogPostClient.tsx` — Blog detail
- `src/app/components/PageLayout.tsx` — shared top nav + footer
- `src/app/data/amenti-data.json` — Amenti copy
- `src/app/data/blog-posts.json` — Blog archive data (converted from `public_html/V2/blog-posts.js`)
- `public/legacy/` — full V2 static archive

## Styling

Global CSS loaded in `src/app/layout.tsx`:
- `public/assets/css/main.css`
- `public/stargate/stargate-theme.css`
- `public/assets/css/intro-rasta.css`

Use `className="button primary small rasta-gold|rasta-red|rasta-green"` for CTA buttons.
Use `id="main"` + `<article className="active">` to get the glass rasta card look.

## Deploy

`deploy/deploy-intro.sh` rsyncs `dist/` to `/var/www/maintenance/` and reloads nginx.
