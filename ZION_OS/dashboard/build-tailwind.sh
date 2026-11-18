#!/usr/bin/env bash
# Rebuild the dashboard's compiled Tailwind stylesheet.
#
# The dashboard used to load https://cdn.tailwindcss.com at runtime, which
# ships ~400 KB of JS, compiles classes in the browser on every page load and
# prints "cdn.tailwindcss.com should not be used in production" in the console.
# `tailwind.build.css` is the static replacement; regenerate it whenever you add
# or change utility classes in dashboard.html / dashboard.js / app.py.
#
# Usage:
#   bash ZION_OS/dashboard/build-tailwind.sh
#   TAILWIND_BIN=./node_modules/.bin/tailwindcss bash ZION_OS/dashboard/build-tailwind.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

CFG="$(mktemp -t zion-tw-config.XXXXXX.js)"
SRC="$(mktemp -t zion-tw-src.XXXXXX.css)"
trap 'rm -f "$CFG" "$SRC"' EXIT

cat > "$CFG" <<'EOF'
/** Mirrors the inline tailwind.config that used to live in dashboard.html. */
module.exports = {
  content: [
    './dashboard.html',
    './dashboard.js',
    './app.py',
    './ops_console.py',
    './*.html',
    './v31/**/*.{html,js}',
  ],
  theme: {
    extend: {
      colors: {
        'zion-gold': 'rgb(252 209 22 / <alpha-value>)',
        'zion-purple': 'rgb(228 30 43 / <alpha-value>)',
        'zion-cyan': 'rgb(7 137 48 / <alpha-value>)',
        'zion-blue': 'rgb(30 58 138 / <alpha-value>)',
      },
    },
  },
};
EOF

printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' > "$SRC"

BIN="${TAILWIND_BIN:-}"
if [ -z "$BIN" ]; then
  if command -v tailwindcss >/dev/null 2>&1; then
    BIN="$(command -v tailwindcss)"
  else
    echo "[tailwind] tailwindcss CLI not found — install it first:"
    echo "           npm i -g tailwindcss@3.4.17   (or set TAILWIND_BIN=…)"
    exit 1
  fi
fi

"$BIN" -c "$CFG" -i "$SRC" -o tailwind.build.css --minify
rm -f tailwind.build.css.gz
printf '[tailwind] wrote %s (%s bytes)\n' "tailwind.build.css" "$(wc -c < tailwind.build.css | tr -d ' ')"
