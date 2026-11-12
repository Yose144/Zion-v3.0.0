#!/usr/bin/env bash
# IntroPage asset optimisation — reproducible pipeline.
#
#   bash scripts/optimize-assets.sh
#
# Replaces the heavy legacy assets with WebP derivatives that keep the same
# visual result at the sizes the page actually renders them:
#
#   stargate/Z.gif             625 KB animated GIF, rendered at 64 px
#     -> stargate/z-mark.webp    static frame, 128 px (2x for retina)
#   glyph-transparent.png      646 KB PNG, rendered at 240 px
#     -> glyph-transparent.webp  480 px
#   images/market-open.webp    333 KB, rendered at <=575 px
#     -> 1150 px (2x)
#   textures/*                 4K/2K JPGs used by the Nirvana 3D embed
#     -> 1024/768 px WebP
#
# Originals stay in git history; this script is idempotent.
set -euo pipefail
cd "$(dirname "$0")/.."
PUB=public

need() { command -v "$1" >/dev/null || { echo "missing: $1" >&2; exit 1; }; }
need magick

webp() { # in out width quality
  magick "$1" -resize "${3}x" -strip -quality "$4" -define webp:method=6 "$2"
}

# ── Brand marks ────────────────────────────────────────────────────────────
# Frame 40 of the original loop is the cleanest "Z" glyph.
magick "$PUB/stargate/Z.gif[40]" -resize 128x128 -strip -quality 88 \
  -define webp:method=6 "$PUB/stargate/z-mark.webp"
webp "$PUB/glyph-transparent.png"        "$PUB/glyph-transparent.webp"   480 82
webp "$PUB/symbol-200x200.png"           "$PUB/symbol-200x200.webp"      256 86
webp "$PUB/images/logo144.png"           "$PUB/images/logo320.webp"      320 86

# ── Content images ────────────────────────────────────────────────────────
webp "$PUB/images/market-open.webp"      "$PUB/images/market-open.webp"  1150 78
webp "$PUB/images/nirvana-preview.webp"  "$PUB/images/nirvana-preview.webp" 1100 78
webp "$PUB/images/kundun.jpg"            "$PUB/images/kundun.webp"       688 80
webp "$PUB/images/TransAcc.jpeg"         "$PUB/images/transacc.webp"     900 78

# ── 3D scene textures (three.js TextureLoader) ────────────────────────────
webp "$PUB/textures/milkyway-eso-4k.jpg"      "$PUB/textures/milkyway-1k.webp" 1024 68
webp "$PUB/textures/sun-2k.jpg"               "$PUB/textures/sun-1k.webp"      1024 80
webp "$PUB/textures/2k_mercury.jpg"           "$PUB/textures/mercury-768.webp"  768 78
webp "$PUB/textures/2k_venus_atmosphere.jpg"  "$PUB/textures/venus-768.webp"    768 78
webp "$PUB/textures/2k_mars.jpg"              "$PUB/textures/mars-768.webp"     768 78
webp "$PUB/textures/2k_jupiter.jpg"           "$PUB/textures/jupiter-768.webp"  768 78
webp "$PUB/textures/2k_saturn.jpg"            "$PUB/textures/saturn-768.webp"   768 78
webp "$PUB/textures/2k_uranus.jpg"            "$PUB/textures/uranus-768.webp"   768 78
webp "$PUB/textures/2k_neptune.jpg"           "$PUB/textures/neptune-768.webp"  768 78
webp "$PUB/textures/2k_moon.jpg"              "$PUB/textures/moon-512.webp"     512 78
webp "$PUB/textures/earth-blue-marble.webp"   "$PUB/textures/earth-512.webp"    512 78
webp "$PUB/textures/2k_saturn_ring_alpha.png" "$PUB/textures/saturn-ring-512.webp" 512 86

echo "── assets written ──"
ls -l "$PUB/stargate/z-mark.webp" "$PUB/glyph-transparent.webp" \
      "$PUB/symbol-200x200.webp" "$PUB/images/logo320.webp" \
      "$PUB/images/market-open.webp" "$PUB/textures/milkyway-1k.webp" |
  awk '{printf "%8.1f KB  %s\n", $5/1024, $9}'
