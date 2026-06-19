#!/usr/bin/env bash
# ============================================================================
#  ZION Dashboard — Ubuntu / Linux launcher
#  http://127.0.0.1:8766
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

mkdir -p logs

echo "==========================================================="
echo "  ZION Dashboard :: http://127.0.0.1:8766"
echo "==========================================================="
echo ""

exec python3 "${REPO_ROOT}/ZION_OS/dashboard/app.py"
