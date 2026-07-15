#!/usr/bin/env bash
# Wrapper: Edge deployment uses the unified watchdog in edge mode.
exec "$(dirname "$0")/../scripts/watchdog.sh" edge "$@"
