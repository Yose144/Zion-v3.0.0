#!/usr/bin/env bash
# ZION V3 — Stop Local Backup Node. Uses PID file (node1 + node2 share the same binary).
set -uo pipefail
source "$(dirname "$0")/_lib.sh"
stop_pidfile "node1" "node1"
