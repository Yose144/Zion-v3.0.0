# ZION TerraNova — Logo

> Oficiální logo ZION TerraNova — **Stargate**.
> Vytvořeno 2026-06-28. Založeno na originálním stargate z [newearth.cz](https://newearth.cz).

---

## Koncept

Logo reprezentuje **Stargate** — kosmický portál mezi světy. Je to přesná replika stargate z newearth.cz, která symbolizuje bránu do ZION Oasis (L4 metaverse) a celého ZION ekosystému.

> **Originál = animovaný stargate v gaming sekci (`/doge-vs-zion`).**
> Všechny ostatní verze (navigace, favicon, OG, hero panel, novinky) jsou **renderované miniatury** tohoto originálu.

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
| `src/components/StargateLogo.tsx` | Animovaný stargate (28 vrstev, glyphs, chevrons) — **použitá všude** |
| `src/components/StargateGate.tsx` | SVG stargate (stará verze, holografická) — **nepoužívá se** |
| `src/components/StargatePortal.tsx` | Mini SVG stargate (stará verze) — **nepoužívá se** |

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
| **Gaming sekce** (`/doge-vs-zion`) | `StargateLogo` komponenta | 360px max-width — **ORIGINÁL** |
| **Hero panel** (Aloha, rozbalený) | `StargateLogo` komponenta | ~280px |
| **Novinky** (DogeVsZionBanner) | `StargateLogo` komponenta | ~112px (h-28 w-28) |
| **Navigace** (header) | `stargate-icon.png` | 48×48px |
| **Favicon** | `favicon.ico` | 32×32px |
| **Apple touch** | `apple-icon.png` | 180×180px |
| **OG image** | `stargate-og.png` | 1024×1024px |

---

## Performance optimalizace

| Optimalizace | Co dělá |
|--------------|---------|
| `container-type: inline-size` | Container queries — glyfy/chevrony se škálují s velikostí |
| `cqw` jednotky | Všechny vmin hodnoty převedeny na cqw (2:1 poměr, gate = 50vmin) |
| `translate3d` místo `translate` | GPU compositing |
| `will-change: transform` | Před-alokace GPU vrstev |
| `backface-visibility: hidden` | Zrychluje 3D transformy |
| `pointer-events: none` | Rotující vrstvy nepřijímají eventy |
| `width: 35%` na obrázky | Obrázky 35% gate (ne 100%) — dle originálu |
| `overflow: hidden` na `.container` | Ořízne obrázky na kruh, chevrony přesahují ven |
| `prefers-reduced-motion` | Vypne animace pro uživatele s preferencí |

---

## Zdroj

- **Originál:** [newearth.cz](https://newearth.cz) — `stargate.css` (745 řádků, 44 KB)
- **HTML struktura:** 28 `<img>` rotujících vrstev, 39 `<div class="glyph">`, 9+9 chevronů
- **CSS hack:** `.logo img { width: 35% }` v originálu přepisuje `.gate img { width: 100% }` — obrázky jsou 35% gate ne 100%

---

## Historie vývoje a řešené problémy

### 1. Počáteční implementace
- Stažen `stargate.css`, `index.html`, `1.png`, `2.png`, `Z.gif`, `nebula.jpg` z newearth.cz
- Vytvořena komponenta `StargateLogo.tsx` se scoped CSS (`.stargate-wrap`)
- `Z.gif` optimalizován z 6.3MB na 625KB (64×64px)
- `nebula.jpg` optimalizován z 184KB na 77KB

### 2. Obrázky byly příliš velké
**Problém:** Obrázky `1.png` a `2.png` vyplnily celý gate (100%) místo 35%.
**Příčina:** V originálu je `.gate` uvnitř `<div class="logo">`, a CSS pravidlo `.logo img { width: 35% }` přepisuje `.gate img { width: 100% }` díky stejné specificitě ale pozdější pozici v CSS.
**Řešení:** Nastaveno `width: 35%` přímo na `.stargate-wrap .gate img`.

### 3. Obnovení originálních obrázků
**Problém:** Předchozí "optimalizace" převedla `1.png` (RGBA) a `2.png` (colormap) na gray+alpha — ztratily barvu.
**Řešení:** Obnoveny originální verze: `1.png` (700×700 RGBA, 192KB), `2.png` (737×737 colormap, 48KB).

### 4. Miniatura pro navigaci — SVG aproximace
**Problém:** První pokus byla ručně kreslená SVG ikona (`stargate-icon.svg`) — nebyla identická s originálem.
**Řešení:** SVG smazáno, nahrazeno Playwright renderem z live stargate.

### 5. Renderování ikon z live stargate
**Proces:**
1. Playwright otevře `https://zionterranova.com/doge-vs-zion`
2. Scroll na `.stargate-wrap`, pauza animací (`animation-play-state: paused`)
3. Screenshot s `deviceScaleFactor: 4` (4x rozlišení)
4. `magick -trim` ořízne na čtverec
5. Resize na všechny velikosti (512, 1024, 180, 48, 32)

### 6. Nahrazení předloh v Hero panelu a novinkách
**Problém:** Hero panel (Aloha) používal `StargateGate` (holografická SVG), novinky `StargatePortal` (malá SVG).
**Řešení:** Obě nahrazeny `StargateLogo` (originál):
- Hero: `max-w-[280px]`
- Novinky: `h-28 w-28` (112px)

### 7. Glyfy příliš velké v miniaturách
**Problém:** Glyfy (A-Z, a-m) a chevrony měly `font-size: 1.6vmin` a `width: 8vmin` — `vmin` je relativní k **viewportu**, ne ke kontejneru. V banneru (112px) byly glyfy stejně velké jako v gaming (360px).
**Řešení:** Container queries:
- `container-type: inline-size` na `.stargate-wrap`
- `vmin` → `cqw` (container query width)

### 8. Container-type nefungoval
**Problém:** `container-type: size` nefungoval s `aspect-ratio` (potřeboval explicitní výšku). `content-visibility: auto` přepisoval `container-type` zpět na `normal`.
**Řešení:**
- `container-type: inline-size` (funguje jen se šířkou)
- `cqmin` → `cqw` (inline-size podporuje jen cqw)
- Odstraněno `content-visibility: auto` a `contain: strict`

### 9. Glyfy příliš malé po container queries
**Problém:** Převod `vmin→cqw` byl 1:1, ale gate = 50vmin → 1vmin = 2cqw. Glyfy byly poloviční velikosti.
**Řešení:** Všechny `cqw` hodnoty zdvojnásobeny:
- Glyf: `1.6cqw` → `3.2cqw` (3.2% — originál 3%)
- Chevron: `8cqw` → `16cqw` (16% — originál 15%)

### 10. Chevrony uvězněné uvnitř kruhu
**Problém:** `.stargate-wrap` měl `overflow: hidden` + `border-radius: 50%` — ořízl chevrony uvnitř kruhu. V originálu chevrony přesahují ven.
**Řešení:**
- `overflow: hidden` + `border-radius: 50%` přesunuto z `.stargate-wrap` na `.container`
- `.container` ořízne jen rotující obrázky, chevrony a glyfy mohou přesahovat

### 11. Text v novinkách příliš velký
**Problém:** Badge text a nadpis v `DogeVsZionBanner` byly příliš velké.
**Řešení:**
- Badge: `text-[10px]` → `text-[8px]`, `px-2.5` → `px-2`
- Nadpis: `text-base/md:text-lg` → `text-sm/md:text-base`
- Podnadpis: `text-xs` → `text-[10px]`

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

Pro změnu velikosti v Hero panelu:
```tsx
// src/components/HeroSection.tsx
<StargateLogo className="max-w-[280px]" />
```

Pro změnu velikosti v novinkách:
```tsx
// src/components/DogeVsZionBanner.tsx
<div className="h-28 w-28 ...">
  <StargateLogo className="w-full h-full" />
</div>
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
  // Pauza animací pro čistý screenshot
  await page.evaluate(() => {
    const wrap = document.querySelector('.stargate-wrap');
    if (wrap) {
      const style = document.createElement('style');
      style.textContent = '.stargate-wrap * { animation-play-state: paused !important; } .stargate-wrap .gate { opacity: 0.5 !important; }';
      wrap.appendChild(style);
    }
  });
  await page.waitForTimeout(500);
  const el = await page.\$('.stargate-wrap');
  await el.screenshot({ path: '/tmp/stargate-hires.png' });
  await browser.close();
})();
"

# Vygenerovat všechny velikosti
magick /tmp/stargate-hires.png -trim -strip /tmp/stargate-trimmed.png
magick /tmp/stargate-trimmed.png -resize 512x512 -strip public/stargate-icon.png
magick /tmp/stargate-trimmed.png -resize 1024x1024 -strip public/stargate-og.png
magick /tmp/stargate-trimmed.png -resize 180x180 -strip public/apple-icon.png
magick /tmp/stargate-trimmed.png -resize 32x32 -strip public/favicon.ico
magick /tmp/stargate-trimmed.png -resize 48x48 -strip public/stargate-nav.png
```

---

## Deploy

```bash
cd APP&WEB/website-v2.9
REMOTE_HOST=mainnetedge SSH_KEY="" npm run deploy

# Na serveru (build s --no-cache, jinak se CSS neaktualizuje):
ssh root@mainnetedge "cd /root/zion-2.9.6-main/docker && \
  docker compose -f docker-compose.website.yml build --no-cache website && \
  docker rm -f zion-website; \
  docker compose -f docker-compose.website.yml up -d --force-recreate website && \
  sleep 12 && docker ps --filter name=zion-website --format '{{.Status}}'"
```

> **Důležité:** Vždy použít `build --no-cache` — jinak Docker použije starý CSS soubor z cache.

---

## Ověření

```bash
# Zkontrolovat computed styles
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto('https://zionterranova.com/doge-vs-zion', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const data = await page.evaluate(() => {
    const w = document.querySelector('.stargate-wrap');
    const g = w.querySelector('.glyph');
    const c = w.querySelector('.chevron');
    return {
      wrapWidth: getComputedStyle(w).width,
      containerType: getComputedStyle(w).containerType,
      glyphFontSize: getComputedStyle(g).fontSize,
      chevronWidth: getComputedStyle(c).width,
    };
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();
"
```

Očekávané hodnoty (gaming 360px):
- `containerType: "inline-size"`
- `glyphFontSize: ~11.5px` (3.2% z 360px)
- `chevronWidth: ~57.6px` (16% z 360px)
