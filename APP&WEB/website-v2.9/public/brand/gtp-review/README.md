# ZION Z-Tree — GTP Brand Package

A clean vector identity built from the brand direction established in the OASIS work:

- **Tree of Life:** wide, faceted umbrella canopy inspired by root `logo.jpeg`.
- **ZION:** a strong gold/emerald **Z** becomes the trunk and roots.
- **Legacy:** `zion-matrix-legacy.*` preserves the neon green / digital-rain feeling from the original `Z.gif`.

## Recommended usage

| Asset | Recommended use |
|---|---|
| `zion-primary-cosmic.*` | Default app/social/website avatar |
| `zion-matrix-legacy.*` | Desktop miner, technical tools, legacy Matrix identity |
| `zion-gold-emerald.*` | Premium ecosystem / OASIS materials |
| `zion-exchange-mark.svg`, `zion-exchange-mark-200.png` | CoinMarketCap, CoinGecko, exchange listings — simplified for small square placements |
| `zion-exchange-transparent.*` | Detailed transparent mark, only for larger placements |
| `zion-light-background.*` | Documents or light interfaces |
| `zion-wordmark-dark.*` / `zion-wordmark-light.*` | Header, marketing, presentations |
| `zion-social-banner.*` | Social and OpenGraph card (1200×630) |
| `favicon.ico`, `favicon-*.png` | Browser and app icons |

## Rebuild

```bash
python3 LOGO/gtp/build_gtp_logos.py
```

Requires `python3`, Pillow, and `rsvg-convert` (provided by `librsvg`).

## Notes

- SVG is the canonical format; PNGs are generated deliverables.
- Do not use the detailed tree icon for a tiny exchange badge: use the dedicated `zion-exchange-mark` asset.
- These assets are not wired into deployed sites yet; review and approve a direction before replacing existing public identity assets.
