#!/usr/bin/env bash
# Lokální self-test scripts/ops/service-snapshot.sh bez produkce.
# Vytvoří fake systemctl + fake binárku a projde snapshot → list → restore.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/bin" "$TMP/app" "$TMP/snaps"
printf 'v1-binary-content\n' > "$TMP/app/fake-daemon"
chmod 755 "$TMP/app/fake-daemon"

cat > "$TMP/bin/systemctl" <<'SHIM'
#!/usr/bin/env bash
case "$1" in
  show)
    unit="${@: -1}"
    if [[ "$*" == *"ExecStart"* ]]; then
      echo "{ path=/tmp/FAKE/app/fake-daemon ; argv[]=/tmp/FAKE/app/fake-daemon ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }"
    else
      echo "Sat 2026-11-08 10:00:00 CET"
    fi
    ;;
  list-units) echo "fake-daemon.service loaded active running Fake" ;;
  cat) echo "# fake unit file" ;;
  is-active) [[ -f "FAIL_FLAG" ]] && exit 3; exit 0 ;;
  stop|start) exit 0 ;;
  *) exit 0 ;;
esac
SHIM
chmod +x "$TMP/bin/systemctl"
# šablona cesty v shimu musí ukazovat na TMP
sed -i.bak "s#/tmp/FAKE#$TMP#g" "$TMP/bin/systemctl" && rm -f "$TMP/bin/systemctl.bak"
sed -i.bak "s#FAIL_FLAG#$TMP/fail-active#g" "$TMP/bin/systemctl" && rm -f "$TMP/bin/systemctl.bak"

export ZION_REMOTE=1
export ZION_SNAPSHOT_DIR="$TMP/snaps"
export ZION_SYSTEMCTL="$TMP/bin/systemctl"

fail=0
run() { echo "--- $*"; "$@" || { echo "   ^ FAILED"; fail=1; }; }

echo "=== 1. snapshot (auto detekce) ==="
run bash "$REPO/scripts/ops/service-snapshot.sh" snapshot --keep 3
ls -1 "$TMP/snaps/fake-daemon.service" | tail -1

echo "=== 2. list ==="
run bash "$REPO/scripts/ops/service-snapshot.sh" list

echo "=== 3. změna binárky (simulace nového deploye) ==="
printf 'v2-broken-content\n' > "$TMP/app/fake-daemon"

echo "=== 4. restore dry-run (nesmí nic změnit) ==="
run bash "$REPO/scripts/ops/service-snapshot.sh" restore --service fake-daemon
grep -q 'v2-broken-content' "$TMP/app/fake-daemon" || { echo "dry-run něco změnil!"; fail=1; }

echo "=== 5. restore --confirm (musí vrátit v1) ==="
run bash "$REPO/scripts/ops/service-snapshot.sh" restore --service fake-daemon --confirm
if grep -q 'v1-binary-content' "$TMP/app/fake-daemon"; then
  echo "   obsah vrácen na v1 ✓"
else
  echo "   obsah NEBYL vrácen ✗"; fail=1
fi

echo "=== 6. retence (--keep 3) ==="
for i in 1 2 3 4; do
  ZION_SNAPSHOT_KEEP=3 bash "$REPO/scripts/ops/service-snapshot.sh" snapshot --service fake-daemon >/dev/null
  sleep 1
done
count=$(ls -1 "$TMP/snaps/fake-daemon.service" | wc -l | tr -d ' ')
echo "   snapshotů: $count (limit 3)"
[[ "$count" -le 3 ]] || { echo "   retence nefunguje ✗"; fail=1; }

echo "=== 7. health check selže -> musí vrátit safety snapshot ==="
printf 'v3-current\n' > "$TMP/app/fake-daemon"
touch "$TMP/fail-active"
if bash "$REPO/scripts/ops/service-snapshot.sh" restore --service fake-daemon --confirm >/dev/null 2>&1; then
  echo "   restore měl selhat ✗"; fail=1
fi
if grep -q 'v3-current' "$TMP/app/fake-daemon"; then
  echo "   původní verze vrácena ✓"
else
  echo "   původní verze NEBYLA vrácena (obsah: $(cat "$TMP/app/fake-daemon")) ✗"; fail=1
fi
rm -f "$TMP/fail-active"

echo
[[ $fail -eq 0 ]] && echo "SELF-TEST PASS" || echo "SELF-TEST FAIL"
exit $fail
