#!/usr/bin/env bash
# deploy-provenance.sh — collect a provenance manifest for deployed ZION
# binaries (8.B3). For each production unit on EDGE + EDGE2 records:
# unit, exec path, sha256, mtime, service start, binary --version (8.B3
# build id once binaries carry 66d15bef4+), plus the repo checkout sha.
#
# Usage: scripts/ops/deploy-provenance.sh [--edge-only|--edge2-only]
# Output: JSON on stdout. Save as docs/3.2/DEPLOY-PROVENANCE-<date>.json
# or feed into the markdown manifest table.
set -u

EDGE_SSH=(-J zion-edge2 -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222 root@62.171.141.136)
EDGE2_SSH=(zion-edge2)
SSH_OPTS=(-o ConnectTimeout=15 -o BatchMode=yes)

# units whose ExecStart binary we fingerprint
EDGE_UNITS="zion-v31-pool zion-v31-node2 zion-v31-node3 zion-v31-miner zion-fallback-miner"
EDGE2_UNITS="zion-v31-node zion-v31-multichain zion-v31-dao zion-v31-ncl zion-v31-free-world zion-v31-issobella zion-v31-oasis zion-v31-ai-native"

REMOTE=$(cat <<'EOS'
units="$1"
out="["
first=1
for u in $units; do
  exec_path=$(systemctl show "$u" -p ExecStart --no-pager 2>/dev/null | sed -n 's/.*argv\[\]=\([^ ;]*\).*/\1/p' | head -1)
  [ -z "$exec_path" ] && exec_path=$(systemctl show "$u" -p ExecStart --no-pager 2>/dev/null | grep -oE '/[a-zA-Z0-9_/.-]+' | head -1)
  active=$(systemctl show "$u" -p ActiveEnterTimestamp --no-pager 2>/dev/null | cut -d= -f2)
  state=$(systemctl is-active "$u" 2>/dev/null)
  sha=""; mtime=""; ver=""
  if [ -n "$exec_path" ] && [ -f "$exec_path" ]; then
    sha=$(sha256sum "$exec_path" 2>/dev/null | cut -c1-16)
    mtime=$(stat -c %y "$exec_path" 2>/dev/null | cut -c1-19)
    # --version only on binaries known to exit cleanly — others START the
    # daemon (port/db contention with the live instance)
    base=$(basename "$exec_path")
    if [ "$base" = "zion-pool" ] || [ "$base" = "zion-node" ] || [ "$base" = "zion-miner" ] || [ "$base" = "warpd" ]; then
      ver=$(timeout 3 "$exec_path" --version 2>/dev/null | head -1 | sed 's/\x1b\[[0-9;]*m//g')
    fi
  fi
  [ $first -eq 0 ] && out="$out,"
  first=0
  out="$out{\"unit\":\"$u\",\"state\":\"$state\",\"exec\":\"$exec_path\",\"sha256\":\"$sha\",\"mtime\":\"$mtime\",\"version\":\"$ver\",\"since\":\"$active\"}"
done
out="$out]"
echo "$out"
EOS
)

collect() { # $1=host label, $2=unit list, rest=ssh target
  local label="$1" units="$2"; shift 2
  local bins checkout
  bins=$(ssh "${SSH_OPTS[@]}" "$@" "bash -s -- \"$units\"" <<<"$REMOTE" 2>/dev/null)
  checkout=$(ssh "${SSH_OPTS[@]}" "$@" "
    if git -C /opt/zion/V31 rev-parse --git-dir >/dev/null 2>&1; then
      git -C /opt/zion/V31 rev-parse --short=9 HEAD 2>/dev/null
      git -C /opt/zion/V31 status -s 2>/dev/null | wc -l
    else
      echo none; echo -1
    fi" 2>/dev/null)
  echo "{\"host\":\"$label\",\"repo\":{\"checkout\":\"$(echo "$checkout" | head -1)\",\"dirty_files\":$(echo "$checkout" | tail -1)},\"binaries\":${bins:-[]}}"
}

scope="${1:-all}"
[ "$scope" != "--edge2-only" ] && collect edge "$EDGE_UNITS" "${EDGE_SSH[@]}"
[ "$scope" != "--edge-only" ] && collect edge2 "$EDGE2_UNITS" "${EDGE2_SSH[@]}"
