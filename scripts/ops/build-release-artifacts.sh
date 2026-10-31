#!/usr/bin/env bash
# build-release-artifacts.sh — 9.B4 / 2.S3 / KS-4: reproducible release artifact matrix.
#
# Builds the public artifact set for one pinned commit and emits, per
# target+variant, a tarball containing the binaries plus BUILD-INFO.txt
# provenance, then a combined SHA256SUMS.
#
# Usage:
#   scripts/ops/build-release-artifacts.sh --version v3.2.0-rc1 \
#       --from-commit <sha> --target x86_64-unknown-linux-gnu
#   scripts/ops/build-release-artifacts.sh --all --container rust:1.95-slim-bullseye
#   scripts/ops/build-release-artifacts.sh --verify dist/v3.2.0-rc1
#
# Targets (linker requirements):
#   x86_64-unknown-linux-gnu   — glibc; build in a container to pin the
#                                baseline (bullseye = glibc 2.31) instead of
#                                inheriting the host's (EDGE 2.39, dev 2.43)
#   x86_64-pc-windows-gnu      — needs mingw-w64 (`gcc-mingw-w64-x86-64`)
#   aarch64-apple-darwin       — macOS arm64 (needs Xcode CLT, runs on a Mac)
#   x86_64-apple-darwin        — macOS Intel (needs Xcode CLT, runs on a Mac)
#
# Variants: a variant is a named feature set for zion-miner. The default
# build has no GPU features (CPU only); `gpu-opencl` adds the OpenCL miner.
#   --variant gpu-opencl:gpu-opencl
#   --variant gpu-all:gpu-opencl,gpu-cuda,native-hashers
#
# Why --container: a release artifact must not require the build host's
# glibc. Building on EDGE (2.39) makes the tarball unusable on older
# distros; building here (2.43) is worse. The container pins the baseline
# and keeps production hosts out of the build path entirely.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
V31="$REPO_ROOT/V31"
cd "$REPO_ROOT"

VERSION="${VERSION:-v3.2.0-beta}"
FROM_COMMIT="HEAD"
OUT=""
TARGETS=()
VARIANTS=("default:")
PACKAGES=""
JOBS=""
CONTAINER=""
ALLOW_DIRTY=0
VERIFY_DIR=""
KEEP_STAGE=0
LOCKED=1

# package → binaries it produces (hyphens make `BINS_FOR_<pkg>` invalid shell
# variable names, so this is a case function, not a variable table)
bins_for_pkg() {
  case "$1" in
    zion-miner)      echo "zion-miner" ;;
    zion-core)       echo "zion-node zion-migrate" ;;
    zion-cli)        echo "zion" ;;
    zion-pool)       echo "zion-pool" ;;
    zion-dao)        echo "zion-dao" ;;
    zion-multichain) echo "zion-multichain" ;;
    *)               echo "" ;;
  esac
}
DEFAULT_PACKAGES="zion-miner zion-core zion-cli"

usage() { sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-2}"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --version)      VERSION="$2"; shift 2 ;;
    --from-commit)  FROM_COMMIT="$2"; shift 2 ;;
    --target)       TARGETS+=("$2"); shift 2 ;;
    --all)          TARGETS=(x86_64-unknown-linux-gnu x86_64-pc-windows-gnu aarch64-apple-darwin x86_64-apple-darwin); shift ;;
    --linux)        TARGETS+=(x86_64-unknown-linux-gnu); shift ;;
    --variant)      VARIANTS+=("$2"); shift 2 ;;
    --packages)     PACKAGES="$2"; shift 2 ;;
    --out)          OUT="$2"; shift 2 ;;
    --jobs)         JOBS="$2"; shift 2 ;;
    --container)    CONTAINER="$2"; shift 2 ;;
    --allow-dirty)  ALLOW_DIRTY=1; shift ;;
    --unlocked)     LOCKED=0; shift ;;
    --keep-stage)   KEEP_STAGE=1; shift ;;
    --verify)       VERIFY_DIR="$2"; shift 2 ;;
    -h|--help)      usage 0 ;;
    *) echo "unknown arg: $1" >&2; usage 2 ;;
  esac
done

