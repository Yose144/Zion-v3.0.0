# IntroPage — sjednocení, responsivita a výkon (2026-11-12)

**Rozsah:** `apps/IntroPage` (apex `zionterranova.com`), landing page + sdílený
layout. **NASAZENO na EDGE2 12. 11. 2026 02:00 UTC** (`deploy/deploy-intro.sh`,
nginx reload; záloha `/opt/zion/archive/zion-maintenance-pre-intro-20261112T005641Z.tar.gz`, 343 MB).

## 1. Výchozí stav (měřeno na produkci 11. 11. 2026)

| Metrika | Hodnota |
|---|---|
| HTML | 90,7 KB (20 KB gz) |
| CSS | 3 soubory, 111 KB raw / ~19 KB gz, `cache-control: no-cache` |
| JS | jQuery 89,5 KB + util 16 KB + breakpoints + browser + `main.js` 8,4 KB + `intro-tabs.js` 32,7 KB (celé slovníky 5 jazyků) + `starfield-bg.js` 8,7 KB |
| three.js chunk | **942 KB se načítal vždy** (i na telefonu) |
| Obrázky | `stargate/Z.gif` 625 KB (animovaný, zobrazený 64 px), `glyph-transparent.png` 646 KB (240 px), `market-open.webp` 333 KB (575 px), textury 4K/2K **1,6 MB** |
| Google Fonts | 2 render-blocking `@import` (Montserrat, Source Sans Pro) — **nepoužité**, veškerý text je Inter |
| Font Awesome | 60 KB CSS + 77 KB webfont na 4 sociální ikony |
| Celkem (desktop) | **5,75 MB** / 48 requestů |

Strukturální problémy:

1. **`#main` byl tab-panel** (HTML5UP Dimension) — 8 z 9 `<article>` sekcí
   (`intro`, `about`, `mine`, `amenti`, `freeworld`, `status`, `support`,
   `contact`) bylo `display:none`, dokud JS nepřidal `.active`. Bez JS stránka
   ukazovala jen hero. Sekce `#elements` (Tři cesty), `#support` a `#contact`
   nebyly z navigace dostupné vůbec.
2. **jQuery 110 KB** na přepínání panelů, které umí nativní kotvy.
3. **Stargate** měl tři různé vlastníky velikosti (`100vmin` v media query,
   `margin-top: 55vmin` ručně, `width: 30rem` v base) → na telefonu kroužek
   přetékal přes titulek.
4. Blokové `margin: 0 auto` z HTML5UP resetu rozhazovalo grid/flex potomky
   (tlačítka od sebe, stat karty na obsahovou šířku).
5. `main.css` obsahoval neplatné deklarace (`padding: 0 auro`, `padding: 0 auto`),
   mrtvý `background-image: url(www.newearth.cz/…)` a `@import` cizích fontů.
6. Nekonečné animace (`box-shadow` + `background-position` na každé kartě,
   `backdrop-filter: blur(20px)`) — trvalý repaint velkých blur vrstven.

## 2. Co je hotové

### Struktura a UX
- Landing je **skrolovací dokument**: `main#main.landing` s 9 sekcemi v pořadí
  intro → about → paths → mine → amenti → freeworld → status → support →
  contact. Kotvy, deep-linky, zpět/vpřed i čtení bez JS fungují nativně.
- Navigace má 7 položek + dropdown „Více" (sekce + stránky + ekosystém),
  floating menu obsahuje všech 9 sekcí. Každý `#odkaz` má reálný cíl.
- Jeden `<h1>` (wordmark), sekce mají `.section-eyebrow` + `h2.major`.
- Dlouhý text je zarovnaný vlevo do míry 72ch, nadpisy zůstávají centrované.
- Skip-link, `:focus-visible` stavy, `aria-expanded`/`aria-pressed`,
  dekorativní vrstvy `aria-hidden`, všechny `<img>` mají `alt` (dekorativní `""`).
- Status sítě je jedna karta místo tří duplikovaných nadpisů „v3.2.0 MAINNET
  BETA"; Support/Contact jsou přeložené do češtiny (dřív anglický text
  v české stránce).
- JSON-LD `Organization` + `WebSite`.

### Výkon
- **jQuery stack smazán** (jquery, util, breakpoints, browser) → nový
  `main.js` 3,3 KB vanilla (current-section, reveal, rok v patičce).
