#!/usr/bin/env bash
# ==============================================================================
# ZION 2.9.8 Autopilot
# Phases: upgrade -> core -> nodes -> miners -> server deploy -> server test
# ==============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NETWORK="${NETWORK:-testnet}"
REMOTE=0
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_DIR="${DEPLOY_DIR:-/root/zion-2.9.6}"
COMPOSE_FILE_TESTNET="docker/docker-compose.testnet.yml"
COMPOSE_FILE_MAINNET="docker/docker-compose.mainnet.yml"
SKIP_BUILD=0
PRIMARY_POOL_MANAGED=1
PROFILE="${PROFILE:-relaxed}"
STRICT_MODE=0

SSH_KEY_PRIMARY="${SSH_KEY_PRIMARY:-${SSH_KEY_HELSINKI:-$HOME/.ssh/zion_hetzner_key}}"
SSH_KEY_NODES="${SSH_KEY_NODES:-$HOME/.ssh/zion_hetzner_key}"

# name|ip|key_type|services_testnet|services_mainnet
SERVERS=(
  "Zion2|91.98.122.165|primary|core pool miner redis|core pool miner redis"
)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log() { echo -e "${GREEN}[AUTOPILOT]${NC} $1"; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
phase() { echo -e "\n${BOLD}════════ $1 ════════${NC}"; }

usage() {
  cat <<EOF
Usage: bash scripts/autopilot-2.9.8.sh [options]

Options:
  --remote                Run remote deploy + remote tests on servers
  --network <name>        testnet|mainnet (default: testnet)
  --profile <name>        relaxed|prod-run (default: relaxed)
  --strict                Alias for --profile prod-run
  --skip-build            Skip docker compose build on remote servers
  --no-primary-pool       Do not deploy/manage pool service on the primary host
  -h, --help              Show this help

Environment:
  DEPLOY_USER             SSH user (default: root)
  DEPLOY_DIR              Remote repo dir (default: /root/zion-2.9.6)
  SSH_KEY_PRIMARY         SSH key for the primary host (falls back to SSH_KEY_HELSINKI)
  SSH_KEY_NODES           Reserved for future multi-node topology
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote) REMOTE=1; shift ;;
    --network) NETWORK="${2:-}"; shift 2 ;;
    --profile) PROFILE="${2:-}"; shift 2 ;;
    --strict) PROFILE="prod-run"; shift ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    --no-primary-pool|--no-helsinki-pool) PRIMARY_POOL_MANAGED=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) err "Unknown argument: $1" ;;
  esac
done

if [[ "$NETWORK" != "testnet" && "$NETWORK" != "mainnet" ]]; then
  err "Invalid --network '$NETWORK' (use testnet|mainnet)"
fi

if [[ "$PROFILE" != "relaxed" && "$PROFILE" != "prod-run" ]]; then
  err "Invalid --profile '$PROFILE' (use relaxed|prod-run)"
fi

if [[ "$PROFILE" == "prod-run" ]]; then
  STRICT_MODE=1
fi

