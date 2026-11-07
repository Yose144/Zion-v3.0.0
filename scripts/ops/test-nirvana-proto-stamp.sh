#!/usr/bin/env bash
# Three cases for the artifact stamp: match, client ahead, stamp missing.
# Health comes from a file. The missing-stamp deploy must exit before rsync.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CHECK="$ROOT/scripts/ops/nirvana-proto-check.sh"
DEPLOY="$ROOT/apps/nirvana/deploy/deploy-nirvana.sh"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/zion-proto-stamp.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

fail() { echo "FAIL $*" >&2; exit 1; }

printf '%s\n' '{"ok":true,"proto":32}' > "$tmp/health.json"
export NIRVANA_HEALTH_FILE="$tmp/health.json"

printf '32\n' > "$tmp/match"
bash "$CHECK" --stamp "$tmp/match" >/dev/null || fail "matching stamp should pass"

printf '99\n' > "$tmp/ahead"
set +e
ahead_out="$(bash "$CHECK" --stamp "$tmp/ahead" 2>&1)"
ahead_code=$?
set -e
[[ "$ahead_code" -eq 1 ]] || fail "client ahead exited $ahead_code: $ahead_out"
printf '%s\n' "$ahead_out" | grep -q "BLOKOVÁNO" || fail "client ahead message: $ahead_out"

mkdir -p "$tmp/artifact"
set +e
deploy_out="$(bash "$DEPLOY" --artifact-dir "$tmp/artifact" 2>&1)"
deploy_code=$?
set -e
[[ "$deploy_code" -eq 1 ]] || fail "missing stamp deploy exited $deploy_code: $deploy_out"
printf '%s\n' "$deploy_out" | grep -q "nemá razítko PROTO_VERSION" || fail "missing stamp message: $deploy_out"
printf '%s\n' "$deploy_out" | grep -q "Waiting for" && fail "deploy continued past the missing stamp"
echo "RESULT: PASS proto stamp fixtures"
