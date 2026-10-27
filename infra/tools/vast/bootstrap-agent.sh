#!/usr/bin/env bash
# bootstrap-agent.sh — install zion-vast-agent on a vast.ai rig (W3 B1/B7).
#
#   bash bootstrap-agent.sh <instance-id>
#
# What it does over the existing vastctl SSH path:
#   1. scp agent.py        → /root/zion-vast-agent.py
#   2. --enroll            → per-rig secret in ~/.local/share/vast-agent.json
#   3. tmux session        → detached heartbeat loop (vast.ai has no systemd)
#
# The enroll token is read from ~/.config/vastctl.env on THIS ops station —
# it travels to the rig only inside the SSH session, never on our argv.
set -euo pipefail

IID="${1:?usage: bootstrap-agent.sh <vast instance id>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
RIG_ID="${2:-$IID}"

set -a; . "$HOME/.config/vastctl.env"; set +a
: "${VASTCTL_ENROLL_TOKEN:?missing in ~/.config/vastctl.env}"

# Resolve ssh endpoint for the instance.
read -r HOST PORT <<<"$(cd "$HERE" && python3 -c "
import vastctl, sys
insts = [i for i in vastctl.instances() if str(i['id']) == '$IID']
if not insts: sys.exit('instance $IID not found')
i = insts[0]
print(i['ssh_host'], i['ssh_port'])")"
echo ">> $IID → root@$HOST:$PORT (rig_id=$RIG_ID)"

SSH=(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 -p "$PORT" "root@$HOST")

# 1. upload agent
scp -o StrictHostKeyChecking=no -P "$PORT" \
    "$HERE/agent.py" "root@$HOST:/root/zion-vast-agent.py"

# 2+3. enroll (idempotent — skips when state file exists) + tmux launch
"${SSH[@]}" 'bash -s' <<EOF
set -e
export VAST_AGENT_URL="https://zionterranova.com"
export VAST_AGENT_ENROLL="$VASTCTL_ENROLL_TOKEN"
export VAST_AGENT_RIG_ID="$RIG_ID"
export VAST_AGENT_INTERVAL=30
python3 /root/zion-vast-agent.py --enroll
tmux kill-session -t vast-agent 2>/dev/null || true
tmux new-session -d -s vast-agent \\
  'VAST_AGENT_URL=https://zionterranova.com VAST_AGENT_RIG_ID=$RIG_ID \\
   VAST_AGENT_INTERVAL=30 python3 /root/zion-vast-agent.py'
sleep 2
tmux ls | grep vast-agent
EOF

echo ">> agent running. verify: curl -s https://zionterranova.com/api/agent/fleet | jq '.rigs[] | select(.rig_id==\"$RIG_ID\")'"
