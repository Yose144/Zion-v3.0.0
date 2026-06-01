#!/usr/bin/env bash
# ZION V3 — Start Node 1 (alias to start-node.sh, used by restart-node1)
set -euo pipefail
exec bash "$(dirname "$0")/start-node.sh"
