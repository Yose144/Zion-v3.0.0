#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v apt &>/dev/null; then
  echo "Tento script je pro Debian/Ubuntu systémy."
  exit 1
fi

echo "==> Installing Tauri build dependencies for Ubuntu…"
sudo apt update
sudo apt install -y \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  libjavascriptcoregtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libdbus-1-dev \
  pkg-config

echo "==> Cleaning root-owned local cargo cache in src-tauri/.cargo-home…"
if [ -d "src-tauri/.cargo-home" ]; then
  sudo rm -rf "src-tauri/.cargo-home"
fi

echo "==> Building frontend…"
npm ci 2>/dev/null || npm install
npm run build

echo "==> Building Tauri .deb bundle (with embedded Python dashboard)…"
# Use a clean target dir to avoid root-owned artifact conflicts.
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$(pwd)/src-tauri/target}"
npm run tauri:build

echo "==> Installer ready:"
DEB_PATH="$(find "$CARGO_TARGET_DIR/release/bundle/deb" -name '*.deb' | sort -V | tail -1)"
if [ -z "$DEB_PATH" ]; then
  echo "ERROR: no .deb found in $CARGO_TARGET_DIR/release/bundle/deb/"
  exit 1
fi
ls -lh "$DEB_PATH"
echo ""
echo "Install with:"
echo "  sudo dpkg -i \"$DEB_PATH\""
echo "  sudo apt-get install -f   # resolves dependencies if needed"
