#!/usr/bin/env bash
# ============================================================================
#  ZION CLI Launcher — Ubuntu / Linux
#  Runs interactive menu. Window stays open after menu exits.
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ZION_BIN="${REPO_ROOT}/V3/target/release/zion"

echo "==========================================================="
echo "  ZION CLI Launcher"
echo "==========================================================="
echo ""

# ── 1. Check binary ────────────────────────────────────────────────────────
if [[ ! -x "$ZION_BIN" ]]; then
    echo "[BUILD] Binary zion not found, building..."
    echo "        (first build may take 2-5 minutes)"
    echo ""

    if ! command -v cargo >/dev/null 2>&1; then
        if [[ -x "${HOME}/.cargo/bin/cargo" ]]; then
            export PATH="${HOME}/.cargo/bin:${PATH}"
        else
            echo "[ERROR] Rust / cargo not found in PATH or ~/.cargo/bin/"
            echo "        Install Rust from https://rustup.rs"
            read -r -p "Press ENTER to close..."
            exit 1
        fi
    fi

    cargo build --release --manifest-path "${REPO_ROOT}/V3/Cargo.toml" -p zion-cli
    echo ""
    echo "[OK] Build completed."
    echo ""
else
    echo "[OK] Binary found: ${ZION_BIN}"
    echo ""
fi

# ── 2. Run CLI in interactive mode ──────────────────────────────────────────
echo "  Commands:"
echo "    ${ZION_BIN} --help"
echo "    ${ZION_BIN} mine start"
echo "    ${ZION_BIN} node status"
echo "    ${ZION_BIN} doctor"
echo ""
echo "==========================================================="
echo ""

while true; do
    "$ZION_BIN" menu
    echo ""
    echo "[INFO] Menu exited (code: $?). Press ENTER to restart, or Ctrl+C to quit."
    read -r
    echo ""
done