preflight_profile_checks() {
  if [[ "$STRICT_MODE" -ne 1 ]]; then
    return
  fi

  [[ "$REMOTE" -eq 1 ]] || err "prod-run profile requires --remote"
  [[ "$PRIMARY_POOL_MANAGED" -eq 1 ]] || err "prod-run profile forbids --no-primary-pool"
  [[ -n "${REDIS_PASSWORD:-}" ]] || err "prod-run profile requires REDIS_PASSWORD environment variable"

  [[ -f "$SSH_KEY_PRIMARY" ]] || err "Missing SSH key: $SSH_KEY_PRIMARY"

  for entry in "${SERVERS[@]}"; do
    IFS='|' read -r name ip key_type _ _ <<< "$entry"
    local_key="$(ssh_key_for_type "$key_type")"
    ssh_run "$local_key" "$ip" "echo preflight-ok >/dev/null" || err "prod-run preflight SSH failed for ${name} (${ip})"

    ssh_run "$local_key" "$ip" "
      if [ ! -f '$DEPLOY_DIR/.env' ]; then
        echo 'missing .env'
        exit 12
      fi
      val=\$(grep -E '^REDIS_PASSWORD=' '$DEPLOY_DIR/.env' | tail -n 1 | cut -d= -f2-)
      val=\$(echo \"\$val\" | tr -d '\"')
      if [ -z \"\$val\" ]; then
        echo 'empty REDIS_PASSWORD in .env'
        exit 13
      fi
    " || err "prod-run preflight secret check failed for ${name} (${ip}) — missing/empty REDIS_PASSWORD in ${DEPLOY_DIR}/.env"
  done
}

compose_file_for_network() {
  if [[ "$NETWORK" == "mainnet" ]]; then
    echo "$COMPOSE_FILE_MAINNET"
  else
    echo "$COMPOSE_FILE_TESTNET"
  fi
}

services_for_network() {
  local services_testnet="$1"
  local services_mainnet="$2"
  local name="${3:-}"
  if [[ "$NETWORK" == "mainnet" ]]; then
    services="$services_mainnet"
  else
    services="$services_testnet"
  fi

  if [[ "$name" == "Zion2" && "$PRIMARY_POOL_MANAGED" -eq 0 ]]; then
    services="$(echo "$services" | sed -E 's/(^| )(pool|miner)( |$)/ /g' | xargs)"
  fi

  if [[ "$PRIMARY_POOL_MANAGED" -eq 0 ]]; then
    services="$(echo "$services" | sed -E 's/(^| )miner( |$)/ /g' | xargs)"
  fi

  echo "$services"
}

ssh_key_for_type() {
  local key_type="$1"
  if [[ "$key_type" == "primary" ]]; then
    echo "$SSH_KEY_PRIMARY"
  else
    echo "$SSH_KEY_NODES"
  fi
}

ssh_run() {
  local key="$1"
  local host="$2"
  local cmd="$3"
  ssh -i "$key" -o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new "${DEPLOY_USER}@${host}" "$cmd"
}

upsert_remote_env() {
  local key="$1"
  local host="$2"
  local var_name="$3"
  local var_value="$4"

  ssh_run "$key" "$host" "python3 - <<'PY'
from pathlib import Path

path = Path('$DEPLOY_DIR/.env')
text = path.read_text() if path.exists() else ''
lines = text.splitlines()
name = '$var_name'
value = '$var_value'
updated = []
found = False
for line in lines:
    if line.startswith(f'{name}='):
        updated.append(f'{name}={value}')
        found = True
    else:
        updated.append(line)
if not found:
    updated.append(f'{name}={value}')
path.write_text('\n'.join(updated) + '\n')
PY"
}

ensure_remote_node_env() {
  local key="$1"
  local host="$2"
  local name="$3"

  if [[ "$NETWORK" != "testnet" || "$name" == "Zion2" ]]; then
    return
  fi

  upsert_remote_env "$key" "$host" "MINER_POOL_URL" "91.98.122.165:3333"
  upsert_remote_env "$key" "$host" "ZION_RANDOMX_FULL" "0"
  upsert_remote_env "$key" "$host" "XMR_THREADS" "1"

  if [[ "$name" == "Asia" ]]; then
    upsert_remote_env "$key" "$host" "MINER_CPUS" "1.0"
  fi
}

ensure_remote_miner_identity() {
  local key="$1"
  local host="$2"
  local name="$3"

  local worker="testnet-miner"
  local nonce_base="0"

  case "$name" in
    Zion2)
      worker="zion2-miner"
      nonce_base="268435456"
      ;;
    Usa|Usa2)
      worker="usa-miner"
      nonce_base="536870912"
      ;;
    Asia|Asia3)
      worker="asia-miner"
      nonce_base="805306368"
      ;;
  esac

  upsert_remote_env "$key" "$host" "MINER_WORKER" "$worker"
  upsert_remote_env "$key" "$host" "ZION_NONCE_BASE" "$nonce_base"
}

check_tcp_port() {
  local host="$1"
  local port="$2"

  if command -v nc >/dev/null 2>&1; then
    nc -z -w 5 "$host" "$port" >/dev/null 2>&1
    return $?
  fi

  python3 - "$host" "$port" <<'PY'
import socket
import sys

host = sys.argv[1]
port = int(sys.argv[2])
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(5)
try:
    s.connect((host, port))
    sys.exit(0)
except Exception:
    sys.exit(1)
finally:
    s.close()
PY
}

ensure_remote_volumes() {
  local key="$1"
  local host="$2"

  local volumes=()
  if [[ "$NETWORK" == "testnet" ]]; then
    volumes=("zion-testnet-data" "pool-testnet-data")
  else
    volumes=("zion-data" "pool-data" "redis-data")
  fi

  for v in "${volumes[@]}"; do
    ssh_run "$key" "$host" "docker volume create '$v' >/dev/null"
  done
}

free_remote_ports() {
  local key="$1"
  local host="$2"
  local name="$3"

  local ports=()
  if [[ "$NETWORK" == "mainnet" ]]; then
    ports+=(8333 8443)
  else
    ports+=(8334 8444)
  fi

  if [[ "$name" == "Zion2" ]]; then
    ports+=(3333 8080)
  fi

  for p in "${ports[@]}"; do
    local ids
    ids="$(ssh_run "$key" "$host" "docker ps --filter publish=${p} --format '{{.ID}}'")"
    if [[ -n "$ids" ]]; then
      ssh_run "$key" "$host" "docker rm -f $ids >/dev/null 2>&1 || true"
    fi
  done
}