sha256_of() { # portable: GNU coreutils or BSD shasum
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

# ---------------------------------------------------------------- verify mode
verify_dist() {
  local dir="$1" fail=0 n=0
  [ -d "$dir" ] || { echo "verify: no such directory: $dir" >&2; exit 2; }
  [ -f "$dir/SHA256SUMS" ] || { echo "verify: missing $dir/SHA256SUMS" >&2; exit 2; }
  while read -r sum name; do
    [ -n "${name:-}" ] || continue
    n=$((n+1))
    if [ ! -f "$dir/$name" ]; then echo "  FAIL missing $name"; fail=$((fail+1)); continue; fi
    local got; got="$(sha256_of "$dir/$name")"
    if [ "$got" = "$sum" ]; then echo "  PASS sha256 $name"
    else echo "  FAIL sha256 $name"; echo "         want $sum"; echo "         got  $got"; fail=$((fail+1)); fi
    # every artifact must carry BUILD-INFO.txt with a full commit + target.
    # Member may appear as "BUILD-INFO.txt" or "./BUILD-INFO.txt" depending on
    # how tar was invoked — accept both.
    local member; member="$(tar tzf "$dir/$name" 2>/dev/null | grep -E '^\.?/?BUILD-INFO\.txt$' | head -1 || true)"
    if [ -n "$member" ]; then
      local info; info="$(tar xzOf "$dir/$name" "$member" 2>/dev/null || true)"
      if printf '%s' "$info" | grep -q '^commit: [0-9a-f]\{40\}$'; then echo "         BUILD-INFO.txt present (full commit pinned)"
      else echo "         FAIL BUILD-INFO.txt lacks full 40-char commit"; fail=$((fail+1)); fi
    else
      echo "         FAIL BUILD-INFO.txt missing in $name"; fail=$((fail+1))
    fi
  done < "$dir/SHA256SUMS"
  if [ "$fail" -eq 0 ]; then echo "RESULT: PASS ($n artifacts verified)"; exit 0
  else echo "RESULT: FAIL ($fail problems)"; exit 1; fi
}
if [ -n "$VERIFY_DIR" ]; then verify_dist "$VERIFY_DIR"; fi

# ------------------------------------------------------------------- pin commit
[ ${#TARGETS[@]} -gt 0 ] || { echo "specify --target/--linux/--all (or --verify <dir>)" >&2; exit 2; }
[ -f "$V31/Cargo.toml" ] || { echo "no V31 workspace at $V31" >&2; exit 2; }

FULL_SHA="$(git rev-parse --verify "$FROM_COMMIT^{commit}")"
SHORT_SHA="$(git rev-parse --short=9 "$FULL_SHA")"
COMMIT_DATE="$(git show -s --format=%cI "$FULL_SHA")"
DESCRIBE="$(git describe --tags --always --dirty 2>/dev/null || echo "$SHORT_SHA")"
HEAD_SHA="$(git rev-parse HEAD)"
DIRTY="$(git status --porcelain --untracked-files=no | wc -l | tr -d ' ')"

echo "=== ZION release artifacts"
echo "    version : $VERSION"
echo "    commit  : $FULL_SHA ($SHORT_SHA) — $COMMIT_DATE"
echo "    describe: $DESCRIBE"
echo "    targets : ${TARGETS[*]}"
echo "    variants: ${VARIANTS[*]}"
[ -n "$CONTAINER" ] && echo "    builder : docker $CONTAINER"

if [ "$DIRTY" != "0" ] && [ "$ALLOW_DIRTY" = 0 ]; then
  echo "" >&2
  echo "ERROR: working tree has $DIRTY modified tracked file(s) — a release artifact" >&2
  echo "       must come from a clean tree, otherwise BUILD-INFO.txt provenance is a lie." >&2
  echo "       Commit/stash first, or pass --allow-dirty (recorded as tree_state: dirty)." >&2
  exit 3
fi
[ "$FULL_SHA" = "$HEAD_SHA" ] || echo "    NOTE    : building $SHORT_SHA, HEAD is $(git rev-parse --short=9 HEAD)"

OUT="${OUT:-$REPO_ROOT/dist/$VERSION}"
mkdir -p "$OUT"
SUMS="$OUT/SHA256SUMS"
: > "$SUMS"

PKGS="${PACKAGES:-$DEFAULT_PACKAGES}"
pkg_flags=(); BINS=""
for p in $PKGS; do
  pkg_flags+=(-p "$p")
  b="$(bins_for_pkg "$p")"
  [ -n "$b" ] || { echo "no binary map for package $p" >&2; exit 2; }
  BINS="$BINS $b"
done
echo "    packages: $PKGS → binaries:$BINS"

# ---------------------------------------------------------------- build runner
# Cargo applies --features to *every* selected package, so a feature that only
# one package declares must be package-qualified (`zion-miner/gpu-opencl`),
# otherwise `-p zion-miner -p zion-core --features gpu-opencl` fails with
# "none of the selected packages contains these features".
FEATURE_PKG="${FEATURE_PKG:-zion-miner}"
qualify_features() {
  local in="${1:-}" out="" one
  [ -z "$in" ] && { printf ''; return 0; }
  local IFS=','
  for one in $in; do
    [ -z "$one" ] && continue
    case "$one" in */*) ;; *) one="$FEATURE_PKG/$one" ;; esac
    out="${out:+$out,}$one"
  done
  printf '%s' "$out"
}

build_one() { # build_one <target> <features> <bindir-out> <logfile> <variant>
  local target="$1" features="$2" bindir="$3" logf="$4" variant="$5"
  local qualified; qualified="$(qualify_features "$features")"
  local feat_flags=()
  [ -n "$qualified" ] && feat_flags=(--features "$qualified")
  local lockflag=(); [ "$LOCKED" = 1 ] && lockflag=(--locked)
  local jobs_flag=(); [ -n "$JOBS" ] && jobs_flag=(-j "$JOBS")

  if [ -n "$CONTAINER" ]; then
    local apt="build-essential pkg-config libssl-dev git ca-certificates"
    case "$features" in *gpu-opencl*) apt="$apt ocl-icd-opencl-dev" ;; esac
    case "$features" in *native-*) apt="$apt cmake clang libclang-dev" ;; esac
    case "$target" in *windows-gnu*) apt="$apt gcc-mingw-w64-x86-64" ;; esac
    local cargo_home="$HOME/.cache/zion-release-cargo"
    mkdir -p "$cargo_home" "$OUT/cargo-target"
    docker run --rm \
      -v "$REPO_ROOT":/src \
      -v "$OUT/cargo-target":/target \
      -v "$cargo_home":/cargo-home \
      -e CARGO_HOME=/cargo-home \
      -e CARGO_TARGET_DIR=/target \
      -e ZION_GIT_SHA="$SHORT_SHA" \
      -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0='*' \
      -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
      -w /src/V31 \
      "$CONTAINER" bash -euc "
        export DEBIAN_FRONTEND=noninteractive
        if ! command -v gcc >/dev/null || ! command -v pkg-config >/dev/null || \
           ! command -v git >/dev/null || { [ '$target' = x86_64-pc-windows-gnu ] && ! command -v x86_64-w64-mingw32-gcc >/dev/null; } || \
           { case '$features' in *gpu-opencl*) true ;; *) false ;; esac && [ ! -f /usr/include/CL/cl.h ]; }; then
          apt-get update -qq && apt-get install -y -qq $apt >/dev/null
        fi
        case '$features' in *gpu-opencl*) [ -f /usr/include/CL/cl.h ] || { apt-get update -qq && apt-get install -y -qq ocl-icd-opencl-dev >/dev/null; } ;; esac
        rustup target add '$target' >/dev/null 2>&1 || true
        cargo build --release --target '$target' ${lockflag[*]} ${jobs_flag[*]} ${pkg_flags[*]} ${feat_flags[*]} 2>&1
        mkdir -p '$bindir'
        for b in $BINS; do
          for f in /target/'$target'/release/\$b /target/'$target'/release/\$b.exe; do
            [ -f \"\$f\" ] && cp \"\$f\" '$bindir/'
          done
        done
        chown -R \$HOST_UID:\$HOST_GID '$bindir' /target 2>/dev/null || true
      " > "$logf" 2>&1
  else
    ( cd "$V31" && ZION_GIT_SHA="$SHORT_SHA" cargo build --release --target "$target" \
        "${lockflag[@]}" "${jobs_flag[@]}" "${pkg_flags[@]}" "${feat_flags[@]}" ) > "$logf" 2>&1
    mkdir -p "$bindir"
    for b in $BINS; do
      for f in "$V31/target/$target/release/$b" "$V31/target/$target/release/$b.exe"; do
        [ -f "$f" ] && cp "$f" "$bindir/"
      done
    done
  fi
}

write_build_info() { # write_build_info <stage> <target> <variant> <features>
  local stage="$1" target="$2" variant="$3" features="$4" tree="clean"
  [ "$DIRTY" != "0" ] && tree="dirty ($DIRTY modified tracked files)"
  local toolchain rustc_line cargo_line
  if [ -n "$CONTAINER" ]; then
    rustc_line="$(docker run --rm "$CONTAINER" sh -c 'rustc -vV | tr "\n" " "' 2>/dev/null || echo "unknown")"
    cargo_line="$(docker run --rm "$CONTAINER" sh -c 'cargo --version' 2>/dev/null || echo "unknown")"
  else
    rustc_line="$(rustc -vV | tr '\n' ' ')"
    cargo_line="$(cargo --version)"
  fi
  {
    echo "zion release artifact"
    echo "version: $VERSION"
    echo "commit: $FULL_SHA"
    echo "commit_short: $SHORT_SHA"
    echo "commit_date: $COMMIT_DATE"
    echo "describe: $DESCRIBE"
    echo "tree_state: $tree"
    echo "target: $target"
    echo "variant: $variant"
    echo "features: ${features:-none}"
    echo "built: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "builder: $(whoami)@$(uname -n) ($(uname -srm))"
    echo "builder_host_glibc: $(ldd --version 2>/dev/null | head -1 | awk '{print $NF}')"
    if [ -n "$CONTAINER" ]; then
      echo "container: $CONTAINER"
      echo "container_glibc: $(docker run --rm "$CONTAINER" sh -c 'ldd --version | head -1 | awk "{print \$NF}"' 2>/dev/null || echo unknown)"
    fi
    echo "rustc: $rustc_line"
    echo "cargo: $cargo_line"
    echo "locked: $([ "$LOCKED" = 1 ] && echo yes || echo no)"
    echo "binaries:"
    for f in "$stage"/*; do
      [ -f "$f" ] || continue
      printf '  %s  %s  %s B\n' "$(sha256_of "$f")" "$(basename "$f")" "$(stat -c %s "$f" 2>/dev/null || stat -f %z "$f")"
    done
  } > "$stage/BUILD-INFO.txt"
}

FAILED=()
for t in "${TARGETS[@]}"; do
  for v in "${VARIANTS[@]}"; do
    variant="${v%%:*}"
    features="${v#*:}"
    [ "$variant" = "$features" ] && features=""   # "--variant default" form
    tag="$t"
    [ "$variant" = "default" ] || tag="$t+$variant"

    echo "--- $tag"
    stage="$(mktemp -d)"
    logf="$OUT/build-$tag.log"
    if ! build_one "$t" "$features" "$stage" "$logf" "$variant"; then
      echo "  BUILD FAIL $tag — log: $logf"
      FAILED+=("$tag"); rm -rf "$stage"; continue
    fi
    count=$(find "$stage" -maxdepth 1 -type f | wc -l | tr -d ' ')
    if [ "$count" = "0" ]; then
      echo "  no binaries for $tag — log: $logf"
      FAILED+=("$tag"); rm -rf "$stage"; continue
    fi
    write_build_info "$stage" "$t" "$variant" "$features"
    tarfile="zion-$VERSION-$tag.tar.gz"
    tar czf "$OUT/$tarfile" -C "$stage" .
    rm -rf "$stage" 2>/dev/null || true
    ( cd "$OUT" && echo "$(sha256_of "$tarfile")  $tarfile" >> "$SUMS" )
    echo "  + $tarfile ($count binaries, $(stat -c %s "$OUT/$tarfile" 2>/dev/null || stat -f %z "$OUT/$tarfile") B)"
  done
done

echo ""
echo "=== SHA256SUMS → $SUMS"
cat "$SUMS"
if [ ${#FAILED[@]} -gt 0 ]; then
  echo ""
  echo "FAILED targets: ${FAILED[*]}" >&2
  exit 1
fi
echo ""
echo "Verify with: $0 --verify $OUT"
