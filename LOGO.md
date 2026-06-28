# ZION TerraNova — Logo

> Oficiální logo ZION TerraNova — **Stargate**.
> Vytvořeno 2026-06-28. Založeno na originálním stargate z [newearth.cz](https://newearth.cz).

---

## Koncept

Logo reprezentuje **Stargate** — kosmický portál mezi světy. Je to přesná replika stargate z newearth.cz, která symbolizuje bránu do ZION Oasis (L4 metaverse) a celého ZION ekosystému.

### Vizuální prvky

| Prvek | Význam |
|-------|--------|
| **Metalický kruh** | Tělo stargate — radial-gradient (černá → šedá → kov) |
| **28 rotujících vrstev** | Mandala (`2.png` x22) + Sri Yantra (`1.png` x6) — různé rychlosti a směry |
| **39 glyphů** | A-Z, a-m — Stargate SG-1 adresní glyfy kolem dokola |
| **9 chevronů** | V-triangles s cyan glow — Stargate SG-1 zámky |
| **Center logo (Z)** | Animované Z.gif s `grayscale(100%) contrast(180%)` filtrem |
| **Nebula pozadí** | Hubble mlhovina — kosmické pozadí |

### Struktura (dle originálu)

```
.stargate-wrap
  .gate
    .container
      img.rotate1..28    (28 rotujících vrstev, 35% šířky gate)
      a.center-logo > img (Z.gif, grayscale+contrast)
    .glyphs > .glyph x39  (A-Z, a-m)
    .chevrons > .chevron x9
    .chevronInners > .chevronInner x9
```

---

## Soubory

### Animovaný stargate (gaming sekce)

| Soubor | Velikost | Rozměr | Popis |
|--------|----------|--------|-------|
| `public/stargate/stargate.css` | ~18 KB | — | Scoped CSS (`.stargate-wrap`) |
| `public/stargate/1.png` | 192 KB | 700×700 | Sri Yantra (RGBA) — rotate23-28 |
| `public/stargate/2.png` | 48 KB | 737×737 | Mandala (colormap) — rotate1-22 |
| `public/stargate/Z.gif` | 625 KB | 64×64 | Animované center logo |
| `public/stargate/nebula.jpg` | 77 KB | 800×800 | Pozadí (Hubble) |

### Statická ikona (navigace, favicon, OG)

Všechny ikony jsou **vyrenderovány z live stargate** (Playwright screenshot z `/doge-vs-zion`), ne ručně kreslené — jsou identické s originálem.

| Soubor | Velikost | Rozměr | Popis |
|--------|----------|--------|-------|
| `public/stargate-icon.png` | 283 KB | 512×512 |Navigační ikona (z live renderu) |
| `public/stargate-nav.png` | 4.5 KB | 48×48 | Malá nav ikona (optimalizovaná) |
| `public/stargate-og.png` | 866 KB | 1024×1024 | OG image |
| `public/apple-icon.png` | 46 KB | 180×180 | Apple touch icon |
| `public/favicon.ico` | 4 KB | 32×32 | Favicon |

### Komponenty

| Soubor | Popis |
|--------|-------|
| `src/components/StargateLogo.tsx` | Animovaný stargate (28 vrstev, glyphs, chevrons) |
| `src/components/StargateGate.tsx` | SVG stargate (stará verze, holografická) |
| `src/components/StargatePortal.tsx` | Mini SVG stargate (stará verze) |

---

## Brand colors

| Barva | Hex | Použití |
|-------|-----|---------|
| **Cyan glow** | `#6ffff0` | Chevron glow, center lock |
| **Metal šedá** | `#7e7f81` | Metalický kruh |
| **Tmavá šedá** | `#656667` | Vnější kruh |
| **Black** | `#000000` | Event horizon, pozadí |
| **Purple** | `rgba(139,92,246,*)` | Rotující ringy |
| **Gold** | `rgba(245,215,142,*)` | Sri Yantra ringy |

---

## Umístění na webu

| Umístění | Soubor | Velikost |
|----------|--------|----------|
| **Navigace** (header) | `stargate-icon.png` | 48×48px |
| **Gaming sekce** (`/doge-vs-zion`) | `StargateLogo` komponenta | 360px max-width |
| **Favicon** | `favicon.ico` | 32×32px |
| **Apple touch** | `apple-icon.png` | 180×180px |
| **OG image** | `stargate-og.png` | 1024×1024px |

---

## Performance optimalizace

| Optimalizace | Co dělá |
|--------------|---------|
| `content-visibility: auto` | Přeskočí renderování když je off-screen |
| `contain: strict` na `.gate` | Izoluje layout/paint |
| `translate3d` místo `translate` | GPU compositing |
| `will-change: transform` | Před-alokace GPU vrstev |
| `backface-visibility: hidden` | Zrychluje 3D transformy |
| `pointer-events: none` | Rotující vrstvy nepřijímají eventy |
| `width: 35%` na obrázky | Obrázky 35% gate (ne 100%) — dle originálu |
| `prefers-reduced-motion` | Vypne animace pro uživatele s preferencí |

---

## Zdroj

- **Originál:** [newearth.cz](https://newearth.cz) — `stargate.css` (745 řádků, 44 KB)
- **HTML struktura:** 28 `<img>` rotujících vrstev, 39 `<div class="glyph">`, 9+9 chevronů
- **CSS hack:** `.logo img { width: 35% }` v originálu přepisuje `.gate img { width: 100% }` — obrázky jsou 35% gate ne 100%

---

## Modifikace

Pro změnu velikosti stargate v gaming sekci:
```tsx
// src/app/doge-vs-zion/page.tsx
<StargateLogo className="mx-auto max-w-[360px]" />
```

Pro změnu navigační ikony:
```tsx
// src/components/Navigation.tsx
<Image src="/stargate-icon.png" alt="ZION Stargate" width={48} height={48} />
```

Pro regeneraci statických ikon z live stargate:
```bash
# Hi-res render stargate z live stránky (deviceScaleFactor 4)
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 4 });
  await page.goto('https://zionterranova.com/doge-vs-zion', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  await page.evaluate(() => { const el = document.querySelector('.stargate-wrap'); if (el) el.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(3000);
  const el = await page.\$('.stargate-wrap');
  await el.screenshot({ path: '/tmp/stargate-hires.png' });
  await browser.close();
})();
"

# Vygenerovat všechny velikosti
magick /tmp/stargate-hires.png -trim -strip /tmp/stargate-trimmed.png
magick /tmp/stargate-trimmed.png -resize 512x512^ -gravity center -extent 512x512 -strip public/stargate-icon.png
magick /tmp/stargate-trimmed.png -resize 1024x1024^ -gravity center -extent 1024x1024 -strip public/stargate-og.png
magick /tmp/stargate-trimmed.png -resize 180x180^ -gravity center -extent 180x180 -strip public/apple-icon.png
magick /tmp/stargate-trimmed.png -resize 32x32^ -gravity center -extent 32x32 -strip public/favicon.ico
magick /tmp/stargate-trimmed.png -resize 48x48^ -gravity center -extent 48x48 -strip public/stargate-nav.png
```
