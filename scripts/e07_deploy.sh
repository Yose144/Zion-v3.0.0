#!/bin/bash
# E-07 Canary Deploy Script
# Run on Helsinki as: bash /tmp/e07_deploy.sh
set -e

START_UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
AUDIT_LOG="/root/e07_audit.log"

log() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$AUDIT_LOG"; }

log "=== E-07 Canary Deploy START: $START_UTC ==="

# ─── 1. Verify revenue config is present ────────────────────────────────────
REVENUE_CFG="/root/zion-bridge-build/config/ch3_revenue_settings.json"
if [ ! -f "$REVENUE_CFG" ]; then
  log "ERROR: Revenue config not found at $REVENUE_CFG"
  exit 1
fi
log "Revenue config: OK ($(stat -c%s "$REVENUE_CFG") bytes)"

# ─── 2. Get current pool env vars ────────────────────────────────────────────
log "Reading current pool container env vars..."
POOL_ENVS=$(docker inspect zion-pool 2>/dev/null | python3 -c "
import sys, json
c = json.load(sys.stdin)[0]
for e in c['Config']['Env']:
    print('-e', e)
" 2>/dev/null | grep -v HOSTNAME | grep -v HOME | grep -v PATH)

log "Pool env snapshot taken"

# ─── 3. Get current pool port bindings ───────────────────────────────────────
POOL_PORTS=$(docker inspect zion-pool 2>/dev/null | python3 -c "
import sys, json
c = json.load(sys.stdin)[0]
bindings = c['HostConfig']['PortBindings']
for container_port, host_bindings in bindings.items():
    for hb in (host_bindings or []):
        host_port = hb.get('HostPort', '')
        host_ip = hb.get('HostIp', '')
        cport = container_port.split('/')[0]
        if host_ip:
            print(f'-p {host_ip}:{host_port}:{cport}')
        else:
            print(f'-p {host_port}:{cport}')
" 2>/dev/null)

log "Pool ports: $POOL_PORTS"

# ─── 4. Restart pool with E-08 env vars + revenue config mount ───────────────
log "Stopping zion-pool for restart with E-08 env vars..."
docker stop zion-pool && docker rm zion-pool
sleep 2

log "Starting zion-pool with ZION_HAS_GPU=1 + PERMINER_MIN_MINERS=2 + revenue config..."
docker run -d \
  --name zion-pool \
  --restart unless-stopped \
  --network zion-net \
  -p 3333:3333 \
  -p 8080:8080 \
  -v pool-testnet-data:/data/zion-pool \
  -v "$REVENUE_CFG:/config/ch3_revenue_settings.json:ro" \
  $POOL_ENVS \
  -e ZION_HAS_GPU=1 \
  -e ZION_SCHEDULER_PERMINER_MIN_MINERS=2 \
  --security-opt no-new-privileges:true \
  zion-pool:2.9.6-testnet

log "Pool container started. Waiting 15s for startup..."
sleep 15

# ─── 5. Verify pool is healthy ───────────────────────────────────────────────
if docker exec zion-pool curl -sf http://localhost:8080/stats > /dev/null 2>&1; then
  log "Pool health check: OK"
else
  log "WARNING: Pool health check failed or stats endpoint unavailable (may still be starting)"
fi

# ─── 6. Deploy XMR miner (MoneroOcean) ──────────────────────────────────────
log "Deploying XMR miner (MoneroOcean) — dero-miner service..."
cd /root/zion-bridge-build
COMPOSE_PROFILES=helsinki docker compose -p zion-revenue \
  -f docker/docker-compose.revenue.yml up -d dero-miner 2>&1 | tail -5 | while IFS= read -r line; do log "$line"; done

log "Waiting 20s for xmrig build/startup..."
sleep 20

# ─── 7. Verify revenue mining started ────────────────────────────────────────
if docker ps --format '{{.Names}}' | grep -q zion-dero-miner; then
  log "XMR miner container: RUNNING"
  docker logs zion-dero-miner --tail 5 2>&1 | while IFS= read -r line; do log "  xmrig: $line"; done
else
  log "WARNING: zion-dero-miner not running yet (may still be building xmrig ~10-15 min)"
fi

# ─── 8. Log E-07 canary start time ───────────────────────────────────────────
echo "E07_START=$START_UTC" >> "$AUDIT_LOG"
echo "E07_END_TARGET=$(date -u -d '+72 hours' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -v+72H -u +%Y-%m-%dT%H:%M:%SZ)" >> "$AUDIT_LOG"

# ─── 9. Final status report ──────────────────────────────────────────────────
log "=== DEPLOY COMPLETE ==="
log ""
log "--- Containers running ---"
docker ps --format "{{.Names}}: {{.Status}}" | while IFS= read -r line; do log "  $line"; done
log ""
log "--- Pool env vars (E-08 check) ---"
docker inspect zion-pool 2>/dev/null | grep -E 'ZION_HAS_GPU|PERMINER|REVENUE_CONFIG' | while IFS= read -r line; do log "  $line"; done
log ""
log "E-07 72h canary started at: $START_UTC"
log "Audit log: $AUDIT_LOG"
log "MoneroOcean dashboard: https://moneroocean.stream/#/dashboard?addr=42m86RBWf4PeuRf8P5rwA96XvmCKAfF77doWYJRv3KKAKrT8GTb5b3pbHTtaZsbJ4BERW1NHgh8WQgpAxAoEiXF82skcKsK"
