#!/usr/bin/env bash
set -e

SRC='/mnt/c/Users/yosef/Desktop/Zion/2.9.6-main/APP&WEB/website-v2.9'
REMOTE='root@62.171.141.136'
REMOTE_DIR='/root/zion-2.9.6-main/APP&WEB/website-v2.9'
SSH_KEY='/tmp/ssh-key-zion-edge'
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
TMP_REMOTE='/root/zion-web-sync'
NEW_TAG='zion-website:v3.5.1'

echo "=== Prepare tmp sync dir on Edge ==="
ssh $SSH_OPTS "$REMOTE" "rm -rf $TMP_REMOTE && mkdir -p $TMP_REMOTE"

echo "=== Rsync source to Edge tmp dir ==="
cd "$SRC"
rsync -avz --delete \
  --exclude=node_modules \
  --exclude='.next' \
  --exclude=out \
  --exclude='*.tar.gz' \
  --exclude=.env.local \
  -e "ssh $SSH_OPTS" \
  ./ "${REMOTE}:${TMP_REMOTE}/"

echo "=== Move synced files into final location ==="
ssh $SSH_OPTS "$REMOTE" "rm -rf '${REMOTE_DIR}' && mkdir -p '${REMOTE_DIR}' && cp -a ${TMP_REMOTE}/. '${REMOTE_DIR}/' && rm -rf ${TMP_REMOTE}"

echo "=== npm install on Edge host ==="
ssh $SSH_OPTS "$REMOTE" "cd '${REMOTE_DIR}' && npm install"

echo "=== Build with webpack (not Turbopack) on Edge host ==="
ssh $SSH_OPTS "$REMOTE" "cd '${REMOTE_DIR}' && npx next build --webpack"

echo "=== Create artifacts Dockerfile ==="
ssh $SSH_OPTS "$REMOTE" "cat > /tmp/Dockerfile.zion-artifacts << 'EOF'
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --chown=nextjs:nodejs . .
USER nextjs
EXPOSE 3000
CMD [\"node\", \"node_modules/next/dist/bin/next\", \"start\"]
EOF"

echo "=== Build Docker image from host artifacts ==="
ssh $SSH_OPTS "$REMOTE" "cd '${REMOTE_DIR}' && docker build -f /tmp/Dockerfile.zion-artifacts -t ${NEW_TAG} ."

echo "=== Update compose file to new tag and recreate ==="
ssh $SSH_OPTS "$REMOTE" "sed -i 's|zion-website:v[0-9.]*|${NEW_TAG}|' /root/zion-web/docker-compose.yml && cd /root/zion-web && docker compose up -d --force-recreate"

echo "=== Health check ==="
ssh $SSH_OPTS "$REMOTE" 'for i in $(seq 1 12); do STATUS=$(docker inspect --format="{{.State.Health.Status}}" zion-website 2>/dev/null || echo missing); if [ "$STATUS" = "healthy" ]; then echo "Container healthy after ~$((i*5))s"; exit 0; fi; sleep 5; done; echo "Warning: not healthy after 60s (status: $STATUS)"; docker logs --tail 20 zion-website; exit 1'

echo "=== Deploy complete ==="
