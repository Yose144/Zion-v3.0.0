#!/usr/bin/env bash
# Negative fixtures for the release verifier, plus --from-commit isolation.
# Never invokes cargo: a fake cargo on PATH records a call and fails the test.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERIFY="$ROOT/scripts/ops/verify-release-artifacts.py"
BUILD="$ROOT/scripts/ops/build-release-artifacts.sh"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/zion-release-verify.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

fail() { echo "FAIL $*" >&2; exit 1; }

mkdir -p "$tmp/bin"
cat > "$tmp/bin/cargo" <<EOF
#!/bin/sh
echo cargo-invoked >> "$tmp/cargo-ran"
exit 99
EOF
chmod +x "$tmp/bin/cargo"

mkdir -p "$tmp/empty"
: > "$tmp/empty/SHA256SUMS"
set +e
empty_out="$(python3 "$VERIFY" "$tmp/empty" 2>&1)"
empty_code=$?
set -e
[[ "$empty_code" -eq 1 ]] || fail "empty sums exited $empty_code"
printf '%s\n' "$empty_out" | grep -q "0 artifacts verified" || fail "empty sums message: $empty_out"

commit="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
mkdir -p "$tmp/missing"
python3 - "$tmp/missing" "$commit" <<'PY'
import json, sys
directory, commit = sys.argv[1:]
open(f"{directory}/SHA256SUMS", "w").write("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef  zion.tar.gz\n")
json.dump({
    "commit": commit,
    "packages": ["zion-cli"],
    "artifacts": [{"file": "zion.tar.gz", "target": "x86_64-unknown-linux-gnu", "variant": "default"}],
}, open(f"{directory}/RELEASE-MATRIX.json", "w"))
PY
set +e
missing_out="$(python3 "$VERIFY" "$tmp/missing" 2>&1)"
missing_code=$?
set -e
[[ "$missing_code" -eq 1 ]] || fail "missing archive exited $missing_code"
printf '%s\n' "$missing_out" | grep -q "missing/non-regular" || fail "missing archive message: $missing_out"

mkdir -p "$tmp/bad/stage"
printf 'zion release artifact\ncommit: abc\ntarget: x86_64-unknown-linux-gnu\nvariant: default\n' > "$tmp/bad/stage/BUILD-INFO.txt"
tar -czf "$tmp/bad/zion.tar.gz" -C "$tmp/bad/stage" BUILD-INFO.txt
if command -v sha256sum >/dev/null 2>&1; then
  sum="$(sha256sum "$tmp/bad/zion.tar.gz" | awk '{print $1}')"
else
  sum="$(shasum -a 256 "$tmp/bad/zion.tar.gz" | awk '{print $1}')"
fi
printf '%s  zion.tar.gz\n' "$sum" > "$tmp/bad/SHA256SUMS"
python3 - "$tmp/bad" "$commit" <<'PY'
import json, sys
directory, commit = sys.argv[1:]
json.dump({
    "commit": commit,
    "packages": ["zion-cli"],
    "artifacts": [{"file": "zion.tar.gz", "target": "x86_64-unknown-linux-gnu", "variant": "default"}],
}, open(f"{directory}/RELEASE-MATRIX.json", "w"))
PY
set +e
bad_out="$(python3 "$VERIFY" "$tmp/bad" 2>&1)"
bad_code=$?
set -e
[[ "$bad_code" -eq 1 ]] || fail "short commit exited $bad_code"
printf '%s\n' "$bad_out" | grep -q "BUILD-INFO commit" || fail "short commit message: $bad_out"

old="$(git -C "$ROOT" rev-parse HEAD~1)"
set +e
foreign_out="$(PATH="$tmp/bin:$PATH" bash "$BUILD" --from-commit "$old" --target x86_64-unknown-linux-gnu 2>&1)"
foreign_code=$?
set -e
[[ "$foreign_code" -eq 3 ]] || fail "foreign commit exited $foreign_code: $foreign_out"
[[ ! -f "$tmp/cargo-ran" ]] || fail "cargo ran for a foreign commit"
printf '%s\n' "$foreign_out" | grep -q "not HEAD" || fail "foreign commit message: $foreign_out"

iso="$tmp/iso"
PATH="$tmp/bin:$PATH" bash "$BUILD" \
  --from-commit "$old" --isolate --isolate-dir "$iso" --stop-before-build \
  --target x86_64-unknown-linux-gnu >/dev/null
[[ -f "$iso/V31/Cargo.toml" ]] || fail "isolate did not extract V31"
[[ ! -f "$tmp/cargo-ran" ]] || fail "cargo ran during isolate prepare"
git -C "$ROOT" show "$old:V31/Cargo.toml" > "$tmp/expected-cargo"
cmp -s "$tmp/expected-cargo" "$iso/V31/Cargo.toml" || fail "isolate tree is not that commit"

echo "RESULT: PASS release verifier fixtures"