phase_upgrade() {
  phase "1/6 UPGRADE"
  cd "$ROOT_DIR"

  [[ -f "docs/2.9.8/INDEX.md" ]] || err "Missing docs/2.9.8/INDEX.md"
  [[ -f "docs/2.9.8/ROADMAP_2.9.8.md" ]] || err "Missing docs/2.9.8/ROADMAP_2.9.8.md"
  [[ -f "docs/2.9.8/GO_NO_GO_2.9.8.md" ]] || err "Missing docs/2.9.8/GO_NO_GO_2.9.8.md"

  if ! grep -q "Status: ACTIVE" docs/2.9.8/INDEX.md; then
    warn "docs/2.9.8/INDEX.md does not contain 'Status: ACTIVE'"
  fi

  local compose_file
  compose_file="$(compose_file_for_network)"
  docker compose -f "$compose_file" config >/dev/null
  log "Upgrade baseline OK (${NETWORK}, ${compose_file})"
}

phase_core() {
  phase "2/6 CORE"
  cd "$ROOT_DIR"

  cargo test -p zion-cosmic-harmony-v3 deeksha::tests::
  cargo test -p zion-pool --test chv4_e2e
  cargo check -p zion-core

  log "Core phase PASS"
}

phase_nodes() {
  phase "3/6 NODES"
  cd "$ROOT_DIR"

  local compose_file
  compose_file="$(compose_file_for_network)"

  docker compose -f "$compose_file" config >/dev/null

  if [[ "$NETWORK" == "testnet" ]]; then
    grep -q '"8334:8334"' "$compose_file" || err "Expected testnet P2P port 8334 not found"
    grep -q '"8444:8444"' "$compose_file" || err "Expected testnet RPC port 8444 not found"
  fi

  log "Node config phase PASS"
}

phase_miners() {
  phase "4/6 MINERS"
  cd "$ROOT_DIR"

  cargo test -p zion-miner --no-run

  python3 -m py_compile \
    "APP&WEB/desktop-agent/resources/mining/cosmic_harmony_v42_gpu.py" \
    "APP&WEB/desktop-agent/resources/mining/cosmic_harmony_deeksha_gpu.py" \
    "APP&WEB/desktop-agent/resources/mining/cosmic_harmony_deeksha_fallback.py"

  node --check "APP&WEB/desktop-agent/src/main.js"

  # Ekam Deeksha kernel sync check
  if ! grep -q "ekam_deeksha_mine" "APP&WEB/desktop-agent/resources/mining/cosmic_harmony_deeksha_canonical.cl" 2>/dev/null; then
    warn "Ekam Deeksha kernel not found in canonical .cl — sync needed"
  fi
  if ! grep -q "ekam_deeksha_mine" "L1/cosmic-harmony/src/gpu/kernels/cosmic_harmony_deeksha.cl" 2>/dev/null; then
    err "Ekam Deeksha kernel missing from source .cl"
  fi

  log "Miner/Desktop phase PASS"
}

