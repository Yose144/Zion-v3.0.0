#!/usr/bin/env bash
# provision-standby.sh — turnkey bring-up of the ZION standby pool on a
# FRESH Debian/Ubuntu VPS.  Run FROM the primary edge (or any machine
# that has the built binary + secrets):
#
#   bash provision-standby.sh root@<STANDBY_IP>
#
# Steps performed (idempotent):
#   1. zion user + dirs
#   2. zion-pool binary + edge-environment.sh + pool state (PPLNS seed)
#   3. systemd unit (standby profile) + enable
#   4. UFW 8444/8445 + TLS cert (certbot) for the TLS stratum
#
# BEFORE RUNNING:
#   - point pool.zionterranova.com (or a test name) DNS at the standby IP
#     FIRST so certbot can issue the cert
#   - the standby's L1 RPC must reach reachable endpoints — edit
#     ZION_STANDBY_L1_RPC_URL in /etc/zion/edge-environment.sh afterward
#
# ⚠️ NEVER run this while the primary is still serving — two pools with
# the same payout wallet = split-brain mining.  Promote only on
# confirmed primary loss (see docs runbook).

set -euo pipefail

TARGET="${1:?usage: provision-standby.sh root@<standby-ip-or-alias>}"
SSH="ssh -o StrictHostKeyChecking=accept-new $TARGET"
RSYNC="rsync -az -e 'ssh -o StrictHostKeyChecking=accept-new'"

PRIMARY_V31="${PRIMARY_V31:-/opt/zion/V31}"
ENV_SRC="${ENV_SRC:-/etc/zion/edge-environment.sh}"
DATA_SRC="${DATA_SRC:-/opt/zion/data/v31}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

echo "=== ZION standby pool provision -> $TARGET ==="
echo "⚠️  Confirm the PRIMARY pool is down/promoted-off before enabling mining."
read -r -p "type PROMOTE to continue: " c
[[ "$c" == "PROMOTE" ]] || { echo "aborted"; exit 1; }

echo "[1/6] user + dirs"
$SSH 'id -u zion >/dev/null 2>&1 || useradd -r -m -s /bin/bash zion;
      mkdir -p /opt/zion/V31/target/release /opt/zion/data/v31 /etc/zion /opt/zion/logs;
      chown -R zion:zion /opt/zion/data /opt/zion/logs'

echo "[2/6] binary"
rsync -az "$PRIMARY_V31/target/release/zion-pool" "$TARGET:/opt/zion/V31/target/release/zion-pool.new"
$SSH 'mv /opt/zion/V31/target/release/zion-pool.new /opt/zion/V31/target/release/zion-pool && chmod +x /opt/zion/V31/target/release/zion-pool'

echo "[3/6] environment (secrets)"
$SSH 'mkdir -p /etc/zion && chmod 700 /etc/zion'
rsync -az "$ENV_SRC" "$TARGET:/etc/zion/edge-environment.sh"
$SSH 'chmod 600 /etc/zion/edge-environment.sh'

echo "[4/6] PPLNS state seed (pool-store.db + pool-pplns.json)"
for f in pool-store.db pool-pplns.json; do
  if [[ -f "$DATA_SRC/$f" ]]; then
    rsync -az "$DATA_SRC/$f" "$TARGET:/opt/zion/data/v31/$f"
  else
    echo "  warn: $DATA_SRC/$f missing — standby starts with empty state"
  fi
done
$SSH 'chown -R zion:zion /opt/zion/data/v31'

echo "[5/6] systemd unit"
rsync -az "$REPO_ROOT/V31/deploy/systemd/zion-v31-pool-standby.service" \
  "$TARGET:/etc/systemd/system/zion-v31-pool.service"
$SSH 'systemctl daemon-reload && systemctl enable zion-v31-pool'

echo "[6/6] firewall + TLS"
$SSH 'command -v ufw >/dev/null && (ufw allow 8444/tcp; ufw allow 8445/tcp) || true'
cat <<'NOTE'

Next manual steps:
  1. Edit /etc/zion/edge-environment.sh on the standby —
     ZION_STANDBY_L1_RPC_URL must point at reachable L1 endpoints
     (cross-host to primary nodes, or a local node replica).
  2. Point DNS (pool.zionterranova.com) at the standby IP, then:
       certbot certonly --standalone -d pool.zionterranova.com \
         --pre-hook 'systemctl stop nginx' --post-hook 'systemctl start nginx'
     and set ZION_POOL_TLS_CERT/ZION_POOL_TLS_KEY for the :8445 listener.
  3. systemctl start zion-v31-pool; verify /public/v1/coins + stratum.
  4. Miners reconnect automatically (stratum retry logic).

NOTE
echo "=== provision complete (service enabled, not started) ==="
