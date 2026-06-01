#!/usr/bin/env bash
# ZION V3 — Stop Hiranyagarbha API
set -uo pipefail
source "$(dirname "$0")/_lib.sh"
stop_pidfile "hiranyagarbha" "hiranyagarbha" || true
stop_match 'zion-ai-native-api' "hiranyagarbha"
