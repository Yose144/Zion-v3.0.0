# AGENTS.md — FreeWorld (freeworld.zionterranova.com)

Dedikovaný **statický** L5 Free World portál — editorial/projektový web mimo hlavní Next.js appku. Žije jako podprojekt IntroPage (`APP&WEB/IntroPage/freeworld/`). Live na `freeworld.zionterranova.com` (nginx servíruje `/var/www/freeworld` na Edge).

## Struktura

- `src/index.html` — homepage template (`<!--GEN:X-->` placeholdery)
- `src/project.html` — template projektové stránky
- `src/assets/css/site.css` — celý design (dark shell + krémové "masterplan board" panely)
- `src/assets/js/site.js` — i18n slovník CS/EN (`data-i18n` + `data-lang-show`), reveal, Leaflet mapa (Esri Dark Gray Canvas), live fund/registry polling, QV ballot UI
- `src/docs-index.html`, `src/doc.html` — templates dokumentace
- `content/projects.json` — 6 projektů (slug, lokace, souřadnice, accent, tagline cs/en, obrázky, docs slug)
- `content/docs.json` — L5 docs registry (kategorie → {slug, file, title override?}); zdroj `public/V3/L5/docs/**`, titulky/blurby se berou z `# H1` + první `>` citace
- `tools/build.mjs` — build (marked → docs HTML, templating, volá images.py)
- `tools/images.py` — PIL → webp z `L5Projects/img/` do `dist/assets/img/<slug>/{render,board}.webp`
- `deploy/deploy-freeworld.sh` — rsync `dist/` → `/var/www/freeworld` + nginx reload

## Build & deploy

```bash
# z kořene IntroPage:
npm run build:freeworld      # → freeworld/dist/
npm run deploy:freeworld     # rsync → /var/www/freeworld + nginx reload

# nebo přímo v tomto adresáři:
npm install        # pokud chybí marked
npm run build      # → dist/
bash deploy/deploy-freeworld.sh
```

## URL struktura

- `/` — hero (L5FreeWorlds banner), live fund ticker, 6 karet, mapa, registry tabulky, QV sekce
- `/p/<slug>/` — detail: render hero, masterplan board (lightbox), plná dokumentace CS+EN (pre-render z `website-v2.9/public/docs/terranova/<docSlug>.<lang>.md`), prev/next navigace
- `/docs/` — index 14 L5 dokumentů ve 7 kategoriích; `/docs/<slug>/` — doc stránka (EN obsah, `docs.enonly` poznámka jen v CS; per-doc `title`/`blurb` override v docs.json pro interní názvy v H1)

## Live data & bezpečnost

- JS volá same-origin `/api/free-world/*` a `/api/auth/me` — nginx `/api/` proxuje na `127.0.0.1:3000` (Next.js appka vlastní Free World proxy + ZIS auth).
- **`FREE_WORLD_API_KEY` nikdy do dist/ ani JS** — GET jsou public, QV POST vyžaduje ZIS session (voter_id = `zis:<user.id>` vynucen server-side v proxy).
- Public copy pravidla jako website-v2.9: žádné interní názvy/IP/cesty.

## Nginx

Conf: `V31/deploy/nginx/freeworld.zionterranova.com.conf` → `/etc/nginx/sites-available/` (symlink v sites-enabled). Zálohy ukládat **mimo** sites-enabled (include glob `*` chytí i .bak soubory → duplicate server_name conflict). Záloha původního proxy conf: `/root/freeworld.conf.bak-static-20260929T172236Z`.

Starší app-vestavěný portál zůstává funkční na `app.zionterranova.com/l5-free-world`.

## Poznámky

- Mapa: Esri World Dark Gray Canvas (CARTO tiles mají "API KEY REQUIRED" watermark — nepoužívat basemaps.cartocdn.com).
- LUMI/Nova Amerika board (`Lumi project.png`) je tmavý Issobella board — sdílený pozemek s L6 pozemní stanicí, záměrně.
- i18n: `data-i18n` klíče + `data-lang-show="cs|en"` bloků; výchozí CS, ?lang=en nebo localStorage `fw-lang`.
