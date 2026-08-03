#!/usr/bin/env bash
set -euo pipefail

echo "[native-libs] Linux scaffold build start"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACTS_DIR="${ROOT_DIR}/artifacts"
mkdir -p "${ARTIFACTS_DIR}"

# TODO: add CMake or custom build calls per algorithm.
# Expected outputs (future):
# - libzion_randomx.so
# - libzion_kawpow.so
# - libzion_autolykos.so

echo "[native-libs] Scaffold only - no binaries built yet"
