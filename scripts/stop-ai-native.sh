#!/usr/bin/env bash
# ZION V3 — Stop Hiran Inference server (llama-server / serve.py)
set -uo pipefail
source "$(dirname "$0")/_lib.sh"
stop_pidfile "hiran-inference" "hiran-inference" || true
stop_match 'llama-server' "llama-server"
stop_match 'HiranV2.2/inference/serve.py' "hiran serve.py"
