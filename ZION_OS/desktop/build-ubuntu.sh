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

echo "==> Building Tauri .deb bundle…"
npm run tauri:build

echo "==> Installer ready:"
ls -lh src-tauri/target/release/bundle/deb/*.deb
