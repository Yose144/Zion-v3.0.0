#!/usr/bin/env bash
# Hiran v2.3-mini — vast.ai end-to-end pipeline.
#
#   vast_v23mini.sh find                  # list suitable GPU offers
#   vast_v23mini.sh create <offer_id>     # create instance (PyTorch img, 60G disk)
#   vast_v23mini.sh ssh-cmd <id>          # print ssh command for instance
#   vast_v23mini.sh push <id>             # upload dataset + scripts
#   vast_v23mini.sh train <id>            # remote: deps → train → merge → gguf
#   vast_v23mini.sh status <id>           # instance + training progress
#   vast_v23mini.sh pull <id>             # download GGUF + adapter to ./artifacts
#   vast_v23mini.sh destroy <id>          # destroy instance (stops billing)
#
# Prereq: `vastai` CLI configured (vastai set api-key …), ssh key
# ~/.ssh/id_ed25519.pub (or $VAST_SSH_KEY.pub) uploaded to your vast.ai account.
set -euo pipefail

BUNDLE="$(cd "$(dirname "$0")" && pwd)"
DATA="${V23MINI_DATA:-$BUNDLE/../merged_seed.jsonl}"
WORK=/workspace/v23mini
IMG="pytorch/pytorch:2.6.0-cuda12.4-cudnn9-devel"
SSH_KEY="${VAST_SSH_KEY:-$HOME/.ssh/id_ed25519}"

instance_field() { # <id> <field>
  vastai show instance "$1" --raw | python3 -c \
    "import json,sys; d=json.load(sys.stdin); print(d.get('$2',''))"
}

ssh_cmd() { # prints array-ready ssh invocation
  local host port
  host="$(instance_field "$1" ssh_host)"; port="$(instance_field "$1" ssh_port)"
  echo "ssh -i $SSH_KEY -p $port -o StrictHostKeyChecking=accept-new root@$host"
}

ssh_rsh() { # rsync rsh part (ssh + opts, no host)
  local host port
  host="$(instance_field "$1" ssh_host)"; port="$(instance_field "$1" ssh_port)"
  echo "ssh -i $SSH_KEY -p $port -o StrictHostKeyChecking=accept-new"
  return 0
}

ssh_target() { echo "root@$(instance_field "$1" ssh_host)"; }

case "${1:-}" in
  find)
    vastai search offers 'gpu_ram>=24 reliability>0.9 inet_down>500 num_gpus=1' \
      -o 'dph+' --limit 15
    ;;
  create)
    [[ -n "${2:-}" ]] || { echo "usage: create <offer_id>" >&2; exit 1; }
    vastai create instance "$2" --image "$IMG" --disk 60 \
      --ssh --direct --label hiran-v23mini
    ;;
  ssh-cmd) ssh_cmd "$2" ;;
  push)
    SSH="$(ssh_cmd "$2")"
    $SSH "mkdir -p $WORK"
    rsync -az --info=progress2 -e "$(ssh_rsh "$2")" \
      "$DATA" "$BUNDLE/train_v23mini.py" "$BUNDLE/merge_v23mini.py" \
      "$BUNDLE/requirements-v23mini.txt" "$BUNDLE/run_remote.sh" \
      "$(ssh_target "$2")":$WORK/
    ;;
  train)
    SSH="$(ssh_cmd "$2")"
    $SSH "cd $WORK && nohup bash run_remote.sh > train.log 2>&1 & echo started"
    ;;
  status)
    vastai show instance "$2"
    SSH="$(ssh_cmd "$2")"
    $SSH "tail -8 $WORK/train.log 2>/dev/null || echo 'no log yet'"
    ;;
  pull)
    mkdir -p "$BUNDLE/artifacts"
    rsync -az --info=progress2 -e "$(ssh_rsh "$2")" \
      "$(ssh_target "$2")":$WORK/out/ "$BUNDLE/artifacts/"
    ;;
  destroy)
    vastai destroy instance "$2" -y
    ;;
  *) echo "usage: find|create|ssh-cmd|push|train|status|pull|destroy" >&2; exit 1 ;;
esac
