# ZION Brand Package — `LOGO/org/`

Canonical deliverables based on `LOGO/ZionLogo.png` for listings, websites, apps and socials.

The previous `LOGO/symbol.png` package is still buildable with:
```bash
python3 LOGO/org/build_org_logos.py --source LOGO/symbol.png --legacy-symbol
```

## Quick pick

| Use case | File |
|---|---|
| **CoinMarketCap / CoinGecko listing** | `symbol-200x200.png` |
| **Website favicon** | `favicon.ico` or `favicon-32.png` |
| **App icon (iOS/Android)** | `zion-primary-cosmic.png` |
| **Social banner / OpenGraph** | `zion-social-banner.png` |
| **Header wordmark dark** | `zion-wordmark-dark.png` |
| **Header wordmark light** | `zion-wordmark-light.png` |
| **High-res master** | `symbol-1024x1024.png` |
| **Desktop .ico** | `zion-desktop.ico` |
| **Desktop .icns** | `zion-desktop.icns` |

## Generated assets

| File | Size | Description |
|---|---|---|
| `symbol-1024x1024.png` | 1024×1024 | Master icon, transparent PNG |
| `symbol-512x512.png` | 512×512 | High-res app / web icon |
| `symbol-256x256.png` | 256×256 | Wallet / app icon |
| `symbol-200x200.png` | 200×200 | **CoinMarketCap / CoinGecko / exchange listing** |
| `favicon.png` | 512×512 | Default web favicon PNG |
| `favicon.ico` | multi-res | ICO with 16, 32, 48, 64, 128, 256 layers |
| `favicon-16/32/48/64/128/144/180/192/256/512.png` | various | Individual favicon sizes |
| `favicon.svg` | 256×256 | SVG wrapper with embedded PNG (for modern browsers) |
| `symbol.svg` | 512×512 | SVG wrapper with embedded PNG |
| `zion-wordmark-dark.png` | 1200×600 | Light text on dark background |
| `zion-wordmark-light.png` | 1200×600 | Dark text on white background |
| `zion-social-banner.png` | 1200×630 | Twitter / Discord / Telegram / OpenGraph banner |
| `zion-primary-cosmic.png` | 1024×1024 | App icon, dark cosmic background with gold glow |
| `zion-gold-emerald.png` | 1024×1024 | App icon, gold-to-emerald gradient background |
| `zion-light-background.png` | 1024×1024 | App icon, light/white background |
| `zion-exchange-mark-200/256/512.png` | 200/256/512 | Exchange / CMC-style square mark |
| `zion-desktop.ico` | multi-res | Windows desktop agent icon |
| `zion-desktop.icns` | multi-res | macOS desktop agent icon set |
| `zion-mobile-adaptive-icon.png` | 1024×1024 | Transparent adaptive / app icon for mobile |
| `zion-mobile-splash.png` | 1242×2208 | Expo splash screen with dark background |

## Rebuild

```bash
python3 LOGO/org/build_org_logos.py
```

Requirements:
- `python3`
- `Pillow` (`pip install Pillow` if missing)
- `iconutil` (macOS only, required for `.icns`)

The script reads `LOGO/ZionLogo.png`, removes the stray top-left watermark and makes the background transparent, then generates the whole package in `LOGO/org/`.

## Notes

- The `*.svg` files are SVG wrappers that embed the generated PNG for compatibility. They are not true vector traces of the symbol.
- For a real vector source, the original symbol would need to be traced or redrawn in SVG.
- The canonical transparent master is `symbol-1024x1024.png`.