phase_servers_deploy() {
  phase "5/6 SERVERS DEPLOY"
  if [[ "$REMOTE" -ne 1 ]]; then
    warn "Remote deploy skipped (use --remote to execute)"
    return
  fi

  cd "$ROOT_DIR"
  local compose_file
  compose_file="$(compose_file_for_network)"

  local remote_env_prefix=""
  if [[ -n "${REDIS_PASSWORD:-}" ]]; then
    remote_env_prefix="REDIS_PASSWORD='${REDIS_PASSWORD}' "
  else
    warn "REDIS_PASSWORD není nastaven lokálně; remote compose použije .env/default"
  fi

  [[ -f "$SSH_KEY_PRIMARY" ]] || err "Missing SSH key: $SSH_KEY_PRIMARY"

  local -a deploy_failed=()

  for entry in "${SERVERS[@]}"; do
    IFS='|' read -r name ip key_type services_testnet services_mainnet <<< "$entry"
    local_key="$(ssh_key_for_type "$key_type")"
    services="$(services_for_network "$services_testnet" "$services_mainnet" "$name")"

    log "Deploy -> ${name} (${ip}) services: ${services}"

    if ! ssh_run "$local_key" "$ip" "echo connected >/dev/null"; then
      if [[ "$STRICT_MODE" -eq 1 ]]; then
        err "Deploy failed on ${name} (${ip}) - SSH auth/connect failed"
      else
        warn "Deploy skipped on ${name} (${ip}) - SSH auth/connect failed"
        deploy_failed+=("$name")
        continue
      fi
    fi

    if ! {
      ssh_run "$local_key" "$ip" "mkdir -p '$DEPLOY_DIR'"

      rsync -az --delete \
        --exclude 'target/' \
        --exclude '.git/' \
        --exclude 'node_modules/' \
        --exclude 'Zion-2.9.5-main/' \
        --exclude '.env' \
        --exclude '*.tmp' \
        --chmod=Du=rwx,Fu=rw \
        -e "ssh -i $local_key -o BatchMode=yes -o StrictHostKeyChecking=accept-new" \
        "$ROOT_DIR/" "${DEPLOY_USER}@${ip}:${DEPLOY_DIR}/"

      ensure_remote_node_env "$local_key" "$ip" "$name"
      ensure_remote_miner_identity "$local_key" "$ip" "$name"

      ensure_remote_volumes "$local_key" "$ip"

      if [[ "$SKIP_BUILD" -eq 0 ]]; then
        ssh_run "$local_key" "$ip" "cd '$DEPLOY_DIR' && ${remote_env_prefix}docker compose --env-file .env -f '$compose_file' build --no-cache $services"
      else
        warn "${name}: build skipped (--skip-build)"
      fi

      for svc in $services; do
        ssh_run "$local_key" "$ip" "docker rm -f 'zion-${svc}' >/dev/null 2>&1 || true"
      done

      free_remote_ports "$local_key" "$ip" "$name"

      ssh_run "$local_key" "$ip" "cd '$DEPLOY_DIR' && ${remote_env_prefix}docker compose --env-file .env -f '$compose_file' up -d --no-deps $services"
      ssh_run "$local_key" "$ip" "cd '$DEPLOY_DIR' && ${remote_env_prefix}docker compose --env-file .env -f '$compose_file' ps $services"
    }; then
      if [[ "$STRICT_MODE" -eq 1 ]]; then
        err "Deploy failed on ${name} (${ip})"
      else
        warn "Deploy failed on ${name} (${ip}); continuing"
        deploy_failed+=("$name")
      fi
    fi
  done

  if [[ ${#deploy_failed[@]} -gt 0 ]]; then
    warn "Deploy partial failures: ${deploy_failed[*]}"
  fi

  log "Remote deploy phase PASS"
}

phase_servers_test() {
  phase "6/6 SERVERS TEST"
  if [[ "$REMOTE" -ne 1 ]]; then
    warn "Remote tests skipped (use --remote to execute)"
    return
  fi

  local rpc_port p2p_port
  if [[ "$NETWORK" == "mainnet" ]]; then
    rpc_port=8443
    p2p_port=8333
  else
    rpc_port=8444
    p2p_port=8334
  fi

  local -a test_failed=()

  for entry in "${SERVERS[@]}"; do
    IFS='|' read -r name ip key_type _ _ <<< "$entry"
    local_key="$(ssh_key_for_type "$key_type")"

    log "Test -> ${name} (${ip})"

    if ! ssh_run "$local_key" "$ip" "echo connected >/dev/null"; then
      if [[ "$STRICT_MODE" -eq 1 ]]; then
        err "Test failed on ${name} (${ip}) - SSH auth/connect failed"
      else
        warn "Test skipped on ${name} (${ip}) - SSH auth/connect failed"
        test_failed+=("$name")
        continue
      fi
    fi

    if ! {
      ssh_run "$local_key" "$ip" "curl -sf http://localhost:${rpc_port}/stats >/dev/null"

      if [[ "$name" == "Zion2" && "$PRIMARY_POOL_MANAGED" -eq 1 ]]; then
        ssh_run "$local_key" "$ip" "curl -sf http://localhost:8080/stats >/dev/null"
        check_tcp_port "$ip" 3333
        check_tcp_port "$ip" 8080
      elif [[ "$name" == "Zion2" ]]; then
        warn "Primary host pool checks skipped (--no-primary-pool)"
      fi

      check_tcp_port "$ip" "$p2p_port"
      check_tcp_port "$ip" "$rpc_port"
    }; then
      if [[ "$STRICT_MODE" -eq 1 ]]; then
        err "Test failed on ${name} (${ip})"
      else
        warn "Test failed on ${name} (${ip}); continuing"
        test_failed+=("$name")
      fi
    fi
  done

  if [[ ${#test_failed[@]} -gt 0 ]]; then
    warn "Server test partial failures: ${test_failed[*]}"
  fi

  log "Remote test phase PASS"
}

main() {
  log "ZION 2.9.8 autopilot start (network=${NETWORK}, remote=${REMOTE}, profile=${PROFILE})"
  preflight_profile_checks
  phase_upgrade
  phase_core
  phase_nodes
  phase_miners
  phase_servers_deploy
  phase_servers_test
  log "AUTOPILOT COMPLETE ✅"
}

main
