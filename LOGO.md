# ZION TerraNova — Logo

> Oficiální logo ZION TerraNova — **Hiran Golden Orb**.
> Vytvořeno 2026-06-28. Založeno na vizuální identitě [`GoldenOrb`](APP&WEB/website-v2.9/src/components/GoldenOrb.tsx) komponenty z homepage.

---

## Koncept

Logo reprezentuje **Hirana** — AI vrstvu (L3) ZION ekosystému. Vizuálně vychází z interaktivního Golden Orbu, který je na homepage vedle Terra Nova sekce jako druhý hlavní pilíř.

### Vizuální prvky

| Prvek | Význam |
|-------|--------|
| **Golden Orb** | Zlatá koule — Hiran jako AI brána, světlo vědomí |
| **Sri Yantra** | Posvátná geometrie — 9 propletených trojúhelníků (Shiva/Shakti), 16- a 8-okvětní lotus, Bindu (centrální bod) |
| **12 světelných paprsků** | Radiální paprsky kolem orbu — Deeksha požehnání |
| **8 vnitřních paprsků** | Counter-rotating paprsky — Ekam (jednota) |
| **Kosmické pozadí** | Deep space + nebula (purple/gold) + hvězdy — Terra Nova |
| **ZION / TERRA NOVA text** | Plná verze loga |

### Brand barvy

| Barva | HEX | CSS proměnná | Použití |
|-------|-----|-------------|---------|
| Gold | `#FFD700` / `#fbbf24` | `--color-zion-gold` | Orb tělo, paprsky, text |
| Purple | `#9333EA` | `--color-zion-purple` | Nebula, accent |
| Cyan | `#06B6D4` | `--color-zion-cyan` | Accent, sekundární |

---

## Soubory

### Produkční logo (veřejné)

Všechny soubory jsou v `APP&WEB/website-v2.9/public/`:

| Soubor | Formát | Rozlišení | Velikost | Účel |
|--------|--------|-----------|----------|------|
| `zion-logo-hiran.svg` | SVG | 512×512 (škálovatelné) | ~7.7 KB | Plné logo s textem (vektor) |
| `zion-logo-hiran.png` | PNG | 1024×1024 | ~195 KB | OG image / social sharing |
| `zion-icon-hiran.svg` | SVG | 512×512 (škálovatelné) | ~6.5 KB | Icon-only (bez textu) — nav bar |
| `zion-icon-hiran.png` | PNG | 1024×1024 | ~187 KB | PWA icon, fallback |
| `favicon.ico` | ICO | 16/32/48 | ~15 KB | Browser tab favicon |
| `apple-touch-icon.png` | PNG | 180×180 | ~14 KB | Apple touch icon (iOS) |
| `icon-192.png` | PNG | 192×192 | ~15 KB | PWA manifest icon |
| `icon-512.png` | PNG | 512×512 | ~66 KB | PWA manifest icon |

### Next.js app router ikony

Tyto soubory Next.js automaticky detekuje a vloží do `<head>`:

| Soubor | Cesta | Účel |
|--------|-------|------|
| `favicon.ico` | `src/app/favicon.ico` | Browser tab |
| `apple-icon.png` | `src/app/apple-icon.png` | Apple touch icon |

### Zdrojové SVG (editovatelné)

| Soubor | Cesta | Popis |
|--------|-------|-------|
| `zion-logo-hiran.svg` | `APP&WEB/website-v2.9/public/zion-logo-hiran.svg` | Plné logo s textem — edituj tento soubor |
| `zion-icon-hiran.svg` | `APP&WEB/website-v2.9/public/zion-icon-hiran.svg` | Icon-only (bez textu) — edituj tento soubor |

### Stará loga (zachována, nepoužívají se)

| Soubor | Cesta | Poznámka |
|--------|-------|----------|
| `LogoStargate.jpg` | `APP&WEB/website-v2.9/public/LogoStargate.jpg` | Předchozí logo (stargate) — nahrazeno |
| `LogoNew.jpg` | `APP&WEB/website-v2.9/public/LogoNew.jpg` | Stará verze — nepoužívá se |
| `zion_logo.png` | `APP&WEB/website-v2.9/public/zion_logo.png` | Stará verze — nepoužívá se |

---

## Kde se logo používá

### Na webu (https://zionterranova.com)

