# ZION Brand Identity — GEM Collection (v3.0.7)

> **Location:** `LOGO/gem/`  
> **Brand Concept:** The sacred **Tree of Life** (`logo.jpeg`) integrated with the iconic **Matrix Z** (`Z.gif`).

---

## 🎨 Design Concept & Symbolic Integration

1. **The Z-Trunk:**
   - The central trunk forms a stylized, organic letter **Z**.
   - The top horizontal bar flares into the scaffold branches of the canopy.
   - The diagonal trunk stroke embodies the Yggdrasil axis.
   - The bottom bar grounds the emblem, dissolving into sprawling roots.
   - Glowing energy veins (matrix green / gold) run along the wood grain.

2. **Umbrella Canopy:**
   - Wide, majestic dome composed of hundreds of faceted, triangular leaves radiating outward.
   - Rich color palette blending emerald green, matrix lime, gold/amber highlights, cyan, and deep purple shadow accents.
   - Suspended throughout the canopy are glowing **Fruit of Life** orbs (gold, emerald, cyan, magenta).

3. **Sacred Geometry & Cosmic Frame:**
   - Outer metallic ring with 12 cardinal ticks representing cosmic harmony.
   - Subtle starfield particles / matrix digital rain in the background void.

---

## 📁 Generated Assets Map

| Asset File | Resolution | Description & Best Use Case |
|---|---|---|
| `icon-cosmic.png` / `.svg` | 1024×1024 | Primary brand avatar with cosmic deep-space void & gold aura. |
| `icon-matrix-green.png` / `.svg` | 1024×1024 | Neon matrix green edition with digital rain lines (tribute to `Z.gif`). |
| `icon-gold-green.png` / `.svg` | 1024×1024 | Luxury gold & emerald hybrid edition for official documents & VIP badges. |
| `icon-transparent.png` / `.svg` | 1024×1024 | Clean transparent background edition for **CoinMarketCap / CoinGecko / Exchanges**. |
| `icon-light.png` / `.svg` | 1024×1024 | Inverted color edition for white/light document backgrounds. |
| `wordmark-dark.png` / `.svg` | 1200×600 | Horizontal lockup with "ZION TERRA NOVA" typography for dark sites. |
| `wordmark-light.png` / `.svg` | 1200×600 | Horizontal lockup for light websites/documents. |
| `banner-header.png` / `.svg` | 1200×630 | Social banner / OpenGraph image for Twitter, Discord, and Telegram. |
| `favicon.ico` | Multi-res | Native ICO containing 16x16, 32x32, 48x48 icon layers. |
| `favicon.png` + `favicon-*.png` | 16–256px | Web favicons for browser tabs and mobile bookmark icons. |

---

## 🚀 How to Rebuild / Customize Assets

All assets are generated deterministically via the included Python pipeline:

```bash
python3 LOGO/gem/build_gem_logos.py
```

*Prerequisites: `python3`, `rsvg-convert` (`brew install librsvg`), `Pillow` (`pip install Pillow`).*
