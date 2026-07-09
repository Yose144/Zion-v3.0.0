#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# fleet-mainnet-remote-bootstrap.sh
#
# Automaticky: (1) stáhne šablonu .env z Core/Edge (pool klíče, miner wallet),
# (2) nasyncuje lokální V3/** na target host, (3) složí .env (.env.example + šablona),
# (4) volitelně zresetuje volumy genesis (docker compose down -v),
# (5) nabuilduje a spustí docker-compose.v3-mainnet.yml na cíli.
#
# Canonical runtime (Core + Edge topology, stav 2026-05): /root/zion-2.9.6/docker — vlastní
# compose (host networking, pool 3333). Tento skript používá *kanonický* compose
# z repa (V3/docker/docker-compose.v3-mainnet.yml, pool port 8444, RPC jen localhost).
#
# Použití (z lokálního stroje, kde je checkout 2.9.6/V3):
#
#   export ZION_SSH_USER=root
#   export ZION_SSH_IDENTITY="${HOME}/.ssh/zion_hetzner_key"
#   export ZION_TEMPLATE_HOST=<TEMPLATE_HOST_IP>      # Core/Edge — čte jen docker/.env šablony
#   export ZION_TARGET_HOST=<TARGET_HOST_IP>            # nový mainnet coordinator nebo follower
#   export ZION_FLEET_ROLE=coordinator                # coordinator | follower
#   export ZION_COORD_P2P=<COORD_P2P_IP>:8333         # pro follower povinný seed
#
#   ./V3/scripts/fleet-mainnet-remote-bootstrap.sh
#
# Env:
#   ZION_REMOTE_V3_PARENT=/root/zion-v3-fleet      # kde bude REMOTE_PARENT/V3/...
#   ZION_FETCH_TEMPLATE=1                          # výchozí 1 — stáhnout šablonu .env a sloučit
#   ZION_GENESIS_VOLUME_RESET=1                  # výchozí 1 — down -v před up (greenfield)
#   ZION_INSTALL_DOCKER=1                         # výchozí 1 — get.docker.com když chybí docker
#   ZION_SKIP_BUILD=0                             # 1 = jen config + rsync, bez compose build
#
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V3_LOCAL="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_LOCAL="$(cd "$V3_LOCAL/.." && pwd)"

: "${ZION_SSH_USER:=root}"
: "${ZION_SSH_IDENTITY:?Set ZION_SSH_IDENTITY to private key path (e.g. ~/.ssh/zion_hetzner_key)}"
: "${ZION_TEMPLATE_HOST:?Set ZION_TEMPLATE_HOST (Core/Edge ops template, e.g. 62.171.141.136)}"
: "${ZION_TARGET_HOST:?Set ZION_TARGET_HOST (new mainnet coordinator or follower)}"
: "${ZION_FLEET_ROLE:=coordinator}"
: "${ZION_COORD_P2P:=62.171.141.136:8333}"
: "${ZION_TEMPLATE_REPO:=/root/zion-2.9.6}"
: "${ZION_REMOTE_V3_PARENT:=/root/zion-v3-fleet}"
: "${ZION_FETCH_TEMPLATE:=1}"
: "${ZION_GENESIS_VOLUME_RESET:=1}"
: "${ZION_INSTALL_DOCKER:=1}"
: "${ZION_SKIP_BUILD:=0}"
: "${COMPOSE_REL:=docker-compose.v3-mainnet.yml}"

SSH_BASE=(ssh -i "$ZION_SSH_IDENTITY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
RSYNC_BASE=(rsync -az --delete --human-readable)

ssh_t() {
  "${SSH_BASE[@]}" "$ZION_SSH_USER@$ZION_TARGET_HOST" "$@"
}
ssh_tpl() {
  "${SSH_BASE[@]}" "$ZION_SSH_USER@$ZION_TEMPLATE_HOST" "$@"
}

case "$ZION_FLEET_ROLE" in
  coordinator|coord) SEED_PEERS="" ; NODE_ID="${ZION_NODE_ID:-v3-helsinki-coordinator}" ;;
  follower) SEED_PEERS="$ZION_COORD_P2P" ; NODE_ID="${ZION_NODE_ID:-v3-mainnet-follower}" ;;
  *) echo "ZION_FLEET_ROLE musí být coordinator | follower"; exit 1 ;;
esac

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/zion-fleet.XXXXXX")"
chmod 700 "$WORKDIR"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Target: ${ZION_SSH_USER}@${ZION_TARGET_HOST} role=${ZION_FLEET_ROLE}"
echo "  Remote: ${ZION_REMOTE_V3_PARENT}/V3"
echo "  Template host: ${ZION_TEMPLATE_HOST} (fetch=${ZION_FETCH_TEMPLATE})"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ "$ZION_INSTALL_DOCKER" == "1" ]]; then
  echo "▸ Kontrola / instalace Docker na target ..."
  ssh_t 'command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 && exit 0
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker || true'
fi

REMOTE_V3="$ZION_REMOTE_V3_PARENT/V3"
echo "▸ příprava adresáře na target ..."
ssh_t "mkdir -p '$REMOTE_V3'"

echo "▸ rsync V3 ze workspace ($V3_LOCAL) → ${ZION_TARGET_HOST}:$REMOTE_V3 ..."
"${RSYNC_BASE[@]}" \
  --exclude '/target/' \
  --exclude 'target/' \
  --exclude '*.swp' \
  -e "ssh -i $ZION_SSH_IDENTITY -o BatchMode=yes -o StrictHostKeyChecking=accept-new" \
  "$V3_LOCAL/" "$ZION_SSH_USER@$ZION_TARGET_HOST:$REMOTE_V3/"

