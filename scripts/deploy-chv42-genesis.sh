#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZION 2.9.7 — CHv4.2 Merkabah Dual-Spin — Genesis Restart Deploy
#
# Kompletní upgrade + genesis reset na všech 3 serverech:
#   Helsinki (seed + pool + monitoring)  — 77.42.31.72       zion_hetzner_key
#   USA      (seed + miner)              — 178.156.240.160   zion_server_key
#   Asia     (seed + miner)              — 5.223.43.93       zion_server_key
#
# Postup na každém serveru:
#   1. Rsync zdrojového kódu
#   2. docker compose down (všechny stack soubory)
#   3. Wipe blockchain dat (genesis reset)
#   4. docker compose build --no-cache  (nové 2.9.7 images)
#   5. docker compose up -d
#   6. Smazání starých images + prune
#   7. Health check
#
# Použití:
#   bash scripts/deploy-chv42-genesis.sh [all|helsinki|usa|asia|verify|clean]
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Barvy ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${GREEN}[ZION]${NC} $1"; }
step() { echo -e "${CYAN}[STEP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERR ]${NC} $1"; }
hr()   { echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# ─── Konfigurace ──────────────────────────────────────────────────────────────
VERSION="2.9.7"
DEPLOY_DIR="/root/zion-${VERSION}"
COMPOSE_FILE="docker/docker-compose.mainnet.yml"
COMPOSE_MONITORING="docker/docker-compose.monitoring.yml"
LOCAL_SRC="$(cd "$(dirname "$0")/.." && pwd)"

KEY_HETZNER="$HOME/.ssh/zion_hetzner_key"
KEY_SERVER="$HOME/.ssh/zion_server_key"

HELSINKI_IP="77.42.31.72"
USA_IP="178.156.240.160"
ASIA_IP="5.223.43.93"

# Seed peers pro P2P (aktualizuj pokud se IPs mění)
SEED_PEERS="${HELSINKI_IP}:8333,${USA_IP}:8333,${ASIA_IP}:8333"

# ─── SSH helper ───────────────────────────────────────────────────────────────
ssh_run() {
    local key="$1" ip="$2" cmd="$3"
    ssh -i "$key" -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new \
        -o ServerAliveInterval=30 "root@${ip}" "$cmd"
}

rsync_src() {
    local key="$1" ip="$2"
    rsync -az --delete \
        --chmod=Du=rwx,Fu=rw \
        --exclude 'target/' \
        --exclude '.git/' \
        --exclude 'node_modules/' \
        --exclude '*.zip' \
        --exclude '.venv*' \
        --exclude 'opencl_sdk/' \
        -e "ssh -i $key -o StrictHostKeyChecking=accept-new" \
        "$LOCAL_SRC/" "root@${ip}:${DEPLOY_DIR}/"
}

# ─── Genesis wipe na serveru ───────────────────────────────────────────────────
# Maže blockchain data ale ZACHOVÁVÁ .env a redis data
wipe_genesis_cmd() {
    cat <<'REMOTE'
set -euo pipefail
echo "[GENESIS] Wiping blockchain data..."
# Zastavit vše
docker compose -f docker/docker-compose.mainnet.yml down --remove-orphans 2>/dev/null || true
docker compose -f docker/docker-compose.monitoring.yml down --remove-orphans 2>/dev/null || true

# Smazat blockchain volume (core data)
if docker volume ls -q | grep -q "zion-data"; then
    docker volume rm zion-data 2>/dev/null || true
    echo "[GENESIS] ✓ zion-data volume smazán"
fi
# Smazat pool share data
if docker volume ls -q | grep -q "pool-data"; then
    docker volume rm pool-data 2>/dev/null || true
    echo "[GENESIS] ✓ pool-data volume smazán"
fi
# Redis data zachovat (wallet/session state) — volitelné
# docker volume rm redis-data 2>/dev/null || true

echo "[GENESIS] Blockchain reset dokončen — od genesis bloku 0"
REMOTE
}

# ─── Build a start na serveru ─────────────────────────────────────────────────
build_and_start_cmd() {
    local is_helsinki="${1:-false}"
    cat <<REMOTE
set -euo pipefail
cd ${DEPLOY_DIR}

echo "[BUILD] Instalace Docker (pokud chybí)..."
command -v docker >/dev/null || (curl -fsSL https://get.docker.com | sh)

# Vytvořit .env pokud neexistuje
if [ ! -f .env ]; then
    echo "REDIS_PASSWORD=\$(openssl rand -hex 32)" > .env
    echo "MINER_WALLET=zion1q893q6c5j7y0e3r062g4m7c240t5g294k7z6729" >> .env
    echo "MINER_WORKER=\$(hostname)" >> .env
    echo "[BUILD] .env vytvořen"
fi

echo "[BUILD] Sestavuji zion-core:${VERSION} (CHv4.2) — může trvat 10-15 min..."
docker compose -f ${COMPOSE_FILE} build --no-cache --pull 2>&1 | tail -5

echo "[BUILD] Spouštím mainnet stack..."
docker compose -f ${COMPOSE_FILE} up -d

# Helsinki: spustit i monitoring
if [ "${is_helsinki}" = "true" ]; then
    echo "[BUILD] Spouštím monitoring stack..."
    docker compose -f ${COMPOSE_MONITORING} up -d 2>/dev/null || true
fi

echo "[BUILD] Čekám na zdraví služeb (60s)..."
sleep 60

# Health check
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

# Test RPC
if curl -sf http://localhost:8443/stats >/dev/null 2>&1; then
    echo "[HEALTH] ✅ zion-core RPC OK"
else
    echo "[HEALTH] ⚠️  zion-core RPC nedostupný (spouštím...)"
fi
if curl -sf http://localhost:8080/stats >/dev/null 2>&1; then
    echo "[HEALTH] ✅ zion-pool API OK"
fi

echo "[BUILD] ✅ Spuštěno — ${VERSION} CHv4.2 Merkabah Dual-Spin"
REMOTE
}

# ─── Čištění starých images ───────────────────────────────────────────────────
cleanup_images_cmd() {
    cat <<REMOTE
set -euo pipefail
echo "[CLEANUP] Mažu staré images..."

# Odstranit konkrétní staré verze
for old_tag in 2.9.5-mainnet 2.9.5 2.9.6 2.9.6-dev; do
    docker rmi "zion-core:\${old_tag}"  2>/dev/null && echo "  ✓ zion-core:\${old_tag}" || true
    docker rmi "zion-pool:\${old_tag}"  2>/dev/null && echo "  ✓ zion-pool:\${old_tag}" || true
    docker rmi "zion-miner:\${old_tag}" 2>/dev/null && echo "  ✓ zion-miner:\${old_tag}" || true
done

# Prune dangling images + build cache
docker image prune -f
docker builder prune -f --filter "until=24h"

echo "[CLEANUP] ✅ Hotovo"
docker images | grep -E "zion|REPOSITORY" || true
REMOTE
}

# ─── Deploy na jeden server ───────────────────────────────────────────────────
deploy_server() {
    local name="$1" ip="$2" key="$3" is_helsinki="${4:-false}"
    hr
    log "${BOLD}Deploying $name ($ip) — CHv4.2 Genesis Restart${NC}"
    hr

    step "[$name] 1/5 Rsync zdrojového kódu → ${DEPLOY_DIR}"
    rsync_src "$key" "$ip"
    log "[$name] ✓ Rsync OK"

    step "[$name] 2/5 Wipe blockchain (genesis reset)"
    ssh_run "$key" "$ip" "$(wipe_genesis_cmd)"

    step "[$name] 3/5 Build ${VERSION} images + start"
    ssh_run "$key" "$ip" "$(build_and_start_cmd "$is_helsinki")"

    step "[$name] 4/5 Čištění starých images"
    ssh_run "$key" "$ip" "$(cleanup_images_cmd)"

    step "[$name] 5/5 Finální health check"
    verify_server "$name" "$ip" "$key"

    log "[$name] 🎉 Deploy dokončen!"
}

# ─── Verify server ────────────────────────────────────────────────────────────
verify_server() {
    local name="$1" ip="$2" key="$3"
    local ok=0

    # Počet běžících kontejnerů
    local cnt
    cnt=$(ssh_run "$key" "$ip" "docker ps --filter 'status=running' --format '{{.Names}}' | wc -l" 2>/dev/null || echo 0)
    if [ "$cnt" -ge 2 ]; then
        log "[$name] ✅ $cnt kontejnery běží"
        ok=$((ok+1))
    else
        warn "[$name] ⚠️  Jen $cnt kontejner(y) — zkontroluj docker logs"
    fi

    # RPC health
    if ssh_run "$key" "$ip" "curl -sf http://localhost:8443/stats" >/dev/null 2>&1; then
        log "[$name] ✅ RPC /stats OK"
        ok=$((ok+1))
    else
        warn "[$name] ⚠️  RPC /stats nedostupný"
    fi

    # P2P port
    if ssh_run "$key" "$ip" "ss -tlnp | grep -q ':8333'" 2>/dev/null; then
        log "[$name] ✅ P2P port 8333 naslouchá"
        ok=$((ok+1))
    else
        warn "[$name] ⚠️  P2P port 8333 není otevřen"
    fi

    # Výška blockchain (genesis = 0)
    local height
    height=$(ssh_run "$key" "$ip" "curl -sf http://localhost:8443/stats 2>/dev/null | python3 -c \"import sys,json; d=json.load(sys.stdin); print(d.get('height',d.get('block_height','?')))\" 2>/dev/null" || echo "?")
    log "[$name] 📦 Block height: $height"

    [ "$ok" -ge 2 ] && log "[$name] ✅ ZDRAVÝ" || warn "[$name] ⚠️  Potřebuje kontrolu"
}

# ─── P2P konektivita mezi servery ─────────────────────────────────────────────
verify_p2p() {
    log "Testujeme P2P konektivitu mezi uzly..."
    local peers=("$HELSINKI_IP" "$USA_IP" "$ASIA_IP")
    local names=("Helsinki" "USA" "Asia")
    local keys=("$KEY_HETZNER" "$KEY_SERVER" "$KEY_SERVER")

    for i in "${!peers[@]}"; do
        local ip="${peers[$i]}" name="${names[$i]}" key="${keys[$i]}"
        for j in "${!peers[@]}"; do
            [ "$i" = "$j" ] && continue
            local peer_ip="${peers[$j]}"
            if ssh_run "$key" "$ip" \
                "timeout 5 bash -c 'echo >/dev/tcp/${peer_ip}/8333' 2>/dev/null && echo OK" 2>/dev/null | grep -q OK; then
                log "[$name] ↔ ${names[$j]} (${peer_ip}:8333) ✅"
            else
                warn "[$name] ↔ ${names[$j]} (${peer_ip}:8333) ❌ TCP failed"
            fi
        done
    done
}

# ─── Main ─────────────────────────────────────────────────────────────────────
hr
log "${BOLD}ZION ${VERSION} — CHv4.2 Merkabah Dual-Spin${NC}"
log "Genesis restart deploy — $(date '+%Y-%m-%d %H:%M:%S')"
hr

case "${1:-all}" in
    helsinki)
        deploy_server "Helsinki" "$HELSINKI_IP" "$KEY_HETZNER" "true"
        ;;
    usa)
        deploy_server "USA" "$USA_IP" "$KEY_SERVER" "false"
        ;;
    asia)
        deploy_server "Asia" "$ASIA_IP" "$KEY_SERVER" "false"
        ;;
    all)
        log "Nasazuji na všechny 3 servery: Helsinki → USA → Asia"
        log "⚠️  GENESIS RESET — veškerá blockchain data budou smazána!"
        echo -n "Opravdu pokračovat? [yes/N] "
        read -r confirm
        [ "$confirm" = "yes" ] || { err "Přerušeno."; exit 1; }

        # Helsinki jako první — seed node musí být zdravý dřív
        deploy_server "Helsinki" "$HELSINKI_IP" "$KEY_HETZNER" "true"
        echo ""
        # USA a Asia paralelně
        log "Nasazuji USA a Asia paralelně..."
        deploy_server "USA"  "$USA_IP"  "$KEY_SERVER" "false" &
        PID_USA=$!
        deploy_server "Asia" "$ASIA_IP" "$KEY_SERVER" "false" &
        PID_ASIA=$!
        wait "$PID_USA"  && log "USA — hotovo" || err "USA — selhalo!"
        wait "$PID_ASIA" && log "Asia — hotovo" || err "Asia — selhalo!"

        echo ""
        hr
        log "P2P konektivita (po 30s stabilizaci)..."
        sleep 30
        verify_p2p

        echo ""
        hr
        log "🎉 Kompletní deploy dokončen — ZION ${VERSION} CHv4.2"
        log "Spusť E2E testy: bash scripts/test-e2e-chv42.sh"
        hr
        ;;
    verify)
        verify_server "Helsinki" "$HELSINKI_IP" "$KEY_HETZNER"
        verify_server "USA"      "$USA_IP"      "$KEY_SERVER"
        verify_server "Asia"     "$ASIA_IP"     "$KEY_SERVER"
        echo ""
        verify_p2p
        ;;
    p2p)
        verify_p2p
        ;;
    clean)
        log "Čistím staré images na všech serverech..."
        for pair in "Helsinki:$HELSINKI_IP:$KEY_HETZNER" "USA:$USA_IP:$KEY_SERVER" "Asia:$ASIA_IP:$KEY_SERVER"; do
            IFS=':' read -r name ip key <<< "$pair"
            log "[$name] Čistím..."
            ssh_run "$key" "$ip" "$(cleanup_images_cmd)"
        done
        ;;
    down)
        log "Zastavuji všechny servery..."
        for pair in "Helsinki:$HELSINKI_IP:$KEY_HETZNER" "USA:$USA_IP:$KEY_SERVER" "Asia:$ASIA_IP:$KEY_SERVER"; do
            IFS=':' read -r name ip key <<< "$pair"
            ssh_run "$key" "$ip" "cd ${DEPLOY_DIR} && docker compose -f ${COMPOSE_FILE} down 2>/dev/null; echo [$name] stopped"
        done
        ;;
    logs)
        SERVER="${2:-helsinki}"
        case "$SERVER" in
            helsinki) ssh_run "$KEY_HETZNER" "$HELSINKI_IP" "cd ${DEPLOY_DIR} && docker compose -f ${COMPOSE_FILE} logs --tail=100 -f" ;;
            usa)      ssh_run "$KEY_SERVER"  "$USA_IP"      "cd ${DEPLOY_DIR} && docker compose -f ${COMPOSE_FILE} logs --tail=100 -f" ;;
            asia)     ssh_run "$KEY_SERVER"  "$ASIA_IP"     "cd ${DEPLOY_DIR} && docker compose -f ${COMPOSE_FILE} logs --tail=100 -f" ;;
        esac
        ;;
    *)
        echo "Použití: $0 {all|helsinki|usa|asia|verify|p2p|clean|down|logs [server]}"
        echo ""
        echo "  all          — genesis restart + deploy na všechny 3 servery"
        echo "  helsinki     — jen Helsinki (seed + pool)"
        echo "  usa          — jen USA"
        echo "  asia         — jen Asia"
        echo "  verify       — health check všech serverů + P2P"
        echo "  p2p          — jen P2P konektivitní test"
        echo "  clean        — smazat staré Docker images"
        echo "  down         — zastavit všechny servery"
        echo "  logs [srv]   — tail logs (helsinki|usa|asia)"
        exit 0
        ;;
esac
