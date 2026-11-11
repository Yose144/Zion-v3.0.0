#!/usr/bin/env bash
# node-tip-age.sh — read a per-node tip age from the G8 probe and report
# whether the tip is fresh. Intended for the ops watchdog (log-only by
# default) and for ad-hoc checks; it never mutates anything.
#
# Semantics (deliberately conservative):
#   exit 0 + age      -> fresh, or the metric is missing/unknown (skip)
#   exit 1 + age      -> the series exists and the tip is older than --max-age
#
# A missing series means an older G8 probe (before 2026-11-11); the watchdog
# must not act on a metric that does not exist yet, so missing is a no-op.
#
# Usage:
#   node-tip-age.sh [--metrics-url URL] [--metrics-file FILE]
#                   [--service NAME] [--max-age SECONDS] [--tolerance SECONDS]
#
# Defaults: http://127.0.0.1:9105/metrics, node_primary, 900 s, 120 s.
set -euo pipefail

URL="${G8_METRICS_URL:-http://127.0.0.1:9105/metrics}"
FILE=""
SERVICE="${G8_TIP_SERVICE:-node_primary}"
MAX_AGE="${G8_TIP_MAX_AGE:-900}"
TOLERANCE="${G8_TIP_FUTURE_TOLERANCE:-120}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --metrics-url)   URL="$2"; shift 2 ;;
    --metrics-file)  FILE="$2"; shift 2 ;;
    --service)       SERVICE="$2"; shift 2 ;;
    --max-age)       MAX_AGE="$2"; shift 2 ;;
    --tolerance)     TOLERANCE="$2"; shift 2 ;;
    -h|--help)       sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

body=""
if [[ -n "$FILE" ]]; then
  [[ -r "$FILE" ]] && body=$(cat "$FILE" 2>/dev/null || true)
else
  body=$(curl -sf --max-time 3 "$URL" 2>/dev/null || true)
fi

if [[ -z "$body" ]]; then
  echo "unknown"
  exit 0
fi

line=$(printf '%s\n' "$body" \
  | grep -E "^zion_g8_node_tip_age_seconds\{service=\"${SERVICE}\"\} " \
  | tail -1 || true)
if [[ -z "$line" ]]; then
  echo "unknown"
  exit 0
fi

age="${line##* }"
# Unknown sentinel (-1) is not a stale tip; the G8 alert handles "no data".
if ! awk -v a="$age" 'BEGIN{exit !(a == a + 0)}'; then
  echo "unknown"
  exit 0
fi
if awk -v a="$age" 'BEGIN{exit !(a < 0)}'; then
  echo "unknown"
  exit 0
fi

echo "$age"
# Fresh when max(-tolerance, ...) <= age <= max_age. A small future skew is
# normal (miner-supplied block timestamps).
if awk -v a="$age" -v m="$MAX_AGE" 'BEGIN{exit !(a <= m)}'; then
  exit 0
fi
exit 1
