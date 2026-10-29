#!/usr/bin/env bash
# bootstrap-agent.sh — install zion-vast-agent on a vast.ai rig (W3 B1/B7).
#
#   bash bootstrap-agent.sh <instance-id> [rig_id]
#   bash bootstrap-agent.sh <instance-id> --sync-only
#
# What it does over the existing vastctl SSH path:
#   1. scp agent.py + code_run.py + job scripts
#   2. --enroll (skipped with --sync-only)
#   3. tmux session → detached heartbeat loop (vast.ai has no systemd)
#
# The enroll token is read from ~/.config/vastctl.env on THIS ops station —
# it travels to the rig only inside the SSH session, never on our argv.
set -euo pipefail

IID="${1:?usage: bootstrap-agent.sh <vast instance id> [--sync-only]}"
HERE="$(cd "$(dirname "$0")" && pwd)"
SYNC_ONLY=0
RIG_ID="$IID"
shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --sync-only) SYNC_ONLY=1 ;;
    *) RIG_ID="$1" ;;
  esac
  shift
done

set -a; . "$HOME/.config/vastctl.env"; set +a
if [[ "$SYNC_ONLY" -eq 0 ]]; then
  : "${VASTCTL_ENROLL_TOKEN:?missing in ~/.config/vastctl.env}"
fi

# Resolve ssh endpoint for the instance.
read -r HOST PORT <<<"$(cd "$HERE" && python3 -c "
import vastctl, sys
insts = [i for i in vastctl.instances() if str(i['id']) == '$IID']
if not insts: sys.exit('instance $IID not found')
i = insts[0]
print(i['ssh_host'], i['ssh_port'])")"
echo ">> $IID → root@$HOST:$PORT (rig_id=$RIG_ID)"

SSH=(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 -p "$PORT" "root@$HOST")

# 1. upload agent + coding worker (F2) + apply hook
scp -o StrictHostKeyChecking=no -P "$PORT" \
    "$HERE/agent.py" "root@$HOST:/root/zion-vast-agent.py"
scp -o StrictHostKeyChecking=no -P "$PORT" \
    "$HERE/code_run.py" "root@$HOST:/root/code_run.py"
scp -o StrictHostKeyChecking=no -P "$PORT" \
    "$HERE/zion-coder-job.sh" "root@$HOST:/root/zion-coder-job.sh"
scp -o StrictHostKeyChecking=no -P "$PORT" \
    "$HERE/zion-sheet-apply.sh" "root@$HOST:/root/zion-sheet-apply.sh"

# 2+3. enroll (skipped on --sync-only) + tmux restart
if [[ "$SYNC_ONLY" -eq 1 ]]; then
  echo ">> sync-only: skip enroll"
  ENROLL_LINE="echo sync-only"
else
  ENROLL_LINE="export VAST_AGENT_ENROLL=\"$VASTCTL_ENROLL_TOKEN\"; python3 /root/zion-vast-agent.py --enroll"
fi
"${SSH[@]}" "bash -s" <<EOF
set -e
export VAST_AGENT_URL="https://zionterranova.com"
export VAST_AGENT_RIG_ID="$RIG_ID"
export VAST_AGENT_INTERVAL=30
export VAST_AGENT_CODE_CWD=/root/work
# Local :8000 is fallback. Metered remote: CLI enqueue passes llm_base + lease_token.
export VAST_AGENT_LLM_URL=http://127.0.0.1:8000/v1
mkdir -p /root/work
chmod 755 /root/zion-vast-agent.py /root/code_run.py /root/zion-coder-job.sh /root/zion-sheet-apply.sh
$ENROLL_LINE
tmux kill-session -t vast-agent 2>/dev/null || true
tmux new-session -d -s vast-agent \\
  'cd /root && VAST_AGENT_URL=https://zionterranova.com VAST_AGENT_RIG_ID=$RIG_ID \\
   VAST_AGENT_INTERVAL=30 VAST_AGENT_CODE_CWD=/root/work \\
   VAST_AGENT_LLM_URL=http://127.0.0.1:8000/v1 \\
   python3 /root/zion-vast-agent.py'
sleep 2
tmux ls | grep vast-agent
EOF

echo ">> agent running. verify: curl -s https://zionterranova.com/api/agent/fleet | jq '.rigs[] | select(.rig_id==\"$RIG_ID\")'"
