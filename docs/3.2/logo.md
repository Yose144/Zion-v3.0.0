# ZION Brand Logo Inventory

This file tracks where the **original company logo** (historic ZION mark) and the **canonical ZION symbol** (2026 brand package) are applied.

## Asset sources

| Logo | Source file(s) | Notes |
|------|----------------|-------|
| **Original company logo** | `apps/MarketPlace/public/logo144.png` (500×500 PNG) | Also copied to `apps/website-v2.9/public/images/logo144.png` |
| **Stargate / portal Z** | `apps/website-v2.9/public/stargate/Z.gif` (+ `Z.webp`) | Grayscale/contrast animated Z used in the stargate/portal |
| **Canonical ZION symbol** | `canon/brand/ZionLogo.png` | Master raster source (2026 rasta Z-Tree mark) |
| | `canon/brand/org/symbol-1024x1024.png` | Master transparent PNG |
| | `canon/brand/org/symbol-200x200.png` | CoinMarketCap / favicon / apple-touch |
| | `canon/brand/org/favicon.ico` | Multi-resolution ICO |
| | `canon/brand/org/zion-social-banner.png` | OpenGraph / Twitter banner |
| | `canon/brand/org/zion-desktop.ico` / `zion-desktop.icns` | Desktop agent Windows / macOS icons |
| | `canon/brand/org/zion-mobile-adaptive-icon.png` / `zion-mobile-splash.png` | Mobile Expo icons |

## Where the original company logo is used

- `apps/MarketPlace/public/logo144.png` → served as `/logo144.png`
- `apps/MarketPlace/src/app/layout.tsx` → footer logo image
- `apps/website-v2.9/public/images/logo144.png` → served as `/images/logo144.png`
- `apps/website-v2.9/public/maintenance.html` → footer logo (`images/logo144.png`)
- `apps/website-v2.9/public/maintenance.html` → stargate center logo (`stargate/Z.gif`)
- `apps/website-v2.9/src/components/StargateLogo.tsx` → homepage stargate center (`stargate/Z.gif`)

## Where the canonical ZION symbol is used

- `apps/OasisWeb/src/app/layout.tsx` → favicon (`/favicon.ico`) + apple-touch (`/symbol-200x200.png`)
- `apps/MarketPlace/src/components/Navbar.tsx` → top-left nav image (`/symbol-200x200.png`)
- `apps/MarketPlace/src/app/layout.tsx` → favicon (`/favicon.ico`) + apple-touch (`/symbol-200x200.png`)
- `apps/MarketPlace/public/symbol-200x200.png` + `zion-social-banner.png`
- `apps/website-v2.9/src/components/Navigation.tsx` → top-left nav image (`/symbol-200x200.png`)
- `apps/website-v2.9/src/app/layout.tsx` → OpenGraph (`/zion-social-banner.png`)
- `apps/website-v2.9/public/maintenance.html` → favicon + apple-touch (`symbol-200x200.png`)
- `apps/website-v2.9/public/maintenance.html` → OpenGraph (`zion-social-banner.png`)
- `apps/website-v2.9/public/tokenlists/wzion.tokenlist.json` → token logoURI (`https://zionterranova.com/symbol-200x200.png`)
- `apps/mobile-app/assets/` → `icon.png`, `splash.png`, `adaptive-icon.png` generated from `canon/brand/org/`
- `apps/desktop-agent/src/assets/` → `icon.png`, `icon.ico`, `icon.icns`, `tray-icon.png`, `logo.png` generated from `canon/brand/org/`
- `archive/DesktopAgentP3.0.6/src/assets/` → archived desktop agent copies
- `ZION_OS/dashboard/dashboard.html` + `v31/index.html` → `/v31/favicon.ico` + `/v31/symbol-200x200.png` header icon
- `ZION_OS/dashboard/app.py` → `AUTH_EXEMPT_ROUTES` for `/v31/favicon.ico` and `/v31/symbol-200x200.png`

## Build and deploy workflow

1. Place the master raster in `canon/brand/ZionLogo.png`.
2. Run `python3 canon/brand/org/build_org_logos.py` to regenerate `canon/brand/org/`.
3. Copy the generated assets to the targets (website, marketplace, OasisWeb, mobile, desktop, dashboard).
4. See `docs/3.1/logo.md` for the full step-by-step workflow.

## Recent changes (2026-08-07)

1. Re-generated the `canon/brand/org/` brand package from the new `canon/brand/ZionLogo.png`.
2. Replaced canonical symbol assets across website-v2.9, MarketPlace, OasisWeb, mobile app, desktop agent and dashboard.
3. Added `.ico`, `.icns` and mobile splash to the build script.
4. Updated this inventory to point at the new canonical source.

## Notes

- `logo144.png` is intentionally a 500×500 PNG despite its name; it is the original company logo master.
- Favicons / apple-touch-icons / social banners use the canonical new symbol.
- `StargateLogo.tsx` and `maintenance.html` intentionally keep the historic `stargate/Z.gif` for the portal animation.
