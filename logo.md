# ZION Brand Logo Inventory

This file tracks where the **original company logo** (historic ZION mark) and the **canonical new ZION symbol** (2024/2025 brand package) are applied.

## Asset sources

| Logo | Source file(s) | Notes |
|------|----------------|-------|
| **Original company logo** | `APP&WEB/MarketPlace/public/logo144.png` (500×500 PNG) | Also copied to `APP&WEB/website-v2.9/public/images/logo144.png` |
| **Stargate / portal Z** | `APP&WEB/website-v2.9/public/stargate/Z.gif` (+ `Z.webp`) | Grayscale/contrast animated Z used in the stargate/portal |
| **Canonical new symbol** | `LOGO/org/symbol-1024x1024.png` | Master transparent PNG |
| | `LOGO/org/symbol-200x200.png` | CoinMarketCap / favicon / apple-touch |
| | `LOGO/org/favicon.ico` | Multi-resolution ICO |
| | `LOGO/org/zion-social-banner.png` | OpenGraph / Twitter banner |

## Where the original company logo is used

- `APP&WEB/MarketPlace/public/logo144.png` → served as `/logo144.png`
- `APP&WEB/MarketPlace/src/app/layout.tsx` → footer logo image
- `APP&WEB/website-v2.9/public/images/logo144.png` → served as `/images/logo144.png`
- `APP&WEB/website-v2.9/public/maintenance.html` → footer logo (`images/logo144.png`)
- `APP&WEB/website-v2.9/public/maintenance.html` → stargate center logo (`stargate/Z.gif`)
- `APP&WEB/website-v2.9/src/components/StargateLogo.tsx` → homepage stargate center (`stargate/Z.gif`)

## Where the canonical new symbol is used

- `APP&WEB/OasisWeb/src/app/layout.tsx` → favicon (`/favicon.ico`) + apple-touch (`/symbol-200x200.png`)
- `APP&WEB/MarketPlace/src/components/Navbar.tsx` → top-left nav image (`/symbol-200x200.png`)
- `APP&WEB/MarketPlace/src/app/layout.tsx` → favicon (`/favicon.ico`) + apple-touch (`/symbol-200x200.png`)
- `APP&WEB/MarketPlace/public/symbol-200x200.png` + `zion-social-banner.png`
- `APP&WEB/website-v2.9/src/components/Navigation.tsx` → top-left nav image (`/symbol-200x200.png`)
- `APP&WEB/website-v2.9/public/maintenance.html` → favicon + apple-touch (`symbol-200x200.png`)
- `APP&WEB/website-v2.9/public/maintenance.html` → OpenGraph (`zion-social-banner.png`)
- `ZION_OS/dashboard/dashboard.html` + `v31/index.html` → `/v31/favicon.ico` + `/v31/symbol-200x200.png` header icon
- `ZION_OS/dashboard/app.py` → `AUTH_EXEMPT_ROUTES` for `/v31/favicon.ico` and `/v31/symbol-200x200.png`
- `APP&WEB/mobile-app/assets/` → `icon.png`, `splash.png`, `adaptive-icon.png` generated from `LOGO/org/symbol-1024x1024.png`
- `APP&WEB/desktop-agent/` build → packaged with the new logo/icon (`favicon.ico` and `APP&WEB/desktop-agent` icons)

## Recent changes (2026-08-06)

1. Restored original company logo in the intro hub (`maintenance.html`) stargate center and footer.
2. Restored `logo144.png` to the original 500×500 company mark in MarketPlace and website-v2.9.
3. Updated MarketPlace and website-v2.9 top navigation to use the canonical new symbol `/symbol-200x200.png`.
4. Created this `logo.md` to keep track of logo usage.

## Notes

- `logo144.png` is intentionally a 500×500 PNG despite its name; it is the original company logo master.
- Favicons / apple-touch-icons / social banners remain the canonical new symbol.
- `StargateLogo.tsx` and `maintenance.html` intentionally keep the historic `stargate/Z.gif` for the portal animation.
