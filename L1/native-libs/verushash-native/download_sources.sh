#!/usr/bin/env bash
# ============================================================================
# download_sources.sh
#
# Downloads the VerusCoin C/C++ source files required by verushash-native
# from the official VerusCoin GitHub repository and the sse2neon project,
# then applies all patches needed for standalone compilation.
#
# Usage:
#   cd native-libs/verushash-native
#   bash download_sources.sh
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CSRC_DIR="${SCRIPT_DIR}/csrc"

# ---------------------------------------------------------------------------
# Source URLs
# ---------------------------------------------------------------------------
VERUSCOIN_RAW="https://raw.githubusercontent.com/VerusCoin/VerusCoin/master/src/crypto"
SSE2NEON_RAW="https://raw.githubusercontent.com/DLTcollab/sse2neon/master"

VERUSCOIN_FILES=(
    "haraka.h"
    "haraka.c"
    "haraka_portable.h"
    "haraka_portable.c"
    "verus_hash.h"
    "verus_hash.cpp"
    "verus_clhash.h"
    "verus_clhash.cpp"
    "verus_clhash_portable.cpp"
    "common.h"
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_ok()   { echo -e "  ${GREEN}[OK]${NC}   $1"; }
log_warn() { echo -e "  ${YELLOW}[WARN]${NC} $1"; }
log_err()  { echo -e "  ${RED}[ERR]${NC}  $1"; }

download_file() {
    local url="$1" dest="$2"
    if command -v curl &>/dev/null; then
        curl -fsSL --retry 3 --retry-delay 2 -o "${dest}" "${url}"
    elif command -v wget &>/dev/null; then
        wget -q --tries=3 -O "${dest}" "${url}"
    else
        log_err "Neither curl nor wget found."; exit 1
    fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
echo ""
echo "=================================================================="
echo " VerusHash Native — Source Downloader + Patcher"
echo "=================================================================="
echo ""

mkdir -p "${CSRC_DIR}"
FAIL=0

# --- Download VerusCoin files ---
echo "--- Downloading VerusCoin crypto sources ---"
for f in "${VERUSCOIN_FILES[@]}"; do
    if download_file "${VERUSCOIN_RAW}/${f}" "${CSRC_DIR}/${f}" 2>/dev/null; then
        log_ok "${f}"
    else
        log_err "Failed: ${f}"; FAIL=$((FAIL+1))
    fi
done

echo ""
echo "--- Downloading sse2neon.h ---"
if download_file "${SSE2NEON_RAW}/sse2neon.h" "${CSRC_DIR}/sse2neon.h" 2>/dev/null; then
    log_ok "sse2neon.h"
else
    log_err "Failed: sse2neon.h"; FAIL=$((FAIL+1))
fi

echo ""
echo "--- Applying compatibility patches ---"

# ---------------------------------------------------------------
# Patch: Rewrite all crypto/* include paths to flat paths
# ---------------------------------------------------------------
for src in "${CSRC_DIR}"/*.c "${CSRC_DIR}"/*.cpp "${CSRC_DIR}"/*.h; do
    [ -f "$src" ] || continue
    sed -i.bak \
        -e 's|#include "crypto/compat/sse2neon.h"|#include "sse2neon.h"|g' \
        -e 's|#include "crypto/sse2neon.h"|#include "sse2neon.h"|g' \
        -e 's|#include "crypto/haraka.h"|#include "haraka.h"|g' \
        -e 's|#include "crypto/haraka_portable.h"|#include "haraka_portable.h"|g' \
        -e 's|#include "crypto/verus_hash.h"|#include "verus_hash.h"|g' \
        -e 's|#include "crypto/verus_clhash.h"|#include "verus_clhash.h"|g' \
        -e 's|#include "crypto/common.h"|#include "common.h"|g' \
        "$src"
    rm -f "${src}.bak"
done
log_ok "Flattened all crypto/* include paths"

# ---------------------------------------------------------------
# Patch: Inject #include "compat.h" at top of key headers
# ---------------------------------------------------------------
for hdr in verus_hash.h verus_clhash.h haraka.h; do
    f="${CSRC_DIR}/${hdr}"
    [ -f "$f" ] || continue
    if ! grep -q 'compat.h' "$f"; then
        sed -i.bak '1s|^|#include "compat.h"\n|' "$f"
        rm -f "${f}.bak"
        log_ok "Injected compat.h into ${hdr}"
    fi
done

# ---------------------------------------------------------------
# Patch: Strip boost includes (compat.h provides stubs)
# ---------------------------------------------------------------
for src in "${CSRC_DIR}"/*.cpp "${CSRC_DIR}"/*.h; do
    [ -f "$src" ] || continue
    if grep -q 'boost/thread' "$src"; then
        sed -i.bak \
            -e 's|#include <boost/thread.hpp>|/* boost stubbed by compat.h */|g' \
            -e 's|#include <boost/thread/tss.hpp>|/* boost stubbed by compat.h */|g' \
            "$src"
        rm -f "${src}.bak"
        log_ok "Stripped boost from $(basename "$src")"
    fi
done

# ---------------------------------------------------------------
# Patch: Strip bitcoin-specific includes
# ---------------------------------------------------------------
STRIP_PATTERNS=(
    '#include "uint256.h"'
    '#include "serialize.h"'
    '#include "hash.h"'
    '#include "primitives/block.h"'
    '#include "primitives/nonce.h"'
    '#include "utilstrencodings.h"'
    '#include "common.h"'
)
for pat in "${STRIP_PATTERNS[@]}"; do
    safe=$(echo "$pat" | sed 's/[\/&]/\\&/g')
    for src in "${CSRC_DIR}"/*.cpp "${CSRC_DIR}"/*.h; do
        [ -f "$src" ] || continue
        if grep -qF "$pat" "$src"; then
            sed -i.bak "s|${safe}|/* ${pat} -- stubbed */|g" "$src"
            rm -f "${src}.bak"
            log_ok "Stripped ${pat} from $(basename "$src")"
        fi
    done
done

# ---------------------------------------------------------------
# Patch: verus_clhash.cpp — add missing includes + STANDALONE guard
# ---------------------------------------------------------------
CLHASH_CPP="${CSRC_DIR}/verus_clhash.cpp"
if [ -f "$CLHASH_CPP" ]; then
    # Add STANDALONE_VERUS_HASH define at the very top
    if ! grep -q 'STANDALONE_VERUS_HASH' "$CLHASH_CPP"; then
        sed -i.bak '1s|^|#define STANDALONE_VERUS_HASH 1\n|' "$CLHASH_CPP"
        rm -f "${CLHASH_CPP}.bak"
        log_ok "Added STANDALONE_VERUS_HASH to verus_clhash.cpp"
    fi

    # Fix __cpuverusoptimized linkage (must be extern "C" to match header)
    sed -i.bak 's/^int __cpuverusoptimized = 0x80;/extern "C" int __cpuverusoptimized = 0x80;/' "$CLHASH_CPP"
    rm -f "${CLHASH_CPP}.bak"
    log_ok "Fixed __cpuverusoptimized linkage"

    # Add #include "haraka.h" and "verus_clhash.h" after the intrinsics block
    # Find the line with "#endif" after x86intrin, then the #endif after _WIN32 posix_memalign
    if ! grep -q '#include "verus_clhash.h"' "$CLHASH_CPP"; then
        # Insert after the _WIN32 posix_memalign #endif block
        WIN_END=$(grep -n 'posix_memalign' "$CLHASH_CPP" | head -1 | cut -d: -f1)
        if [ -n "$WIN_END" ]; then
            ENDIF_LINE=$(awk "NR>$WIN_END && /^#endif/{print NR; exit}" "$CLHASH_CPP")
            if [ -n "$ENDIF_LINE" ]; then
                sed -i.bak "${ENDIF_LINE}a\\
\\
#include \"haraka.h\"\\
#include \"verus_clhash.h\"
" "$CLHASH_CPP"
                rm -f "${CLHASH_CPP}.bak"
                log_ok "Added haraka.h + verus_clhash.h includes to verus_clhash.cpp"
            fi
        fi
    fi

    # Wrap mine_verus_v2 in #ifndef STANDALONE_VERUS_HASH
    if grep -q 'mine_verus_v2' "$CLHASH_CPP" && ! grep -q 'ifndef STANDALONE_VERUS_HASH' "$CLHASH_CPP"; then
        MINE_LINE=$(grep -n '^bool mine_verus_v2' "$CLHASH_CPP" | head -1 | cut -d: -f1)
        if [ -n "$MINE_LINE" ]; then
            sed -i.bak "${MINE_LINE}i\\
#ifndef STANDALONE_VERUS_HASH
" "$CLHASH_CPP"
            rm -f "${CLHASH_CPP}.bak"

            # Find "// verus intermediate hash extra" after mine_verus_v2 and add #endif before it
            EXTRA_LINE=$(grep -n '// verus intermediate hash extra' "$CLHASH_CPP" | head -1 | cut -d: -f1)
            if [ -n "$EXTRA_LINE" ]; then
                sed -i.bak "$((EXTRA_LINE))i\\
#endif /* STANDALONE_VERUS_HASH */
" "$CLHASH_CPP"
                rm -f "${CLHASH_CPP}.bak"
            fi
            log_ok "Wrapped mine_verus_v2 in STANDALONE guard"
        fi
    fi
fi

# ---------------------------------------------------------------
# Patch: verus_clhash_portable.cpp — same treatment
# ---------------------------------------------------------------
CLHASH_PORT="${CSRC_DIR}/verus_clhash_portable.cpp"
if [ -f "$CLHASH_PORT" ]; then
    # Add STANDALONE define
    if ! grep -q 'STANDALONE_VERUS_HASH' "$CLHASH_PORT"; then
        sed -i.bak '1s|^|#define STANDALONE_VERUS_HASH 1\n|' "$CLHASH_PORT"
        rm -f "${CLHASH_PORT}.bak"
        log_ok "Added STANDALONE to verus_clhash_portable.cpp"
    fi

    # Add includes after intrinsics block
    if ! grep -q '#include "verus_clhash.h"' "$CLHASH_PORT"; then
        WIN_END=$(grep -n 'intrin.h' "$CLHASH_PORT" | tail -1 | cut -d: -f1)
        if [ -n "$WIN_END" ]; then
            ENDIF_LINE=$(awk "NR>$WIN_END && /^#endif/{print NR; exit}" "$CLHASH_PORT")
            if [ -n "$ENDIF_LINE" ]; then
                sed -i.bak "${ENDIF_LINE}a\\
\\
#include \"haraka.h\"\\
#include \"haraka_portable.h\"\\
#include \"verus_clhash.h\"
" "$CLHASH_PORT"
                rm -f "${CLHASH_PORT}.bak"
                log_ok "Added includes to verus_clhash_portable.cpp"
            fi
        fi
    fi

    # Wrap mine_verus_v2_port
    if grep -q 'mine_verus_v2_port' "$CLHASH_PORT" && ! grep -q 'ifndef STANDALONE_VERUS_HASH' "$CLHASH_PORT"; then
        MINE_LINE=$(grep -n '^bool mine_verus_v2_port' "$CLHASH_PORT" | head -1 | cut -d: -f1)
        if [ -n "$MINE_LINE" ]; then
            sed -i.bak "${MINE_LINE}i\\
#ifndef STANDALONE_VERUS_HASH
" "$CLHASH_PORT"
            rm -f "${CLHASH_PORT}.bak"
            echo '#endif /* STANDALONE_VERUS_HASH */' >> "$CLHASH_PORT"
            log_ok "Wrapped mine_verus_v2_port in STANDALONE guard"
        fi
    fi
fi

# ---------------------------------------------------------------
# Done
# ---------------------------------------------------------------
echo ""
if [ "$FAIL" -eq 0 ]; then
    echo -e "=== ${GREEN}All files downloaded and patched successfully!${NC} ==="
    echo ""
    echo "  Build:  cargo build -p verushash-native"
    echo "  Test:   cargo test  -p verushash-native"
    echo ""
else
    echo -e "=== ${RED}${FAIL} file(s) failed to download.${NC} ==="
    exit 1
fi
