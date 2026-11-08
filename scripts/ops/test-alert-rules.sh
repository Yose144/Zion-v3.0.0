#!/usr/bin/env bash
# test-alert-rules.sh — promtool firing tests for every Prometheus rule file.
#
#   bash scripts/ops/test-alert-rules.sh          # run everything
#   bash scripts/ops/test-alert-rules.sh --list   # which rule files have a test
#
# Needs `promtool` (ships with Prometheus). It is not installed everywhere —
# EDGE1 has it, so the cheap fallback is:
#   ssh zion-v6 'rm -rf /tmp/rules && mkdir -p /tmp/rules'
#   scp V31/deploy/monitoring/*.yml zion-v6:/tmp/rules/
#   ssh zion-v6 'cd /tmp/rules && for f in test_*_rules.yml; do promtool test rules "$f"; done'
#
# Exit: 0 = all green, 1 = a test failed, 2 = promtool missing.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIR="$ROOT/V31/deploy/monitoring"
shopt -s nullglob

# rule file announced inside each test file (`rule_files:` first entry)
test_target() {
  awk '/^rule_files:/{f=1; next} f && /^[[:space:]]*-[[:space:]]*/ {gsub(/^[[:space:]]*-[[:space:]]*/, ""); print; exit}' "$1"
}

if [[ "${1:-}" == "--list" ]]; then
  declare -a covered=()
  for t in "$DIR"/test_*_rules.yml; do
    covered+=("$(test_target "$t")")
  done
  printf '%-24s %s\n' "rule file" "firing test (alerts)"
  for rules in "$DIR"/*.rules.yml "$DIR"/warp_btc_swap.yml "$DIR"/zis.rules.yml; do
    [[ -f "$rules" ]] || continue
    base="$(basename "$rules")"
    [[ " ${covered[*]-} " == *" $base "* ]] && state="yes" || state="MISSING"
    printf '%-24s %-4s (%s alerts)\n' "$base" "$state" "$(grep -cE '^[[:space:]]*- alert:' "$rules")"
  done | sort -u
  exit 0
fi

if ! command -v promtool >/dev/null 2>&1; then
  echo "promtool not found in PATH — run this on EDGE1, or copy V31/deploy/monitoring" >&2
  echo "to the server and run: promtool test rules test_*_rules.yml" >&2
  exit 2
fi

fail=0
for test_file in "$DIR"/test_*_rules.yml; do
  name="$(basename "$test_file")"
  if out="$(cd "$DIR" && promtool test rules "$name" 2>&1)"; then
    echo "ok   $name"
  else
    echo "FAIL $name"
    echo "$out" | sed 's/^/     /'
    fail=1
  fi
done

[[ $fail -eq 0 ]] && echo "all alert rule tests passed"
exit $fail
