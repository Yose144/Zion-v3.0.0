#!/usr/bin/env bash
# Wrapper: Edge deployment uses the unified watchdog in edge mode.
# Path differs repo vs server: repo=infra/edge-deploy -> ../../scripts,
# server=/opt/zion/edge-deploy -> ../scripts.
d="$(cd "$(dirname "$0")" && pwd)"
for c in "$d/../scripts" "$d/../../scripts"; do
  if [ -x "$c/watchdog.sh" ]; then
    exec "$c/watchdog.sh" edge "$@"
  fi
done
echo "watchdog.sh not found relative to $d" >&2
exit 1