| Místo | Soubor | Velikost |
|-------|--------|----------|
| **Navigation bar** (všechny stránky) | `zion-icon-hiran.svg` | 48×48 px |
| **OG image** (social sharing) | `zion-logo-hiran.png` | 1024×1024 |
| **Favicon** (browser tab) | `favicon.ico` | 16/32/48 |
| **Apple touch icon** (iOS home screen) | `apple-icon.png` | 180×180 |

### V kódu

| Soubor | Řádek | Co |
|--------|-------|-----|
| `src/components/Navigation.tsx` | ~165 | `<Image src="/zion-icon-hiran.svg" ...>` |
| `src/app/layout.tsx` | ~47 | `images: [{ url: '/zion-logo-hiran.png', ... }]` |
| `src/app/favicon.ico` | — | Next.js auto-detekce |
| `src/app/apple-icon.png` | — | Next.js auto-detekce |

---

## Jak upravit logo

### 1. Edituj SVG

Edituj zdrojový SVG soubor:
- Plné logo: `APP&WEB/website-v2.9/public/zion-logo-hiran.svg`
- Icon-only: `APP&WEB/website-v2.9/public/zion-icon-hiran.svg`

SVG je strukturované s komentáři:
- `KOSMICKÉ POZADÍ` — pozadí + hvězdy
- `SRI YANTRA` — posvátná geometrie
- `ORB` — golden orb + paprsky + sparkles
- `ZION TEXT` — text (jen v plném logu)

### 2. Vygeneruj PNG z SVG

```bash
cd APP&WEB/website-v2.9/public

# PNG 1024×1024 (OG image)
rsvg-convert -w 1024 -h 1024 zion-logo-hiran.svg -o zion-logo-hiran.png
rsvg-convert -w 1024 -h 1024 zion-icon-hiran.svg -o zion-icon-hiran.png

# Favicon (multi-size ICO)
rsvg-convert -w 48 -h 48 zion-icon-hiran.svg -o /tmp/favicon-48.png
rsvg-convert -w 32 -h 32 zion-icon-hiran.svg -o /tmp/favicon-32.png
rsvg-convert -w 16 -h 16 zion-icon-hiran.svg -o /tmp/favicon-16.png
magick /tmp/favicon-16.png /tmp/favicon-32.png /tmp/favicon-48.png favicon.ico

# Apple touch icon
rsvg-convert -w 180 -h 180 zion-icon-hiran.svg -o apple-touch-icon.png

# PWA icons
rsvg-convert -w 192 -h 192 zion-icon-hiran.svg -o icon-192.png
rsvg-convert -w 512 -h 512 zion-icon-hiran.svg -o icon-512.png
```

### 3. Zkopíruj do Next.js app router

```bash
cp favicon.ico ../src/app/favicon.ico
cp apple-touch-icon.png ../src/app/apple-icon.png
```

### 4. Deploy

```bash
cd APP&WEB/website-v2.9
REMOTE_HOST=mainnetedge SSH_KEY="" npm run deploy
```

---

## Nástroje

| Nástroj | Účel | Instalace |
|---------|------|-----------|
| `rsvg-convert` | SVG → PNG | `brew install librsvg` |
| `magick` (ImageMagick) | PNG → ICO | `brew install imagemagick` |
| `inkscape` | Alternativa pro SVG edit | `brew install --cask inkscape` |

---

## Historie

| Datum | Verze | Popis |
|-------|-------|-------|
| 2026-05-15 | `LogoStargate.jpg` | Původní logo (stargate) |
| 2026-06-28 | `zion-logo-hiran` | Nové logo — Hiran Golden Orb se Sri Yantra |

---

## Související soubory

- [`GoldenOrb.tsx`](APP&WEB/website-v2.9/src/components/GoldenOrb.tsx) — interaktivní 3D verze orbu na homepage
- [`GoldenEggHaraniagharba.tsx`](APP&WEB/website-v2.9/src/components/GoldenEggHaraniagharba.tsx) — sekce na homepage s Hiranem
- [`globals.css`](APP&WEB/website-v2.9/src/app/globals.css) — brand barvy (`--color-zion-gold`, `--color-zion-purple`, `--color-zion-cyan`)
- [`site.ts`](APP&WEB/website-v2.9/src/lib/site.ts) — brand konstanty