- **three.js rozdělen** do `NirvanaUniverseCanvas.tsx` + `next/dynamic`.
  Auto-load jen na ≥900 px bez data-saveru/reduced-motion, ~1,2 s po vstupu do
  viewportu (chrání LCP); telefony a zbytek dostanou poster + tlačítko.
- **i18n na vyžádání**: čeština = autorovaný HTML (0 B), ostatní jazyky
  `public/i18n/<lang>.json` (~4 KB gz) fetchované při přepnutí. Opravená chyba,
  kdy `textContent` mazal autorské `<strong>`.
- **Obrázky**: `scripts/optimize-assets.sh` generuje WebP — Z mark 625 KB → 3 KB,
  glyph 646 KB → 16 KB, market banner 333 KB → 113 KB, symbol 86 KB → 21 KB,
  logo 46 KB → 37 KB, fotky/QR ~74 KB → ~39 KB, textury 1,6 MB → 0,3 MB
  (1024/768/512 px, scéna je malá a rozmazaná tak jako tak).
- **Font Awesome pryč** (inline SVG ikony), **Google Fonts @importy pryč**,
  JetBrains Mono (48 KB) nahrazen systémovým mono stackem.
- Stargate: 28 vrstev → 9 (identické obrázky ve stejných polohách), gate má
  jednoho vlastníka velikosti (`#header .logo`), mrtvé `100vmin`/`margin-top`
  hacky odstraněny.
- Karty: pryč nekonečné animace `box-shadow`/`background-position`; blur 20 px →
  14 px (10 px na mobilu); statický glow + hover. `body::before` (fixed mask
  stripes) jen na ≥737 px.
- `prefers-reduced-motion` vypíná gate, karty, reveal i starfield smyčku
  (statický frame). Starfield: DPR cap 1,5 (1 na low-power), nižší hustota na
  malých zařízeních, pauza při skryté kartě.
- Odstraněn `is-preload` (stránka byla bez JS neviditelná).
- Assety mají `?v=` cache-buster, `theme-color`, preload stargate ringu.

### Měření po změně (lokální build, bez gzipu)

| | před | po |
|---|---|---|
| desktop (se scénou) | 5,75 MB / 48 req | **2,33 MB / 38 req** |
| mobil/tablet | 5,75 MB / 48 req | **1,13 MB / 23 req** (−80 %) |
| HTML | 90,7 KB | 97 KB (JSON-LD + nové sekce) |
| CSS raw | 111 KB | 128 KB (nová vrstva), **41 KB gz** |
| JS (bez Next bundlů) | ~156 KB | **23 KB raw / 7,3 KB gz** |

### Ověření

- `npx tsc --noEmit` = 0, `npm run build` EXIT 0.
- Funkční probe `apps/IntroPage/scripts/verify-landing.mjs` **24/24**: jediný `h1`,
  pořadí sekcí, všechny kotvy, viditelnost bez tabů, alt u obrázků, žádné
  jQuery/FA, přepnutí EN → persist po reloadu → zpět CZ (obnova autorského
  textu), dropdown, reduced-motion, mobilní tap → scéna, **obsah bez JS**,
  0 chyb v konzoli.
- Vizuální audit `apps/IntroPage/scripts/audit-layout.mjs` 1440 / 820 / 390 /
  320 px: 0 horizontálního přesahu, 0 chyb v konzoli; desktop načte 2 canvasy
  (starfield + scéna), mobil jen starfield.
- Ostatní routy (`/amenti/`, `/blog/`, `/camp/`, `/seeds/`, `/Vzestup/`,
  `/vast-rigs/`, `/evoluzion/`) 200, bez chyb — layout se nemění (flow vrstva je
  scopovaná na `#main.landing`).

## 3. Poznámky a meze

- **CSS zůstává ve `public/`** (tři ručně psané vrstvy). Minifikace by šla
  přesunout do `src/` a nechat Next zabalit, ale `public/portfolio/*.html` a
  `/legacy/` na ty soubory odkazují jako na statické assety — přesun by je
  rozbil. Kompromis: `?v=` cache-buster + odebrání mrtvých `@importů`.
- Font Awesome soubory zůstávají v `public/` kvůli `/legacy/*.html`; layout je
  už nenačítá.
- three.js scéna se na desktopu načte sama (~950 KB) — je to vědomé rozhodnutí
  (hero featura) s ochranou LCP; úplné vypnutí = `canAutoLoad()` v
  `NirvanaUniverseEmbed.tsx`.
