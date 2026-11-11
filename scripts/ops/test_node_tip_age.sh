#!/usr/bin/env bash
# Tests for node-tip-age.sh — no network, no production services.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/node-tip-age.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

check() {
  local name="$1" exp_rc="$2" exp_out="$3" file="$4"
  local out rc
  out=$("$SCRIPT" --metrics-file "$file" 2>/dev/null)
  rc=$?
  if [[ "$rc" -eq "$exp_rc" && "$out" == "$exp_out" ]]; then
    pass=$((pass+1)); echo "ok   $name"
  else
    fail=$((fail+1)); echo "FAIL $name (rc=$rc out='$out', expected rc=$exp_rc out='$exp_out')"
  fi
}

cat > "$TMP/fresh.txt" <<'EOF'
# HELP zion_g8_node_tip_age_seconds test
zion_g8_node_tip_age_seconds{service="node_primary"} 30.0
zion_g8_node_tip_age_seconds{service="node_follower_2"} 31.0
EOF
check "fresh 30s" 0 "30.0" "$TMP/fresh.txt"

cat > "$TMP/stale.txt" <<'EOF'
zion_g8_node_tip_age_seconds{service="node_primary"} 1000.0
EOF
check "stale 1000s" 1 "1000.0" "$TMP/stale.txt"

cat > "$TMP/exact.txt" <<'EOF'
zion_g8_node_tip_age_seconds{service="node_primary"} 900.0
EOF
check "exactly max_age is fresh" 0 "900.0" "$TMP/exact.txt"

cat > "$TMP/over.txt" <<'EOF'
zion_g8_node_tip_age_seconds{service="node_primary"} 901.0
EOF
check "901s is stale" 1 "901.0" "$TMP/over.txt"

cat > "$TMP/unknown.txt" <<'EOF'
zion_g8_node_tip_age_seconds{service="node_primary"} -1
EOF
check "unknown sentinel is no-op" 0 "unknown" "$TMP/unknown.txt"

cat > "$TMP/missing.txt" <<'EOF'
zion_g8_node_tip_age_seconds{service="node_follower_2"} 30.0
EOF
check "missing primary series is no-op" 0 "unknown" "$TMP/missing.txt"

check "unreadable file is no-op" 0 "unknown" "$TMP/does-not-exist"

cat > "$TMP/future.txt" <<'EOF'
zion_g8_node_tip_age_seconds{service="node_primary"} -60.0
EOF
check "future skew is no-op (negative)" 0 "unknown" "$TMP/future.txt"

echo "----"
echo "pass=$pass fail=$fail"
[[ "$fail" -eq 0 ]]
