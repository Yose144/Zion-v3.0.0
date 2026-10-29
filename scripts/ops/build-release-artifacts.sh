#!/usr/bin/env bash
# build-release-artifacts.sh — 9.B4/2.S3: release build matrix + SHA256SUMS.
#
# Builds the public artifact set for a given git commit from the V31
# workspace. Produces dist/<version>/<target>/zion-<bins>.tar.gz +
# per-target .sha256 + a combined SHA256SUMS file.
#
# Usage:
#   scripts/ops/build-release-artifacts.sh --version v3.2.0-rc1 \
#       --target aarch64-apple-darwin [--target x86_64-pc-windows-gnu] ...
#   # or one-shot: --all (every target the host can link)
#
# Targets matrix (linker requirements):
#   aarch64-apple-darwin   — macOS arm64 (local Xcode CLT)
#   x86_64-apple-darwin    — macOS Intel
#   x86_64-unknown-linux-gnu — Linux glibc (build on EDGE/Linux host or
#                              cross only if gcc-mingw present)
#   x86_64-unknown-linux-musl — Linux static (needs musl-gcc for C deps)
#   x86_64-pc-windows-gnu  — Windows (needs mingw-w64 linker)
# CUDA/OpenCL miner variants are separate `--features gpu-opencl` builds —
# GPU kernels can't be cross-compiled from macOS; build on the target host.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
V31="$REPO_ROOT/V31"
VERSION="${VERSION:-v3.2.0-beta}"
# Workspace packages to build → the binaries each produces.
PACKAGES=(zion-miner zion-core zion-cli)
BINS=(zion-miner zion-node zion zion-migrate)
TARGETS=()
OUT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --target)  TARGETS+=("$2"); shift 2 ;;
    --all)     TARGETS=(aarch64-apple-darwin x86_64-apple-darwin x86_64-unknown-linux-gnu x86_64-pc-windows-gnu); shift ;;
    --out)     OUT="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done
[ ${#TARGETS[@]} -gt 0 ] || { echo "specify --target or --all" >&2; exit 2; }
OUT="${OUT:-$REPO_ROOT/dist/$VERSION}"

GIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short=9 HEAD 2>/dev/null || echo nosha)"
mkdir -p "$OUT"
SUMS="$OUT/SHA256SUMS"
: > "$SUMS"
echo "=== ZION release artifacts: $VERSION (commit $GIT_SHA) → $OUT"

pkgs=(); for b in "${PACKAGES[@]}"; do pkgs+=(-p "$b"); done

for t in "${TARGETS[@]}"; do
  echo "--- target $t"
  # Provenance: embed the exact commit the artifact was built from.
  (cd "$V31" && ZION_GIT_SHA="$GIT_SHA" cargo build --release --target "$t" "${pkgs[@]}") || {
    echo "  BUILD FAIL $t — skipped"; continue; }
  bindir="$V31/target/$t/release"
  stage="$(mktemp -d)"
  ok=0
  for b in "${BINS[@]}"; do
    for f in "$bindir/$b" "$bindir/$b.exe"; do
      [ -f "$f" ] && cp "$f" "$stage/" && ok=1
    done
  done
  [ "$ok" = 1 ] || { echo "  no binaries for $t"; rm -rf "$stage"; continue; }
  tarfile="zion-$VERSION-$t.tar.gz"
  tar czf "$OUT/$tarfile" -C "$stage" .
  rm -rf "$stage"
  (cd "$OUT" && shasum -a 256 "$tarfile" >> "$SUMS")
  echo "  + $tarfile"
done
echo "=== done → $SUMS"; cat "$SUMS"
