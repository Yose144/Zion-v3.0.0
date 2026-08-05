#!/usr/bin/env bash
# Wrapper: new-server deployment uses the unified watchdog in new-server mode.
exec "$(dirname "$0")/../../../scripts/watchdog.sh" new-server "$@"