EXAMPLE_DST="$WORKDIR/.env.generated"
PRAG_DST="$WORKDIR/prague-docker.env"
cp "$V3_LOCAL/docker/.env.example" "$EXAMPLE_DST"

if [[ "$ZION_FETCH_TEMPLATE" == "1" ]]; then
  echo "▸ Stažení ${ZION_TEMPLATE_HOST}:$ZION_TEMPLATE_REPO/docker/.env (šablona) ..."
  "${SSH_BASE[@]}" "$ZION_SSH_USER@$ZION_TEMPLATE_HOST" "cat '${ZION_TEMPLATE_REPO}/docker/.env'" >"$PRAG_DST" || {
    echo "Nelze přečíst Pražský .env — pokračuji jen s .env.example (nastav ZION_FETCH_TEMPLATE=0 pro očekávaný fail)."
    rm -f "$PRAG_DST"
  }
fi

export SEED_MERGE="$SEED_PEERS"
export NODE_ID_MERGE="$NODE_ID"

if [[ -f "$PRAG_DST" ]]; then
  export FLEET_EXAMPLE_DST="$EXAMPLE_DST" FLEET_PRAG_DST="$PRAG_DST" SEED_MERGE NODE_ID_MERGE
  python3 <<'PY'
import os, pathlib
ex_path = pathlib.Path(os.environ["FLEET_EXAMPLE_DST"])
pr_path = pathlib.Path(os.environ["FLEET_PRAG_DST"])
text = ex_path.read_text(encoding="utf-8")
needles = {}

def kv_block(p):
    out = {}
    for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
        ls = line.strip()
        if not ls or ls.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip()
    return out

if pr_path.is_file():
    pr = kv_block(pr_path)
    if "MINER_WALLET" in pr and pr["MINER_WALLET"]:
        needles["ZION_MINER_ADDRESS"] = pr["MINER_WALLET"]
    for pk in ("ZION_POOL_WALLET", "ZION_POOL_PAYOUT_SK_HEX"):
        if pk in pr and pr[pk]:
            needles[pk] = pr[pk]

repl_lines = []
for line in text.splitlines():
    if "=" in line and not line.strip().startswith("#"):
        key = line.split("=", 1)[0].strip()
        if key in needles:
            repl_lines.append(f"{key}={needles[key]}")
            continue
    if line.strip().startswith("ZION_SEED_PEERS="):
        seed = os.environ.get("SEED_MERGE", "")
        repl_lines.append(f"ZION_SEED_PEERS={seed}")
        continue
    if line.strip().startswith("ZION_NODE_ID="):
        repl_lines.append(f"ZION_NODE_ID={os.environ.get('NODE_ID_MERGE', 'v3-fleet-node')}")
        continue
    repl_lines.append(line)

ex_path.write_text("\n".join(repl_lines) + "\n", encoding="utf-8")
PY
  echo "✓ Merge šablony + lokální .env.example (seed + NODE_ID)."
else
  python3 <<PY
from pathlib import Path
import os
p = Path("${EXAMPLE_DST}")
lines = p.read_text(encoding="utf-8").splitlines()
out = []
seed = "${SEED_MERGE}".strip()
nid = "${NODE_ID_MERGE}"
for line in lines:
    if line.strip().startswith("ZION_SEED_PEERS="):
        out.append(f"ZION_SEED_PEERS={seed}")
    elif line.strip().startswith("ZION_NODE_ID="):
        out.append(f"ZION_NODE_ID={nid}")
    else:
        out.append(line)
p.write_text("\n".join(out) + "\n", encoding="utf-8")
PY
  echo "✓ Pouze .env.example + seed/NODE_ID (bez Prahy)."
fi
echo "▸ kopírování .env na target ..."
scp -q -o BatchMode=yes -o StrictHostKeyChecking=accept-new -i "$ZION_SSH_IDENTITY" \
  "$EXAMPLE_DST" "$ZION_SSH_USER@$ZION_TARGET_HOST:$REMOTE_V3/docker/.env"
ssh_t "chmod 600 '$REMOTE_V3/docker/.env'"

if [[ "$ZION_SKIP_BUILD" == "1" ]]; then
  echo "ZION_SKIP_BUILD=1 → končím před compose up."
  exit 0
fi

REMOTE_COMPOSE_DIR="$REMOTE_V3/docker"

echo "▸ docker compose (${COMPOSE_REL}) ..."
if [[ "$ZION_GENESIS_VOLUME_RESET" == "1" ]]; then
  echo "    ( genesis reset: down -v )"
  ssh_t "cd '$REMOTE_COMPOSE_DIR' && docker compose -f '$COMPOSE_REL' down -v --remove-orphans 2>/dev/null || true"
fi

ssh_t "cd '$REMOTE_COMPOSE_DIR' && docker compose -f '$COMPOSE_REL' up -d --build"

echo ""
echo "▸ post-check (health + krátký getChainInfo) ..."
ssh_t "sleep 8; curl -sf http://127.0.0.1:8443/health | head -c 120; echo || true"

ssh_t 'printf '"'"'%s\n'"'"' '"'"'{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}'"'"' | nc -w 4 127.0.0.1 8443 | head -c 600 || true'

echo ""
echo "Hotovo. Logy na target: ssh -i \"$ZION_SSH_IDENTITY\" $ZION_SSH_USER@$ZION_TARGET_HOST \"cd '$REMOTE_COMPOSE_DIR' && docker compose -f $COMPOSE_REL logs -f node\""

