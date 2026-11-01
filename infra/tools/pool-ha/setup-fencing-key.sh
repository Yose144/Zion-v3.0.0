#!/usr/bin/env bash
# setup-fencing-key.sh — zprovozní read-only sondu primáru pro fencing guard.
#
# Proč: guard běží na EDGE2 (kde je standby i token), ale musí umět rozeznat
# „primár mrtvý" od „primár jen wedged". EDGE2 dnes na primár nedosáhne
# (port 22 refused, 2222 publickey denied). Místo root shellu se instaluje
# **omezený klíč**: authorized_keys na EDGE má `command="edge-pool-probe.sh"`,
# `from="<EDGE2 IP>"`, bez PTY/forwardingů. Klíč tedy umí jediné — přečíst
# tři fakta. Kdykoli lze smazat jeden řádek a je po trustu.
#
# Použití (z operátorského stroje, který umí ssh na oba boxy):
#   bash infra/tools/pool-ha/setup-fencing-key.sh
#   EDGE2_HOST=zion-edge2 EDGE_HOST=zion-v6 bash .../setup-fencing-key.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
EDGE2_HOST="${EDGE2_HOST:-zion-edge2}"
EDGE_HOST="${EDGE_HOST:-zion-v6}"
SSH_OPTS="${SSH_OPTS:--o BatchMode=yes -o ConnectTimeout=15}"
EDGE2_IP="${EDGE2_IP:-207.180.217.100}"
EDGE_SSH_PORT="${EDGE_SSH_PORT:-2222}"
EDGE_IP="${EDGE_IP:-62.171.141.136}"
KEY_ON_EDGE2="/etc/zion/keys/edge-probe"

say() { printf '[fencing] %s\n' "$*"; }

# ── 1. klíč na EDGE2 (idempotentní) ────────────────────────────────────────
say "EDGE2: zajišťuji klíč ${KEY_ON_EDGE2}"
ssh $SSH_OPTS "$EDGE2_HOST" "
  set -e
  mkdir -p /etc/zion/keys && chmod 700 /etc/zion/keys
  if [ ! -f ${KEY_ON_EDGE2} ]; then
    ssh-keygen -t ed25519 -N '' -C 'zion-pool-fencing-probe' -f ${KEY_ON_EDGE2} >/dev/null
  fi
  chmod 600 ${KEY_ON_EDGE2}; chmod 644 ${KEY_ON_EDGE2}.pub
  cat ${KEY_ON_EDGE2}.pub
" > /tmp/fencing-pub.$$ 
PUB="$(cat /tmp/fencing-pub.$$)"; rm -f /tmp/fencing-pub.$$
[ -n "$PUB" ] || { echo "nepodařilo se získat pubkey" >&2; exit 1; }

# ── 2. probe skript na EDGE ────────────────────────────────────────────────
say "EDGE: instaluji edge-pool-probe.sh"
scp $SSH_OPTS "$HERE/edge-pool-probe.sh" "$EDGE_HOST:/usr/local/sbin/edge-pool-probe.sh" >/dev/null
ssh $SSH_OPTS "$EDGE_HOST" "chmod 0755 /usr/local/sbin/edge-pool-probe.sh && bash -n /usr/local/sbin/edge-pool-probe.sh"

# ── 3. omezený authorized_keys záznam (idempotentní) ───────────────────────
say "EDGE: authorized_keys (from=${EDGE2_IP}, forced command, no-pty)"
ssh $SSH_OPTS "$EDGE_HOST" "
  set -e
  AK=/root/.ssh/authorized_keys
  touch \$AK; chmod 600 \$AK
  cp -a \$AK \${AK}.bak-fencing-\$(date +%Y%m%dT%H%M%SZ)
  if ! grep -qF 'zion-pool-fencing-probe' \$AK; then
    printf 'command=\"/usr/local/sbin/edge-pool-probe.sh\",no-port-forwarding,no-agent-forwarding,no-pty,no-X11-forwarding,from=\"${EDGE2_IP}\" %s\n' '${PUB}' >> \$AK
    echo '  + záznam přidán'
  else
    echo '  = záznam už existuje'
  fi
"

# ── 4. ověření z EDGE2 ─────────────────────────────────────────────────────
say "test z EDGE2 → EDGE (probe)"
ssh $SSH_OPTS "$EDGE2_HOST" "
  ssh -i ${KEY_ON_EDGE2} -p ${EDGE_SSH_PORT} -o BatchMode=yes -o ConnectTimeout=10 \
      -o StrictHostKeyChecking=accept-new root@${EDGE_IP} probe
" || { echo "probe selhal — zkontroluj IP/port/authorized_keys" >&2; exit 1; }

cat <<EOF

Hotovo. Guard teď má čím číst stav primáru:

  export ZION_POOL_HA_PROBE_CMD='ssh -i ${KEY_ON_EDGE2} -p ${EDGE_SSH_PORT} -o BatchMode=yes root@${EDGE_IP} probe'

(dej to do /etc/zion/pool-standby.env na EDGE2; guard to čte sám)
Rollback: smaž řádek s 'zion-pool-fencing-probe' z /root/.ssh/authorized_keys na EDGE.
EOF
