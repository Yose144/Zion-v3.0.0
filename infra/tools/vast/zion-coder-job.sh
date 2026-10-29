#!/usr/bin/env bash
# zion-coder-job.sh — F2 path-B wrapper (allowlisted via `bash /root/…`).
#
# Usage on rig:
#   bash /root/zion-coder-job.sh "fix typo in README"
#   printf '%s' "$PROMPT" | bash /root/zion-coder-job.sh -
#
# Prefer fleet op `code.run` (enqueue). This script is the exec-safe
# fallback — still runs the same tool jail in code_run.py.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
if [[ "${1:-}" == "-" ]]; then
  PROMPT="$(cat)"
elif [[ -n "${1:-}" ]]; then
  PROMPT="$1"
else
  PROMPT="${PROMPT:-}"
fi
if [[ -z "${PROMPT}" ]]; then
  echo "usage: zion-coder-job.sh \"<prompt>\" | zion-coder-job.sh -" >&2
  exit 2
fi

export VAST_AGENT_CODE_CWD="${VAST_AGENT_CODE_CWD:-/root/work}"
export VAST_AGENT_LLM_URL="${VAST_AGENT_LLM_URL:-http://127.0.0.1:8000/v1}"
mkdir -p "$VAST_AGENT_CODE_CWD"

export CODER_PROMPT="$PROMPT"
cd "$ROOT"
exec python3 -c '
import json, os, sys
sys.path.insert(0, ".")
import code_run
rc, out = code_run.run_code_job({
    "prompt": os.environ["CODER_PROMPT"],
    "force": True,
    "cwd": os.environ.get("VAST_AGENT_CODE_CWD", "/root/work"),
})
print(out)
raise SystemExit(rc)
'