- `#bg` div a `noscript.css` jsou z původní šablony, neškodí.
- Tailwind je v projektu dostupný, landing používá plain classy (injektované
  HTML + React komponenty sdílí jednu slovní zásobu).
- Deployment (`deploy/deploy-intro.sh`) neproveden.

## 3b. Nasazení a živé ověření

- `deploy-intro.sh` → rsync do `/var/www/zion-maintenance` + `nginx -t` +
  reload; smazalo 32 souborů (staré Next chunky a nahrazené assety), nic
  neočekávaného. `vast-rigs/status.json` (live z vastctl daemonu) zůstal
  netknutý, exkluze v deploy skriptu funguje.
- **Živě naměřeno (gzip, `scripts/audit-layout.mjs`):** mobil/tablet **659 KB /
  23 requestů**, desktop se 3D scénou **940 KB / 27 requestů**, HTML 23,6 KB,
  0 horizontálního přesahu, 0 chyb v konzoli. Před: 5,75 MB raw / 48 requestů
  (z toho 1,8 MB JS/CSS/HTML, které se gzipem smrsknou na ~0,5 MB → reálný
  rozdíl je cca 4,4 MB → 0,66 MB).
- **`verify-landing.mjs` proti produkci: 24/24** (kotvy, sekce, i18n EN → reload
  → CZ, dropdown, reduced-motion, tap → scéna, obsah bez JS, 0 chyb).
- Assety: `stargate/z-mark.webp` 3,2 KB, `symbol-200x200.webp` 21 KB,
  `glyph-transparent.webp` 16 KB, `i18n/en.json` 4,3 KB gz, `market-open.webp`
  112 KB — vše 200; `Z.gif`, `jquery.min.js`, původní textury → 404.
- CSS gz: main 6,7 + stargate 24,4 + rasta 11,4 = **42,5 KB**; vlastní JS gz:
  main 1,3 + intro-tabs 2,9 + starfield 3,3 = **7,5 KB**.
- Routy `/amenti/ /blog/ /camp/ /seeds/ /Vzestup/ /evoluzion/ /vast-rigs/` 200.

## 4. Poznámka ke commitu

Mažání souborů (`git rm` jQuery stacku, `Z.gif`, původních textur) bylo ve
staging area strženo paralelní session do commitu `a18967fdc` (stejná past jako
v `STATUSV3` — `git add -A` přes celý strom). Obsah je správný, jen atribuce
sedí na cizí commit; zbytek práce je v samostatném commitu.

## 5. Dotčené soubory

```
apps/IntroPage/AGENTS.md                              (přepsáno)
apps/IntroPage/src/app/maintenance.html               (nová struktura)
apps/IntroPage/src/app/page.tsx                       (JSON-LD, next/script, preload)
apps/IntroPage/src/app/layout.tsx                     (CSS vrstvy, bez is-preload, bez JetBrains)
apps/IntroPage/src/app/globals.css                    (--font-mono)
apps/IntroPage/src/app/components/NirvanaUniverseEmbed.tsx   (poster + opt-in)
apps/IntroPage/src/app/components/NirvanaUniverseCanvas.tsx  (nový, lazy three.js)
apps/IntroPage/public/assets/css/main.css             (mrtvé @importy/deklarace)
apps/IntroPage/public/assets/css/intro-rasta.css      (flow layout, komponenty, motion)
apps/IntroPage/public/assets/js/main.js               (vanilla, bez jQuery)
apps/IntroPage/public/assets/js/intro-tabs.js         (lazy i18n, menu)
apps/IntroPage/public/assets/js/starfield-bg.js       (DPR cap, pause, reduced motion)
apps/IntroPage/public/i18n/{cs,en,es,pt,fr}.json      (nové)
apps/IntroPage/scripts/optimize-assets.sh             (nový)
apps/IntroPage/scripts/verify-landing.mjs             (nový, 24 funkčních kontrol)
apps/IntroPage/scripts/audit-layout.mjs               (nový, layout + váha)
apps/IntroPage/scripts/i18n-apply-additions.mjs       (nový)
apps/IntroPage/scripts/i18n-additions.json            (nový)
smazáno: public/assets/js/{jquery.min,util,breakpoints.min,browser.min}.js,
         public/stargate/Z.gif, public/textures/*.jpg|png (nahrazeno WebP)
```
