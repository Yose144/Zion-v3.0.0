#!/usr/bin/env bash
# Prints the canonical git-filter-repo recipe for removing leaked secrets from history.
#
# WARNING:
#   - Destructive: rewrites ALL refs; every collaborator must re-clone or reset hard.
#   - Run ONLY after leaked credentials are revoked (see SECURITY_NOTICE + playbook §1).
#   - Replace REMOTE_URL / backup bare repo before proceeding.
#
# This script does NOT run git-filter-repo — copy-paste after review.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "Repo root: $ROOT"
echo ""
echo "Paths historically containing leaked material (must match SECURITY_NOTICE):"
echo "  zion-wallet.json"
echo "  V3/zion-wallet.json"
echo "  V3-src.tar"
echo "  V3-src-fresh.tar"
echo "  V3-src.zip"
echo "  V3_upload.zip"
echo "  docs/docs2.9/ZION_KEYS"
echo ""
echo "--- Recommended invocation (dry-run first where supported) ---"
echo ""
echo "pip install --user git-filter-repo   # or distro package"
echo "cd \"$ROOT\""
echo "git filter-repo --invert-paths \\"
echo "    --path zion-wallet.json \\"
echo "    --path V3/zion-wallet.json \\"
echo "    --path V3-src.tar \\"
echo "    --path V3-src-fresh.tar \\"
echo "    --path V3-src.zip \\"
echo "    --path V3_upload.zip \\"
echo "    --path docs/docs2.9/ZION_KEYS"
echo "# Then force-push ALL migrated branches / tags per team policy:"
echo "# git push --force-with-lease origin main"
echo ""
echo "See also: V3/docs/operational/AUDIT_CLOSEOUT_1_THROUGH_6.md §5"
