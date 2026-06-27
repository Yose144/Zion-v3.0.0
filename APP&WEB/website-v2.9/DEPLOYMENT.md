# ZION Web v3.7 — Deployment Guide

> Last verified production deploy: 27 June 2026 (v3.7.5-quantum-revolution)

## Current Production Status

- **Live URL:** https://zionterranova.com
- **Host:** Edge server (Hetzner VPS) — `77.42.71.94` / Tailscale: `mainnetedge`
- **Runtime:** Docker container `zion-website` (host network mode, port 3000)
- **Reverse proxy:** Caddy → `localhost:3000`
- **Source on server:** `/root/zion-2.9.6-main/APP&WEB/website-v2.9`
- **Compose file:** `/root/zion-web/docker-compose.yml`
- **Current image:** `zion-website:v3.7.5-quantum-revolution`

## Build Requirements

> **CRITICAL:** Next.js 16 defaults to Turbopack, which cannot resolve the local `zion-wallet-sdk` `.tgz` dependency. **Always use `--webpack` flag** for production builds:

```bash
npx next build --webpack
```

The `package-lock.json` references `file:/zion-wallet-sdk/zion-wallet-sdk-1.0.0.tgz` — this path only exists on the host after `npm install`, not inside Docker. Therefore the Docker image is built from **host-built artifacts** (`.next` + `node_modules` copied into `node:20-alpine`).

## Deployment Steps

### Method 1: Automated script

```bash
ssh root@mainnetedge
cd /root/zion-2.9.6-main
bash scripts/deploy-edge-web.sh <version-tag>
```

The script (`scripts/deploy-edge-web.sh`):
1. `git pull origin main`
2. `npm install` on host
3. `npm run build` on host (NOTE: script uses `npm run build` — may need `--webpack` flag if Turbopack fails)
4. Builds Docker image from host artifacts
5. Restarts container via docker compose
6. Reloads Caddy

### Method 2: Manual deploy (recommended for control)

```bash
# 1. SSH to Edge via Tailscale
ssh root@mainnetedge

# 2. Pull latest code
cd /root/zion-2.9.6-main
git pull origin main

# 3. Install deps + build with webpack
cd APP&WEB/website-v2.9
npm install
npx next build --webpack

# 4. Build Docker image from host artifacts
cd /root/zion-2.9.6-main
docker build -t zion-website:<version> -f - APP\&WEB/website-v2.9 <<'EOF'
FROM node:20-alpine
WORKDIR /app
COPY .next .next
COPY node_modules node_modules
COPY package.json package.json
COPY public public
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "node_modules/.bin/next", "start"]
EOF

# 5. Update compose file with new image tag
sed -i 's|zion-website:OLD_TAG|zion-website:NEW_TAG|' /root/zion-web/docker-compose.yml

# 6. Restart container
docker compose -f /root/zion-web/docker-compose.yml up -d

# 7. Verify
sleep 3
curl -s http://127.0.0.1:3000/api/health | jq
```

### Docker Compose File

`/root/zion-web/docker-compose.yml`:

```yaml
services:
  zion-website:
    image: zion-website:<version>
    container_name: zion-website
    restart: unless-stopped
    network_mode: host
    environment:
      - NODE_ENV=production
      - ZION_DAO_API_KEY=zion-dao-edge-key-2026
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

## Verification

```bash
# Health check
curl -s http://127.0.0.1:3000/api/health | jq

# Container status
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep zion-website

# Public URL
curl -I https://zionterranova.com/

# Specific page
curl -s https://zionterranova.com/quantum-revolution | head -5
```

## Rollback

```bash
# List available images
docker images | grep zion-website

# Update compose to previous tag
sed -i 's|zion-website:CURRENT|zion-website:PREVIOUS|' /root/zion-web/docker-compose.yml
docker compose -f /root/zion-web/docker-compose.yml up -d
```

## Dockerfiles

| File | Purpose |
|---|---|
| `Dockerfile` | Legacy — uses `COPY ../zion-wallet-sdk` (broken with normal build context) |
| `Dockerfile.production` | Self-contained — `npm ci` inside Docker (fails on `.tgz` path) |
| Inline Dockerfile | Used by `deploy-edge-web.sh` — copies host-built `.next` + `node_modules` |

The **inline Dockerfile** approach (copying host artifacts) is the only working method due to the local `.tgz` dependency issue.

## Connecting to Edge Server

### Via Tailscale (recommended)

```bash
ssh root@mainnetedge
```

Tailscale SSH authenticates via Tailscale identity — no SSH key needed.

### Via direct SSH (if Tailscale is down)

```bash
ssh -i ~/.ssh/ssh-key-zion-edge root@77.42.71.94
```

## Deployment History

| Date | Version | Changes |
|---|---|---|
| 2026-06-27 | v3.7.5-quantum-revolution | New /quantum-revolution page + gold StoryTriptych card |
| 2026-06-27 | v3.7.4-doge-fix | Fix Doge ATH timeline (7.5 years, not 2) |
| 2026-06-27 | v3.7.3-rainbow-theme | ZION rainbow-card theme across all 53 pages |
| 2026-06-26 | v3.7.2-doge-price-fork | Doge vs ZION $0.0002 seed price + 3.0.3 fork news |

---

**Version:** v3.7.5  
**Last updated:** 27 June 2026  
**Status:** ✅ Deployed and verified on Edge
