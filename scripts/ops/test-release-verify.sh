#!/usr/bin/env bash
# Offline builder/verifier fixtures, including --from-commit isolation.
# Only a fake Cargo runs; no compiler, network or real binaries are used.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERIFY="$ROOT/scripts/ops/verify-release-artifacts.py"
BUILD="$ROOT/scripts/ops/build-release-artifacts.sh"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/zion-release-verify.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

fail() { echo "FAIL $*" >&2; exit 1; }

# A tiny independent repo, not a full archive/build of the shared checkout.
fixture="$tmp/repo"
mkdir -p "$fixture/scripts/ops" "$fixture/V31"
cp "$BUILD" "$fixture/scripts/ops/"
printf 'fixture one\n' > "$fixture/V31/Cargo.toml"
git -C "$fixture" init -q
git -C "$fixture" add V31/Cargo.toml scripts/ops/build-release-artifacts.sh
git -C "$fixture" -c user.name=Fixture -c user.email=fixture@example.invalid commit -qm first
old="$(git -C "$fixture" rev-parse HEAD)"
printf 'fixture two\n' > "$fixture/V31/Cargo.toml"
git -C "$fixture" add V31/Cargo.toml
git -C "$fixture" -c user.name=Fixture -c user.email=fixture@example.invalid commit -qm second
BUILD="$fixture/scripts/ops/build-release-artifacts.sh"

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
open(f"{directory}/SHA256SUMS", "w").write("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef  zion-fixture-x86_64-unknown-linux-gnu.tar.gz\n")
json.dump({
    "version": "fixture",
    "commit": commit,
    "packages": ["zion-cli"],
    "artifacts": [{"file": "zion-fixture-x86_64-unknown-linux-gnu.tar.gz", "target": "x86_64-unknown-linux-gnu", "variant": "default", "features": ""}],
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
COPYFILE_DISABLE=1 tar -czf "$tmp/bad/zion-fixture-x86_64-unknown-linux-gnu.tar.gz" -C "$tmp/bad/stage" BUILD-INFO.txt
if command -v sha256sum >/dev/null 2>&1; then
  sum="$(sha256sum "$tmp/bad/zion-fixture-x86_64-unknown-linux-gnu.tar.gz" | awk '{print $1}')"
else
  sum="$(shasum -a 256 "$tmp/bad/zion-fixture-x86_64-unknown-linux-gnu.tar.gz" | awk '{print $1}')"
fi
printf '%s  zion-fixture-x86_64-unknown-linux-gnu.tar.gz\n' "$sum" > "$tmp/bad/SHA256SUMS"
python3 - "$tmp/bad" "$commit" <<'PY'
import json, sys
directory, commit = sys.argv[1:]
json.dump({
    "version": "fixture",
    "commit": commit,
    "packages": ["zion-cli"],
    "artifacts": [{"file": "zion-fixture-x86_64-unknown-linux-gnu.tar.gz", "target": "x86_64-unknown-linux-gnu", "variant": "default", "features": ""}],
}, open(f"{directory}/RELEASE-MATRIX.json", "w"))
PY
set +e
bad_out="$(python3 "$VERIFY" "$tmp/bad" 2>&1)"
bad_code=$?
set -e
[[ "$bad_code" -eq 1 ]] || fail "short commit exited $bad_code"
printf '%s\n' "$bad_out" | grep -q "BUILD-INFO commit" || fail "short commit message: $bad_out"

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
git -C "$fixture" show "$old:V31/Cargo.toml" > "$tmp/expected-cargo"
cmp -s "$tmp/expected-cargo" "$iso/V31/Cargo.toml" || fail "isolate tree is not that commit"

# Failed Cargo must not fall through to packaging stale binaries from cache
# (errexit is disabled inside a function called in an `if ! function` test).
mkdir -p "$tmp/target/x86_64-unknown-linux-gnu/release"
printf stale > "$tmp/target/x86_64-unknown-linux-gnu/release/zion"
set +e
PATH="$tmp/bin:$PATH" CARGO_TARGET_DIR="$tmp/target" bash "$BUILD" \
  --target x86_64-unknown-linux-gnu --packages zion-cli --out "$tmp/failed-build" > "$tmp/failed.log" 2>&1
failed_code=$?
set -e
[[ "$failed_code" -ne 0 ]] || fail 'failed cargo packaged a stale cache binary'
[[ -f "$tmp/cargo-ran" ]] || fail 'mock cargo was not exercised'
[[ ! -s "$tmp/failed-build/SHA256SUMS" ]] || fail 'failed build emitted an artifact checksum'

# A successful mock build must package a complete binary set and emit valid
# BUILD-INFO (not a self-checksum of the still-being-written BUILD-INFO file).
cat > "$tmp/bin/cargo" <<'PY'
#!/usr/bin/env python3
import os, pathlib, sys
if sys.argv[1:] == ['--version']:
    print('cargo synthetic-fixture')
    sys.exit(0)
args = sys.argv[1:]
target = args[args.index('--target') + 1]
output = pathlib.Path(os.environ['CARGO_TARGET_DIR']) / target / 'release'
output.mkdir(parents=True, exist_ok=True)
suffix = '.exe' if 'windows' in target else ''
for binary in ['zion', 'zion-node', 'zion-migrate', 'warpd']:
    if binary == os.environ.get('FIXTURE_OMIT_BINARY'):
        continue
    path = output / (binary + suffix)
    path.write_text('synthetic fixture, never executed: ' + binary + '\n')
    path.chmod(0o755)
PY
chmod +x "$tmp/bin/cargo"
PATH="$tmp/bin:$PATH" CARGO_TARGET_DIR="$tmp/success-target" bash "$BUILD" \
  --from-commit "$old" --isolate --version fixture \
  --target x86_64-unknown-linux-gnu --target x86_64-pc-windows-gnu \
  --packages 'zion-core zion-cli zion-multichain' --out "$tmp/complete" > "$tmp/complete.log" 2>&1 \
  || { cat "$tmp/complete.log"; fail 'successful mock build failed'; }
python3 "$VERIFY" "$tmp/complete" --commit "$old"

# A clean-Cargo exit without every requested binary must fail packaging too.
set +e
PATH="$tmp/bin:$PATH" FIXTURE_OMIT_BINARY=zion-migrate CARGO_TARGET_DIR="$tmp/partial-target" bash "$BUILD" \
  --target x86_64-unknown-linux-gnu --packages 'zion-core zion-cli' \
  --out "$tmp/partial" > "$tmp/partial.log" 2>&1
partial_code=$?
set -e
[[ "$partial_code" -ne 0 ]] || fail 'partial binary set was accepted'
[[ ! -s "$tmp/partial/SHA256SUMS" ]] || fail 'partial binary set emitted a checksum'
grep -q 'incomplete binary set' "$tmp/partial.log" || fail 'partial set did not reach packaging guard'

# Untracked source counts as dirty, and an existing isolation destination is
# never reused/overwritten. Both must stop before invoking even the mock Cargo.
printf 'untracked source\n' > "$fixture/V31/untracked.rs"
set +e
PATH="$tmp/bin:$PATH" bash "$BUILD" --linux --out "$tmp/dirty" > "$tmp/dirty.log" 2>&1
dirty_code=$?
PATH="$tmp/bin:$PATH" bash "$BUILD" --linux --isolate --isolate-dir "$iso" > "$tmp/reuse.log" 2>&1
reuse_code=$?
set -e
[[ "$dirty_code" -eq 3 ]] || fail 'untracked source was not rejected'
[[ "$reuse_code" -eq 3 ]] || fail 'existing isolation destination was not rejected'

echo "RESULT: PASS release verifier fixtures"
